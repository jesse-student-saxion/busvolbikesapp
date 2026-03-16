(function() {
  var currentType = 'all';
  var statusEl = document.getElementById('status');
  var gridEl = document.getElementById('grid');
  var buttons = document.querySelectorAll('.filter');

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(fietsen) {
    if (!fietsen.length) {
      gridEl.innerHTML = '<div class="empty">Geen fietsen gevonden.</div>';
      return;
    }

    gridEl.innerHTML = fietsen.map(function(f) {
      var specs = Array.isArray(f.specs) && f.specs.length ? f.specs.join(' • ') : 'Bekijk de details voor meer specificaties';
      var badgeClass = f.state === 'new' ? 'badge new' : 'badge used';
      return '<article class="card">' +
        '<div class="media">' +
          (f.image ? '<img src="' + esc(f.image) + '" alt="' + esc(f.title) + '" loading="lazy">' : '') +
        '</div>' +
        '<div class="card-body">' +
          '<div class="' + badgeClass + '">' + esc(f.stateLabel) + '</div>' +
          '<h3>' + esc(f.title) + '</h3>' +
          '<p class="specs">' + esc(specs) + '</p>' +
          '<div class="card-footer">' +
            '<div class="price">' + esc(f.price) + '</div>' +
            '<a class="btn" href="' + esc(f.url || '#') + '" target="_blank" rel="noopener noreferrer">Bekijken</a>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function load() {
    statusEl.textContent = 'Fietsen laden...';
    gridEl.innerHTML = '<div class="empty">Fietsen laden...</div>';

    fetch('/api/fietsen?type=' + encodeURIComponent(currentType))
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(data) {
        var fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
        statusEl.textContent = (data.count || 0) + ' fietsen beschikbaar';
        render(fietsen);
      })
      .catch(function(err) {
        console.error(err);
        statusEl.textContent = 'Fietsen konden niet worden geladen';
        gridEl.innerHTML = '<div class="empty">Fietsen konden niet worden geladen.</div>';
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
