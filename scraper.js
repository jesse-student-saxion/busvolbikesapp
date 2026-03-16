const axios = require('axios');
const fs = require('fs');
const path = require('path');

const FEITSENWIJK_URL = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/';
const OUTPUT_FILE = path.join(__dirname, 'public', 'fietsen-data.json');

async function scrapeFietsen() {
    try {
        console.log('Fietsen ophalen van Fietsenwijk...');
        
        // Haal zowel gebruikte (cat=1) als nieuwe (cat=2) fietsen op
        const [gebruiktHtml, nieuwHtml] = await Promise.all([
            fetchFietsenHTML(1),  // Gebruikt
            fetchFietsenHTML(2)   // Nieuw
        ]);
        
        // Parse beide categorieën
        const gebruikteFietsen = parseFietsenFromHTML(gebruiktHtml, 'Gebruikt');
        const nieuweFietsen = parseFietsenFromHTML(nieuwHtml, 'Nieuw');
        
        // Combineer en verwijder duplicaten (op ID)
        const alleFietsen = [...gebruikteFietsen, ...nieuweFietsen];
        const uniekeFietsen = verwijderDuplicaten(alleFietsen);
        
        if (uniekeFietsen.length === 0) {
            console.log('⚠️  Geen fietsen gevonden');
            return;
        }
        
        console.log(`   Gebruikt: ${gebruikteFietsen.length} fietsen`);
        console.log(`   Nieuw: ${nieuweFietsen.length} fietsen`);
        console.log(`   Totaal uniek: ${uniekeFietsen.length} fietsen`);
        
        // Sorteer op titel
        uniekeFietsen.sort((a, b) => a.titel.localeCompare(b.titel));
        
        // Maak output object
        const output = {
            laatsteUpdate: new Date().toISOString(),
            aantal: uniekeFietsen.length,
            gebruikt: gebruikteFietsen.length,
            nieuw: nieuweFietsen.length,
            fietsen: uniekeFietsen
        };
        
        // Zorg dat public folder bestaat
        const publicDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        // Schrijf naar JSON file
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
        
        console.log(`✅ ${uniekeFietsen.length} fietsen opgeslagen in fietsen-data.json`);
        console.log(`📸 Foto's zijn nu 800px breed (scherp!)`);
        
    } catch (error) {
        console.error('❌ Fout bij ophalen fietsen:', error.message);
        process.exit(1);
    }
}

async function fetchFietsenHTML(category) {
    const url = `${FEITSENWIJK_URL}?cat=${category}`;
    console.log(`   Ophalen: ${url}`);
    
    const response = await axios.get(url, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
            'Accept': 'text/html'
        },
        responseEncoding: 'binary'
    });
    
    // Converteer van latin1 (iso-8859-1) naar utf-8
    return Buffer.from(response.data, 'binary').toString('utf8');
}

function verwijderDuplicaten(fietsen) {
    const gezien = new Set();
    return fietsen.filter(fiets => {
        if (gezien.has(fiets.id)) {
            return false;
        }
        gezien.add(fiets.id);
        return true;
    });
}

function parseFietsenFromHTML(html, categorie) {
    const fietsen = [];
    
    // Zoek naar table rows met fiets data
    // Pattern: <tr>...<a href="/fietsen/detail/?b=ID"><img src="/images/bicycles/...060.jpg">...prijs...</tr>
    // Capture groups: 1=ID, 2=foto, 3=titel, 4=details, 5=prijs
    const rowRegex = /<tr>\s*<td[^>]*>\s*<a href="\/fietsen\/detail\/\?b=([^"]+)"[^>]*>\s*<img src="([^"]+)"[^>]*>\s*<\/a>\s*<\/td>\s*<td[^>]*>\s*<a[^>]*>\s*<b>([^<]+)<\/b>\s*<\/a>.*?<br>\s*([^<]+)<br>\s*<\/td>\s*<td[^>]*>[\s&nbsp;]*<b>\s*([€\xa0\ufffd\s\d\.,\-]*)\s*<\/b>/gi;
    
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const id = match[1];
        const fotoSmall = match[2]; // /images/bicycles/...060.jpg
        const titel = match[3].trim();
        const details = match[4].trim();
        
        // Vervang 060.jpg door 800.jpg voor grotere foto
        const fotoLarge = fotoSmall.replace(/060\.jpg$/i, '800.jpg');
        const fotoUrl = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl' + fotoLarge;
        
        // Parse details: "Elektrische fiets, heren, 55 cm, blauw"
        const detailParts = details.split(',').map(p => p.trim());
        const type = detailParts[0] || '';
        const geslacht = detailParts[1] || '';
        const maat = detailParts[2] || '';
        const kleur = detailParts[3] || '';
        
        // Haal prijs op (groep 5) en fix encoding
        let prijs = match[5] ? match[5].trim().replace(/[\xa0\ufffd]/g, '€') : '';
        
        fietsen.push({
            id: id,
            titel: titel,
            prijs: prijs,
            prijsNummer: parsePrijs(prijs),
            soort: categorie,  // 'Gebruikt' of 'Nieuw'
            type: type,
            geslacht: geslacht,
            kleur: kleur,
            maat: maat,
            foto: fotoUrl,
            detailUrl: `https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/detail/?b=${id}`
        });
    }
    
    return fietsen;
}

function parsePrijs(prijsString) {
    if (!prijsString) return 0;
    const match = prijsString.replace(/[^0-9]/g, '');
    return parseInt(match) || 0;
}

// Voer uit als dit script direct wordt aangeroepen
if (require.main === module) {
    scrapeFietsen();
}

module.exports = { scrapeFietsen };