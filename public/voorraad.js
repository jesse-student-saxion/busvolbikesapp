(function(){
  const grid = document.getElementById('grid');
  const countEl = document.getElementById('count');
  const updatedEl = document.getElementById('updated');
  const buttons = document.querySelectorAll('.filter');
  let currentType = 'all';
  let fietsen = [];

  function esc(v){
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render() {
    let shown = fietsen;
    if (currentType !== 'all') {
      shown = fietsen.filter(f => f.state === currentType);
    }

    countEl.textContent = shown.length + ' fietsen beschikbaar';

    if (!shown.length) {
      grid.innerHTML = '<div class="loading">Geen fietsen gevonden met dit filter.</div>';
      return;
    }

    grid.innerHTML = shown.map(function(f){
      const badgeClass = f.state === 'new' ? 'badge new' : 'badge';
      const specs = Array.isArray(f.specs) ? f.specs : [];
      return '<article class="card">' +
        '<div class="card-image">' +
          '<span class="' + badgeClass + '">' + esc(f.stateLabel) + '</span>' +
          (f.image ? '<img src="' + esc(f.image) + '" alt="' + esc(f.title) + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
        '</div>' +
        '<div class="card-body">' +
          '<h3>' + esc(f.title) + '</h3>' +
          '<div class="meta">' + esc([f.brand, f.category].filter(Boolean).join(' • ')) + '</div>' +
          '<div class="specs">' + specs.map(s => '<span class="spec">' + esc(s) + '</span>').join('') + '</div>' +
          '<div class="card-footer">' +
            '<span class="price">' + esc(f.price) + '</span>' +
            '<a class="link-btn" href="' + esc(f.url || '#') + '" target="_blank" rel="noopener noreferrer">Bekijken</a>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function load() {
    grid.innerHTML = '<div class="loading">🚲 Fietsen worden geladen...</div>';
    fetch('/api/fietsen')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(data => {
        fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
        if (data.laatsteUpdate) {
          const d = new Date(data.laatsteUpdate);
          if (!isNaN(d)) {
            updatedEl.textContent = 'Laatste update: ' + d.toLocaleString('nl-NL');
          }
        }
        render();
      })
      .catch(err => {
        console.error(err);
        grid.innerHTML = '<div class="error">Fietsen konden niet worden geladen.</div>';
        countEl.textContent = 'Fout bij laden';
      });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', function(){
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      render();
    });
  });

  load();
})();
