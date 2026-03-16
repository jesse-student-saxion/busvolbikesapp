(() => {
  const API_URL = '/api/fietsen';
  const grid = document.getElementById('grid');
  const countLabel = document.getElementById('countLabel');
  const updateLabel = document.getElementById('updateLabel');
  const filterButtons = [...document.querySelectorAll('.filter')];

  let fietsen = [];
  let currentFilter = 'all';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function render() {
    const items = currentFilter === 'all'
      ? fietsen
      : fietsen.filter((fiets) => fiets.state === currentFilter);

    countLabel.textContent = `${items.length} fietsen zichtbaar`;

    if (!items.length) {
      grid.innerHTML = '<div class="empty">Geen fietsen gevonden.</div>';
      return;
    }

    grid.innerHTML = items.map((fiets) => {
      const image = escapeHtml(fiets.image || '');
      const title = escapeHtml(fiets.title || 'Onbekende fiets');
      const price = escapeHtml(fiets.price || 'Prijs op aanvraag');
      const url = escapeHtml(fiets.url || '#');
      const badge = escapeHtml(fiets.stateLabel || 'Fiets');
      const specs = Array.isArray(fiets.specs) ? fiets.specs.slice(0, 4) : [];
      const badgeClass = fiets.state === 'new' ? 'badge new' : 'badge';

      return `
        <article class="bike-card">
          <div class="bike-image">
            ${image ? `<img src="${image}" alt="${title}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <span class="${badgeClass}">${badge}</span>
          </div>
          <div class="bike-content">
            <h2 class="bike-title">${title}</h2>
            <div class="specs">
              ${specs.map((spec) => `<span class="spec">${escapeHtml(spec)}</span>`).join('')}
            </div>
            <div class="bike-footer">
              <div class="price">${price}</div>
              <a class="button" href="${url}" target="_blank" rel="noopener noreferrer">Bekijken</a>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  fetch(API_URL, { headers: { Accept: 'application/json' } })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
      countLabel.textContent = `${fietsen.length} fietsen geladen`;
      if (data.laatsteUpdate) {
        const d = new Date(data.laatsteUpdate);
        if (!Number.isNaN(d.getTime())) {
          updateLabel.textContent = `Laatste update: ${d.toLocaleString('nl-NL')}`;
        }
      }
      render();
    })
    .catch((error) => {
      countLabel.textContent = 'Fout bij laden';
      updateLabel.textContent = error.message;
      grid.innerHTML = '<div class="empty">❌ Fietsen konden niet worden geladen.</div>';
    });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.filter;
      render();
    });
  });
})();
