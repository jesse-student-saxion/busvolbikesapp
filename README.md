# Bus vol Bikes HTML + XML app

Deze app haalt voorraad op uit de HTML-pagina's van Fietsenwijk en biedt daarna:

- `/api/fietsen` als JSON
- `/api/fietsen.xml` als eigen XML feed
- `/embed.js` voor WordPress
- `/voorraad` als losse pagina

## Starten

```bash
npm install
npm start
```

## WordPress embed

```html
<div id="bvb-voorraad"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```

Of alleen gebruikt:

```html
<div class="busvolbikes-voorraad" data-type="used"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```
