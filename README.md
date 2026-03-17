# Voorraadportaal v17.1

Ontwikkelaar: **Jesse van Mullem**  
Bedrijf: **Je-Ma ICT Beheer**

## Overzicht
Dit project is een white-label voorraadportaal voor een externe voorraadbron.  
De applicatie haalt items op uit categorie-overzichten, bezoekt daarna per item de detailpagina en bouwt daaruit een eigen API, detailpagina's en een embed-script.

De zichtbare teksten zijn bewust algemeen gehouden zodat het portaal ook voor andere websites of klanten gebruikt kan worden.

## Wat de applicatie doet
De server doet in hoofdlijnen het volgende:

1. Leest de overzichtspagina's voor gebruikte en nieuwe voorraad.
2. Vindt op die pagina's de detail-links en bewaart per item het ID en de titel.
3. Bezoekt daarna elke detailpagina.
4. Leest uit de detailpagina velden zoals:
   - titel
   - prijs
   - soort
   - kleur
   - maat
   - wielmaat
   - gewicht
   - modeljaar
   - bijzonderheden
   - artikelnummer
   - garantie
   - status
5. Biedt de verzamelde gegevens aan via:
   - JSON API
   - XML feed
   - detailpagina's
   - een WordPress-embed

## Waarom dit zo is gebouwd
De externe bron biedt de gegevens niet direct in een nette, stabiele JSON-API aan.  
Daarom verzamelt dit project de gegevens via de HTML-overzichten en detailpagina's, en zet het ze daarna om naar een eigen, bruikbare structuur.

## Belangrijkste routes

### Frontend
- `/`  
  Startpagina

- `/voorraad`  
  Overzichtspagina met kaarten en filters

- `/fiets/:id`  
  Detailpagina voor één item

### API
- `/api/fietsen`  
  JSON feed met alle items

- `/api/fietsen?refresh=1`  
  Zelfde feed, maar geforceerd opnieuw ophalen

- `/api/fietsen.xml`  
  XML feed

- `/api/fietsen.xml?refresh=1`  
  XML feed met geforceerde refresh

- `/api/health`  
  Simpele healthcheck

### Media
- `/image/:id`  
  Proxy voor itemafbeeldingen

### Embed
- `/embed.js`  
  Script voor externe websites, bijvoorbeeld WordPress

## Caching
De server gebruikt caching om de bron niet bij elke aanvraag opnieuw volledig op te halen.

- Cacheduur: **10 minuten**
- Met `?refresh=1` kan handmatig een verse update worden afgedwongen.

## WordPress embed
Gebruik in een Custom HTML blok:

```html
<div id="bvb-voorraad"></div>
<script>
window.BVB_API_BASE = 'https://jouwdomein.nl';
</script>
<script src="https://jouwdomein.nl/embed.js"></script>
```

Je kunt ook een class gebruiken:

```html
<div class="busvolbikes-voorraad" data-type="all"></div>
<script>
window.BVB_API_BASE = 'https://jouwdomein.nl';
</script>
<script src="https://jouwdomein.nl/embed.js"></script>
```

Beschikbare `data-type` waarden:
- `all`
- `used`
- `new`

## Installatie lokaal

```bash
npm install
npm start
```

Daarna openen:
- `http://localhost:3000/`
- `http://localhost:3000/voorraad`
- `http://localhost:3000/api/fietsen?refresh=1`

## Deploy
De applicatie is geschikt voor Node.js hosting, bijvoorbeeld Railway.

### Basisstappen
1. Upload de projectbestanden naar een Git-repository.
2. Koppel de repository aan je hostingplatform.
3. Laat het platform `npm install` en `npm start` uitvoeren.
4. Controleer na deploy:
   - `/api/health`
   - `/api/fietsen?refresh=1`
   - `/voorraad`

## Bestandsstructuur
- `server.js`  
  Express-server, scraping, parsing, caching, API-routes en detailpagina's

- `public/index.html`  
  Startpagina

- `public/voorraad.html`  
  Overzichtspagina

- `public/voorraad.js`  
  Frontend-logica voor laden en filteren

- `public/styles.css`  
  Styling voor overzicht en detailpagina's

- `package.json`  
  Dependencies en startscript

## Dependencies
- `express` voor de webserver
- `axios` voor HTTP-requests
- `cheerio` voor HTML parsing
- `cors` voor externe embeds

## Onderhoud
Bij wijzigingen in de structuur van de bronwebsite kunnen selectors of parsing-regels aangepast moeten worden.  
De kans daarop is het grootst bij:
- detailvelden
- prijsopmaak
- afbeelding-wrapper
- overzichtstitels

## Notities
- De applicatie gebruikt white-label teksten in de frontend.
- De data blijft afkomstig uit de externe bron.
- Het embed-script is bruikbaar op externe websites zonder dat de volledige frontend hoeft te worden ingebouwd.


## Changelog

### v18
- Terugknop op de detailpagina ondersteunt nu een `return` queryparameter.
- Overzichtspagina en embed voegen automatisch de huidige WordPress-URL toe als return-URL.
- Gebruikers keren daardoor vanaf de detailpagina weer terug naar de WordPress-pagina in plaats van naar het portaal zelf.
- README aangevuld met uitleg over de terugnavigatie.

### v17
- Detailtitel en prijs op detailpagina kleiner gemaakt.
- White-label teksten toegepast in de zichtbare interface.
- README sterk uitgebreid met uitleg, routes, embed en onderhoudsinformatie.

### v16
- Prijsnormalisatie toegevoegd voor kapotte euro-symbolen.
- Extra detectie van prijsregels zonder correct euroteken.

### v15
- Prijsdetectie uitgebreid via `th/td`, `td`, bold tekst en body text.

### v14
- Afbeelding-proxy verbeterd via wrapper HTML naar echte `<img>` bron.

### v13
- Titel uit lijstpagina behouden.
- Afbeelding-proxy teruggebracht als `/image/:id`.

### v12
- Detailvelden via tabel-rijen uitgelezen.
- Directe afbeeldings-URL als bron gebruikt.

### v11
- Regex-gebaseerde detailparser en image proxy verbeterd.

### v10
- Layout en detailpresentatie opgeschoond.

### v9
- Caching en stabielere detailpagina toegevoegd.

### v8
- Eerste detailpagina en prijsparser toegevoegd.

### v7
- Detail scraping geïntroduceerd.

### v6
- HTML als hoofdbron gebruikt in plaats van XML.

### v5
- Eerste XML-verwerking en basis-API opgezet.

### v4 en lager
- Prototypefase met experimenten rond scraping, XML, layouts en hosting.

## Terugnavigatie vanaf detailpagina
De detailpagina ondersteunt een queryparameter:

- `return`

Voorbeeld:

```text
https://jouwdomein.nl/fiets/BIKEID?return=https%3A%2F%2Fjewordpresssite.nl%2Ffietsen%2F
```

De embed en overzichtspagina voegen deze parameter automatisch toe met de huidige pagina-URL. Daardoor werkt de knop **Terug** ook correct wanneer de gebruiker vanuit WordPress naar een detailpagina gaat.
