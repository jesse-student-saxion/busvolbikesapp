const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// XML Feed Proxy Endpoint
app.get('/api/fietsen', async (req, res) => {
    const { cat = '0', c, b } = req.query;
    
    try {
        // Build XML feed URL - using the working endpoint
        let xmlUrl = 'https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/xml/';
        const params = [];
        if (cat !== '0') params.push(`cat=${cat}`);
        if (c) params.push(`c=${encodeURIComponent(c)}`);
        if (b) params.push(`b=${encodeURIComponent(b)}`);
        if (params.length) xmlUrl += '?' + params.join('&');
        
        console.log('Fetching XML from:', xmlUrl);
        
        // Fetch XML with headers
        const response = await axios.get(xmlUrl, { 
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BusVolBikes/1.0)',
                'Accept': 'application/xml, text/xml, */*'
            }
        });
        
        const xmlData = response.data;
        console.log('XML received, length:', xmlData.length);
        
        // Parse XML to JSON
        const parser = new xml2js.Parser({ 
            explicitArray: false,
            mergeAttrs: true,
            normalize: true
        });
        
        const result = await parser.parseStringPromise(xmlData);
        console.log('Parsed XML keys:', Object.keys(result));
        
        // Transform data
        const fietsen = [];
        
        // Try different possible XML structures
        let bikes = [];
        
        if (result.bicycles && result.bicycles.bicycle) {
            bikes = Array.isArray(result.bicycles.bicycle) 
                ? result.bicycles.bicycle 
                : [result.bicycles.bicycle];
        } else if (result.bicycle) {
            bikes = Array.isArray(result.bicycle) 
                ? result.bicycle 
                : [result.bicycle];
        } else if (result.fietsen && result.fietsen.fiets) {
            bikes = Array.isArray(result.fietsen.fiets) 
                ? result.fietsen.fiets 
                : [result.fietsen.fiets];
        }
        
        console.log('Found bikes:', bikes.length);
        
        for (const bike of bikes) {
            const state = bike.state || bike.status || 'used';
            fietsen.push({
                id: bike.id || bike.ID || '',
                title: bike.title || bike.titel || bike.name || bike.naam || 'Onbekende fiets',
                brand: bike.brand || bike.merk || '',
                category: bike.category || bike.categorie || '',
                state: state === '2' || state === 'new' ? 'new' : 'used',
                stateLabel: state === '2' || state === 'new' ? 'Nieuw' : 'Gebruikt',
                price: bike.price || bike.prijs || 'Prijs op aanvraag',
                priceNumeric: parseFloat(bike.price_numeric || bike.prijs || 0) || 0,
                image: bike.image_url || bike.image || bike.foto || 'images/showroom-fietsen.jpg',
                description: bike.description || bike.omschrijving || '',
                url: bike.detail_url || bike.url || bike.link || '#',
                specs: [
                    bike.frame_size || bike.framesize || bike['frame-size'] || '',
                    bike.motor_type || bike.motor || bike.motortype || '',
                    bike.range || bike.actieradius || bike.reach || ''
                ].filter(s => s && s !== '')
            });
        }
        
        res.json({
            success: true,
            count: fietsen.length,
            fietsen: fietsen,
            source: xmlUrl
        });
        
    } catch (error) {
        console.error('Error fetching XML:', error.message);
        console.error('Stack:', error.stack);
        
        // Return mock data as fallback
        const mockFietsen = [
            {
                id: '1',
                title: 'Qwic Premium MN7',
                state: 'used',
                stateLabel: 'Gebruikt',
                price: '€1.899,-',
                image: 'images/showroom-fietsen.jpg',
                specs: ['49cm frame', 'Bafang middenmotor', '50-80km actieradius'],
                url: '#contact'
            },
            {
                id: '2',
                title: 'Gazelle Grenoble C7',
                state: 'new',
                stateLabel: 'Nieuw',
                price: '€2.499,-',
                image: 'images/fiets-spotlight.jpg',
                specs: ['53cm frame', 'Bosch middenmotor', '70-120km actieradius'],
                url: '#contact'
            },
            {
                id: '3',
                title: 'Cortina E-Transport',
                state: 'used',
                stateLabel: 'Gebruikt',
                price: '€1.599,-',
                image: 'images/gezin-fietsen.jpg',
                specs: ['57cm frame', 'Bafang voorwielmotor', '40-60km actieradius'],
                url: '#contact'
            },
            {
                id: '4',
                title: 'Giant DailyTour E+',
                state: 'new',
                stateLabel: 'Nieuw',
                price: '€2.199,-',
                image: 'images/fiets-nieuw.jpg',
                specs: ['50cm frame', 'Yamaha middenmotor', '60-100km actieradius'],
                url: '#contact'
            }
        ];
        
        res.json({
            success: true,
            count: mockFietsen.length,
            fietsen: mockFietsen,
            source: 'mock-data',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Bus vol Bikes server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
