# Voorraadportaal

Een white-label voorraadportaal voor het ophalen en tonen van fietsvoorraad via scraping.  
Geschikt voor integratie in websites zoals WordPress.

---

## Features

- Live scraping van externe voorraadbron
- Detailpagina per item
- Afbeelding proxy (betrouwbare images)
- Prijs parsing (ook bij slechte HTML)
- Caching voor performance
- WordPress embed (standaard + filters)
- Mobile friendly UI
- Volledig white-label

---

## Installatie

```bash
npm install
node server.js
```

Standaard draait de server op:

```
http://localhost:3000
```

---

## API

### Alle fietsen

```
/api/fietsen
```

### Force refresh (aanrader bij testen)

```
/api/fietsen?refresh=1
```

### Handmatige refresh trigger

```
/api/refresh
```

---

## Detailpagina

```
/fiets/:id
```

---

## Terugnavigatie (WordPress fix)

De detailpagina ondersteunt een return parameter:

```
/fiets/ID?return=https://jouwsite.nl/fietsen/
```

Hierdoor werkt de terugknop correct wanneer je vanuit WordPress komt.

---

## WordPress Embed (standaard)

Gebruik deze voor een snelle integratie:

```html
<div id="voorraad-root"></div>
<script src="https://api.jouwdomein.nl/embed.js"></script>
```

---

## WordPress Embed (met filters)

Deze variant bevat filters voor:

- Alle
- Gebruikt
- Nieuw



### Script

```html
<style>
.vp-embed-wrap{
  max-width:1280px;
  margin:0 auto;
  padding:24px 16px 40px;
  background:#f4f6fb;
  font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  color:#101828;
}
.vp-embed-toolbar{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:16px;
  margin-bottom:22px;
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:24px;
  padding:24px;
  box-shadow:0 8px 28px rgba(16,24,40,.05);
}
.vp-embed-badge{
  display:inline-flex;
  padding:10px 16px;
  border-radius:999px;
  background:#e9f7f0;
  color:#21795f;
  font-weight:800;
  font-size:14px;
}
.vp-embed-title{
  margin:12px 0 0;
  font-size:clamp(26px,4vw,40px);
  line-height:1.05;
  color:#0f172a;
}
.vp-embed-filters{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.vp-embed-filter{
  padding:12px 16px;
  border-radius:14px;
  border:1px solid #e5e7eb;
  background:#fff;
  font-weight:800;
  color:#101828;
  cursor:pointer;
}
.vp-embed-filter.active{
  background:#08194d;
  color:#fff;
  border-color:#08194d;
}
.vp-embed-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(290px,1fr));
  gap:22px;
}
.vp-embed-card{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:26px;
  overflow:hidden;
  box-shadow:0 10px 28px rgba(16,24,40,.06);
}
.vp-embed-image{
  height:250px;
  background:#f7f8fa;
  padding:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}
.vp-embed-image img{
  width:100%;
  height:100%;
  object-fit:contain;
  display:block;
}
.vp-embed-content{
  padding:20px;
}
.vp-embed-card-title{
  font-size:20px;
  line-height:1.25;
  margin:12px 0 8px;
  color:#0f172a;
  min-height:50px;
}
.vp-embed-meta{
  color:#667085;
  font-size:15px;
  line-height:1.5;
  min-height:44px;
  margin-bottom:16px;
}
.vp-embed-price{
  font-size:clamp(30px,4vw,46px);
  line-height:1;
  font-weight:900;
  color:#12806a;
  margin-bottom:18px;
}
.vp-embed-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:14px 18px;
  border-radius:16px;
  text-decoration:none !important;
  font-weight:800;
  background:#08194d;
  color:#fff !important;
}
.vp-embed-state{
  display:inline-flex;
  padding:10px 16px;
  border-radius:999px;
  background:#e9f7f0;
  color:#21795f;
  font-weight:800;
  font-size:14px;
}
.vp-embed-empty,
.vp-embed-loading,
.vp-embed-error{
  background:#fff;
  border:1px solid #e5e7eb;
  border-radius:24px;
  padding:24px;
}
@media (max-width:920px){
  .vp-embed-toolbar{
    flex-direction:column;
    align-items:flex-start;
  }
}
@media (max-width:640px){
  .vp-embed-wrap{
    padding:14px 12px 28px;
  }
  .vp-embed-toolbar,
  .vp-embed-content{
    padding:18px;
  }
  .vp-embed-grid{
    grid-template-columns:1fr;
  }
  .vp-embed-image{
    height:220px;
  }
  .vp-embed-card-title{
    min-height:0;
  }
}
</style>

<div class="vp-embed-wrap" data-api-base="https://api.busvolbikes.nl" data-return-url="https://busvolbikes.nl/aanbod-fietsen/">
  <div class="vp-embed-toolbar">
    <div>
      <span class="vp-embed-badge">Voorraad</span>
      <h2 class="vp-embed-title">Actuele voorraad</h2>
    </div>

    <div class="vp-embed-filters">
      <button class="vp-embed-filter active" data-filter="all">Alle fietsen</button>
      <button class="vp-embed-filter" data-filter="used">Gebruikt</button>
      <button class="vp-embed-filter" data-filter="new">Nieuw</button>
    </div>
  </div>

  <div id="vp-embed-root" class="vp-embed-loading">Voorraad laden...</div>
</div>

<script>
(function () {
  var wrap = document.querySelector('.vp-embed-wrap');
  if (!wrap) return;

  var apiBase = wrap.getAttribute('data-api-base') || 'https://api.busvolbikes.nl';
  var returnUrl = wrap.getAttribute('data-return-url') || window.location.href;
  var root = document.getElementById('vp-embed-root');
  var filterButtons = wrap.querySelectorAll('.vp-embed-filter');

  var allItems = [];
  var currentFilter = 'all';

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getFilteredItems() {
    if (currentFilter === 'all') return allItems;
    return allItems.filter(function (item) {
      return item.state === currentFilter;
    });
  }

  function render() {
    var items = getFilteredItems();

    if (!items.length) {
      root.className = 'vp-embed-empty';
      root.innerHTML = 'Geen fietsen gevonden voor dit filter.';
      return;
    }

    root.className = 'vp-embed-grid';
    root.innerHTML = items.map(function (item) {
      var specs = Array.isArray(item.specs) ? item.specs.slice(0, 2).join(' • ') : '';
      var detailUrl = apiBase + item.url + '?return=' + encodeURIComponent(returnUrl);

      return '' +
        '<article class="vp-embed-card">' +
          '<div class="vp-embed-image">' +
            '<img src="' + esc(apiBase + item.image) + '" alt="' + esc(item.title) + '" loading="lazy">' +
          '</div>' +
          '<div class="vp-embed-content">' +
            '<span class="vp-embed-state">' + esc(item.stateLabel || '') + '</span>' +
            '<h3 class="vp-embed-card-title">' + esc(item.title || '') + '</h3>' +
            '<div class="vp-embed-meta">' + esc(specs) + '</div>' +
            '<div class="vp-embed-price">' + esc(item.price || '') + '</div>' +
            '<a class="vp-embed-btn" href="' + esc(detailUrl) + '">Bekijken</a>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      render();
    });
  });

  fetch(apiBase + '/api/fietsen?refresh=1')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      allItems = Array.isArray(data.fietsen) ? data.fietsen : [];
      render();
    })
    .catch(function () {
      root.className = 'vp-embed-error';
      root.innerHTML = 'Voorraad kon niet worden geladen.';
    });
})();
</script>
```

---

## Werking

1. API haalt lijstpagina op
2. Data wordt geparsed (titel, prijs, image, detail)
3. Detailpagina wordt extra gescraped
4. Data wordt gecached
5. Frontend of embed gebruikt JSON output

---

## Cache

Standaard:

```js
const CACHE_TIME = 1000 * 60 * 5;
```

Force refresh:

```
/api/fietsen?refresh=1
```

---

## Ontwikkelaar

Jesse van Mullem  
Je-Ma ICT Beheer

---

## Changelog

### v18
- Return URL support toegevoegd
- WordPress terugknop fix
- Embed met filters toegevoegd
- README uitgebreid

### v17
- Detailpagina styling verbeterd
- White-label teksten toegevoegd

### v16
- Prijs parsing verbeterd

### v15
- Extra prijs detectie

### v14
- Image proxy verbeterd

### v13 en lager
- Basis scraping, API en layout opgebouwd
