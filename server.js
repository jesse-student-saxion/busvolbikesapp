const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SHOP_ID = process.env.FIETSENWIJK_SHOP_ID || 'D40972D3C78B4BC6A44E816EDE6281CC';
const BASE_HOST = `https://${SHOP_ID}.hst.fietsenwijk.nl`;
const USED_URL = `${BASE_HOST}/fietsen/?cat=1`;
const NEW_URL = `${BASE_HOST}/fietsen/?cat=2`;
const DETAIL_IMAGE_BASE = `${BASE_HOST}/fietsen/detail/images/`;
const CSS_PARAM = '/css/default.css';

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function absUrl(url, base) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return '';
  }
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractBikeId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('b') || '';
  } catch {
    return '';
  }
}

function buildDetailImageUrl(detailUrl) {
  const bikeId = extractBikeId(detailUrl);
  if (!bikeId) return '';
  return `${DETAIL_IMAGE_BASE}?b=${encodeURIComponent(bikeId)}&css=${encodeURIComponent(CSS_PARAM)}`;
}

function normalizePrice(raw) {
  const text = cleanText(raw)
    .replace(/\u20ac/g, '€')
    .replace(/EUR/gi, '€')
    .replace(/\s+/g, ' ');

  if (!text) return '';

  const patterns = [
    /(€\s*[\d]{1,3}(?:[\.\s][\d]{3})*(?:,[\d]{2})?\s*,-)/i,
    /(€\s*[\d]{1,3}(?:[\.\s][\d]{3})*(?:,[\d]{2})?)/i,
    /(v\.?a\.?\s*€\s*[\d]{1,3}(?:[\.\s][\d]{3})*(?:,[\d]{2})?)/i,
    /(prijs\s*[:\-]?\s*€\s*[\d]{1,3}(?:[\.\s][\d]{3})*(?:,[\d]{2})?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return cleanText(match[0]).replace(/€\s+/, '€');
    }
  }

  return '';
}

function extractSpecs(text) {
  const specs = [];
  const patterns = [
    /\b\d{2}\s?cm\s*(?:frame|framemaat)?\b/i,
    /\b(?:bafang|bosch|yamaha|shimano|brose)[^,.]{0,40}motor\b/i,
    /\b\d{2,3}\s?-\s?\d{2,3}\s?km\s*actieradius\b/i,
    /\b(?:accu|batterij)\s*\d+\s*wh\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) specs.push(cleanText(match[0]));
  }

  return [...new Set(specs)];
}

function firstNonEmpty(values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function getFallback(baseUrl) {
  return [
    {
      id: '1',
      title: 'Qwic Premium MN7',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.899,-',
      image: `${baseUrl}/images/showroom-fietsen.jpg`,
      url: '#contact',
      specs: ['49cm frame', 'Bafang middenmotor', '50-80km actieradius']
    },
    {
      id: '2',
      title: 'Gazelle Grenoble C7',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.499,-',
      image: `${baseUrl}/images/fiets-spotlight.jpg`,
      url: '#contact',
      specs: ['53cm frame', 'Bosch middenmotor', '70-120km actieradius']
    },
    {
      id: '3',
      title: 'Cortina E-Transport',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.599,-',
      image: `${baseUrl}/images/gezin-fietsen.jpg`,
      url: '#contact',
      specs: ['57cm frame', 'Bafang voorwielmotor', '40-60km actieradius']
    },
    {
      id: '4',
      title: 'Giant DailyTour E+',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.199,-',
      image: `${baseUrl}/images/fiets-nieuw.jpg`,
      url: '#contact',
      specs: ['50cm frame', 'Yamaha middenmotor', '60-100km actieradius']
    }
  ];
}

function parseBikesFromHtml(html, state, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  $('a[href*="/fietsen/detail/"]').each((_, el) => {
    const a = $(el);
    const href = absUrl(a.attr('href') || '', baseUrl);
    if (!href) return;

    const scope = a.closest('article, li, .item, .product, .fiets, .bike, .card, .block, .result, .row, .col, .bike-item, .overzichtItem').first();
    const node = scope.length ? scope : a.parent();
    const blockText = cleanText(node.text() || a.text());

    const title = firstNonEmpty([
      node.find('h1,h2,h3,h4,.title,.titel,[itemprop="name"]').first().text(),
      a.attr('title'),
      a.find('img').attr('alt'),
      a.text()
    ]);

    if (!title || title.length < 3) return;

    const price = normalizePrice(firstNonEmpty([
      node.find('[itemprop="price"]').first().attr('content'),
      node.find('[itemprop="price"]').first().text(),
      node.find('.price,.prijs,.amount,.product-price,.sale-price,.prijsblok,.price-box,.price-sales').first().text(),
      blockText
    ]));

    const key = `${title}|${href}`;
    if (seen.has(key)) return;
    seen.add(key);

    items.push({
      id: String(items.length + 1),
      title,
      state,
      stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
      price: price || 'Prijs op aanvraag',
      image: buildDetailImageUrl(href),
      url: href,
      specs: extractSpecs(blockText)
    });
  });

  return items;
}

async function fetchPage(url) {
  const response = await axios.get(url, {
    timeout: 20000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
      'Accept': 'text/html,application/xhtml+xml,*/*'
    }
  });
  return Buffer.from(response.data).toString('utf8');
}

async function enrichMissingData(items) {
  const targets = items.filter((item) => item.price === 'Prijs op aanvraag' || !item.specs.length).slice(0, 24);

  await Promise.allSettled(targets.map(async (item) => {
    try {
      const html = await fetchPage(item.url);
      const $ = cheerio.load(html);
      const bodyText = cleanText($('body').text());
      const detailPrice = normalizePrice(firstNonEmpty([
        $('[itemprop="price"]').first().attr('content'),
        $('[itemprop="price"]').first().text(),
        $('.price,.prijs,.amount,.product-price,.sale-price,.detail-price,.prijsblok,.price-box,.price-sales').first().text(),
        bodyText
      ]));

      if (detailPrice) item.price = detailPrice;
      if (!item.specs.length) item.specs = extractSpecs(bodyText);
    } catch {
      // keep defaults
    }
  }));

  return items;
}

async function fetchCategory(url, state) {
  const html = await fetchPage(url);
  const items = parseBikesFromHtml(html, state, url);
  return enrichMissingData(items);
}

async function getInventory(baseUrl) {
  const [usedResult, newResult] = await Promise.allSettled([
    fetchCategory(USED_URL, 'used'),
    fetchCategory(NEW_URL, 'new')
  ]);

  const used = usedResult.status === 'fulfilled' ? usedResult.value : [];
  const fresh = newResult.status === 'fulfilled' ? newResult.value : [];
  const bikes = [...used, ...fresh];

  if (!bikes.length) {
    return {
      fietsen: getFallback(baseUrl),
      meta: {
        source: 'fallback',
        usedFetch: usedResult.status,
        newFetch: newResult.status,
        usedError: usedResult.status === 'rejected' ? usedResult.reason.message : null,
        newError: newResult.status === 'rejected' ? newResult.reason.message : null
      }
    };
  }

  return {
    fietsen: bikes,
    meta: {
      source: { used: USED_URL, new: NEW_URL },
      usedFetch: usedResult.status,
      newFetch: newResult.status,
      usedError: usedResult.status === 'rejected' ? usedResult.reason.message : null,
      newError: newResult.status === 'rejected' ? newResult.reason.message : null
    }
  };
}

app.get('/api/fietsen', async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  try {
    const { fietsen, meta } = await getInventory(baseUrl);
    const type = (req.query.type || 'all').toLowerCase();
    const filtered = type === 'used' || type === 'new'
      ? fietsen.filter((f) => f.state === type)
      : fietsen;

    res.json({
      success: true,
      count: filtered.length,
      fietsen: filtered,
      laatsteUpdate: new Date().toISOString(),
      shopId: SHOP_ID,
      ...meta
    });
  } catch (error) {
    const fallback = getFallback(baseUrl);
    res.json({
      success: true,
      count: fallback.length,
      fietsen: fallback,
      source: 'fallback',
      error: error.message,
      laatsteUpdate: new Date().toISOString(),
      shopId: SHOP_ID
    });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  try {
    const { fietsen } = await getInventory(baseUrl);
    const type = (req.query.type || 'all').toLowerCase();
    const filtered = type === 'used' || type === 'new'
      ? fietsen.filter((f) => f.state === type)
      : fietsen;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<fietsen>\n${filtered.map((f) => `  <fiets>\n    <id>${escapeXml(f.id)}</id>\n    <titel>${escapeXml(f.title)}</titel>\n    <status>${escapeXml(f.state)}</status>\n    <statusLabel>${escapeXml(f.stateLabel)}</statusLabel>\n    <prijs>${escapeXml(f.price)}</prijs>\n    <afbeelding>${escapeXml(f.image)}</afbeelding>\n    <url>${escapeXml(f.url)}</url>\n    <specificaties>${(f.specs || []).map((s) => `<spec>${escapeXml(s)}</spec>`).join('')}</specificaties>\n  </fiets>`).join('\n')}\n</fietsen>`;

    res.type('application/xml').send(xml);
  } catch (error) {
    res.status(500).type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(error.message)}</error>`);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), shopId: SHOP_ID });
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript').send(`
(function() {
  var API_BASE = window.BVB_API_BASE || (document.currentScript ? new URL(document.currentScript.src).origin : window.location.origin);
  var STYLE_ID = 'bvb-embed-style';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '.bvb-embed{font-family:Inter,system-ui,sans-serif;max-width:1200px;margin:0 auto}.bvb-embed-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}.bvb-embed-card{background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;box-shadow:0 14px 30px rgba(15,23,42,.08)}.bvb-embed-media{height:260px;background:linear-gradient(180deg,#f8fafc,#eef2f7);display:flex;align-items:center;justify-content:center;padding:16px}.bvb-embed-media img{width:100%;height:100%;object-fit:contain;display:block}.bvb-embed-body{padding:18px}.bvb-embed-pill{display:inline-block;background:#ecfdf5;color:#15803d;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:10px}.bvb-embed-pill.new{background:#eff6ff;color:#2563eb}.bvb-embed-title{font-size:18px;line-height:1.3;margin:0 0 8px;color:#0f172a}.bvb-embed-specs{font-size:14px;color:#64748b;min-height:40px;margin:0 0 14px}.bvb-embed-footer{display:flex;justify-content:space-between;align-items:center;gap:12px}.bvb-embed-price{font-size:24px;font-weight:800;color:#0f766e}.bvb-embed-btn{display:inline-block;background:#0f172a;color:#fff!important;padding:10px 14px;border-radius:12px;text-decoration:none;font-weight:700}.bvb-embed-empty{padding:28px;background:#fff;border-radius:16px;border:1px dashed #cbd5e1}@media(max-width:640px){.bvb-embed-footer{flex-direction:column;align-items:stretch}.bvb-embed-btn{text-align:center}}';
    document.head.appendChild(style);
  }
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function render(container, fietsen){
    if(!fietsen.length){container.innerHTML='<div class="bvb-embed-empty">Geen fietsen gevonden.</div>';return;}
    container.classList.add('bvb-embed');
    container.innerHTML='<div class="bvb-embed-grid">'+fietsen.map(function(f){var specs=Array.isArray(f.specs)&&f.specs.length?f.specs.join(' • '):'Bekijk de details voor meer specificaties';var pillClass=f.state==='new'?'bvb-embed-pill new':'bvb-embed-pill';return '<article class="bvb-embed-card"><div class="bvb-embed-media">'+(f.image?'<img src="'+esc(f.image)+'" alt="'+esc(f.title)+'" loading="lazy">':'')+'</div><div class="bvb-embed-body"><span class="'+pillClass+'">'+esc(f.stateLabel)+'</span><h3 class="bvb-embed-title">'+esc(f.title)+'</h3><p class="bvb-embed-specs">'+esc(specs)+'</p><div class="bvb-embed-footer"><div class="bvb-embed-price">'+esc(f.price)+'</div><a class="bvb-embed-btn" href="'+esc(f.url||'#')+'" target="_blank" rel="noopener noreferrer">Bekijken</a></div></div></article>';}).join('')+'</div>';
  }
  function load(container){var type=container.getAttribute('data-type')||'all';container.innerHTML='<div class="bvb-embed-empty">Fietsen laden...</div>';fetch(API_BASE+'/api/fietsen?type='+encodeURIComponent(type)).then(function(r){return r.json()}).then(function(data){render(container,Array.isArray(data.fietsen)?data.fietsen:[])}).catch(function(){container.innerHTML='<div class="bvb-embed-empty">Fietsen konden niet worden geladen.</div>'})}
  var one=document.getElementById('bvb-voorraad'); if(one) load(one);
  var many=document.querySelectorAll('.busvolbikes-voorraad'); for(var i=0;i<many.length;i++) load(many[i]);
})();
  `);
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
