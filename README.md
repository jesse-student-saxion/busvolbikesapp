npm install
npm start

Routes:
- /voorraad
- /api/fietsen?refresh=1
- /api/fietsen.xml
- /api/health
- /fiets/:id
- /image/:id
- /embed.js

WordPress:
<div id="bvb-voorraad"></div>
<script>
window.BVB_API_BASE = 'https://api.busvolbikes.nl';
</script>
<script src="https://api.busvolbikes.nl/embed.js"></script>


v15:
- extra prijsdetectie via th/td rij, bold tekst en body fallback


v16:
- prijsnormalisatie voor kapotte euro-tekens en prijsregels zonder echt euro-symbool
