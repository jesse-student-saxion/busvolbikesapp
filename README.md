# Bus vol Bikes XML app

Nieuwe versie op basis van de officiële Fietsenwijk XML-feed.

## Starten

```bash
npm install
npm start
```

Lokaal draait de app dan op:
- http://localhost:3000
- http://localhost:3000/voorraad
- http://localhost:3000/api/fietsen
- http://localhost:3000/api/fietsen.xml
- http://localhost:3000/api/health

## Railway

Deze app is Railway-ready.

## Omgevingsvariabele

Optioneel kun je een andere Fietsenwijk shop-id zetten:

```bash
FIETSENWIJK_SHOP_ID=D40972D3C78B4BC6A44E816EDE6281CC
```

## WordPress embed

Plak dit in een Custom HTML-blok:

```html
<div id="bvb-voorraad"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```

Alleen gebruikte fietsen:

```html
<div class="busvolbikes-voorraad" data-type="used"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```

Alleen nieuwe fietsen:

```html
<div class="busvolbikes-voorraad" data-type="new"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```
