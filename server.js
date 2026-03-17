const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SHOP_BASE = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl';
const USED_URL = `${SHOP_BASE}/fietsen/?cat=1`;
const NEW_URL = `${SHOP_BASE}/fietsen/?cat=2`;
const CACHE_MS = 10 * 60 * 1000;

let cache = {
  all: null,
  used: null,
  fresh: null,
  fetchedAt: 0
};

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function getBikeIdFromUrl(url) {
  try {
    const u = new URL(url, SHOP_BASE);
    return u.searchParams.get('b');
  } catch (_) {
    return null;
  }
}

function buildRawDetailUrl(bikeId) {
  return `${SHOP_BASE}/fietsen/detail/?b=${bikeId}`;
}

function buildImageUrl(bikeId) {
  return `${SHOP_BASE}/fietsen/detail/images/?b=${bikeId}&css=/css/default.css`;
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 25000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });

  return Buffer.from(response.data).toString('utf8');
}

async function fetchListBikeIds(listUrl) {
  const html = await fetchHtml(listUrl);
  const $ = cheerio.load(html);
  const ids = new Set();

  $('a[href*="/fietsen/detail/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const bikeId = getBikeIdFromUrl(href);
    if (bikeId) ids.add(bikeId);
  });

  return [...ids];
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? cleanText(match[1] || match[0]) : '';
}

function parseDetailPage(html, bikeId, state) {
  const $ = cheerio.load(html);
  const rootText = cleanText($.root().text());
  const title = cleanText($('h1, h2, h3').first().text()) || 'Onbekende fiets';

  const soort = firstMatch(rootText, /Soort:\s*(.*?)\s*(?:Kleur:|Maat:|Wielmaat:|Modeljaar:|Bijzonderheden:|Art\. nummer:|Garantie:|Prijs:|Status:|Terug)/i);
  const kleur = firstMatch(rootText, /Kleur:\s*(.*?)\s*(?:Maat:|Wielmaat:|Modeljaar:|Bijzonderheden:|Art\. nummer:|Garantie:|Prijs:|Status:|Terug)/i);
  const maat = firstMatch(rootText, /Maat:\s*(.*?)\s*(?:Wielmaat:|Modeljaar:|Bijzonderheden:|Art\. nummer:|Garantie:|Prijs:|Status:|Terug)/i);
  const wielmaat = firstMatch(rootText, /Wielmaat:\s*(.*?)\s*(?:Modeljaar:|Bijzonderheden:|Art\. nummer:|Garantie:|Prijs:|Status:|Terug)/i);
  const modeljaar = firstMatch(rootText, /Modeljaar:\s*(.*?)\s*(?:Bijzonderheden:|Art\. nummer:|Garantie:|Prijs:|Status:|Terug)/i);
  const bijzonderheden = firstMatch(rootText, /Bijzonderheden:\s*(.*?)\s*(?:Art\. nummer:|Garantie:|Prijs:|Status:|Terug)/i);
  const artikelnummer = firstMatch(rootText, /Art\. nummer:\s*(.*?)\s*(?:Garantie:|Prijs:|Status:|Terug)/i);
  const garantie = firstMatch(rootText, /Garantie:\s*(.*?)\s*(?:Prijs:|Status:|Terug)/i);
  const status = firstMatch(rootText, /Status:\s*(.*?)\s*(?:Terug|$)/i);

  let price = '';
  const prijsBlock = rootText.match(/Prijs:\s*(€\s?[\d\.,]+(?:,-)?)/i);
  const euroAny = rootText.match(/(€\s?[\d\.,]+(?:,-)?)/i);
  if (prijsBlock) price = cleanText(prijsBlock[1]);
  else if (euroAny) price = cleanText(euroAny[1]);
  if (!price) price = 'Prijs op aanvraag';

  const specs = [maat, kleur, wielmaat, modeljaar].filter(Boolean);

  return {
    id: bikeId,
    title,
    state,
    stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
    price,
    image: buildImageUrl(bikeId),
    url: `/fiets/${bikeId}`,
    detailUrl: buildRawDetailUrl(bikeId),
    soort,
    kleur,
    maat,
    wielmaat,
    modeljaar,
    bijzonderheden,
    artikelnummer,
    garantie,
    status,
    specs
  };
}

async function fetchBikeDetails(bikeId, state) {
  const html = await fetchHtml(buildRawDetailUrl(bikeId));
  return parseDetailPage(html, bikeId, state);
}

async function fetchCategory(listUrl, state) {
  const ids = await fetchListBikeIds(listUrl);
  const results = await Promise.allSettled(ids.map((id) => fetchBikeDetails(id, state)));
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}

async function getAllFietsen(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache.all && now - cache.fetchedAt < CACHE_MS) {
    return cache;
  }

  const [used, fresh] = await Promise.all([
    fetchCategory(USED_URL, 'used'),
    fetchCategory(NEW_URL, 'new')
  ]);

  cache = {
    used,
    fresh,
    all: [...used, ...fresh],
    fetchedAt: now
  };

  return cache;
}

function renderDetailPage(fiets) {
  const title = escapeHtml(fiets.title);
  const price = escapeHtml(fiets.price);
  const stateLabel = escapeHtml(fiets.stateLabel);
  const image = escapeHtml(fiets.image);
  const detailUrl = escapeHtml(fiets.detailUrl);
  const rows = [
    ['Soort', fiets.soort],
    ['Kleur', fiets.kleur],
    ['Maat', fiets.maat],
    ['Wielmaat', fiets.wielmaat],
    ['Modeljaar', fiets.modeljaar],
    ['Bijzonderheden', fiets.bijzonderheden],
    ['Art. nummer', fiets.artikelnummer],
    ['Garantie', fiets.garantie],
    ['Status', fiets.status]
  ].filter(([, v]) => v);

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Bus vol Bikes</title>
  <style>
    :root { --bg:#f7f8fb; --card:#fff; --text:#0f172a; --muted:#64748b; --line:#e2e8f0; --brand:#0f766e; --dark:#0b1739; }
    *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,Arial,sans-serif;background:var(--bg);color:var(--text)}
    .wrap{max-width:1120px;margin:0 auto;padding:20px 16px 96px}
    .back{display:inline-flex;align-items:center;gap:8px;margin:8px 0 18px;color:var(--dark);text-decoration:none;font-weight:700}
    .grid{display:grid;grid-template-columns:1.05fr .95fr;gap:28px}
    .imageCard,.infoCard{background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:0 10px 30px rgba(15,23,42,.05)}
    .imageCard{padding:16px}.imageBox{background:#f2f5f8;border-radius:16px;min-height:340px;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .imageBox img{width:100%;max-height:560px;object-fit:contain;display:block}
    .infoCard{padding:24px}.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#e8f5f1;color:#21825f;font-weight:800;font-size:13px}
    h1{font-size:clamp(28px,4vw,42px);line-height:1.1;margin:14px 0 10px}.price{font-size:clamp(34px,5vw,52px);font-weight:900;color:var(--brand);margin:18px 0 20px}
    .table{display:grid;gap:10px;margin:18px 0}.row{display:grid;grid-template-columns:140px 1fr;gap:12px;padding:12px 0;border-top:1px solid var(--line)}
    .row:first-child{border-top:0}.label{color:var(--muted);font-weight:700}.value{font-weight:600}
    .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border-radius:14px;text-decoration:none;font-weight:800}
    .btn-primary{background:var(--dark);color:#fff}.btn-secondary{background:#eef2f7;color:var(--dark)}
    .note{margin-top:12px;color:var(--muted);font-size:14px}
    @media (max-width: 780px){ .grid{grid-template-columns:1fr;gap:18px}.wrap{padding-bottom:116px}.imageBox{min-height:220px}.row{grid-template-columns:1fr}.actions{position:sticky;bottom:0;background:linear-gradient(180deg,rgba(247,248,251,0),var(--bg) 24%,var(--bg));padding-top:14px} .actions .btn{flex:1} }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="back" href="/voorraad">← Terug naar voorraad</a>
    <div class="grid">
      <section class="imageCard">
        <div class="imageBox"><img src="${image}" alt="${title}"></div>
      </section>
      <section class="infoCard">
        <span class="badge">${stateLabel}</span>
        <h1>${title}</h1>
        <div class="price">${price}</div>
        <div class="table">
          ${rows.map(([label, value]) => `<div class="row"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join('')}
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="${detailUrl}" target="_blank" rel="noopener noreferrer">Open originele pagina</a>
          <a class="btn btn-secondary" href="/voorraad">Terug</a>
        </div>
        <div class="note">Deze pagina is mobielvriendelijk gemaakt op basis van de Fietsenwijk detailinformatie.</div>
      </section>
    </div>
  </div>
</body>
</html>`;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/fietsen', async (req, res) => {
  try {
    const data = await getAllFietsen(req.query.refresh === '1');
    res.json({
      success: true,
      count: data.all.length,
      fietsen: data.all,
      laatsteUpdate: new Date(data.fetchedAt).toISOString(),
      source: { used: USED_URL, new: NEW_URL }
    });
  } catch (error) {
    console.error('Fietsen fout:', error.message);
    res.status(500).json({
      success: false,
      count: 0,
      fietsen: [],
      error: error.message,
      laatsteUpdate: new Date().toISOString(),
      source: { used: USED_URL, new: NEW_URL }
    });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  try {
    const data = await getAllFietsen(req.query.refresh === '1');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<fietsen laatsteUpdate="${escapeXml(new Date(data.fetchedAt).toISOString())}">\n${data.all.map((f) => `  <fiets>\n    <id>${escapeXml(f.id)}</id>\n    <titel>${escapeXml(f.title)}</titel>\n    <status>${escapeXml(f.state)}</status>\n    <statusLabel>${escapeXml(f.stateLabel)}</statusLabel>\n    <prijs>${escapeXml(f.price)}</prijs>\n    <image>${escapeXml(f.image)}</image>\n    <url>${escapeXml(f.url)}</url>\n    <detailUrl>${escapeXml(f.detailUrl)}</detailUrl>\n    <soort>${escapeXml(f.soort)}</soort>\n    <kleur>${escapeXml(f.kleur)}</kleur>\n    <maat>${escapeXml(f.maat)}</maat>\n    <wielmaat>${escapeXml(f.wielmaat)}</wielmaat>\n    <modeljaar>${escapeXml(f.modeljaar)}</modeljaar>\n  </fiets>`).join('\n')}\n</fietsen>`;
    res.type('application/xml').send(xml);
  } catch (error) {
    res.status(500).type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(error.message)}</error>`);
  }
});

app.get('/fiets/:id', async (req, res) => {
  try {
    const bikeId = req.params.id;
    const html = await fetchHtml(buildRawDetailUrl(bikeId));
    const fiets = parseDetailPage(html, bikeId, 'used');
    res.send(renderDetailPage(fiets));
  } catch (error) {
    res.status(500).send(`<!doctype html><html><body style="font-family:Arial;padding:24px">Kon fiets niet laden: ${escapeHtml(error.message)}</body></html>`);
  }
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript').send(`
(function(){
  var API_BASE = window.BVB_API_BASE || window.location.origin;
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');}
  function render(container,fietsen){
    if(!fietsen.length){container.innerHTML='Geen fietsen gevonden';return;}
    container.innerHTML='<style>.bvb-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}.bvb-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 8px 28px rgba(15,23,42,.05)}.bvb-img{height:230px;background:#f5f7fa;display:flex;align-items:center;justify-content:center}.bvb-img img{width:100%;height:100%;object-fit:contain}.bvb-body{padding:18px}.bvb-badge{display:inline-block;margin-bottom:10px;padding:6px 11px;border-radius:999px;background:#e8f5f1;color:#21825f;font-size:12px;font-weight:800}.bvb-title{font:800 18px/1.25 system-ui;margin:0 0 10px;color:#0f172a}.bvb-specs{color:#64748b;font:600 14px/1.4 system-ui;min-height:20px}.bvb-bottom{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:18px}.bvb-price{font:900 20px/1.1 system-ui;color:#0f766e}.bvb-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:14px;background:#0b1739;color:#fff;text-decoration:none;font:800 14px system-ui}@media(max-width:640px){.bvb-img{height:190px}.bvb-bottom{flex-direction:column;align-items:stretch}.bvb-btn{text-align:center}}</style><div class="bvb-grid">'+fietsen.map(function(f){return '<article class="bvb-card"><div class="bvb-img"><img src="'+esc(f.image)+'" alt="'+esc(f.title)+'"></div><div class="bvb-body"><div class="bvb-badge">'+esc(f.stateLabel)+'</div><h3 class="bvb-title">'+esc(f.title)+'</h3><div class="bvb-specs">'+esc([f.maat,f.kleur,f.modeljaar].filter(Boolean).join(' • '))+'</div><div class="bvb-bottom"><div class="bvb-price">'+esc(f.price)+'</div><a class="bvb-btn" href="'+esc(API_BASE + f.url)+'">Bekijken</a></div></div></article>';}).join('')+'</div>';
  }
  function initOne(container){
    var type = container.getAttribute('data-type') || 'all';
    container.innerHTML = 'Fietsen laden...';
    fetch(API_BASE + '/api/fietsen').then(function(r){return r.json();}).then(function(data){
      var fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
      if(type !== 'all'){fietsen = fietsen.filter(function(f){return f.state === type;});}
      render(container,fietsen);
    }).catch(function(){container.innerHTML='Fietsen konden niet worden geladen';});
  }
  var byId=document.getElementById('bvb-voorraad'); if(byId) initOne(byId);
  var list=document.querySelectorAll('.busvolbikes-voorraad'); list.forEach(initOne);
})();`);
});

app.get('/voorraad', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voorraad.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Bus vol Bikes server running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
});
