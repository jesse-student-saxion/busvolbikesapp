# Bus vol Bikes app

## Starten

```bash
npm install
npm start
```

## Endpoints

- `/api/fietsen`
- `/api/fietsen.xml`
- `/api/health`
- `/voorraad`
- `/embed.js`

## WordPress embed

```html
<div id="bvb-voorraad"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>
```

## Opmerkingen

- Gebruikt HTML van Fietsenwijk als bron.
- Bouwt de afbeeldings-URL stabiel op via:
  `/fietsen/detail/images/?b=...&css=/css/default.css`
- Afbeeldingen worden overal even groot weergegeven.
