/* ============================================================
   Колесо слов
   12 разноцветных секторов со словами на «плашках»: колесо крутится,
   стрелка показывает сектор, ребёнок ищет слово в словаре или
   энциклопедии и объясняет его.
   ============================================================ */
const SECTORS=12, TAU=360/SECTORS, CX=200, CY=200, R=186, PLATE_R=150;
const KEY='koleso_v1';
const SVGNS='http://www.w3.org/2000/svg';

/* слова, которые есть в толковых словарях и энциклопедиях */
const POOL=['аист','азбука','акварель','балерина','барометр','батискаф','букварь','вулкан',
  'галактика','гейзер','герб','геолог','глобус','дельфин','динозавр','жаворонок','затмение','иглу',
  'калейдоскоп','компас','континент','лавина','мамонт','маяк','мозаика','метеорит','мелодия',
  'навигатор','облако','орбита','океан','парус','планета','радуга','ракушка','словарь','спутник',
  'телескоп','ураган','фасоль','фейерверк','хоровод','цирк','черепаха','шахматы','эскимос','юла','ящер'];

const $=s=>document.querySelector(s);
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
function shuffle(a){ const b=a.slice(); for(let i=b.length-1;i>0;i--){ const j=rnd(i+1); const t=b[i]; b[i]=b[j]; b[j]=t; } return b; }
function svgEl(name,attrs){ const e=document.createElementNS(SVGNS,name); for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

/* ------------------------------ состояние ------------------------------ */
let state=loadState();
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null')||{};
    return { sound: s.sound!==false, theme: s.theme||'auto', speed: s.speed||'long',
             words: Array.isArray(s.words)? s.words : [],
             found: Array.isArray(s.found)? s.found : [], spins: s.spins||0 };
  }catch(e){ return { sound:true, theme:'auto', speed:'long', words:[], found:[], spins:0 }; }
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }

let words = (state.words.length===SECTORS) ? state.words.slice() : shuffle(POOL).slice(0,SECTORS);
let rot=0, spinning=false, lastWin=-1;

/* ------------------------------ цвета ------------------------------ */
function isDark(){ return document.documentElement.getAttribute('data-theme')==='dark'; }
function hueOf(i){ return (i*30 + 354) % 360; }
function sectorColors(i){
  const h=hueOf(i);
  return isDark()
    ? { deep:`hsl(${h} 58% 30%)`, bright:`hsl(${h} 76% 62%)` }
    : { deep:`hsl(${h} 66% 46%)`, bright:`hsl(${h} 82% 74%)` };
}
function rimColors(){
  return isDark() ? ['#2b2340','#7b6b93','#f4c462','#241f38'] : ['#4a3350','#c8a07c','#ffe6b8','#4a3350'];
}
function labelSize(w){
  /* на маленьком телефоне колесо сжимается, поэтому подписи делаем крупнее в единицах viewBox */
  const f=clamp(520/(window.innerWidth||440), 1, 1.5);
  const base = w.length<=5 ? 17 : w.length<=7 ? 14.5 : w.length<=9 ? 12 : 10.5;
  return Math.round(base*f*10)/10;
}
function labelText(w){ return w.length>12 ? w.slice(0,11)+'…' : w; }

/* ------------------------------ сборка колеса ------------------------------ */
function buildWheel(){
  const svg=$('#wheel');
  svg.innerHTML='';

  const defs=svgEl('defs',{});
  for(let i=0;i<SECTORS;i++){
    const th=(hueOf(i));
    const c=sectorColors(i);
    const a=(i*TAU-90+TAU/2)*Math.PI/180;
    const g=svgEl('linearGradient',{id:'sg'+i, gradientUnits:'userSpaceOnUse',
      x1:CX, y1:CY, x2:(CX+R*Math.cos(a)).toFixed(2), y2:(CY+R*Math.sin(a)).toFixed(2)});
    g.appendChild(svgEl('stop',{offset:'0%','stop-color':c.deep}));
    g.appendChild(svgEl('stop',{offset:'100%','stop-color':c.bright}));
    defs.appendChild(g);
  }
  const rc=rimColors();
  const rg=svgEl('linearGradient',{id:'rimGrad', x1:'0', y1:'0', x2:'1', y2:'1'});
  rg.appendChild(svgEl('stop',{offset:'0%','stop-color':rc[0]}));
  rg.appendChild(svgEl('stop',{offset:'38%','stop-color':rc[1]}));
  rg.appendChild(svgEl('stop',{offset:'62%','stop-color':rc[2]}));
  rg.appendChild(svgEl('stop',{offset:'100%','stop-color':rc[3]}));
  defs.appendChild(rg);
  const hg=svgEl('radialGradient',{id:'hubGrad', cx:'35%', cy:'30%', r:'80%'});
  hg.appendChild(svgEl('stop',{offset:'0%', 'stop-color': isDark()? '#fff6e3':'#fff8ef'}));
  hg.appendChild(svgEl('stop',{offset:'60%', 'stop-color': isDark()? '#f4c462':'#e9a72a'}));
  hg.appendChild(svgEl('stop',{offset:'100%','stop-color': isDark()? '#a06a2a':'#b9772f'}));
  defs.appendChild(hg);
  svg.appendChild(defs);

  const rotor=svgEl('g',{id:'rotor'});
  rotor.setAttribute('transform',`rotate(${rot} ${CX} ${CY})`);

  /* секторы */
  for(let i=0;i<SECTORS;i++){
    const a0=(i*TAU-90)*Math.PI/180, a1=((i+1)*TAU-90)*Math.PI/180;
    const x0=CX+R*Math.cos(a0), y0=CY+R*Math.sin(a0), x1=CX+R*Math.cos(a1), y1=CY+R*Math.sin(a1);
    rotor.appendChild(svgEl('path',{class:'sector','data-i':i,
      d:`M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      fill:`url(#sg${i})`}));
  }
  /* обод и тонкое кольцо внутри */
  rotor.appendChild(svgEl('circle',{class:'rim',cx:CX,cy:CY,r:R+6, stroke:'url(#rimGrad)'}));
  rotor.appendChild(svgEl('circle',{class:'rim-in',cx:CX,cy:CY,r:R-10}));

  /* плашки со словами: по касательной, внизу перевёрнуты, чтобы читались */
  for(let i=0;i<SECTORS;i++){
    const txt=labelText(words[i]), size=labelSize(txt);
    const w=clamp(txt.length*size*0.62+16, 46, 132), h=28;
    const phi=i*TAU+TAU/2;
    const outer=svgEl('g',{transform:`rotate(${phi} ${CX} ${CY})`,'data-i':i});
    const inner=svgEl('g',{});
    if(phi>90 && phi<270){ inner.setAttribute('transform',`rotate(180 ${CX} ${CY-PLATE_R})`); }
    inner.appendChild(svgEl('rect',{class:'plate','data-i':i, x:(CX-w/2).toFixed(2), y:(CY-PLATE_R-h/2).toFixed(2),
      width:w.toFixed(2), height:h, rx:13, ry:13}));
    const t=svgEl('text',{class:'plate-txt', x:CX, y:(CY-PLATE_R+5.4).toFixed(2), 'font-size':size});
    t.textContent=txt;
    inner.appendChild(t);
    outer.appendChild(inner);
    rotor.appendChild(outer);
  }
  svg.appendChild(rotor);

  /* втулка: не крутится */
  svg.appendChild(svgEl('circle',{class:'hub',cx:CX,cy:CY,r:46}));
  const hubText=svgEl('text',{class:'hub-emoji',x:CX,y:CY});
  hubText.textContent='🎡';
  svg.appendChild(hubText);

  highlight(lastWin);
}
function highlight(i){
  document.querySelectorAll('#wheel .sector').forEach(s=>s.classList.toggle('win', Number(s.dataset.i)===i));
  document.querySelectorAll('#wheel .plate').forEach(p=>p.classList.toggle('hot', Number(p.dataset.i)===i));
}

/* ------------------------------ LED по ободу ------------------------------ */
function buildLeds(){
  const box=$('#leds');
  box.innerHTML='';
  const n=24;
  for(let i=0;i<n;i++){
    const a=(i*360/n-90)*Math.PI/180, rr=50.4;
    const d=document.createElement('span');
    d.className='led';
    d.style.left=(50+rr*Math.cos(a)).toFixed(2)+'%';
    d.style.top=(50+rr*Math.sin(a)).toFixed(2)+'%';
    d.style.animationDelay=(i*0.14).toFixed(2)+'s';
    box.appendChild(d);
  }
}

/* ------------------------------ звук ------------------------------ */
let audioCtx=null;
function ctxAudio(){
  if(!audioCtx){ try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; } }
  if(audioCtx && audioCtx.state==='suspended'){ try{ audioCtx.resume(); }catch(e){} }
  return audioCtx;
}
function tone(freq,dur,type,gain,delay){
  if(!state.sound) return;
  const ac=ctxAudio(); if(!ac) return;
  const t0=ac.currentTime+(delay||0);
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
  g.gain.setValueAtTime(0,t0);
  g.gain.linearRampToValueAtTime(gain||.1,t0+.02);
  g.gain.exponentialRampToValueAtTime(.0008,t0+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0+dur+.05);
  return o;
}
function tick(){ tone(700+Math.random()*260,.05,'square',.05,0); }
function whoosh(){
  if(!state.sound) return;
  const ac=ctxAudio(); if(!ac) return;
  const t0=ac.currentTime;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type='sawtooth';
  o.frequency.setValueAtTime(220,t0);
  o.frequency.exponentialRampToValueAtTime(900,t0+.7);
  o.frequency.exponentialRampToValueAtTime(180,t0+2.4);
  g.gain.setValueAtTime(.0001,t0);
  g.gain.linearRampToValueAtTime(.09,t0+.25);
  g.gain.exponentialRampToValueAtTime(.0008,t0+2.4);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0+2.6);
}
function fanfare(){ [523,659,784,1047,1318].forEach((f,i)=>tone(f,.26,'triangle',.12,i*.09)); }
function rumble(){ tone(120,.35,'sine',.12,0); tone(90,.45,'sine',.1,.08); }
function ding(){ tone(1200,.12,'triangle',.1,0); tone(1600,.14,'triangle',.08,.1); }

/* ------------------------------ конфетти и искры ------------------------------ */
const cvs=$('#confetti');
const cctx=cvs.getContext('2d');
let parts=[], confRAF=null;
function fitCanvas(){
  const dpr=Math.min(2, window.devicePixelRatio||1);
  cvs.width=Math.max(1, Math.floor(window.innerWidth*dpr));
  cvs.height=Math.max(1, Math.floor(window.innerHeight*dpr));
  cctx.setTransform(dpr,0,0,dpr,0,0);
}
function wheelCenter(){
  const f=$('#wheel-frame').getBoundingClientRect();
  return { x:f.left+f.width/2, y:f.top+f.height/2 };
}
function confetti(n, hue){
  if(n<=0) return;
  fitCanvas();
  const c=wheelCenter();
  const cols=[`hsl(${hue} 85% 65%)`,'#f4c462','#ff79ab','#7fb7ff','#66d9b4','#ffffff'];
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=3+Math.random()*7;
    parts.push({ x:c.x, y:c.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2.5, g:.5+Math.random()*.35,
      s:5+Math.random()*10, c:pick(cols), r:Math.random()*6.28, sp:(Math.random()*2-1)*.3, life:1 });
  }
  if(!confRAF) confRAF=requestAnimationFrame(confStep);
}
function confStep(){
  cctx.clearRect(0,0,window.innerWidth,window.innerHeight);
  for(const p of parts){
    p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.vx*=.99; p.r+=p.sp; p.life-=0.011;
    if(p.life<=0 || p.y>window.innerHeight+30) continue;
    cctx.save();
    cctx.translate(p.x,p.y); cctx.rotate(p.r);
    cctx.globalAlpha=Math.max(0,p.life);
    cctx.fillStyle=p.c;
    cctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);
    cctx.restore();
  }
  parts=parts.filter(p=>p.life>0 && p.y<window.innerHeight+30);
  if(parts.length){ confRAF=requestAnimationFrame(confStep); }
  else { confRAF=null; cctx.clearRect(0,0,window.innerWidth,window.innerHeight); }
}
function sparkleBurst(n){
  const box=$('#sparkles'); if(!box) return;
  const c=wheelCenter();
  const E=['✨','⭐','💫','🌟','🎀','🌈'];
  for(let i=0;i<(n||12);i++){
    const s=document.createElement('span');
    s.className='spk'; s.textContent=pick(E);
    s.style.left=(c.x+(Math.random()*300-150))+'px';
    s.style.top=(c.y+(Math.random()*220-110))+'px';
    s.style.fontSize=(16+Math.random()*22)+'px';
    box.appendChild(s);
    setTimeout(()=>s.remove(),1300);
  }
}

/* ------------------------------ вращение ------------------------------ */
const SPEED={
  fast:   {turns:3, extra:1, dur:2600, tail:1200, wob:260, ease:3.0},
  normal: {turns:5, extra:2, dur:4800, tail:1600, wob:420, ease:2.8},
  long:   {turns:7, extra:3, dur:8000, tail:2600, wob:700, ease:2.2}
};
function spinMode(){ return SPEED[state.speed] || SPEED.long; }
function reducedMotion(){ try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }

function pickWinner(){
  let i=rnd(SECTORS);
  if(i===lastWin) i=(i+1+rnd(SECTORS-1))%SECTORS;
  lastWin=i;
  return i;
}
function spin(){
  if(spinning) return;
  const i=pickWinner();
  const m=spinMode();
  const jitter=(Math.random()*2-1)*12;              /* стрелка встаёт внутрь сектора */
  const base=-(i*TAU+TAU/2)-jitter;
  const target=((base%360)+360)%360;
  const cur=((rot%360)+360)%360;
  let delta=target-cur; if(delta<0) delta+=360;
  const turns=m.turns+rnd(m.extra+1);
  const from=rot, to=rot+delta+turns*360;
  const dur=reducedMotion()? 380 : m.dur+rnd(m.tail);

  spinning=true;
  $('#spin').classList.add('busy');
  $('#wheel-tap').classList.add('busy');
  $('#wheel-frame').classList.add('spin');
  $('#pointer').classList.add('busy');
  whoosh();
  const t0=performance.now();
  let prevSlot=Math.round(((from%360)+360)%360/TAU), prevRot=from, prevT=t0;
  const rotor=$('#rotor');

  function frame(now){
    const p=Math.min(1,(now-t0)/dur);
    const e=1-Math.pow(1-p,m.ease);
    rot=from+(to-from)*e;
    rotor.setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    const dt=Math.max(1, now-prevT);
    const v=(rot-prevRot)/dt;                       /* градусов за миллисекунду */
    prevRot=rot; prevT=now;
    if(!reducedMotion()){ rotor.style.filter = v>0.35 ? `blur(${clamp(v*0.85,0,3).toFixed(2)}px)` : ''; }
    const slot=Math.round(((rot%360)+360)%360/TAU);
    if(slot!==prevSlot){ tick(); prevSlot=slot; }
    if(p<1) requestAnimationFrame(frame); else settle(i);
  }
  requestAnimationFrame(frame);

  /* финальное «докачивание» */
  function settle(i){
    const t0s=performance.now(), durS=reducedMotion()? 0 : m.wob;
    const amp=m.wob>500?3.4:(m.wob>350?2.6:1.8);
    function s(now){
      const p=Math.min(1,(now-t0s)/durS);
      const wob=Math.sin(p*Math.PI*(m.wob>500?4:3))*(1-p)*amp;
      rotor.setAttribute('transform',`rotate(${(rot+wob).toFixed(2)} ${CX} ${CY})`);
      if(p<1) requestAnimationFrame(s); else land(i);
    }
    if(durS===0) land(i); else requestAnimationFrame(s);
  }
  function land(i){
    rotor.style.filter='';
    $('#rotor').setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    spinning=false;
    $('#spin').classList.remove('busy');
    $('#wheel-tap').classList.remove('busy');
    $('#wheel-frame').classList.remove('spin');
    const ptr=$('#pointer');
    ptr.classList.remove('busy'); ptr.classList.remove('hit'); void ptr.offsetWidth; ptr.classList.add('hit');
    const wf=$('#wheel-frame');
    wf.classList.remove('hit'); void wf.offsetWidth; wf.classList.add('hit');
    highlight(i);
    showWord(i);
    const hue=hueOf(i);
    rumble(); fanfare();
    confetti(reducedMotion()? 0 : 200, hue);
    sparkleBurst(reducedMotion()? 0 : 26);
    state.spins++; save(); updateCounts();
  }
}

/* ------------------------------ результат ------------------------------ */
function showWord(i){
  const w=words[i], hue=hueOf(i);
  const el=$('#word');
  el.innerHTML=w.split('').map((ch,k)=>`<span class="ltr" style="--i:${k}; color:hsl(${(hue+k*14)%360} 80% ${isDark()?68:58}%)">${ch}</span>`).join('');
  const card=$('#word-card');
  card.style.setProperty('--glow', `hsl(${hue} 85% 60% / .6)`);
  card.style.setProperty('--glow-soft', `hsl(${hue} 85% 60% / .28)`);
  card.classList.add('hot');
  $('#task').textContent='Найди слово «'+w+'» в словаре или энциклопедии на столе и расскажи, что оно обозначает.';
  card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
  card.scrollIntoView({behavior:reducedMotion()?'auto':'smooth', block:'nearest'});
  speakWord(w);
  ding();
}
function speakWord(w){
  if(!state.sound || !window.speechSynthesis) return;
  try{
    const u=new SpeechSynthesisUtterance(w);
    u.lang='ru-RU'; u.rate=.9; u.pitch=1.05;
    const v=window.speechSynthesis.getVoices().filter(x=>/ru/i.test(x.lang))[0];
    if(v) u.voice=v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){}
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
  save(); renderFound(); updateCounts();
  ding(); sparkleBurst(10);
}
function updateCounts(){
  $('#found-count').textContent=state.found.length;
  $('#spin-count').textContent=state.spins;
}

/* ------------------------------ свои слова ------------------------------ */
function parseWords(text){
  const toks=text.split(/[\s,;]+/).map(s=>s.trim().replace(/[«»"'\.]/g,'')).filter(Boolean);
  const out=[]; const seen={};
  for(const t of toks){ if(!seen[t.toLowerCase()]){ seen[t.toLowerCase()]=1; out.push(t); } }
  const extra=shuffle(POOL).filter(p=>!seen[p]);
  while(out.length<SECTORS) out.push(extra.length? extra.shift() : pick(POOL));
  return out.slice(0,SECTORS);
}
function applyCustomWords(){
  const list=parseWords($('#words-input').value);
  words=list; state.words=list.slice(); save();
  buildWheel(); lastWin=-1; highlight(-1);
  $('#words-modal').classList.add('hidden');
  fanfare();
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
const SPEED_BTN={ fast:'#sp-fast', normal:'#sp-normal', long:'#sp-long' };
function renderSpeed(){
  for(const k in SPEED_BTN){ const el=$(SPEED_BTN[k]); if(el) el.classList.toggle('sel', state.speed===k); }
}
for(const k in SPEED_BTN){
  $(SPEED_BTN[k]).addEventListener('click',()=>{
    state.speed=k; save(); renderSpeed();
    tone(k==='long'?420:(k==='normal'?620:880), .12, 'triangle', .08, 0);
  });
}
$('#spin').addEventListener('click',spin);
$('#wheel-tap').addEventListener('click',spin);
$('#again').addEventListener('click',spin);
$('#another').addEventListener('click',()=>{ $('#shuffle').click(); spin(); });
$('#shuffle').addEventListener('click',()=>{
  words=shuffle(POOL).slice(0,SECTORS); state.words=[]; save();
  buildWheel(); lastWin=-1; highlight(-1);
});
$('#found').addEventListener('click',markFound);
$('#clear-found').addEventListener('click',()=>{
  if(!state.found.length) return;
  if(!confirm('Удалить список найденных слов?')) return;
  state.found=[]; save(); renderFound(); updateCounts();
});
$('#btn-theme').addEventListener('click',toggleTheme);
$('#btn-sound').addEventListener('click',()=>{
  state.sound=!state.sound; save();
  $('#btn-sound').textContent = state.sound? '🔊 Звук вкл.' : '🔇 Звук выкл.';
  if(state.sound) tone(700,.12,'triangle',.1,0);
});
$('#words-btn').addEventListener('click',()=>{
  $('#words-input').value=words.join(', ');
  $('#words-modal').classList.remove('hidden');
});
$('#words-apply').addEventListener('click',applyCustomWords);
$('#words-close').addEventListener('click',()=>$('#words-modal').classList.add('hidden'));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ $('#words-modal').classList.add('hidden'); return; }
  if((e.key===' '||e.key==='Enter') && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)){ e.preventDefault(); spin(); }
});
let resizeTimer=null;
window.addEventListener('resize',()=>{
  fitCanvas();
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>buildWheel(), 220);
});

/* ------------------------------ старт ------------------------------ */
applyTheme();
buildLeds();
$('#btn-sound').textContent = state.sound? '🔊 Звук вкл.' : '🔇 Звук выкл.';
renderSpeed();
renderFound();
updateCounts();
fitCanvas();
