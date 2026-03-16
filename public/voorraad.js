(async function () {
  const grid = document.getElementById('grid');
  const countBox = document.getElementById('countBox');
  const updateBox = document.getElementById('updateBox');
  const buttons = Array.from(document.querySelectorAll('.filter'));
  let fietsen = [];
  let currentType = 'all';

  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    let list = fietsen;
    if (currentType !== 'all') list = fietsen.filter((fiets) => fiets.state === currentType);

    countBox.textContent = list.length + ' fietsen';

    if (!list.length) {
      grid.className = 'grid-state empty';
      grid.innerHTML = 'Geen fietsen gevonden.';
      return;
    }

    grid.className = 'grid-state';
    grid.innerHTML = list.map((fiets) => `
      <article class="card">
        <div class="card-image"><img src="${esc(fiets.image)}" alt="${esc(fiets.title)}" loading="lazy"></div>
        <div class="card-body">
          <span class="chip">${esc(fiets.stateLabel)}</span>
          <h2 class="card-title">${esc(fiets.title)}</h2>
          <div class="card-specs">${esc((fiets.specs || []).join(' • '))}</div>
          <div class="card-footer">
            <div class="card-price">${esc(fiets.price)}</div>
            <a class="card-link" href="${esc(fiets.url)}">Bekijk</a>
          </div>
        </div>
      </article>
    `).join('');
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      render();
    });
  });

  try {
    const response = await fetch('/api/fietsen');
    const data = await response.json();
    fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
    if (data.laatsteUpdate) {
      const d = new Date(data.laatsteUpdate);
      updateBox.textContent = 'Laatst bijgewerkt: ' + d.toLocaleString('nl-NL');
    }
    render();
  } catch (err) {
    grid.className = 'grid-state empty';
    grid.textContent = 'Fietsen konden niet worden geladen.';
    countBox.textContent = 'Fout';
  }
})();
