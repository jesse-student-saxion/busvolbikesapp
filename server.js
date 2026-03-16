const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const SHOP_ID = (process.env.FIETSENWIJK_SHOP_ID || 'D40972D3C78B4BC6A44E816EDE6281CC').toUpperCase();
const BASE_URL = `https://${SHOP_ID}.hst.fietsenwijk.nl/fietsen/xml/`;

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.static(path.join(__dirname, 'public')));

function xmlUrl(cat, c, b) {
  const params = new URLSearchParams();
  params.set('cat', String(cat));
  if (c) params.set('c', c);
  if (b) params.set('b', b);
  return `${BASE_URL}?${params.toString()}`;
}

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    if (typeof v._ === 'string') return v._.trim();
    if (typeof v['#text'] === 'string') return v['#text'].trim();
  }
  return String(v).trim();
}

function pick(obj, keys, fallback = '') {
  for (const key of keys) {
    if (obj && obj[key] != null) {
      const value = text(obj[key]);
      if (value !== '') return value;
    }
  }
  return fallback;
}

function cleanPrice(value) {
  const s = text(value);
  if (!s) return 'Prijs op aanvraag';
  if (s.includes('€')) return s;
  return `€${s}`;
}

function absUrl(url, base) {
  const s = text(url);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  try {
    return new URL(s, base).href;
  } catch {
    return s;
  }
}

function collectItems(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    const k = key.toLowerCase();
    if (['fiets', 'bike', 'bicycle', 'item', 'product', 'record'].includes(k)) {
      for (const entry of asArray(value)) {
        if (entry && typeof entry === 'object') out.push(entry);
      }
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach(v => collectItems(v, out));
      } else {
        collectItems(value, out);
      }
    }
  }
  return out;
}

function parseSpecs(item) {
  const specs = [
    pick(item, ['frame_size', 'framesize', 'maat', 'frame', 'framemaat']),
    pick(item, ['motor_type', 'motor', 'motortype']),
    pick(item, ['range', 'actieradius', 'reach']),
    pick(item, ['color', 'kleur']),
    pick(item, ['year', 'bouwjaar', 'modeljaar'])
  ].filter(Boolean);
  return [...new Set(specs)];
}

function mapBike(item, state, sourceUrl, index) {
  const title = pick(item, ['title', 'titel', 'name', 'naam', 'model'], 'Onbekende fiets');
  const image = absUrl(pick(item, ['image_url', 'image', 'foto', 'afbeelding', 'img']), sourceUrl);
  const url = absUrl(pick(item, ['detail_url', 'url', 'link', 'href', 'detail']), sourceUrl) || '#';
  const rawState = pick(item, ['state', 'status', 'bicyclestate']);
  const inferredNew = rawState === '2' || /nieuw/i.test(rawState) || state === 'new';

  return {
    id: pick(item, ['id', 'ID', 'guid', 'uuid'], String(index + 1)),
    title,
    brand: pick(item, ['brand', 'merk']),
    category: pick(item, ['category', 'categorie', 'type']),
    state: inferredNew ? 'new' : 'used',
    stateLabel: inferredNew ? 'Nieuw' : 'Gebruikt',
    price: cleanPrice(pick(item, ['price', 'prijs', 'saleprice', 'verkoopprijs'])),
    image,
    url,
    description: pick(item, ['description', 'omschrijving']),
    specs: parseSpecs(item)
  };
}

async function fetchXmlFeed(cat, state, c, b) {
  const url = xmlUrl(cat, c, b);
  const response = await axios.get(url, {
    timeout: 30000,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/3.0)',
      'Accept': 'application/xml, text/xml, */*'
    }
  });

  const xml = Buffer.from(response.data).toString('utf8');
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
    normalize: true
  });

  const parsed = await parser.parseStringPromise(xml);
  const items = collectItems(parsed);
  const fietsen = items.map((item, idx) => mapBike(item, state, url, idx));
  return { fietsen, source: url, rawCount: items.length };
}

function getFallback(req) {
  const base = `${req.protocol}://${req.get('host')}`;
  return [
    {
      id: '1',
      title: 'Qwic Premium MN7',
      brand: 'Qwic',
      category: 'Elektrische fietsen',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.899,-',
      image: `${base}/images/showroom-fietsen.jpg`,
      url: '#contact',
      description: '',
      specs: ['49cm frame', 'Bafang middenmotor', '50-80km actieradius']
    },
    {
      id: '2',
      title: 'Gazelle Grenoble C7',
      brand: 'Gazelle',
      category: 'Elektrische fietsen',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.499,-',
      image: `${base}/images/fiets-spotlight.jpg`,
      url: '#contact',
      description: '',
      specs: ['53cm frame', 'Bosch middenmotor', '70-120km actieradius']
    },
    {
      id: '3',
      title: 'Cortina E-Transport',
      brand: 'Cortina',
      category: 'Transportfietsen',
      state: 'used',
      stateLabel: 'Gebruikt',
      price: '€1.599,-',
      image: `${base}/images/gezin-fietsen.jpg`,
      url: '#contact',
      description: '',
      specs: ['57cm frame', 'Bafang voorwielmotor', '40-60km actieradius']
    },
    {
      id: '4',
      title: 'Giant DailyTour E+',
      brand: 'Giant',
      category: 'Elektrische fietsen',
      state: 'new',
      stateLabel: 'Nieuw',
      price: '€2.199,-',
      image: `${base}/images/fiets-nieuw.jpg`,
      url: '#contact',
      description: '',
      specs: ['50cm frame', 'Yamaha middenmotor', '60-100km actieradius']
    }
  ];
}

app.get('/api/fietsen', async (req, res) => {
  const type = String(req.query.type || 'all').toLowerCase();
  const category = req.query.c || '';
  const brand = req.query.b || '';

  try {
    const tasks = [];
    if (type === 'all' || type === 'used') tasks.push(fetchXmlFeed(1, 'used', category, brand));
    if (type === 'all' || type === 'new') tasks.push(fetchXmlFeed(2, 'new', category, brand));

    const results = await Promise.all(tasks);
    const fietsen = results.flatMap(r => r.fietsen);

    res.json({
      success: true,
      count: fietsen.length,
      fietsen,
      source: results.map(r => r.source),
      laatsteUpdate: new Date().toISOString(),
      filters: { type, c: category || null, b: brand || null }
    });
  } catch (error) {
    console.error('Fietsen XML fout:', error.message);
    const fallback = getFallback(req);
    res.json({
      success: true,
      count: fallback.length,
      fietsen: fallback,
      source: 'fallback',
      error: error.message,
      laatsteUpdate: new Date().toISOString()
    });
  }
});

app.get('/api/fietsen.xml', async (req, res) => {
  const type = String(req.query.type || 'all').toLowerCase();
  const category = req.query.c || '';
  const brand = req.query.b || '';

  try {
    const tasks = [];
    if (type === 'all' || type === 'used') tasks.push(fetchXmlFeed(1, 'used', category, brand));
    if (type === 'all' || type === 'new') tasks.push(fetchXmlFeed(2, 'new', category, brand));
    const results = await Promise.all(tasks);
    const fietsen = results.flatMap(r => r.fietsen);

    const builder = new xml2js.Builder({ rootName: 'fietsen', headless: false });
    const xml = builder.buildObject({
      fiets: fietsen.map(f => ({
        id: f.id,
        titel: f.title,
        merk: f.brand,
        categorie: f.category,
        status: f.state,
        prijs: f.price,
        afbeelding: f.image,
        url: f.url,
        specs: { spec: f.specs }
      }))
    });

    res.type('application/xml; charset=utf-8').send(xml);
  } catch (error) {
    res.status(500).type('application/xml; charset=utf-8').send(`<?xml version="1.0" encoding="UTF-8"?><error>${String(error.message).replace(/[<&>]/g, '')}</error>`);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    shopId: SHOP_ID,
    xmlBase: BASE_URL
  });
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript').send(`
(function(){
  function esc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function render(container,fietsen){
    if(!fietsen.length){container.innerHTML='Geen fietsen gevonden';return;}
    container.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;">'+
      fietsen.map(function(f){
        var specs=Array.isArray(f.specs)?f.specs.join(' • '):'';
        return '<div style="border:1px solid #ddd;border-radius:12px;padding:16px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06);">'+
          (f.image?'<img src="'+esc(f.image)+'" alt="'+esc(f.title)+'" style="width:100%;height:220px;object-fit:cover;border-radius:8px;margin-bottom:12px;">':'')+
          '<h3 style="margin:0 0 8px 0;font-family:Arial,sans-serif;">'+esc(f.title)+'</h3>'+
          '<div style="color:#666;margin-bottom:8px;font-family:Arial,sans-serif;">'+esc(f.stateLabel)+'</div>'+
          '<div style="margin-bottom:10px;color:#444;font-family:Arial,sans-serif;font-size:14px;">'+esc(specs)+'</div>'+
          '<div style="font-size:22px;font-weight:700;color:#22c55e;margin-bottom:12px;font-family:Arial,sans-serif;">'+esc(f.price)+'</div>'+
          '<a href="'+esc(f.url||'#')+'" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-family:Arial,sans-serif;">Bekijken</a>'+
        '</div>';
      }).join('')+
    '</div>';
  }
  function loadOne(container){
    var type=container.getAttribute('data-type')||'all';
    var apiBase=(window.BVB_API_BASE||'').replace(/\/$/,'');
    var src=apiBase?apiBase+'/api/fietsen?type='+encodeURIComponent(type):'/api/fietsen?type='+encodeURIComponent(type);
    container.innerHTML='Fietsen laden...';
    fetch(src).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(data){render(container,Array.isArray(data.fietsen)?data.fietsen:[]);}).catch(function(err){console.error(err);container.innerHTML='Fietsen konden niet worden geladen';});
  }
  var byId=document.getElementById('bvb-voorraad'); if(byId) loadOne(byId);
  var byClass=document.querySelectorAll('.busvolbikes-voorraad'); byClass.forEach(loadOne);
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
