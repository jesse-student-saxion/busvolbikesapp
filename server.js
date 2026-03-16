const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SHOP_BASE = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl';
const LIST_USED_URL = `${SHOP_BASE}/fietsen/?cat=1`;
const LIST_NEW_URL = `${SHOP_BASE}/fietsen/?cat=2`;
const DETAIL_PATH = '/fietsen/detail/';
const IMAGE_PATH = '/fietsen/detail/images/';
const CACHE_TTL_MS = 10 * 60 * 1000;

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

const cache = {
  inventory: { expires: 0, data: null },
  detail: new Map()
};

function fetchPageBuffer(url) {
  return axios.get(url, {
    timeout: 30000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
}

function decodeHtml(buffer) {
  return Buffer.from(buffer).toString('latin1');
}

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getBikeId(detailUrl) {
  try {
    const u = new URL(detailUrl, SHOP_BASE);
    return u.searchParams.get('b') || '';
  } catch {
    return '';
  }
}

function buildDetailUrl(bikeId) {
  return `${SHOP_BASE}${DETAIL_PATH}?b=${encodeURIComponent(bikeId)}`;
}

function buildImageUrl(bikeId) {
  return `${SHOP_BASE}${IMAGE_PATH}?b=${encodeURIComponent(bikeId)}&css=/css/default.css`;
}

function findPriceInText(text) {
  const normalized = cleanText(text);
  const labelMatch = normalized.match(/Prijs\s*:?[\s€]*?(€\s?[\d\.,]+(?:,-)?)/i);
  if (labelMatch) return cleanText(labelMatch[1]);
  const genericMatches = normalized.match(/€\s?[\d\.,]+(?:,-)?/gi);
  return genericMatches && genericMatches.length ? cleanText(genericMatches[0]) : '';
}

function normalizeTitle(title) {
  return cleanText(title)
    .replace(/^Meer informatie\.*$/i, '')
    .replace(/^Bekijk\s*/i, '')
    .trim();
}

function htmlToLines(html) {
  const marked = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|table|ul|ol|li|h1|h2|h3|h4|td|th|b|strong)\s*>/gi, '$&\n')
    .replace(/<\s*(p|div|tr|table|ul|ol|li|h1|h2|h3|h4|td|th|b|strong)[^>]*>/gi, '\n$&');

  const text = cheerio.load(marked).text();
  return text
    .split(/\n+/)
    .map(cleanText)
    .filter(Boolean);
}

function extractFieldsFromLines(lines) {
  const labels = ['Soort', 'Kleur', 'Maat', 'Wielmaat', 'Modeljaar', 'Bijzonderheden', 'Art. nummer', 'Garantie', 'Prijs', 'Status'];
  const fields = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/:$/, '');
    if (labels.includes(line)) {
      let value = '';
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j].replace(/:$/, '');
        if (labels.includes(next)) break;
        if (!value) value = lines[j];
        else value += ' ' + lines[j];
        if (value.length > 220) break;
        j += 1;
      }
      if (value) fields[line] = cleanText(value);
    }
  }
  return fields;
}

function parseListPage(html, state) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  $('a[href*="/fietsen/detail/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const detailUrl = new URL(href, SHOP_BASE).href;
    const bikeId = getBikeId(detailUrl);
    if (!bikeId || seen.has(bikeId)) return;

    const card = $(el).closest('article, li, .item, .card, .fiets, .bike, .product, div');
    const cardText = cleanText(card.text());

    let title = normalizeTitle(card.find('h1,h2,h3,h4,strong').first().text());
    if (!title) {
      const candidates = card.find('h1,h2,h3,h4,strong,a').map((i, node) => normalizeTitle($(node).text())).get();
      title = candidates.find((t) => t && !/^Meer informatie/i.test(t) && !/^Bekijk/i.test(t)) || '';
    }
    if (!title) return;

    const sizeMatch = cardText.match(/\b\d{2}\s?cm\b/i);
    const price = findPriceInText(cardText);

    seen.add(bikeId);
    items.push({
      id: bikeId,
      title,
      state,
      stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
      price: price || 'Prijs op aanvraag',
      image: buildImageUrl(bikeId),
      detailUrl,
      specs: [sizeMatch ? cleanText(sizeMatch[0]) : ''].filter(Boolean)
    });
  });

  return items;
}

function parseDetailPage(html, bikeId) {
  const $ = cheerio.load(html);
  const lines = htmlToLines(html);
  const fields = extractFieldsFromLines(lines);
  const title = normalizeTitle($('h1,h2,b').first().text()) || lines[0] || `Fiets ${bikeId}`;

  const htmlPriceMatch = html.match(/Prijs\s*:?[^€]{0,120}(€\s?[\d\.,]+(?:,-)?)/i);
  const linePrice = fields.Prijs ? findPriceInText(fields.Prijs) || cleanText(fields.Prijs) : '';
  const fallbackPrice = findPriceInText(lines.join(' '));
  const price = cleanText((htmlPriceMatch && htmlPriceMatch[1]) || linePrice || fallbackPrice || 'Prijs op aanvraag');

  return {
    id: bikeId,
    title,
    price,
    image: buildImageUrl(bikeId),
    fields,
    status: fields.Status || '',
    type: fields.Soort || '',
    color: fields.Kleur || '',
    size: fields.Maat || '',
    wheelSize: fields.Wielmaat || '',
    modelYear: fields.Modeljaar || '',
    articleNumber: fields['Art. nummer'] || '',
    warranty: fields.Garantie || '',
    detailsText: fields.Bijzonderheden || ''
  };
}

async function fetchDetail(bikeId) {
  const cached = cache.detail.get(bikeId);
  if (cached && cached.expires > Date.now()) return cached.data;

  const response = await fetchPageBuffer(buildDetailUrl(bikeId));
  const html = decodeHtml(response.data);
  const detail = parseDetailPage(html, bikeId);
  cache.detail.set(bikeId, { expires: Date.now() + CACHE_TTL_MS, data: detail });
  return detail;
}

async function fetchInventory(force = false) {
  if (!force && cache.inventory.data && cache.inventory.expires > Date.now()) {
    return cache.inventory.data;
  }

  const [usedRes, newRes] = await Promise.all([
    fetchPageBuffer(LIST_USED_URL),
    fetchPageBuffer(LIST_NEW_URL)
  ]);

  const used = parseListPage(decodeHtml(usedRes.data), 'used');
  const fresh = parseListPage(decodeHtml(newRes.data), 'new');
  const merged = [...used, ...fresh];

  const enriched = [];
  for (const item of merged) {
    try {
      const detail = await fetchDetail(item.id);
      enriched.push({
        ...item,
        title: detail.title || item.title,
        price: detail.price && detail.price !== 'Prijs op aanvraag' ? detail.price : item.price,
        image: buildImageUrl(item.id),
        specs: [detail.size || item.specs[0] || '', detail.color || '', detail.modelYear || ''].filter(Boolean),
        detail: {
          ...detail,
          state: item.state,
          stateLabel: item.stateLabel
        },
        url: `/fiets/${item.id}`,
        externalUrl: item.detailUrl
      });
    } catch (err) {
      enriched.push({
        ...item,
        image: buildImageUrl(item.id),
        url: `/fiets/${item.id}`,
        externalUrl: item.detailUrl,
        detail: null
      });
    }
  }

  const data = {
    success: true,
    count: enriched.length,
    fietsen: enriched,
    laatsteUpdate: new Date().toISOString(),
    source: { used: LIST_USED_URL, new: LIST_NEW_URL }
  };

  cache.inventory = { expires: Date.now() + CACHE_TTL_MS, data };
  return data;
}

function renderDetailPage(item) {
  const d = item.detail || {};
  const rows = [
    ['Soort', d.type],
    ['Kleur', d.color],
    ['Maat', d.size],
    ['Wielmaat', d.wheelSize],
    ['Modeljaar', d.modelYear],
    ['Garantie', d.warranty],
    ['Status', d.status],
    ['Art. nummer', d.articleNumber],
    ['Bijzonderheden', d.detailsText]
  ].filter((row) => row[1]);

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(item.title)} | Bus vol Bikes</title>
  <style>
    :root {
      --bg: #f3f7fb;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #0f766e;
      --accent-dark: #0b132b;
      --line: #e2e8f0;
      --shadow: 0 12px 30px rgba(15, 23, 42, 0.10);
      --radius: 24px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: linear-gradient(180deg, #edf4f8, var(--bg) 22rem); color: var(--text); }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 16px; }
    .back { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--accent-dark); font-weight: 800; margin: 6px 0 18px; }
    .hero { display: grid; grid-template-columns: minmax(0,1fr) minmax(320px,460px); gap: 0; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
    .media { background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 380px; padding: 28px; }
    .media img { width: 100%; max-height: 440px; object-fit: contain; display: block; }
    .content { padding: 28px; display: flex; flex-direction: column; }
    .badge { display: inline-flex; width: fit-content; padding: 8px 14px; border-radius: 999px; background: #e7f8f0; color: #177245; font-weight: 800; margin-bottom: 12px; }
    h1 { margin: 0; font-size: clamp(28px, 4vw, 42px); line-height: 1.08; }
    .sub { margin: 10px 0 0; color: var(--muted); font-size: 17px; }
    .price { font-size: clamp(34px, 5vw, 54px); font-weight: 900; color: var(--accent); margin: 18px 0 8px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; margin: 18px 0 22px; }
    .meta { background: #f8fafc; border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; }
    .meta small { display: block; color: var(--muted); font-size: 13px; margin-bottom: 6px; }
    .meta strong { display: block; font-size: 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: auto; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 14px 18px; border-radius: 14px; text-decoration: none; font-weight: 800; min-height: 50px; }
    .btn-primary { background: var(--accent-dark); color: #fff; }
    .btn-secondary { background: #fff; color: var(--accent-dark); border: 1px solid var(--line); }
    .details { margin-top: 24px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 22px; }
    .details h2 { margin: 0 0 16px; font-size: 24px; }
    .table { display: grid; gap: 8px; }
    .row { display: grid; grid-template-columns: 180px 1fr; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--line); }
    .row:last-child { border-bottom: 0; }
    .label { color: var(--muted); font-weight: 700; }
    .value { font-weight: 600; }
    .sticky-bar { display: none; }
    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
      .content { padding: 20px; }
      .media { min-height: 280px; padding: 20px; }
      .meta-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; gap: 6px; }
      .actions { display: none; }
      .sticky-bar { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 12px; margin-top: 14px; background: rgba(255,255,255,.96); backdrop-filter: blur(10px); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
      .sticky-bar .btn { flex: 1; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="back" href="/voorraad">← Terug naar voorraad</a>
    <section class="hero">
      <div class="media"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}"></div>
      <div class="content">
        <span class="badge">${escapeHtml(item.stateLabel)}</span>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="sub">${escapeHtml(d.type || 'Bus vol Bikes')}</p>
        <div class="price">${escapeHtml(item.price)}</div>
        <div class="meta-grid">
          ${rows.slice(0, 6).map(([label, value]) => `<div class="meta"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="${escapeHtml(item.externalUrl)}" target="_blank" rel="noopener noreferrer">Originele pagina</a>
          <a class="btn btn-secondary" href="/voorraad">Terug naar overzicht</a>
        </div>
      </div>
    </section>
    <section class="details">
      <h2>Specificaties</h2>
      <div class="table">
        ${rows.map(([label, value]) => `<div class="row"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join('')}
      </div>
    </section>
    <div class="sticky-bar">
      <a class="btn btn-primary" href="${escapeHtml(item.externalUrl)}" target="_blank" rel="noopener noreferrer">Originele pagina</a>
      <a class="btn btn-secondary" href="/voorraad">Terug</a>
    </div>
  </div>
</body>
</html>`;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/fietsen', async (req, res) => {
  try {
    const inventory = await fetchInventory(req.query.refresh === '1');
    const type = String(req.query.type || 'all').toLowerCase();
    let fietsen = inventory.fietsen;
    if (type === 'used' || type === 'new') {
      fietsen = fietsen.filter((fiets) => fiets.state === type);
    }
    res.json({ ...inventory, count: fietsen.length, fietsen });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, fietsen: [] });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  try {
    const inventory = await fetchInventory(req.query.refresh === '1');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<fietsen laatsteUpdate="${escapeXml(inventory.laatsteUpdate)}">\n${inventory.fietsen.map((fiets) => `  <fiets id="${escapeXml(fiets.id)}">\n    <titel>${escapeXml(fiets.title)}</titel>\n    <status>${escapeXml(fiets.state)}</status>\n    <statusLabel>${escapeXml(fiets.stateLabel)}</statusLabel>\n    <prijs>${escapeXml(fiets.price)}</prijs>\n    <afbeelding>${escapeXml(fiets.image)}</afbeelding>\n    <url>${escapeXml(fiets.url)}</url>\n    <extern>${escapeXml(fiets.externalUrl)}</extern>\n  </fiets>`).join('\n')}\n</fietsen>`;
    res.type('application/xml').send(xml);
  } catch (err) {
    res.status(500).type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(err.message)}</error>`);
  }
});

app.get('/embed.js', (_req, res) => {
  res.type('application/javascript').send(`
(function(){
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  var base=(window.BVB_API_BASE||window.location.origin).replace(/\/$/,'');
  function renderOne(container,data){
    var fietsen=Array.isArray(data.fietsen)?data.fietsen:[];
    if(container.dataset.type){fietsen=fietsen.filter(function(f){return f.state===container.dataset.type;});}
    if(!fietsen.length){container.innerHTML='Geen fietsen gevonden';return;}
    container.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px">'+fietsen.map(function(f){
      return '<article style="background:#fff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;box-shadow:0 10px 25px rgba(15,23,42,.08)">'+
        '<div style="height:220px;background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:16px"><img src="'+esc(f.image)+'" alt="'+esc(f.title)+'" style="width:100%;height:100%;object-fit:contain;display:block"></div>'+
        '<div style="padding:18px">'+
        '<div style="display:inline-flex;padding:7px 12px;border-radius:999px;background:#e7f8f0;color:#177245;font-weight:700;font-size:13px;margin-bottom:12px">'+esc(f.stateLabel)+'</div>'+
        '<h3 style="margin:0 0 8px;font:800 20px/1.2 system-ui,sans-serif;color:#0f172a">'+esc(f.title)+'</h3>'+
        '<div style="color:#64748b;margin-bottom:12px;min-height:20px">'+esc((f.specs||[]).join(' • '))+'</div>'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
        '<div style="font:800 22px/1.2 system-ui,sans-serif;color:#0f766e">'+esc(f.price)+'</div>'+
        '<a href="'+esc(base+f.url)+'" style="display:inline-flex;white-space:nowrap;padding:12px 16px;border-radius:14px;background:#0b132b;color:#fff;text-decoration:none;font-weight:800">Bekijk</a>'+
        '</div></div></article>';
    }).join('')+'</div>';
  }
  function load(el){el.innerHTML='Fietsen laden...';fetch(base+'/api/fietsen').then(function(r){return r.json()}).then(function(data){renderOne(el,data)}).catch(function(){el.innerHTML='Fietsen konden niet worden geladen';});}
  var byId=document.getElementById('bvb-voorraad'); if(byId) load(byId);
  document.querySelectorAll('.busvolbikes-voorraad').forEach(load);
})();
  `);
});

app.get('/fiets/:id', async (req, res) => {
  try {
    const inventory = await fetchInventory(false);
    const item = inventory.fietsen.find((fiets) => fiets.id === req.params.id);
    if (!item) return res.status(404).send('Fiets niet gevonden');
    if (!item.detail) item.detail = await fetchDetail(item.id);
    res.send(renderDetailPage(item));
  } catch (err) {
    res.status(500).send('Fiets kon niet worden geladen');
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Bus vol Bikes server running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
});
