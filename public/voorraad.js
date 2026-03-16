(function(){
  var state = 'all';
  var status = document.getElementById('status');
  var grid = document.getElementById('grid');
  var buttons = document.querySelectorAll('.filter');

  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function render(items){
    if(!items.length){grid.innerHTML='';status.textContent='Geen fietsen gevonden';return;}
    status.textContent = items.length + ' fietsen gevonden';
    grid.innerHTML = items.map(function(f){
      return '<article class="card">'
        + (f.image ? '<img src="'+esc(f.image)+'" alt="'+esc(f.title)+'">' : '')
        + '<div class="badge '+esc(f.state)+'">'+esc(f.stateLabel)+'</div>'
        + '<h3>'+esc(f.title)+'</h3>'
        + '<div class="meta">'+esc((Array.isArray(f.specs)?f.specs:[]).join(' • '))+'</div>'
        + '<div class="price">'+esc(f.price || 'Prijs op aanvraag')+'</div>'
        + '<a class="link" href="'+esc(f.url || '#')+'">Bekijken</a>'
        + '</article>';
    }).join('');
  }
  function load(){
    status.textContent='Fietsen laden...';
    fetch('/api/fietsen?type='+encodeURIComponent(state))
      .then(function(r){if(!r.ok) throw new Error('HTTP '+r.status); return r.json();})
      .then(function(data){render(Array.isArray(data.fietsen)?data.fietsen:[]);})
      .catch(function(e){status.textContent='Fietsen konden niet worden geladen'; console.error(e);});
  }
  for(var i=0;i<buttons.length;i++){
    buttons[i].addEventListener('click', function(){
      for(var j=0;j<buttons.length;j++) buttons[j].classList.remove('active');
      this.classList.add('active');
      state = this.getAttribute('data-type') || 'all';
      load();
    });
  }
  load();
})();
