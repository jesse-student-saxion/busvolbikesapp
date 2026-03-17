const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl';
const USED_URL = `${BASE}/fietsen/?cat=1`;
const NEW_URL = `${BASE}/fietsen/?cat=2`;
const CACHE_TTL_MS = 10 * 60 * 1000;

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

let fietsenCache = { timestamp: 0, data: null };

function decodeHtmlBuffer(buf) {
  let html = Buffer.from(buf).toString('utf8');
  if (html.includes('�')) html = Buffer.from(buf).toString('latin1');
  return html;
}

async function fetchWithHeaders(url, extra = {}) {
  return axios.get(url, {
    timeout: 25000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
      'Accept': 'text/html,application/xhtml+xml,image/*,*/*'
    },
    ...extra
  });
}

async function fetchHtml(url) {
  const response = await fetchWithHeaders(url);
  return decodeHtmlBuffer(response.data);
}

function cleanText(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBikeId(url) {
  try {
    return new URL(url).searchParams.get('b');
  } catch {
    return null;
  }
}

function buildDetailUrl(bikeId) {
  return `${BASE}/fietsen/detail/?b=${bikeId}`;
}

function buildRawImageUrl(bikeId) {
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

function getCellValue($, label) {
  let value = '';

  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;

    const left = cleanText($(tds[0]).text()).replace(/:$/, '').toLowerCase();
    if (left === label.toLowerCase()) {
      value = cleanText($(tds[1]).text())
        .replace(/^&nbsp;$/i, '')
        .replace(/\u00a0/g, '')
        .trim();
    }
  });

  return value;
}

function parseDetailPage(html, bikeId, state) {
  const $ = cheerio.load(html);

  const title =
    cleanText($('h1').first().text()) ||
    cleanText($('h2').first().text()) ||
    'Onbekende fiets';

  const pageText = cleanText($('body').text());

  const soort = getCellValue($, 'Soort');
  const kleur = getCellValue($, 'Kleur');
  const maat = getCellValue($, 'Maat');
  const wielmaat = getCellValue($, 'Wielmaat');
  const gewicht = getCellValue($, 'Gewicht');
  const modeljaar = getCellValue($, 'Modeljaar');
  const bijzonderheden = getCellValue($, 'Bijzonderheden');
  const artNummer = getCellValue($, 'Art. nummer');
  const garantie = getCellValue($, 'Garantie');
  const status = getCellValue($, 'Status');

  const priceMatch =
    pageText.match(/Prijs\s*:\s*€\s?[\d\.\,]+(?:,-)?/i) ||
    pageText.match(/€\s?[\d\.\,]+(?:,-)?/);

  return {
    id: bikeId,
    title,
    state,
    stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
    price: priceMatch ? cleanText(priceMatch[0].replace(/Prijs\s*:\s*/i, '')) : 'Prijs op aanvraag',
    image: buildRawImageUrl(bikeId),
    rawImage: buildRawImageUrl(bikeId),
    url: `/fiets/${bikeId}`,
    detailUrl: buildDetailUrl(bikeId),
    soort,
    kleur,
    maat,
    wielmaat,
    gewicht,
    modeljaar,
    bijzonderheden,
    artNummer,
    garantie,
    status,
    specs: [
      maat && `Maat: ${maat}`,
      kleur && `Kleur: ${kleur}`,
      wielmaat && `Wielmaat: ${wielmaat}`,
      gewicht && `Gewicht: ${gewicht}`,
      modeljaar && `Modeljaar: ${modeljaar}`
    ].filter(Boolean)
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

  const data = [...used, ...fresh];
  fietsenCache = { timestamp: Date.now(), data };
  return data;
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
    const fietsen = await getFietsen(req.query.refresh === '1');
    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      laatsteUpdate: new Date().toISOString(),
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
    const fietsen = await getFietsen(req.query.refresh === '1');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fietsen>
${fietsen.map(f => `  <fiets>
    <id>${escapeXml(f.id)}</id>
    <titel>${escapeXml(f.title)}</titel>
    <status>${escapeXml(f.state)}</status>
    <prijs>${escapeXml(f.price)}</prijs>
    <afbeelding>${escapeXml(f.rawImage)}</afbeelding>
    <detailUrl>${escapeXml(f.detailUrl)}</detailUrl>
    <soort>${escapeXml(f.soort)}</soort>
    <kleur>${escapeXml(f.kleur)}</kleur>
    <maat>${escapeXml(f.maat)}</maat>
    <wielmaat>${escapeXml(f.wielmaat)}</wielmaat>
    <gewicht>${escapeXml(f.gewicht)}</gewicht>
    <modeljaar>${escapeXml(f.modeljaar)}</modeljaar>
    <bijzonderheden>${escapeXml(f.bijzonderheden)}</bijzonderheden>
    <garantie>${escapeXml(f.garantie)}</garantie>
    <statusTekst>${escapeXml(f.status)}</statusTekst>
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
    cached: Boolean(fietsenCache.data)
  });
});

app.get('/fiets/:id', async (req, res) => {
  try {
    const bikeId = req.params.id;
    const item = parseDetailPage(await fetchHtml(buildDetailUrl(bikeId)), bikeId, 'used');

    const rows = [
      ['Soort', item.soort],
      ['Kleur', item.kleur],
      ['Maat', item.maat],
      ['Wielmaat', item.wielmaat],
      ['Gewicht', item.gewicht],
      ['Modeljaar', item.modeljaar],
      ['Bijzonderheden', item.bijzonderheden],
      ['Art. nummer', item.artNummer],
      ['Garantie', item.garantie],
      ['Status', item.status]
    ].filter(([,v]) => v).map(([k,v]) => `<div class="spec-row"><span>${k}</span><strong>${v}</strong></div>`).join('');

    res.send(`<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${item.title} | Bus vol Bikes</title>
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<main class="page detail-shell">
<a class="back-link" href="/voorraad">← Terug naar voorraad</a>
<section class="detail-layout">
  <div class="detail-photo card">
    <div class="detail-photo-wrap">
      <img src="${item.image}" alt="${item.title}">
    </div>
  </div>
  <div class="detail-panel card">
    <span class="badge">${item.stateLabel}</span>
    <h1 class="detail-title">${item.title}</h1>
    <div class="detail-price">${item.price}</div>
    <div class="spec-list">${rows || '<div class="spec-row"><span>Info</span><strong>Geen details gevonden</strong></div>'}</div>
    <div class="detail-actions">
      <a class="btn btn-primary" href="${item.detailUrl}" target="_blank" rel="noopener noreferrer">Originele pagina</a>
      <a class="btn btn-secondary" href="/voorraad">Terug</a>
    </div>
  </div>
</section>
</main>
</body>
</html>`);
  } catch (error) {
    res.status(500).send('Kon detailpagina niet laden');
  }
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript').send(`
(function() {
  var API_BASE = window.BVB_API_BASE || window.location.origin;
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function render(el, items, type){
    if(type && type !== 'all') items = items.filter(function(x){return x.state===type;});
    if(!items.length){el.innerHTML='<div style="padding:20px;border:1px solid #e5e7eb;border-radius:20px;background:#fff">Geen fietsen gevonden.</div>';return;}
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">' + items.map(function(f){
      return '<article style="background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.07)">' +
      '<div style="height:230px;background:#f6f7f8;padding:14px;display:flex;align-items:center;justify-content:center"><img src="' + esc(f.image) + '" alt="' + esc(f.title) + '" style="width:100%;height:100%;object-fit:contain"></div>' +
      '<div style="padding:18px"><span style="display:inline-flex;padding:9px 14px;border-radius:999px;background:#e7f4ee;color:#1f7a5c;font-weight:800;font-size:14px;margin-bottom:12px">' + esc(f.stateLabel) + '</span>' +
      '<h3 style="margin:0 0 8px;font-size:19px;line-height:1.3;color:#0f172a">' + esc(f.title) + '</h3>' +
      '<div style="color:#64748b;min-height:42px;margin-bottom:14px">' + esc((f.specs||[]).slice(0,2).join(' • ')) + '</div>' +
      '<div style="font-size:36px;font-weight:900;line-height:1;color:#0f8a7d;margin-bottom:18px">' + esc(f.price) + '</div>' +
      '<a href="' + esc(API_BASE + f.url) + '" style="display:inline-flex;background:#08194d;color:#fff;text-decoration:none;padding:12px 16px;border-radius:14px;font-weight:800">Bekijken</a></div></article>';
    }).join('') + '</div>';
  }
  function mount(el){
    var type = el.getAttribute('data-type') || 'all';
    el.innerHTML = 'Fietsen laden...';
    fetch(API_BASE + '/api/fietsen?refresh=1').then(function(r){return r.json();}).then(function(d){render(el, Array.isArray(d.fietsen)?d.fietsen:[], type);}).catch(function(){el.innerHTML='Fietsen konden niet worden geladen';});
  }
  var one = document.getElementById('bvb-voorraad'); if(one) mount(one);
  document.querySelectorAll('.busvolbikes-voorraad').forEach(mount);
})();
  `);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/voorraad', (req, res) => res.sendFile(path.join(__dirname, 'public', 'voorraad.html')));

app.listen(PORT, () => {
  console.log('Bus vol Bikes server running on port ' + PORT);
});
