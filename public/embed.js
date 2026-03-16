(function () {
  const script = document.currentScript;
  const apiBase = new URL(script.src).origin;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function findTargets() {
    const selector = script.dataset.target || '.busvolbikes-voorraad, #bvb-voorraad, #busvolbikes-embed';
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length) return nodes;
    if (script.previousElementSibling && script.previousElementSibling.tagName !== 'SCRIPT') {
      return [script.previousElementSibling];
    }
    return [];
  }

  function injectStyles() {
    if (document.getElementById('bvb-embed-styles')) return;
    const style = document.createElement('style');
    style.id = 'bvb-embed-styles';
    style.textContent = [
      '.bvb-embed{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a}',
      '.bvb-embed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}',
      '.bvb-embed-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06)}',
      '.bvb-embed-image{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc}',
      '.bvb-embed-content{padding:16px}',
      '.bvb-embed-badge{display:inline-block;margin-bottom:10px;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;color:#fff;background:#22c55e}',
      '.bvb-embed-badge.new{background:#3b82f6}',
      '.bvb-embed-title{margin:0 0 8px;font-size:18px;line-height:1.3}',
      '.bvb-embed-specs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;padding:0;list-style:none}',
      '.bvb-embed-spec{background:#f1f5f9;color:#475569;border-radius:999px;padding:6px 10px;font-size:12px}',
      '.bvb-embed-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:8px}',
      '.bvb-embed-price{font-size:22px;font-weight:800;color:#16a34a}',
      '.bvb-embed-button{display:inline-block;background:#0f172a;color:#fff !important;text-decoration:none !important;border-radius:10px;padding:10px 14px;font-weight:700}',
      '.bvb-embed-empty{padding:24px;border:1px dashed #cbd5e1;border-radius:14px;background:#fff;color:#64748b;text-align:center}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderTarget(target, fietsen) {
    target.classList.add('bvb-embed');
    if (!fietsen.length) {
      target.innerHTML = '<div class="bvb-embed-empty">Geen fietsen gevonden.</div>';
      return;
    }
    target.innerHTML = '<div class="bvb-embed-grid">' + fietsen.map(function (f) {
      const img = escapeHtml(f.image || '');
      const title = escapeHtml(f.title || 'Onbekende fiets');
      const badge = escapeHtml(f.stateLabel || 'Fiets');
      const price = escapeHtml(f.price || 'Prijs op aanvraag');
      const url = escapeHtml(f.url || '#');
      const badgeClass = f.state === 'new' ? 'bvb-embed-badge new' : 'bvb-embed-badge';
      const specs = Array.isArray(f.specs) ? f.specs.slice(0, 4) : [];
      return '<article class="bvb-embed-card">'
        + (img ? '<img class="bvb-embed-image" src="' + img + '" alt="' + title + '" loading="lazy">' : '')
        + '<div class="bvb-embed-content">'
        + '<span class="' + badgeClass + '">' + badge + '</span>'
        + '<h3 class="bvb-embed-title">' + title + '</h3>'
        + (specs.length ? '<ul class="bvb-embed-specs">' + specs.map(function (s) { return '<li class="bvb-embed-spec">' + escapeHtml(s) + '</li>'; }).join('') + '</ul>' : '')
        + '<div class="bvb-embed-footer"><div class="bvb-embed-price">' + price + '</div><a class="bvb-embed-button" href="' + url + '" target="_blank" rel="noopener noreferrer">Bekijken</a></div>'
        + '</div></article>';
    }).join('') + '</div>';
  }

  function load() {
    const targets = findTargets();
    if (!targets.length) return;
    injectStyles();
    targets.forEach(function (t) { t.innerHTML = '<div class="bvb-embed-empty">Fietsen laden...</div>'; });
    const type = script.dataset.type || targets[0].dataset.type || 'all';
    fetch(apiBase + '/api/fietsen?type=' + encodeURIComponent(type), { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        const fietsen = Array.isArray(data.fietsen) ? data.fietsen : [];
        targets.forEach(function (t) { renderTarget(t, fietsen); });
      })
      .catch(function (err) {
        targets.forEach(function (t) {
          t.innerHTML = '<div class="bvb-embed-empty">Fietsen konden niet worden geladen.</div>';
        });
        console.error('Bus vol Bikes embed fout:', err);
      });
  }

  load();
})();
