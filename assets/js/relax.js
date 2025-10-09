document.addEventListener('DOMContentLoaded',function(){
  // Smooth scroll for TOC
  document.querySelectorAll('.toc a').forEach(a=>{
    a.addEventListener('click',function(e){
      e.preventDefault();
      const id = this.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });

  // Collapsible raw source blocks
  document.querySelectorAll('.collapsible').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target = document.getElementById(btn.dataset.target);
      if(!target) return;
      const visible = target.style.display !== 'none';
      target.style.display = visible ? 'none' : 'block';
      btn.innerText = visible ? 'Показать исходник' : 'Свернуть исходник';
    });
  });
});
