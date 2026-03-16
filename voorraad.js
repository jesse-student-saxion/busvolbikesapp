// Voorraad pagina JavaScript

let alleFietsen = [];
let huidigeFilter = 'all';

// Laad fietsen data
async function laadFietsen() {
    const grid = document.getElementById('fietsen-grid');
    const countEl = document.getElementById('fietsen-count');
    const updateEl = document.getElementById('update-time');
    
    try {
        const response = await fetch('public/fietsen-data.json');
        if (!response.ok) throw new Error('Data niet gevonden');
        
        const data = await response.json();
        alleFietsen = data.fietsen || [];
        
        // Update stats
        countEl.textContent = `${alleFietsen.length} fietsen beschikbaar`;
        if (data.laatsteUpdate) {
            const date = new Date(data.laatsteUpdate);
            updateEl.textContent = `Laatste update: ${date.toLocaleDateString('nl-NL', { 
                day: 'numeric', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit' 
            })}`;
        }
        
        // Toon fietsen
        toonFietsen();
        
    } catch (error) {
        console.error('Fout bij laden fietsen:', error);
        grid.innerHTML = `
            <div class="error">
                <p>❌ Fietsen konden niet worden geladen.</p>
                <p><a href="https://d40972d3c78b4bc6a44e816ede6281cc.hst.fietsenwijk.nl/fietsen/" target="_blank">
                    Bekijk voorraad direct op Fietsenwijk →
                </a></p>
            </div>
        `;
        countEl.textContent = 'Fout bij laden';
    }
}

// Toon fietsen met filter
function toonFietsen() {
    const grid = document.getElementById('fietsen-grid');
    
    // Filter fietsen
    let gefilterdeFietsen = alleFietsen;
    if (huidigeFilter === 'gebruikt') {
        gefilterdeFietsen = alleFietsen.filter(f => 
            f.soort?.toLowerCase().includes('gebruik') || 
            f.titel?.toLowerCase().includes('gebruik')
        );
    } else if (huidigeFilter === 'nieuw') {
        gefilterdeFietsen = alleFietsen.filter(f => 
            f.soort?.toLowerCase().includes('nieuw') || 
            f.titel?.toLowerCase().includes('nieuw')
        );
    }
    
    if (gefilterdeFietsen.length === 0) {
        grid.innerHTML = '<div class="loading">Geen fietsen gevonden met dit filter.</div>';
        return;
    }
    
    // Genereer HTML
    grid.innerHTML = gefilterdeFietsen.map(fiets => createFietsCard(fiets)).join('');
}

// Maak fiets kaart HTML
function createFietsCard(fiets) {
    const isNieuw = fiets.soort?.toLowerCase().includes('nieuw') || 
                    fiets.titel?.toLowerCase().includes('nieuw');
    const badge = isNieuw ? 
        '<span class="fiets-badge nieuw">Nieuw</span>' : 
        '<span class="fiets-badge">Gebruikt</span>';
    
    const details = [
        fiets.geslacht,
        fiets.maat,
        fiets.kleur
    ].filter(Boolean).join(' • ');
    
    const specs = [
        fiets.modeljaar && `Bouwjaar: ${fiets.modeljaar}`,
        fiets.wielmaat && `Wielmaat: ${fiets.wielmaat}`
    ].filter(Boolean);
    
    const specsHtml = specs.length > 0 ? 
        `<div class="fiets-specs">${specs.map(s => `<span class="fiets-spec">${s}</span>`).join('')}</div>` : 
        '';
    
    return `
        <article class="fiets-card">
            <div class="fiets-image" style="position: relative;">
                ${badge}
                <img src="${fiets.foto}" 
                     alt="${fiets.titel}" 
                     loading="lazy"
                     onerror="this.src='images/voorraad-buiten.jpg'">
            </div>
            <div class="fiets-content">
                <h3 class="fiets-title">${fiets.titel}</h3>
                <p class="fiets-details">${details}</p>
                ${specsHtml}
                <div class="fiets-footer">
                    <span class="fiets-prijs">${fiets.prijs}</span>
                    <a href="${fiets.detailUrl}" target="_blank" class="fiets-link">
                        Bekijken →
                    </a>
                </div>
            </div>
        </article>
    `;
}

// Filter handlers
document.addEventListener('DOMContentLoaded', () => {
    laadFietsen();
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update filter en toon
            huidigeFilter = btn.dataset.filter;
            toonFietsen();
        });
    });
});