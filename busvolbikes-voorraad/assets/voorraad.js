// Bus vol Bikes - Voorraad JavaScript
(function() {
    'use strict';
    
    // Configuratie vanuit WordPress
    const config = window.bvbData || {
        apiUrl: 'https://busvolbikes-website-production.up.railway.app/fietsen-data.json',
        strings: {
            loading: 'Fietsen laden...',
            error: 'Fietsen konden niet worden geladen.',
            noResults: 'Geen fietsen gevonden met dit filter.',
            all: 'Alle fietsen',
            used: 'Gebruikt',
            new: 'Nieuw',
            view: 'Bekijken →',
            available: 'fietsen beschikbaar',
            lastUpdate: 'Laatste update:'
        }
    };
    
    let alleFietsen = [];
    
    /**
     * Initialiseer de voorraadweergave
     */
    function init() {
        const containers = document.querySelectorAll('.bvb-voorraad');
        
        containers.forEach(function(container) {
            const grid = container.querySelector('#bvb-fietsen-grid');
            const countEl = container.querySelector('#bvb-fietsen-count');
            const updateEl = container.querySelector('#bvb-update-time');
            
            if (!grid) return;
            
            // Haal settings op uit data-attributen
            const limit = parseInt(container.dataset.limit) || 0;
            const defaultFilter = container.dataset.filter || 'all';
            
            // Laad de fietsen
            loadFietsen(grid, countEl, updateEl, limit, defaultFilter);
            
            // Event listeners voor filter buttons
            const filterButtons = container.querySelectorAll('.bvb-filter-btn');
            filterButtons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    // Update active state
                    filterButtons.forEach(function(b) {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                    
                    // Toon gefilterde fietsen
                    const filter = btn.dataset.filter;
                    toonFietsen(grid, limit, filter);
                });
            });
        });
    }
    
    /**
     * Laad fietsen data van de API
     */
    async function loadFietsen(grid, countEl, updateEl, limit, defaultFilter) {
        try {
            const response = await fetch(config.apiUrl);
            if (!response.ok) throw new Error('Data niet gevonden');
            
            const data = await response.json();
            alleFietsen = data.fietsen || [];
            
            // Update stats
            if (countEl) {
                countEl.textContent = alleFietsen.length + ' ' + config.strings.available;
            }
            
            if (updateEl && data.laatsteUpdate) {
                const date = new Date(data.laatsteUpdate);
                updateEl.textContent = config.strings.lastUpdate + ' ' + date.toLocaleDateString('nl-NL', { 
                    day: 'numeric', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }
            
            // Toon fietsen met default filter
            toonFietsen(grid, limit, defaultFilter);
            
        } catch (error) {
            console.error('Fout bij laden fietsen:', error);
            grid.innerHTML = createErrorHTML();
            if (countEl) {
                countEl.textContent = config.strings.error;
            }
        }
    }
    
    /**
     * Toon fietsen met filter en limit
     */
    function toonFietsen(grid, limit, filter) {
        // Filter fietsen
        let gefilterdeFietsen = alleFietsen;
        
        if (filter === 'gebruikt') {
            gefilterdeFietsen = alleFietsen.filter(function(f) {
                return (f.soort && f.soort.toLowerCase().includes('gebruik')) || 
                       (f.titel && f.titel.toLowerCase().includes('gebruik'));
            });
        } else if (filter === 'nieuw') {
            gefilterdeFietsen = alleFietsen.filter(function(f) {
                return (f.soort && f.soort.toLowerCase().includes('nieuw')) || 
                       (f.titel && f.titel.toLowerCase().includes('nieuw'));
            });
        }
        
        // Apply limit
        if (limit > 0) {
            gefilterdeFietsen = gefilterdeFietsen.slice(0, limit);
        }
        
        if (gefilterdeFietsen.length === 0) {
            grid.innerHTML = '<div class="bvb-loading">' + config.strings.noResults + '</div>';
            return;
        }
        
        // Genereer HTML
        grid.innerHTML = gefilterdeFietsen.map(createFietsCard).join('');
    }
    
    /**
     * Maak HTML voor een fiets kaart
     */
    function createFietsCard(fiets) {
        const isNieuw = (fiets.soort && fiets.soort.toLowerCase().includes('nieuw')) || 
                        (fiets.titel && fiets.titel.toLowerCase().includes('nieuw'));
        const badgeClass = isNieuw ? 'bvb-fiets-badge nieuw' : 'bvb-fiets-badge';
        const badgeText = isNieuw ? config.strings.new : config.strings.used;
        
        const details = [
            fiets.geslacht,
            fiets.maat,
            fiets.kleur
        ].filter(function(x) { return x; }).join(' • ');
        
        const specs = [];
        if (fiets.modeljaar) specs.push('Bouwjaar: ' + fiets.modeljaar);
        if (fiets.wielmaat) specs.push('Wielmaat: ' + fiets.wielmaat);
        
        let specsHtml = '';
        if (specs.length > 0) {
            specsHtml = '<div class="bvb-fiets-specs">' + 
                specs.map(function(s) { 
                    return '<span class="bvb-fiets-spec">' + s + '</span>'; 
                }).join('') + 
                '</div>';
        }
        
        return [
            '<article class="bvb-fiets-card">',
                '<div class="bvb-fiets-image">',
                    '<span class="' + badgeClass + '">' + badgeText + '</span>',
                    '<img src="' + fiets.foto + '" alt="' + fiets.titel + '" loading="lazy" onerror="this.style.display=\'none\'">',
                '</div>',
                '<div class="bvb-fiets-content">',
                    '<h3 class="bvb-fiets-title">' + fiets.titel + '</h3>',
                    '<p class="bvb-fiets-details">' + details + '</p>',
                    specsHtml,
                    '<div class="bvb-fiets-footer">',
                        '<span class="bvb-fiets-prijs">' + fiets.prijs + '</span>',
                        '<a href="' + fiets.detailUrl + '" target="_blank" class="bvb-fiets-link">' + config.strings.view + '</a>',
                    '</div>',
                '</div>',
            '</article>'
        ].join('');
    }
    
    /**
     * Maak error HTML
     */
    function createErrorHTML() {
        return [
            '<div class="bvb-error">',
                '<p>❌ ' + config.strings.error + '</p>',
                '<p><a href="https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/" target="_blank">',
                    'Bekijk voorraad direct op Fietsenwijk →',
                '</a></p>',
            '</div>'
        ].join('');
    }
    
    // Start wanneer DOM geladen is
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
