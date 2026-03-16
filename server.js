const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

const USED_URL = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/?cat=1';
const NEW_URL = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/?cat=2';

function absUrl(url, base) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, base).href;
}

function cleanText(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function parseBikesFromHtml(html, state, baseUrl) {
  const $ = cheerio.load(html);
  const fietsen = [];
  let idCounter = 1;

  $('article, .fiets, .bike, li, .item, .product, .card').each((_, el) => {
    const root = $(el);

    const title =
      cleanText(root.find('h1, h2, h3, h4').first().text()) ||
      cleanText(root.find('[title]').first().attr('title')) ||
      '';

    const price =
      cleanText(root.text().match(/€\s?[\d\.\,]+(?:,-)?/i)?.[0]) ||
      'Prijs op aanvraag';

    let image = root.find('img').first().attr('src') || '';
    let url = root.find('a').first().attr('href') || '';

    if (!title || !url) return;

    image = absUrl(image, baseUrl);
    url = absUrl(url, baseUrl);

    const specs = [];
    const text = cleanText(root.text());

    const frameMatch = text.match(/\b\d{2}\s?cm frame\b/i);
    const motorMatch = text.match(/\b(bafang|bosch|yamaha)[^,.]*motor\b/i);
    const rangeMatch = text.match(/\b\d{2,3}\s?-\s?\d{2,3}\s?km actieradius\b/i);

    if (frameMatch) specs.push(frameMatch[0]);
    if (motorMatch) specs.push(motorMatch[0]);
    if (rangeMatch) specs.push(rangeMatch[0]);

    fietsen.push({
      id: String(idCounter++),
      title,
      state,
      stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
      price,
      image,
      url,
      specs
    });
  });

  return fietsen;
}

async function fetchCategory(url, state) {
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });

  return parseBikesFromHtml(response.data, state, url);
}

app.get('/api/fietsen', async (req, res) => {
  try {
    const [usedBikes, newBikes] = await Promise.all([
      fetchCategory(USED_URL, 'used'),
      fetchCategory(NEW_URL, 'new')
    ]);

    const fietsen = [...usedBikes, ...newBikes];

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
    console.error('Error fetching voorraad:', error.message);

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const mockFietsen = [
      {
        id: '1',
        title: 'Qwic Premium MN7',
        state: 'used',
        stateLabel: 'Gebruikt',
        price: '€1.899,-',
        image: `${baseUrl}/images/showroom-fietsen.jpg`,
        specs: ['49cm frame', 'Bafang middenmotor', '50-80km actieradius'],
        url: '#contact'
      },
      {
        id: '2',
        title: 'Gazelle Grenoble C7',
        state: 'new',
        stateLabel: 'Nieuw',
        price: '€2.499,-',
        image: `${baseUrl}/images/fiets-spotlight.jpg`,
        specs: ['53cm frame', 'Bosch middenmotor', '70-120km actieradius'],
        url: '#contact'
      }
    ];

    res.json({
      success: true,
      count: mockFietsen.length,
      fietsen: mockFietsen,
      source: 'mock-data',
      error: error.message,
      laatsteUpdate: new Date().toISOString()
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript').send(`
(function() {
  function render(container, fietsen) {
    container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">' +
      fietsen.map(function(f) {
        return '<div style="border:1px solid #ddd;border-radius:12px;padding:16px;background:#fff;">' +
          (f.image ? '<img src="' + f.image + '" style="width:100%;height:220px;object-fit:cover;border-radius:8px;margin-bottom:12px;">' : '') +
          '<h3 style="margin:0 0 8px 0;">' + f.title + '</h3>' +
          '<div style="color:#666;margin-bottom:8px;">' + f.stateLabel + '</div>' +
          '<div style="margin-bottom:10px;">' + (Array.isArray(f.specs) ? f.specs.join(' • ') : '') + '</div>' +
          '<div style="font-size:22px;font-weight:700;color:#22c55e;margin-bottom:12px;">' + f.price + '</div>' +
          '<a href="' + f.url + '" style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">Bekijken</a>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function loadOne(container) {
    var type = container.getAttribute('data-type') || 'all';
    container.innerHTML = 'Fietsen laden...';

    fetch('/api/fietsen')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
        if (type !== 'all') {
          fietsen = fietsen.filter(function(f) { return f.state === type; });
        }
        render(container, fietsen);
      })
      .catch(function() {
        container.innerHTML = 'Fietsen konden niet worden geladen';
      });
  }

  var byId = document.getElementById('bvb-voorraad');
  if (byId) loadOne(byId);

  var byClass = document.querySelectorAll('.busvolbikes-voorraad');
  byClass.forEach(loadOne);
})();
  `);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
console.log(`Bus vol Bikes server running on port ${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
