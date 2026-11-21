/* ============================================================
   Колесо слов
   12 секторов, слова зафиксированы (добавлять свои нельзя).
   Тяжёлое колесо: латунный обод с заклёпками, тёмное дерево,
   станина, настоящая защёлка-молоточек над штырьками.
   Звука и озвучки слов нет.
   ============================================================ */
const WORDS=['Бумага','Арена','Награда','Чемодан','Маскарад','Ураган','Радуга','Мешок','Басня','Лагерь','Договор','Обычай'];
const SECTORS=WORDS.length, TAU=360/SECTORS;
const CX=200, CY=196;              /* центр колеса в единицах viewBox */
const R=160;                       /* радиус лица колеса (секторов) */
const BAND_R=176, BAND_W=26;       /* деревянный обод */
const PIN_R=166;                   /* штырьки, о которые стучит защёлка */
const PLATE_R=138;                 /* плашки со словами */
const PIVOT_X=200, PIVOT_Y=10;     /* ось защёлки-молоточка */
const KEY='koleso_v1';
const SVGNS='http://www.w3.org/2000/svg';

/* приглушённые «эмалевые» цвета секторов: h, s, l */
const PALETTE=[
  [148,25,25],[350,36,30],[212,30,27],[ 40,44,29],
  [168,22,26],[ 16,44,31],[200,30,28],[ 28,34,27],
  [158,25,26],[335,36,30],[216,15,28],[ 36,46,30]
];

const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a, Math.min(b, v));
function svgEl(name,attrs){ const e=document.createElementNS(SVGNS,name); for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }
function stops(list){ return list.map(([o,c])=>svgEl('stop',{offset:o,'stop-color':c})); }

/* ------------------------------ состояние ------------------------------ */
let state=loadState();
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null')||{};
    return { theme: s.theme||'auto', found: Array.isArray(s.found)? s.found : [] };
  }catch(e){ return { theme:'auto', found:[] }; }
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }

let words=WORDS.slice();
let rot=0, spinning=false, lastWin=-1, pawlAngle=0;

/* ------------------------------ цвета ------------------------------ */
function isDark(){ return document.documentElement.getAttribute('data-theme')==='dark'; }
function sectorColors(i){
  const [h,s,l]=PALETTE[i%PALETTE.length];
  const up = isDark()? 0 : 5;                        /* днём эмаль чуть светлее */
  const dark = isDark()? -7 : 0;
  return { deep:`hsl(${h} ${s}% ${clamp(l+dark,8,80)}%)`, bright:`hsl(${h} ${clamp(s+6,0,100)}% ${clamp(l+9+up,10,88)}%)` };
}
function accentOf(i){
  const [h,s,l]=PALETTE[i%PALETTE.length];
  return `hsl(${h} ${clamp(s+22,20,80)}% ${clamp(l+26,30,72)}%)`;
}
/* плашка не должна залезать на соседнюю: ширина ограничена хордой сектора */
const MAX_PLATE_W = 2*PLATE_R*Math.sin(Math.PI/SECTORS) - 4;
function labelSize(w){
  const base = w.length<=5 ? 16 : w.length<=6 ? 14.5 : w.length<=7 ? 13 : 12;
  const fit = ((MAX_PLATE_W-14)/w.length - 0.5)/0.63;
  return Math.round(Math.min(base, fit)*10)/10;
}
function plateWidth(txt, size){ return Math.min(MAX_PLATE_W, txt.length*(size*0.63+0.5)+14); }
function labelText(w){ return w.length>11 ? w.slice(0,10)+'…' : w; }

/* ------------------------------ сборка колеса ------------------------------ */
function buildWheel(){
  const svg=$('#wheel');
  svg.innerHTML='';

  /* ---- градиенты и фильтры ---- */
  const defs=svgEl('defs',{});

  const brass=svgEl('linearGradient',{id:'brass',x1:'0',y1:'0',x2:'1',y2:'1'});
  stops([['0%','#7d5f27'],['16%','#e6c98a'],['34%','#a3823c'],['52%','#f3e2ae'],['70%','#98783a'],['100%','#6f5423']])
    .forEach(s=>brass.appendChild(s));
  defs.appendChild(brass);

  const brassR=svgEl('radialGradient',{id:'brassR',cx:'34%',cy:'28%',r:'78%'});
  stops([['0%','#fbf0cf'],['42%','#dcc184'],['78%','#9b7c39'],['100%','#6b5122']])
    .forEach(s=>brassR.appendChild(s));
  defs.appendChild(brassR);

  const wood=svgEl('linearGradient',{id:'wood',x1:'0.1',y1:'0',x2:'0.7',y2:'1'});
  stops([['0%','#4c3320'],['22%','#2a1b10'],['44%','#5d4026'],['64%','#241608'],['84%','#432c19'],['100%','#1c1207']])
    .forEach(s=>wood.appendChild(s));
  defs.appendChild(wood);

  const hubWood=svgEl('radialGradient',{id:'hubWood',cx:'34%',cy:'28%',r:'82%'});
  stops([['0%','#6b4a2d'],['48%','#3d2817'],['100%','#1e1409']]).forEach(s=>hubWood.appendChild(s));
  defs.appendChild(hubWood);

  for(let i=0;i<SECTORS;i++){
    const c=sectorColors(i);
    const a=(i*TAU-90+TAU/2)*Math.PI/180;
    const g=svgEl('linearGradient',{id:'sg'+i, gradientUnits:'userSpaceOnUse',
      x1:CX, y1:CY, x2:(CX+R*Math.cos(a)).toFixed(2), y2:(CY+R*Math.sin(a)).toFixed(2)});
    stops([['0%',c.deep],['100%',c.bright]]).forEach(s=>g.appendChild(s));
    defs.appendChild(g);
  }

  /* неподвижный свет: сверху-слева тёплый, снизу-справа тень */
  const sheen=svgEl('linearGradient',{id:'sheen',x1:'0.15',y1:'0',x2:'0.7',y2:'1'});
  stops([['0%','rgba(255,244,214,.30)'],['40%','rgba(255,244,214,.04)'],['72%','rgba(0,0,0,.10)'],['100%','rgba(0,0,0,.34)']])
    .forEach(s=>sheen.appendChild(s));
  defs.appendChild(sheen);

  const blur=svgEl('filter',{id:'softShadow',x:'-30%',y:'-30%',width:'160%',height:'160%'});
  blur.appendChild(svgEl('feGaussianBlur',{stdDeviation:'7'}));
  defs.appendChild(blur);

  svg.appendChild(defs);

  /* ---- станина: тень на полу, ножки, основание ---- */
  const mount=svgEl('g',{id:'mount'});
  mount.appendChild(svgEl('ellipse',{cx:CX,cy:436,rx:132,ry:11,fill:'rgba(0,0,0,.42)',filter:'url(#softShadow)'}));
  mount.appendChild(svgEl('path',{d:'M172,292 L194,292 L150,420 L110,420 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  mount.appendChild(svgEl('path',{d:'M228,292 L206,292 L250,420 L290,420 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  mount.appendChild(svgEl('rect',{x:'86',y:'412',width:'228',height:'24',rx:'6',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  mount.appendChild(svgEl('rect',{x:'86',y:'412',width:'228',height:'5',rx:'2',fill:'rgba(255,226,170,.14)'}));
  const plateTxt=svgEl('text',{class:'mount-txt',x:CX,y:'429','text-anchor':'middle'});
  plateTxt.textContent='КОЛЕСО СЛОВ';
  mount.appendChild(plateTxt);
  for(const bx of [104,296]){
    mount.appendChild(svgEl('circle',{cx:bx,cy:'424',r:'3.2',fill:'url(#brassR)',stroke:'rgba(20,12,4,.6)','stroke-width':'.8'}));
  }
  svg.appendChild(mount);

  /* ---- ротор: обод, сектора, плашки, штырьки ---- */
  const rotor=svgEl('g',{id:'rotor'});
  rotor.setAttribute('transform',`rotate(${rot} ${CX} ${CY})`);

  /* деревянный обод и его кромки */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R,fill:'none',stroke:'url(#wood)','stroke-width':BAND_W}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R+BAND_W/2,fill:'none',stroke:'#150d05','stroke-width':'3'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R-BAND_W/2,fill:'none',stroke:'#150d05','stroke-width':'3'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R+8,fill:'none',stroke:'rgba(255,231,181,.10)','stroke-width':'1.4','stroke-dasharray':'120 40 70 26'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R-9,fill:'none',stroke:'rgba(0,0,0,.35)','stroke-width':'1.2','stroke-dasharray':'90 30 140 44'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R-BAND_W/2-3,fill:'none',stroke:'url(#brass)','stroke-width':'4'}));

  /* заклёпки на ободе */
  for(let i=0;i<24;i++){
    const a=(i*15-90)*Math.PI/180;
    const x=CX+BAND_R*Math.cos(a), y=CY+BAND_R*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:'3.4',fill:'url(#brassR)',stroke:'rgba(18,11,4,.65)','stroke-width':'.9'}));
    rotor.appendChild(svgEl('circle',{cx:(x-1).toFixed(2),cy:(y-1.2).toFixed(2),r:'1',fill:'rgba(255,246,214,.75)'}));
  }

  /* сектора */
  for(let i=0;i<SECTORS;i++){
    const a0=(i*TAU-90)*Math.PI/180, a1=((i+1)*TAU-90)*Math.PI/180;
    const x0=CX+R*Math.cos(a0), y0=CY+R*Math.sin(a0), x1=CX+R*Math.cos(a1), y1=CY+R*Math.sin(a1);
    rotor.appendChild(svgEl('path',{class:'sector','data-i':i,
      d:`M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      fill:`url(#sg${i})`}));
  }
  /* грани секторов и штырьки, о которые стучит защёлка */
  for(let i=0;i<SECTORS;i++){
    const a=(i*TAU-90)*Math.PI/180;
    const x0=CX+24*Math.cos(a), y0=CY+24*Math.sin(a), x1=CX+R*Math.cos(a), y1=CY+R*Math.sin(a);
    rotor.appendChild(svgEl('line',{x1:x0.toFixed(2),y1:y0.toFixed(2),x2:x1.toFixed(2),y2:y1.toFixed(2),
      stroke:'rgba(14,9,4,.45)','stroke-width':'1.6'}));
    const px=CX+PIN_R*Math.cos(a), py=CY+PIN_R*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:px.toFixed(2),cy:py.toFixed(2),r:'4.6',fill:'url(#brassR)',stroke:'rgba(18,11,4,.6)','stroke-width':'.9'}));
    rotor.appendChild(svgEl('circle',{cx:(px-1.2).toFixed(2),cy:(py-1.4).toFixed(2),r:'1.2',fill:'rgba(255,248,220,.8)'}));
  }

  /* плашки со словами: по касательной, нижние перевёрнуты, чтобы читались */
  for(let i=0;i<SECTORS;i++){
    const txt=labelText(words[i]), size=labelSize(txt);
    const w=plateWidth(txt, size), h=26;
    const phi=i*TAU+TAU/2;
    const outer=svgEl('g',{transform:`rotate(${phi} ${CX} ${CY})`,'data-i':i});
    const inner=svgEl('g',{});
    if(phi>90 && phi<270){ inner.setAttribute('transform',`rotate(180 ${CX} ${CY-PLATE_R})`); }
    inner.appendChild(svgEl('rect',{class:'plate','data-i':i, x:(CX-w/2).toFixed(2), y:(CY-PLATE_R-h/2).toFixed(2),
      width:w.toFixed(2), height:h, rx:'6', ry:'6'}));
    const t=svgEl('text',{class:'plate-txt', x:CX, y:(CY-PLATE_R+5).toFixed(2), 'font-size':size});
    t.textContent=txt.toUpperCase();
    inner.appendChild(t);
    outer.appendChild(inner);
    rotor.appendChild(outer);
  }

  /* ступица: деревянный диск с болтами, крутится вместе с колесом */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R,fill:'none',stroke:'rgba(10,6,2,.5)','stroke-width':'4'}));
  rotor.appendChild(svgEl('circle',{class:'hub',cx:CX,cy:CY,r:'52',fill:'url(#hubWood)',stroke:'url(#brass)','stroke-width':'5'}));
  for(let i=0;i<6;i++){
    const a=(i*60-90)*Math.PI/180;
    const x=CX+40*Math.cos(a), y=CY+40*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:'3.6',fill:'url(#brassR)',stroke:'rgba(16,10,4,.7)','stroke-width':'.9'}));
  }
  svg.appendChild(rotor);

  /* неподвижный блик/свет поверх колеса */
  svg.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R+2,fill:'url(#sheen)',class:'sheen','pointer-events':'none'}));

  /* неподвижная ось */
  svg.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'20',fill:'url(#brassR)',stroke:'rgba(18,11,4,.65)','stroke-width':'2'}));
  svg.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'7',fill:'#241a0d'}));
  svg.appendChild(svgEl('circle',{cx:CX-4,cy:CY-5,r:'3',fill:'rgba(255,248,222,.6)'}));

  /* кронштейн и защёлка-молоточек */
  svg.appendChild(svgEl('path',{d:'M184,0 L216,0 L211,14 L189,14 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'1.6'}));
  const pawl=svgEl('g',{id:'pawl'});
  pawl.appendChild(svgEl('path',{d:'M194.5,6 L205.5,6 L203,33 L197,33 Z',fill:'url(#brass)',stroke:'rgba(24,15,5,.75)','stroke-width':'1.4'}));
  pawl.appendChild(svgEl('circle',{cx:PIVOT_X,cy:PIVOT_Y,r:'7.5',fill:'url(#brassR)',stroke:'rgba(24,15,5,.75)','stroke-width':'1.6'}));
  pawl.appendChild(svgEl('circle',{cx:PIVOT_X,cy:PIVOT_Y,r:'2.4',fill:'#2a1d0d'}));
  pawl.appendChild(svgEl('circle',{cx:CX,cy:'33.5',r:'3.6',fill:'url(#brassR)',stroke:'rgba(24,15,5,.7)','stroke-width':'1'}));
  svg.appendChild(pawl);

  highlight(lastWin);
}
function highlight(i){
  document.querySelectorAll('#wheel .sector').forEach(s=>s.classList.toggle('win', Number(s.dataset.i)===i));
  document.querySelectorAll('#wheel .plate').forEach(p=>p.classList.toggle('hot', Number(p.dataset.i)===i));
}
function setPawl(deg){
  const p=$('#pawl');
  if(p) p.style.transform=`rotate(${deg.toFixed(2)}deg)`;
}

/* ------------------------------ вращение ------------------------------ */
/* профиль скорости тяжёлого колеса: быстрый разгон, длинное плавное
   торможение. Таблица интеграла строится один раз. */
const PROFILE=(function(){
  const N=600, cum=new Array(N+1);
  let sum=0;
  for(let i=0;i<=N;i++){ const p=i/N; sum+=Math.pow(Math.sin(Math.PI*Math.pow(p,0.55)),1.35)+1e-6; cum[i]=sum; }
  for(let i=0;i<=N;i++) cum[i]/=sum;
  return cum;
})();
function heavyEase(p){
  const x=clamp(p,0,1)*600, i=Math.floor(x), j=Math.min(600,i+1), f=x-i;
  return PROFILE[i]+(PROFILE[j]-PROFILE[i])*f;
}
const SPIN={ turns:7, extra:3, dur:7600, tail:2600, wob:900 };
function reducedMotion(){ try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }

function pickWinner(){
  let i=Math.floor(Math.random()*SECTORS);
  if(i===lastWin) i=(i+1+Math.floor(Math.random()*(SECTORS-1)))%SECTORS;
  lastWin=i;
  return i;
}
function spin(){
  if(spinning) return;
  const i=pickWinner();
  const jitter=(Math.random()*2-1)*11;              /* стрелка встаёт внутрь сектора */
  const base=-(i*TAU+TAU/2)-jitter;
  const target=((base%360)+360)%360;
  const cur=((rot%360)+360)%360;
  let delta=target-cur; if(delta<0) delta+=360;
  const turns=SPIN.turns+Math.floor(Math.random()*(SPIN.extra+1));
  const from=rot, to=rot+delta+turns*360;
  const dur=reducedMotion()? 500 : SPIN.dur+Math.random()*SPIN.tail;

  spinning=true;
  $('#spin').classList.add('busy');
  $('#wheel-tap').classList.add('busy');
  $('#wheel-frame').classList.add('spin');
  const t0=performance.now();
  let prevSlot=Math.round(((from%360)+360)%360/TAU), prevRot=from, prevT=t0;
  const rotor=$('#rotor');

  function frame(now){
    const p=Math.min(1,(now-t0)/dur);
    rot=from+(to-from)*heavyEase(p);
    rotor.setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);

    const dt=Math.max(1, now-prevT);
    const v=(rot-prevRot)/dt;                       /* градусов за миллисекунду */
    prevRot=rot; prevT=now;
    if(!reducedMotion()){ rotor.style.filter = v>0.3 ? `blur(${clamp(v*0.7,0,2.4).toFixed(2)}px)` : ''; }

    /* защёлку подбрасывает каждый штырёк */
    const slot=Math.round(((rot%360)+360)%360/TAU);
    if(slot!==prevSlot){ pawlAngle=Math.min(11, 4+v*1.4); prevSlot=slot; }
    pawlAngle+=(0-pawlAngle)*Math.min(1, dt/70);
    setPawl(pawlAngle);

    if(p<1) requestAnimationFrame(frame); else settle(i);
  }
  requestAnimationFrame(frame);

  /* финальное «докачивание» тяжёлого колеса */
  function settle(i){
    const t0s=performance.now(), durS=reducedMotion()? 0 : SPIN.wob;
    function s(now){
      const p=Math.min(1,(now-t0s)/durS);
      const wob=Math.sin(p*Math.PI*3)*(1-p)*1.6;
      rotor.setAttribute('transform',`rotate(${(rot+wob).toFixed(2)} ${CX} ${CY})`);
      pawlAngle=Math.sin(p*Math.PI*3)*(1-p)*4;
      setPawl(pawlAngle);
      if(p<1) requestAnimationFrame(s); else land(i);
    }
    if(durS===0) land(i); else requestAnimationFrame(s);
  }
  function land(i){
    rotor.style.filter='';
    $('#rotor').setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    setPawl(0);
    spinning=false;
    $('#spin').classList.remove('busy');
    $('#wheel-tap').classList.remove('busy');
    $('#wheel-frame').classList.remove('spin');
    const wf=$('#wheel-frame');
    wf.classList.remove('hit'); void wf.offsetWidth; wf.classList.add('hit');
    highlight(i);
    showWord(i);
  }
}

/* ------------------------------ результат ------------------------------ */
function showWord(i){
  const w=words[i];
  const el=$('#word');
  el.textContent=w;
  const card=$('#word-card');
  card.style.setProperty('--accent', accentOf(i));
  card.classList.add('hot');
  $('#task').textContent='Найди слово «'+w+'» в словаре или энциклопедии на столе и расскажи, что оно обозначает.';
  card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
  card.scrollIntoView({behavior:reducedMotion()?'auto':'smooth', block:'nearest'});
}

/* ------------------------------ список найденных ------------------------------ */
function renderFound(){
  const box=$('#found-list');
  if(!state.found.length){ box.innerHTML='<span class="empty-note">Пока ничего не нашли — крути колесо и ищи слово в книгах.</span>'; return; }
  box.innerHTML=state.found.slice().reverse().map(f=>'<span class="fchip">'+f.w+' <small>'+f.t+'</small></span>').join('');
}
function markFound(){
  const w=$('#word').textContent;
  if(!w || w==='—') return;
  const t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  state.found.push({w:w,t:t});
  save(); renderFound();
}

/* ------------------------------ тема ------------------------------ */
function applyTheme(){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = state.theme==='dark' || (state.theme==='auto' && (!window.matchMedia || prefersDark));
  document.documentElement.setAttribute('data-theme', dark? 'dark':'light');
  $('#btn-theme').textContent = dark? '🌙 Ночная' : '☀️ Светлая';
  buildWheel();
}
function toggleTheme(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  state.theme = dark? 'light' : 'dark';
  save(); applyTheme();
}

/* ------------------------------ кнопки и клавиатура ------------------------------ */
$('#spin').addEventListener('click',spin);
$('#wheel-tap').addEventListener('click',spin);
$('#again').addEventListener('click',spin);
$('#found').addEventListener('click',markFound);
$('#clear-found').addEventListener('click',()=>{
  if(!state.found.length) return;
  if(!confirm('Удалить список найденных слов?')) return;
  state.found=[]; save(); renderFound();
});
$('#btn-theme').addEventListener('click',toggleTheme);
document.addEventListener('keydown',e=>{
  if((e.key===' '||e.key==='Enter') && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)){ e.preventDefault(); spin(); }
});
let resizeTimer=null;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{ if(!spinning) buildWheel(); }, 220);
});

/* ------------------------------ старт ------------------------------ */
applyTheme();
renderFound();
setPawl(0);
