(function(){
  var stage=document.getElementById('stage'),slides=[].slice.call(document.querySelectorAll('.slide')),i=0;
  if(/[?&]export/.test(location.search))document.body.classList.add('export');
  if(/[?&]print/.test(location.search)){document.body.classList.add('print');document.documentElement.classList.add('print');}
  function fit(){var s=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform='scale('+s+') translate(-50%,-50%)';}
  function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach(function(s,k){s.classList.toggle('on',k===i);});
    try{history.replaceState(null,'',location.search+'#'+(i+1));}catch(e){}}
  function next(){show(i+1);}function prev(){show(i-1);}
  function full(){var d=document.documentElement;if(document.fullscreenElement){document.exitFullscreen();}else if(d.requestFullscreen){d.requestFullscreen().catch(function(){});}}
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'||e.key==='Enter'){e.preventDefault();next();}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'||e.key==='Backspace'){e.preventDefault();prev();}
    else if(e.key==='Home'){show(0);}else if(e.key==='End'){show(slides.length-1);}
    else if(e.key==='f'||e.key==='F'){full();}
  });
  stage.addEventListener('click',function(e){if(e.target.closest('a,button'))return;var r=stage.getBoundingClientRect();((e.clientX-r.left)/r.width<0.25)?prev():next();});
  var x0=null;stage.addEventListener('touchstart',function(e){x0=e.touches[0].clientX;},{passive:true});
  stage.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>40){dx<0?next():prev();}x0=null;});
  document.getElementById('prev').onclick=prev;document.getElementById('next').onclick=next;document.getElementById('full').onclick=full;
  addEventListener('resize',fit);fit();
  show((parseInt((location.hash||'').slice(1),10)||1)-1);
})();
