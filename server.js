const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl';
const USED_URL = `${BASE}/fietsen/?cat=1`;
const NEW_URL = `${BASE}/fietsen/?cat=2`;
const CACHE_TTL_MS = 10 * 60 * 1000;

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

let fietsenCache = {
  timestamp: 0,
  data: null
};

function cleanText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlBuffer(buf) {
  let html = Buffer.from(buf).toString('utf8');
  if (html.includes('�')) {
    html = Buffer.from(buf).toString('latin1');
  }
  return html;
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

  return decodeHtmlBuffer(response.data);
}

function getBikeId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('b');
  } catch {
    return null;
  }
}

function buildDetailUrl(bikeId) {
  return `${BASE}/fietsen/detail/?b=${bikeId}`;
}

function buildImageUrl(bikeId) {
  return `${BASE}/fietsen/detail/images/?b=${bikeId}&css=/css/default.css`;
}

async function fetchListBikeIds(listUrl) {
  const html = await fetchHtml(listUrl);
  const $ = cheerio.load(html);
  const ids = new Set();

  $('a[href*="/fietsen/detail/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const fullUrl = new URL(href, BASE).href;
    const bikeId = getBikeId(fullUrl);
    if (bikeId) ids.add(bikeId);
  });

  return [...ids];
}

function extractLineValue(pageText, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*:\\s*([^\\n\\r]+)`, 'i');
  const match = pageText.match(regex);
  return match ? cleanText(match[1]) : '';
}

function parseDetailPage(html, bikeId, state) {
  const $ = cheerio.load(html);
  const pageText = cleanText($('body').text().replace(/\s{2,}/g, ' '));

  let title =
    cleanText($('h1').first().text()) ||
    cleanText($('h2').first().text()) ||
    '';

  if (!title || /terug/i.test(title)) {
    const titleMatch = pageText.match(/^([A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ \-+\/().']{3,120})\s+Soort:/);
    if (titleMatch) title = cleanText(titleMatch[1]);
  }

  const priceMatch =
    pageText.match(/Prijs\s*:\s*€\s?[\d\.\,]+(?:,-)?/i) ||
    pageText.match(/€\s?[\d\.\,]+(?:,-)?/i);

  const soort = extractLineValue(pageText, 'Soort');
  const kleur = extractLineValue(pageText, 'Kleur');
  const maat = extractLineValue(pageText, 'Maat');
  const wielmaat = extractLineValue(pageText, 'Wielmaat');
  const modeljaar = extractLineValue(pageText, 'Modeljaar');
  const status = extractLineValue(pageText, 'Status');
  const garantie = extractLineValue(pageText, 'Garantie');
  const artNummer = extractLineValue(pageText, 'Art. nummer');

  return {
    id: bikeId,
    title: title || 'Onbekende fiets',
    state,
    stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
    price: priceMatch ? cleanText(priceMatch[0].replace(/Prijs\s*:\s*/i, '')) : 'Prijs op aanvraag',
    image: buildImageUrl(bikeId),
    url: `/fiets/${bikeId}`,
    detailUrl: buildDetailUrl(bikeId),
    soort,
    kleur,
    maat,
    wielmaat,
    modeljaar,
    status,
    garantie,
    artNummer,
    specs: [maat, kleur, wielmaat, modeljaar, status].filter(Boolean)
  };
}

async function fetchBikeDetails(bikeId, state) {
  const html = await fetchHtml(buildDetailUrl(bikeId));
  return parseDetailPage(html, bikeId, state);
}

async function fetchCategory(listUrl, state) {
  const ids = await fetchListBikeIds(listUrl);
  const results = await Promise.allSettled(ids.map((id) => fetchBikeDetails(id, state)));
  return results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}

async function getFietsen(forceRefresh = false) {
  const freshEnough = fietsenCache.data && (Date.now() - fietsenCache.timestamp < CACHE_TTL_MS);
  if (!forceRefresh && freshEnough) return fietsenCache.data;

  const [used, fresh] = await Promise.all([
    fetchCategory(USED_URL, 'used'),
    fetchCategory(NEW_URL, 'new')
  ]);

  const all = [...used, ...fresh];
  fietsenCache = {
    timestamp: Date.now(),
    data: all
  };
  return all;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.get('/api/fietsen', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const fietsen = await getFietsen(forceRefresh);

    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      laatsteUpdate: new Date().toISOString(),
      source: {
        used: USED_URL,
        new: NEW_URL
      }
    });
  } catch (error) {
    console.error('Fietsen fout:', error.message);
    res.status(500).json({
      success: false,
      count: 0,
      fietsen: [],
      error: error.message,
      laatsteUpdate: new Date().toISOString(),
      source: {
        used: USED_URL,
        new: NEW_URL
      }
    });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const fietsen = await getFietsen(forceRefresh);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fietsen>
${fietsen.map(f => `  <fiets>
    <id>${escapeXml(f.id)}</id>
    <titel>${escapeXml(f.title)}</titel>
    <status>${escapeXml(f.state)}</status>
    <statusLabel>${escapeXml(f.stateLabel)}</statusLabel>
    <prijs>${escapeXml(f.price)}</prijs>
    <afbeelding>${escapeXml(f.image)}</afbeelding>
    <detailUrl>${escapeXml(f.detailUrl)}</detailUrl>
    <url>${escapeXml(f.url)}</url>
    <soort>${escapeXml(f.soort)}</soort>
    <kleur>${escapeXml(f.kleur)}</kleur>
    <maat>${escapeXml(f.maat)}</maat>
    <wielmaat>${escapeXml(f.wielmaat)}</wielmaat>
    <modeljaar>${escapeXml(f.modeljaar)}</modeljaar>
    <garantie>${escapeXml(f.garantie)}</garantie>
    <artNummer>${escapeXml(f.artNummer)}</artNummer>
    <specs>${escapeXml((f.specs || []).join(' | '))}</specs>
  </fiets>`).join('\n')}
</fietsen>`;

    res.type('application/xml').send(xml);
  } catch (error) {
    res.status(500).type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(error.message)}</error>`);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cached: Boolean(fietsenCache.data),
    cacheAgeMs: fietsenCache.data ? Date.now() - fietsenCache.timestamp : null
  });
});

app.get('/fiets/:id', async (req, res) => {
  const bikeId = req.params.id;
  try {
    const html = await fetchHtml(buildDetailUrl(bikeId));
    const parsed = parseDetailPage(html, bikeId, 'used');
    const title = parsed.title;
    const specsHtml = [
      ['Soort', parsed.soort],
      ['Kleur', parsed.kleur],
      ['Maat', parsed.maat],
      ['Wielmaat', parsed.wielmaat],
      ['Modeljaar', parsed.modeljaar],
      ['Garantie', parsed.garantie],
      ['Art. nummer', parsed.artNummer],
      ['Status', parsed.status]
    ].filter(([,v]) => v).map(([k,v]) => `<div class="spec-row"><span>${k}</span><strong>${v}</strong></div>`).join('');

    res.send(`<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} | Bus vol Bikes</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="detail-body">
  <main class="detail-page">
    <a class="back-link" href="/voorraad">← Terug naar voorraad</a>
    <div class="detail-grid">
      <section class="detail-visual card">
        <div class="detail-image">
          <img src="${parsed.image}" alt="${title}" loading="eager">
        </div>
      </section>
      <section class="detail-card card">
        <span class="badge">${parsed.stateLabel}</span>
        <h1 class="detail-title">${title}</h1>
        <div class="detail-price">${parsed.price}</div>
        <div class="spec-list">${specsHtml || '<p>Geen extra gegevens gevonden.</p>'}</div>
        <div class="detail-actions">
          <a class="btn btn-primary" href="${parsed.detailUrl}" target="_blank" rel="noopener noreferrer">Open originele pagina</a>
          <a class="btn btn-secondary" href="/voorraad">Terug</a>
        </div>
        <p class="detail-note">Deze pagina is mobielvriendelijk gemaakt op basis van de Fietsenwijk detailinformatie.</p>
      </section>
    </div>
  </main>
</body>
</html>`);
  } catch (error) {
    res.status(500).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Fiets niet gevonden</title></head><body class="detail-body"><main class="detail-page"><a class="back-link" href="/voorraad">← Terug naar voorraad</a><section class="card detail-card"><h1 class="detail-title">Fiets niet gevonden</h1><p>De fietsinformatie kon niet worden geladen.</p></section></main></body></html>`);
  }
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript').send(`
(function() {
  var API_BASE = window.BVB_API_BASE || window.location.origin;

  function esc(v) {
    return String(v || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function render(container, fietsen, type) {
    if (type && type !== 'all') {
      fietsen = fietsen.filter(function(f) { return f.state === type; });
    }

    if (!fietsen.length) {
      container.innerHTML = '<div style="padding:20px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;">Geen fietsen gevonden.</div>';
      return;
    }

    container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">' +
      fietsen.map(function(f) {
        return '<article style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06);">' +
          '<div style="height:240px;background:#f6f7f8;display:flex;align-items:center;justify-content:center;padding:12px;">' +
            '<img src="' + esc(f.image) + '" alt="' + esc(f.title) + '" style="max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;">' +
          '</div>' +
          '<div style="padding:18px;">' +
            '<div style="display:inline-flex;padding:8px 14px;border-radius:999px;background:#e7f4ee;color:#1f7a5c;font-weight:700;font-size:14px;margin-bottom:12px;">' + esc(f.stateLabel) + '</div>' +
            '<h3 style="margin:0 0 8px;font-size:18px;line-height:1.3;color:#0f172a;">' + esc(f.title) + '</h3>' +
            '<div style="color:#64748b;margin-bottom:14px;">' + esc((f.specs || []).slice(0,2).join(' • ')) + '</div>' +
            '<div style="font-size:34px;font-weight:800;line-height:1;color:#0f8a7d;margin-bottom:16px;">' + esc(f.price) + '</div>' +
            '<a href="' + esc(API_BASE + f.url) + '" style="display:inline-block;background:#08194d;color:#fff;text-decoration:none;padding:12px 16px;border-radius:14px;font-weight:700;">Bekijken</a>' +
          '</div>' +
        '</article>';
      }).join('') +
    '</div>';
  }

  function mount(el) {
    var type = el.getAttribute('data-type') || 'all';
    el.innerHTML = 'Fietsen laden...';
    fetch(API_BASE + '/api/fietsen')
      .then(function(r){ return r.json(); })
      .then(function(data){ render(el, Array.isArray(data.fietsen) ? data.fietsen : [], type); })
      .catch(function(){ el.innerHTML = 'Fietsen konden niet worden geladen'; });
  }

  var byId = document.getElementById('bvb-voorraad');
  if (byId) mount(byId);
  document.querySelectorAll('.busvolbikes-voorraad').forEach(mount);
})();
  `);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/voorraad', (req, res) => res.sendFile(path.join(__dirname, 'public', 'voorraad.html')));

app.listen(PORT, () => {
  console.log('Bus vol Bikes server running on port ' + PORT);
  console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
});
