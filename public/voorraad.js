(function() {
  const grid = document.getElementById('grid');
  const buttons = document.querySelectorAll('.filter-btn');
  let current = 'all';
  let all = [];

  function card(f) {
    return `
      <article class="bike-card">
        <div class="bike-image"><img src="${f.image}" alt="${f.title}" loading="lazy"></div>
        <div class="bike-content">
          <span class="badge">${f.stateLabel}</span>
          <h2 class="bike-title">${f.title}</h2>
          <div class="bike-meta">${(f.specs || []).slice(0,2).join(' • ')}</div>
          <div class="bike-price">${f.price}</div>
          <a class="btn btn-primary" href="${f.url}?return=${encodeURIComponent(window.location.href)}">Bekijken</a>
        </div>
      </article>
    `;
  }

  function render() {
    let items = all;
    if (current !== 'all') items = items.filter(x => x.state === current);
    grid.innerHTML = items.length ? items.map(card).join('') : '<div class="card empty-card">Geen fietsen gevonden.</div>';
  }

  fetch('/api/fietsen?refresh=1')
    .then(r => r.json())
    .then(data => {
      all = Array.isArray(data.fietsen) ? data.fietsen : [];
      render();
    })
    .catch(() => {
      grid.innerHTML = '<div class="card empty-card">Fietsen konden niet worden geladen.</div>';
    });

  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    current = btn.dataset.type;
    render();
  }));
})();
