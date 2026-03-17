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

### HTML

```html
<div class="vp-embed-wrap"
     data-api-base="https://api.jouwdomein.nl"
     data-return-url="https://jouw-wordpress-site.nl/fietsen/">

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

  <div id="vp-embed-root">Voorraad laden...</div>
</div>
```

### Script

```html
<script>
(function () {
  var wrap = document.querySelector('.vp-embed-wrap');
  if (!wrap) return;

  var apiBase = wrap.getAttribute('data-api-base');
  var returnUrl = wrap.getAttribute('data-return-url') || window.location.href;
  var root = document.getElementById('vp-embed-root');
  var buttons = wrap.querySelectorAll('.vp-embed-filter');

  var allItems = [];
  var filter = 'all';

  function esc(v){
    return String(v||'').replace(/[&<>"']/g, s =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])
    );
  }

  function render(){
    var items = filter === 'all'
      ? allItems
      : allItems.filter(i => i.state === filter);

    if (!items.length){
      root.innerHTML = 'Geen resultaten.';
      return;
    }

    root.innerHTML = items.map(item => {
      var detail = apiBase + item.url + '?return=' + encodeURIComponent(returnUrl);
      return `
        <div>
          <h3>${esc(item.title)}</h3>
          <div>${esc(item.price)}</div>
          <a href="${esc(detail)}">Bekijken</a>
        </div>
      `;
    }).join('');
  }

  buttons.forEach(btn => {
    btn.onclick = () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      render();
    };
  });

  fetch(apiBase + '/api/fietsen')
    .then(r => r.json())
    .then(data => {
      allItems = data.fietsen || [];
      render();
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
