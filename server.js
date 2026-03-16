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

function fallback(baseUrl) {
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

  $('a[href]').each((_, el) => {
    const a = $(el);
    const href = a.attr('href') || '';
    const combinedNode = a.closest('article, li, .item, .product, .fiets, .bike, .card, .block, .result, div');
    const scope = combinedNode.length ? combinedNode : a;

    const title = cleanText(
      scope.find('h1,h2,h3,h4,.title,.titel').first().text() ||
      a.attr('title') ||
      a.text()
    );

    if (!title || title.length < 3) return;

    const fullHref = absUrl(href, baseUrl);
    if (!fullHref) return;

    const relevant = /\/fietsen\//i.test(fullHref) || /detail/i.test(fullHref);
    if (!relevant) return;

    const text = cleanText(scope.text());
    const priceMatch = text.match(/€\s?[\d\.,]+(?:,-)?/i);
    let image = scope.find('img').first().attr('src') || a.find('img').first().attr('src') || '';
    image = absUrl(image, baseUrl);

    const specs = [];
    const frameMatch = text.match(/\b\d{2}\s?cm\s*(frame)?\b/i);
    const motorMatch = text.match(/\b(bafang|bosch|yamaha|shimano)[^,.]{0,40}motor\b/i);
    const rangeMatch = text.match(/\b\d{2,3}\s?-\s?\d{2,3}\s?km\s*actieradius\b/i);
    if (frameMatch) specs.push(cleanText(frameMatch[0]));
    if (motorMatch) specs.push(cleanText(motorMatch[0]));
    if (rangeMatch) specs.push(cleanText(rangeMatch[0]));

    const key = `${title}|${fullHref}`;
    if (seen.has(key)) return;
    seen.add(key);

    items.push({
      id: String(items.length + 1),
      title,
      state,
      stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
      price: priceMatch ? cleanText(priceMatch[0]) : 'Prijs op aanvraag',
      image,
      url: fullHref,
      specs
    });
  });

  return items;
}

async function fetchCategory(url, state) {
  const response = await axios.get(url, {
    timeout: 20000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
      'Accept': 'text/html,application/xhtml+xml,*/*'
    }
  });

  const html = Buffer.from(response.data).toString('utf8');
  return parseBikesFromHtml(html, state, url);
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
      fietsen: fallback(baseUrl),
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
      ? fietsen.filter(f => f.state === type)
      : fietsen;

    res.json({
      success: true,
      count: filtered.length,
      fietsen: filtered,
      laatsteUpdate: new Date().toISOString(),
      ...meta
    });
  } catch (error) {
    res.json({
      success: true,
      count: fallback(baseUrl).length,
      fietsen: fallback(baseUrl),
      source: 'fallback',
      error: error.message,
      laatsteUpdate: new Date().toISOString()
    });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  try {
    const { fietsen } = await getInventory(baseUrl);
    const type = (req.query.type || 'all').toLowerCase();
    const filtered = type === 'used' || type === 'new'
      ? fietsen.filter(f => f.state === type)
      : fietsen;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<fietsen>\n${filtered.map(f => `  <fiets>\n    <id>${escapeXml(f.id)}</id>\n    <titel>${escapeXml(f.title)}</titel>\n    <status>${escapeXml(f.state)}</status>\n    <statusLabel>${escapeXml(f.stateLabel)}</statusLabel>\n    <prijs>${escapeXml(f.price)}</prijs>\n    <afbeelding>${escapeXml(f.image)}</afbeelding>\n    <url>${escapeXml(f.url)}</url>\n    <specificaties>${(f.specs || []).map(s => `<spec>${escapeXml(s)}</spec>`).join('')}</specificaties>\n  </fiets>`).join('\n')}\n</fietsen>`;

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
  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
  }
  function render(container, fietsen) {
    if (!fietsen.length) {
      container.innerHTML = 'Geen fietsen gevonden';
      return;
    }
    container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">' + fietsen.map(function(f) {
      var specs = Array.isArray(f.specs) ? f.specs.join(' • ') : '';
      return '<div style="border:1px solid #ddd;border-radius:12px;padding:16px;background:#fff;">' +
        (f.image ? '<img src="' + esc(f.image) + '" alt="' + esc(f.title) + '" style="width:100%;height:220px;object-fit:cover;border-radius:8px;margin-bottom:12px;">' : '') +
        '<div style="font-size:12px;color:#666;margin-bottom:6px;">' + esc(f.stateLabel) + '</div>' +
        '<h3 style="margin:0 0 8px 0;">' + esc(f.title) + '</h3>' +
        '<div style="margin-bottom:10px;color:#666;">' + esc(specs) + '</div>' +
        '<div style="font-size:22px;font-weight:700;color:#22c55e;margin-bottom:12px;">' + esc(f.price) + '</div>' +
        '<a href="' + esc(f.url || '#') + '" style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">Bekijken</a>' +
      '</div>';
    }).join('') + '</div>';
  }
  function load(container) {
    var type = container.getAttribute('data-type') || 'all';
    container.innerHTML = 'Fietsen laden...';
    fetch(API_BASE + '/api/fietsen?type=' + encodeURIComponent(type))
      .then(function(r) { return r.json(); })
      .then(function(data) { render(container, Array.isArray(data.fietsen) ? data.fietsen : []); })
      .catch(function(err) { console.error(err); container.innerHTML = 'Fietsen konden niet worden geladen'; });
  }
  var one = document.getElementById('bvb-voorraad');
  if (one) load(one);
  var many = document.querySelectorAll('.busvolbikes-voorraad');
  for (var i = 0; i < many.length; i++) load(many[i]);
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
