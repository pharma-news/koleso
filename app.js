/* ============================================================
   Колесо слов
   12 разноцветных секторов со словами: колесо крутится, стрелка
   показывает слово, ребёнок ищет его в словаре или энциклопедии.
   Работает с мышки и с пальца, светлая и тёмная темы, прогресс
   сохраняется на устройстве.
   ============================================================ */
const SECTORS=12, TAU=360/SECTORS, CX=200, CY=200, R=182, LABEL_R=118;
const KEY='koleso_v1';
const SVGNS='http://www.w3.org/2000/svg';

/* слова, которые встречаются в толковых словарях и энциклопедиях */
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

/* ------------------------------ состояние ------------------------------ */
let state=loadState();
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null')||{};
    return { sound: s.sound!==false, theme: s.theme||'auto',
             words: Array.isArray(s.words)? s.words : [],
             found: Array.isArray(s.found)? s.found : [], spins: s.spins||0 };
  }catch(e){ return { sound:true, theme:'auto', words:[], found:[], spins:0 }; }
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }

let words = (state.words.length===SECTORS) ? state.words.slice() : shuffle(POOL).slice(0,SECTORS);
let rot=0, spinning=false, lastWin=-1;

/* ------------------------------ колесо ------------------------------ */
function sectorColor(i){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const hue=(i*30+6)%360;
  const sat=dark?52:72, lit=dark? (34+(i%2)*7) : (72+(i%2)*9);
  return `hsl(${hue} ${sat}% ${lit}%)`;
}
function labelSize(w){
  if(w.length<=5) return 15;
  if(w.length<=7) return 13.5;
  if(w.length<=9) return 11;
  return 9.5;
}
function labelText(w){ return w.length>11 ? w.slice(0,10)+'…' : w; }

function buildWheel(){
  const svg=$('#wheel');
  svg.innerHTML='';
  const rotor=svgEl('g',{id:'rotor'});
  rotor.setAttribute('transform',`rotate(${rot} ${CX} ${CY})`);

  for(let i=0;i<SECTORS;i++){
    const a0=(i*TAU-90)*Math.PI/180, a1=((i+1)*TAU-90)*Math.PI/180;
    const x0=CX+R*Math.cos(a0), y0=CY+R*Math.sin(a0), x1=CX+R*Math.cos(a1), y1=CY+R*Math.sin(a1);
    rotor.appendChild(svgEl('path',{
      class:'sector','data-i':i,
      d:`M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      fill:sectorColor(i)
    }));
  }
  /* ободок и риски между секторами */
  rotor.appendChild(svgEl('circle',{class:'rim',cx:CX,cy:CY,r:R}));
  rotor.appendChild(svgEl('circle',{class:'rim-in',cx:CX,cy:CY,r:R-9}));
  for(let i=0;i<SECTORS;i++){
    const a=(i*TAU-90)*Math.PI/180;
    rotor.appendChild(svgEl('line',{class:'notch',
      x1:(CX+(R-9)*Math.cos(a)).toFixed(2), y1:(CY+(R-9)*Math.sin(a)).toFixed(2),
      x2:(CX+(R+9)*Math.cos(a)).toFixed(2), y2:(CY+(R+9)*Math.sin(a)).toFixed(2)}));
  }
  /* подписи слов: по касательной, каждая в своём секторе */
  for(let i=0;i<SECTORS;i++){
    const t=svgEl('text',{class:'sector-label','data-i':i, x:CX, y:CY-LABEL_R,
      'text-anchor':'middle', 'font-size':labelSize(words[i]),
      transform:`rotate(${i*TAU+TAU/2} ${CX} ${CY})`});
    t.textContent=labelText(words[i]);
    rotor.appendChild(t);
  }
  svg.appendChild(rotor);

  /* центральная втулка не крутится */
  svg.appendChild(svgEl('circle',{class:'hub',cx:CX,cy:CY,r:44}));
  const hubText=svgEl('text',{class:'hub-emoji',x:CX,y:CY});
  hubText.textContent='🎡';
  svg.appendChild(hubText);
}
function highlight(i){
  document.querySelectorAll('#wheel .sector').forEach(s=>s.classList.toggle('win', Number(s.dataset.i)===i));
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
  o.type=type||'sine'; o.frequency.value=freq;
  g.gain.setValueAtTime(0,t0);
  g.gain.linearRampToValueAtTime(gain||.1,t0+.02);
  g.gain.exponentialRampToValueAtTime(.0008,t0+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0+dur+.05);
}
function tick(){ tone(760+Math.random()*160,.05,'square',.05,0); }
function fanfare(){ [523,659,784,1047].forEach((f,i)=>tone(f,.24,'triangle',.12,i*.09)); }

/* ------------------------------ конфетти ------------------------------ */
const cvs=$('#confetti');
const cctx=cvs.getContext('2d');
let parts=[], confRAF=null;
function fitCanvas(){
  const dpr=Math.min(2, window.devicePixelRatio||1);
  cvs.width=Math.max(1, Math.floor(window.innerWidth*dpr));
  cvs.height=Math.max(1, Math.floor(window.innerHeight*dpr));
  cctx.setTransform(dpr,0,0,dpr,0,0);
}
function confetti(n){
  fitCanvas();
  const cols=['#ef4f8b','#f0783c','#e9a72a','#3f87e0','#2fa87c','#6f4bb0','#ff79ab'];
  for(let i=0;i<(n||120);i++){
    parts.push({ x:window.innerWidth*0.5+(Math.random()*260-130), y:window.innerHeight*0.32+(Math.random()*90-45),
      vx:(Math.random()*2-1)*3.4, vy:-3-Math.random()*4, g:.42+Math.random()*.3,
      s:5+Math.random()*9, c:pick(cols), r:Math.random()*6.28, sp:(Math.random()*2-1)*.22, life:1 });
  }
  if(!confRAF) confRAF=requestAnimationFrame(confStep);
}
function confStep(){
  cctx.clearRect(0,0,window.innerWidth,window.innerHeight);
  for(const p of parts){
    p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.r+=p.sp; p.life-=0.012;
    if(p.life<=0 || p.y>window.innerHeight+30) continue;
    cctx.save();
    cctx.translate(p.x,p.y); cctx.rotate(p.r);
    cctx.globalAlpha=Math.max(0,p.life);
    cctx.fillStyle=p.c;
    cctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);
    cctx.restore();
  }
  parts=parts.filter(p=>p.life>0 && p.y<window.innerHeight+30);
  if(parts.length){ confRAF=requestAnimationFrame(confStep); } else { confRAF=null; cctx.clearRect(0,0,window.innerWidth,window.innerHeight); }
}

/* ------------------------------ вращение ------------------------------ */
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
  const jitter=(Math.random()*2-1)*12;              /* стрелка встаёт внутрь сектора */
  const base=-(i*TAU+TAU/2)- jitter;
  const target=((base%360)+360)%360;
  const cur=((rot%360)+360)%360;
  let delta=target-cur; if(delta<0) delta+=360;
  const turns=4+rnd(3);
  const from=rot, to=rot+delta+turns*360;
  const dur=reducedMotion()? 380 : 4200+rnd(900);

  spinning=true;
  $('#spin').classList.add('busy');
  $('#wheel-tap').classList.add('busy');
  $('#pointer').classList.add('busy');
  const t0=performance.now();
  let prevSlot=Math.round(((from%360)+360)%360/TAU);

  function frame(now){
    const p=Math.min(1,(now-t0)/dur);
    const e=1-Math.pow(1-p,3);
    rot=from+(to-from)*e;
    $('#rotor').setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    const slot=Math.round(((rot%360)+360)%360/TAU);
    if(slot!==prevSlot){ tick(); prevSlot=slot; }
    if(p<1) requestAnimationFrame(frame); else settle(i);
  }
  requestAnimationFrame(frame);

  /* финальное «докачивание»: колесо чуть качается и останавливается */
  function settle(i){
    const t0s=performance.now(), durS=reducedMotion()? 0 : 420;
    function s(now){
      const p=Math.min(1,(now-t0s)/durS);
      const wob=Math.sin(p*Math.PI*3)*(1-p)*2.6;
      $('#rotor').setAttribute('transform',`rotate(${(rot+wob).toFixed(2)} ${CX} ${CY})`);
      if(p<1) requestAnimationFrame(s); else land(i);
    }
    if(durS===0) land(i); else requestAnimationFrame(s);
  }
  function land(i){
    $('#rotor').setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    spinning=false;
    $('#spin').classList.remove('busy');
    $('#wheel-tap').classList.remove('busy');
    const ptr=$('#pointer');
    ptr.classList.remove('busy'); ptr.classList.remove('hit'); void ptr.offsetWidth; ptr.classList.add('hit');
    highlight(i);
    showWord(i);
    fanfare(); confetti(reducedMotion()? 0 : 170);
    state.spins++; save(); updateCounts();
  }
}

/* ------------------------------ результат ------------------------------ */
function showWord(i){
  const w=words[i];
  $('#word').textContent=w;
  $('#task').textContent='Найди слово «'+w+'» в словаре или энциклопедии на столе и расскажи, что оно обозначает.';
  const card=$('#word-card');
  card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
  card.scrollIntoView({behavior:reducedMotion()?'auto':'smooth', block:'nearest'});
  speakWord(w);
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
  box.innerHTML=state.found.slice().reverse().map(f=>
    '<span class="fchip">'+f.w+' <small>'+f.t+'</small></span>').join('');
}
function markFound(){
  const w=$('#word').textContent;
  if(!w || w==='—') return;
  const t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  state.found.push({w:w,t:t});
  save(); renderFound(); updateCounts();
  tone(980,.14,'triangle',.1,0); tone(1320,.16,'triangle',.09,.12);
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
  buildWheel(); lastWin=-1;
  $('#words-modal').classList.add('hidden');
  fanfare();
}

/* ------------------------------ тема ------------------------------ */
function applyTheme(){
  const dark = state.theme==='dark' || (state.theme==='auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
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
$('#another').addEventListener('click',()=>{ $('#shuffle').click(); spin(); });
$('#shuffle').addEventListener('click',()=>{
  words=shuffle(POOL).slice(0,SECTORS); state.words=[]; save();
  buildWheel(); lastWin=-1;
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
window.addEventListener('resize',fitCanvas);

/* ------------------------------ старт ------------------------------ */
applyTheme();
$('#btn-sound').textContent = state.sound? '🔊 Звук вкл.' : '🔇 Звук выкл.';
renderFound(); updateCounts(); fitCanvas();
