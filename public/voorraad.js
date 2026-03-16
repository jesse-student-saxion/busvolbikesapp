(function() {
  var currentType = 'all';
  var statusEl = document.getElementById('status');
  var gridEl = document.getElementById('grid');
  var buttons = document.querySelectorAll('.filter');

  function esc(v) {
    return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(fietsen) {
    if (!fietsen.length) {
      gridEl.innerHTML = '<p>Geen fietsen gevonden.</p>';
      return;
    }
    gridEl.innerHTML = fietsen.map(function(f) {
      var specs = Array.isArray(f.specs) ? f.specs.join(' • ') : '';
      return '<article class="card">' +
        (f.image ? '<img src="' + esc(f.image) + '" alt="' + esc(f.title) + '">' : '') +
        '<div class="meta">' + esc(f.stateLabel) + '</div>' +
        '<h3>' + esc(f.title) + '</h3>' +
        '<p class="specs">' + esc(specs) + '</p>' +
        '<div class="price">' + esc(f.price) + '</div>' +
        '<a class="btn" href="' + esc(f.url || '#') + '">Bekijken</a>' +
      '</article>';
    }).join('');
  }

  function load() {
    statusEl.textContent = 'Fietsen laden...';
    fetch('/api/fietsen?type=' + encodeURIComponent(currentType))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        statusEl.textContent = (data.count || 0) + ' fietsen beschikbaar';
        render(Array.isArray(data.fietsen) ? data.fietsen : []);
      })
      .catch(function(err) {
        console.error(err);
        statusEl.textContent = 'Fietsen konden niet worden geladen';
      });
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function() {
      for (var j = 0; j < buttons.length; j++) buttons[j].classList.remove('active');
      this.classList.add('active');
      currentType = this.getAttribute('data-type') || 'all';
      load();
    });
  }

  load();
})();
