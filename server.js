const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_HOST = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl';
const USED_URL = `${BASE_HOST}/fietsen/?cat=1`;
const NEW_URL = `${BASE_HOST}/fietsen/?cat=2`;

app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Accept']
}));
app.use(express.static(path.join(__dirname, 'public')));

function absUrl(url) {
  if (!url) return '';
  try {
    return new URL(url, BASE_HOST).href;
  } catch {
    return url;
  }
}

function normalizePrice(text) {
  return String(text || '').replace(/\s+/g, ' ').trim() || 'Prijs op aanvraag';
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function extractBikesFromHtml(html, state) {
  const $ = cheerio.load(html);
  const bikes = [];

  const linkCandidates = new Map();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const title = $(el).attr('title') || $(el).text();
    if (/\/fietsen\/detail\//i.test(href) || /\/detail\//i.test(href)) {
      const key = absUrl(href);
      if (!linkCandidates.has(key)) {
        linkCandidates.set(key, $(el));
      }
    }
  });

  for (const [detailUrl, el] of linkCandidates.entries()) {
    const node = el;
    const card = node.closest('article, li, .item, .product, .fiets, .bike, .col, .grid-item, .teaser');
    const scope = card.length ? card : node.parent();

    const rawText = scope.text().replace(/\s+/g, ' ').trim();
    const title = (
      scope.find('h1,h2,h3,h4,.title,.product-title,.fiets-title').first().text() ||
      node.attr('title') ||
      node.text() ||
      'Onbekende fiets'
    ).replace(/\s+/g, ' ').trim();

    const img = scope.find('img').first();
    const image = absUrl(img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '');

    const priceMatch = rawText.match(/€\s?[\d\.]+(?:,[\d]{2})?(?:,-)?/);
    const specs = uniq([
      ...(rawText.match(/\b\d{2}\s?cm\b/gi) || []),
      ...(rawText.match(/\b(?:bosch|yamaha|bafang|shimano)[^\.\,\|]{0,30}/gi) || []),
      ...(rawText.match(/\b\d{2,3}\s?-\s?\d{2,3}\s?km\b/gi) || []),
      ...(rawText.match(/\b\d{2,3}\s?km\b/gi) || [])
    ]).slice(0, 4);

    if (!title || title.toLowerCase().includes('volgende') || title.toLowerCase().includes('vorige')) {
      continue;
    }

    bikes.push({
      id: Buffer.from(detailUrl).toString('base64').replace(/=/g, '').slice(0, 16),
      title,
      state,
      stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
      price: normalizePrice(priceMatch ? priceMatch[0] : ''),
      image: image || '',
      url: detailUrl,
      specs,
      sourceText: rawText.slice(0, 240)
    });
  }

  return bikes;
}

async function fetchCategory(url, state) {
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikesApp/1.0)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });
  return extractBikesFromHtml(response.data, state);
}

function fallbackData(baseUrl) {
  return [
    {
      id: '1',
      title: 'Qwic Premium MN7',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.899,-',
      image: `${baseUrl}/images/showroom-fietsen.svg`,
      url: '#contact',
      specs: ['49 cm frame', 'Bafang middenmotor', '50-80 km actieradius']
    },
    {
      id: '2',
      title: 'Gazelle Grenoble C7',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.499,-',
      image: `${baseUrl}/images/fiets-spotlight.svg`,
      url: '#contact',
      specs: ['53 cm frame', 'Bosch middenmotor', '70-120 km actieradius']
    },
    {
      id: '3',
      title: 'Cortina E-Transport',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.599,-',
      image: `${baseUrl}/images/gezin-fietsen.svg`,
      url: '#contact',
      specs: ['57 cm frame', 'Bafang voorwielmotor', '40-60 km actieradius']
    },
    {
      id: '4',
      title: 'Giant DailyTour E+',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.199,-',
      image: `${baseUrl}/images/fiets-nieuw.svg`,
      url: '#contact',
      specs: ['50 cm frame', 'Yamaha middenmotor', '60-100 km actieradius']
    }
  ];
}

app.get('/api/fietsen', async (req, res) => {
  const type = String(req.query.type || 'all').toLowerCase();
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  try {
    let used = [];
    let fresh = [];

    if (type === 'all' || type === 'used') {
      used = await fetchCategory(USED_URL, 'used');
    }
    if (type === 'all' || type === 'new') {
      fresh = await fetchCategory(NEW_URL, 'new');
    }

    let fietsen = [...used, ...fresh];
    if (!fietsen.length) {
      fietsen = fallbackData(baseUrl);
    }

    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      source: {
        used: USED_URL,
        new: NEW_URL
      },
      laatsteUpdate: new Date().toISOString()
    });
  } catch (error) {
    const fietsen = fallbackData(baseUrl);
    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      source: 'fallback-data',
      error: error.message,
      laatsteUpdate: new Date().toISOString()
    });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let fietsen;
  try {
    const used = await fetchCategory(USED_URL, 'used');
    const fresh = await fetchCategory(NEW_URL, 'new');
    fietsen = [...used, ...fresh];
    if (!fietsen.length) fietsen = fallbackData(baseUrl);
  } catch {
    fietsen = fallbackData(baseUrl);
  }

  const escapeXml = (s) => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<fietsen laatsteUpdate="${new Date().toISOString()}">\n${fietsen.map(f => `  <fiets>\n    <id>${escapeXml(f.id)}</id>\n    <titel>${escapeXml(f.title)}</titel>\n    <status>${escapeXml(f.state)}</status>\n    <statusLabel>${escapeXml(f.stateLabel)}</statusLabel>\n    <prijs>${escapeXml(f.price)}</prijs>\n    <afbeelding>${escapeXml(f.image)}</afbeelding>\n    <url>${escapeXml(f.url)}</url>\n  </fiets>`).join('\n')}\n</fietsen>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'embed.js'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/voorraad', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voorraad.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Bus vol Bikes app running on port ${PORT}`);
});
