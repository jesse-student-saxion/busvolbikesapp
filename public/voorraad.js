(function() {
  const grid = document.getElementById('grid');
  const buttons = document.querySelectorAll('.filter-btn');
  let currentType = 'all';
  let allBikes = [];

  function render() {
    const bikes = currentType === 'all' ? allBikes : allBikes.filter(b => b.state === currentType);
    if (!bikes.length) {
      grid.innerHTML = '<div class="card" style="padding:20px">Geen fietsen gevonden.</div>';
      return;
    }

    grid.innerHTML = bikes.map(f => `
      <article class="bike-card">
        <div class="bike-image">
          <img src="${f.image}" alt="${f.title}" loading="lazy">
        </div>
        <div class="bike-content">
          <span class="badge">${f.stateLabel}</span>
          <h2 class="bike-title">${f.title}</h2>
          <div class="bike-meta">${(f.specs || []).slice(0,2).join(' • ')}</div>
          <div class="bike-price">${f.price}</div>
          <a class="btn btn-primary" href="${f.url}">Bekijken</a>
        </div>
      </article>
    `).join('');
  }

  fetch('/api/fietsen')
    .then(r => r.json())
    .then(data => {
      allBikes = Array.isArray(data.fietsen) ? data.fietsen : [];
      render();
    })
    .catch(() => {
      grid.innerHTML = '<div class="card" style="padding:20px">Fietsen konden niet worden geladen.</div>';
    });

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      render();
    });
  });
})();
