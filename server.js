const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

const USED_URL = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/?cat=1';
const NEW_URL = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/?cat=2';

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

function absUrl(url, base) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, base).href;
  } catch (e) {
    return url;
  }
}

function cleanText(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCards($, selectors, state, baseUrl) {
  const results = [];
  selectors.each((i, el) => {
    const root = $(el);
    const title = cleanText(
      root.find('h1, h2, h3, h4, .title, .titel, .product-title').first().text() ||
      root.find('[title]').first().attr('title') ||
      root.find('img').first().attr('alt') || ''
    );

    let href = root.find('a[href]').first().attr('href') || '';
    let image = root.find('img').first().attr('src') || root.find('img').first().attr('data-src') || '';
    const allText = cleanText(root.text());
    const priceMatch = allText.match(/€\s?[\d\.]+(?:,[\d]{2})?(?:,-)?/i);
    const frameMatch = allText.match(/\b\d{2}\s?cm\b/i);
    const kmMatch = allText.match(/\b\d{1,3}\s?-\s?\d{1,3}\s?km\b/i);
    const motorMatch = allText.match(/\b(Bosch|Bafang|Yamaha|Shimano)[^,.]*motor\b/i);

    if (!title || !href) return;

    href = absUrl(href, baseUrl);
    image = absUrl(image, baseUrl);

    results.push({
      id: String(i + 1),
      title,
      state,
      stateLabel: state === 'new' ? 'Nieuw' : 'Gebruikt',
      price: priceMatch ? priceMatch[0] : 'Prijs op aanvraag',
      image,
      url: href,
      specs: [
        frameMatch ? frameMatch[0] + ' frame' : '',
        motorMatch ? motorMatch[0] : '',
        kmMatch ? kmMatch[0] + ' actieradius' : ''
      ].filter(Boolean)
    });
  });
  return uniqueBy(results, (x) => x.url || x.title);
}

function parseBikesFromHtml(html, state, baseUrl) {
  const $ = cheerio.load(html);
  const selectorGroups = [
    $('article'),
    $('.fiets, .fiets-item, .bike, .bike-item, .product, .product-item, .card'),
    $('li'),
    $('div')
  ];

  for (const group of selectorGroups) {
    const items = extractCards($, group, state, baseUrl).filter((x) => x.title.length > 2);
    if (items.length >= 2) return items;
  }

  return [];
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

function getFallback(baseUrl) {
  return [
    {
      id: '1',
      title: 'Qwic Premium MN7',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.899,-',
      image: baseUrl + '/placeholder-used.svg',
      url: '#',
      specs: ['49cm frame', 'Bafang middenmotor', '50-80km actieradius']
    },
    {
      id: '2',
      title: 'Gazelle Grenoble C7',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.499,-',
      image: baseUrl + '/placeholder-new.svg',
      url: '#',
      specs: ['53cm frame', 'Bosch middenmotor', '70-120km actieradius']
    }
  ];
}

app.get('/api/fietsen', async (req, res) => {
  const type = String(req.query.type || 'all').toLowerCase();
  const baseUrl = req.protocol + '://' + req.get('host');

  try {
    let used = [];
    let fresh = [];

    if (type === 'all' || type === 'used') {
      used = await fetchCategory(USED_URL, 'used');
    }
    if (type === 'all' || type === 'new') {
      fresh = await fetchCategory(NEW_URL, 'new');
    }

    let fietsen = used.concat(fresh);
    if (!fietsen.length) {
      fietsen = getFallback(baseUrl);
    }

    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      source: { used: USED_URL, new: NEW_URL },
      laatsteUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching voorraad:', error.message);
    const fietsen = getFallback(baseUrl);
    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      source: 'fallback',
      error: error.message,
      laatsteUpdate: new Date().toISOString()
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/embed.js', (req, res) => {
  const origin = req.protocol + '://' + req.get('host');
  res.type('application/javascript').send(`
(function(){
  var API_BASE = ${JSON.stringify(origin)};
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function render(container, fietsen){
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;font-family:Arial,sans-serif;">';
    fietsen.forEach(function(f){
      html += '<div style="border:1px solid #ddd;border-radius:12px;padding:16px;background:#fff">';
      if(f.image){html += '<img src="'+esc(f.image)+'" alt="'+esc(f.title)+'" style="width:100%;height:220px;object-fit:cover;border-radius:8px;margin-bottom:12px">';}
      html += '<div style="font-size:12px;font-weight:700;display:inline-block;background:'+(f.state==='new'?'#2563eb':'#22c55e')+';color:#fff;padding:4px 10px;border-radius:999px;margin-bottom:10px">'+esc(f.stateLabel)+'</div>';
      html += '<h3 style="margin:0 0 8px 0;color:#0f172a">'+esc(f.title)+'</h3>';
      if(Array.isArray(f.specs)&&f.specs.length){html += '<div style="color:#64748b;font-size:14px;margin-bottom:10px">'+esc(f.specs.join(' • '))+'</div>';}
      html += '<div style="font-size:22px;font-weight:700;color:#22c55e;margin-bottom:12px">'+esc(f.price||'Prijs op aanvraag')+'</div>';
      html += '<a href="'+esc(f.url||'#')+'" style="display:inline-block;background:#111827;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">Bekijken</a>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }
  function load(container){
    var type = container.getAttribute('data-type') || 'all';
    container.innerHTML = 'Fietsen laden...';
    fetch(API_BASE + '/api/fietsen?type=' + encodeURIComponent(type))
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(data){ render(container, Array.isArray(data.fietsen) ? data.fietsen : []); })
      .catch(function(err){ container.innerHTML = 'Fietsen konden niet worden geladen'; console.error(err); });
  }
  var single = document.getElementById('bvb-voorraad');
  if(single) load(single);
  var list = document.querySelectorAll('.busvolbikes-voorraad');
  for(var i=0;i<list.length;i++) load(list[i]);
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
