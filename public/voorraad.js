(function () {
  const grid = document.getElementById('grid');
  const meta = document.getElementById('meta');
  const buttons = document.querySelectorAll('.filter');
  let all = [];
  let active = 'all';

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    let items = all;
    if (active !== 'all') items = all.filter((f) => f.state === active);

    meta.textContent = items.length + ' fietsen zichtbaar';
    if (!items.length) {
      grid.innerHTML = '<div>Geen fietsen gevonden.</div>';
      return;
    }

    grid.innerHTML = items.map((f) => `
      <article class="card">
        <div class="card-img"><img src="${esc(f.image)}" alt="${esc(f.title)}" loading="lazy"></div>
        <div class="card-body">
          <div class="badge">${esc(f.stateLabel)}</div>
          <h3 class="title">${esc(f.title)}</h3>
          <div class="specs">${esc([f.maat, f.kleur, f.modeljaar].filter(Boolean).join(' • '))}</div>
          <div class="bottom">
            <div class="price">${esc(f.price)}</div>
            <a class="view" href="${esc(f.url)}">Bekijken</a>
          </div>
        </div>
      </article>
    `).join('');
  }

  fetch('/api/fietsen')
    .then((r) => r.json())
    .then((data) => {
      all = Array.isArray(data.fietsen) ? data.fietsen : [];
      render();
    })
    .catch((err) => {
      console.error(err);
      meta.textContent = 'Kon voorraad niet laden';
      grid.innerHTML = '<div>Fietsen konden niet worden geladen.</div>';
    });

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      active = btn.dataset.filter;
      render();
    });
  });
})();
