# Bus vol Bikes app

Railway-ready Node/Express app voor Bus vol Bikes.

## Starten

```bash
npm install
npm start
```

## Belangrijke pagina's

- `/` homepage
- `/voorraad` voorraadpagina
- `/api/fietsen` JSON API
- `/api/fietsen?type=used` alleen gebruikt
- `/api/fietsen?type=new` alleen nieuw
- `/api/fietsen.xml` XML feed
- `/api/health` healthcheck
- `/embed.js` WordPress embed script

## WordPress embed

Plak dit in een Custom HTML blok:

```html
<div id="bvb-voorraad"></div>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```

Of alleen gebruikt:

```html
<div class="busvolbikes-voorraad" data-type="used"></div>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```
