/* ============================================================
   Тарелка слов — живой фон (canvas)
   ------------------------------------------------------------
   Один слой поверх CSS-подсветки комнаты:
     · дымка    — большие тёплые пятна света, медленно плывут по стене;
     · боке     — расфокусированные блики, они ближе всех к зрителю;
     · пылинки  — три глубины: дальние мелкие и тусклые, ближние крупные;
     · искры    — вылетают следом за храповиком, живут полсекунды;
     · волны    — световое кольцо, когда тарелка садится на штырёк.
   Воздух реагирует на вращение: AMB.frame(k) сообщает скорость, и вокруг
   тарелки поднимается воронка — пылинки закручивает и разгоняет.
   Дёшево: всё рисуется заранее запечёнными спрайтами, аллокаций в кадре нет.
   ============================================================ */
(function(){
'use strict';
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const rnd=(a,b)=>a+Math.random()*(b-a);

/* палитра: в ночи свет складывается (lighter), днём — ложится на крем (source-over) */
const PAL={
  dark:{ haze:'rgba(255,206,140,', mote:'rgba(255,230,184,', bokeh:'rgba(255,212,146,',
         spark:'rgba(255,206,118,', wave:'rgba(255,228,170,', add:true,  hazeA:.55, moteA:1 },
  light:{ haze:'rgba(226,196,150,', mote:'rgba(148,110,56,', bokeh:'rgba(190,152,92,',
         spark:'rgba(168,118,40,',  wave:'rgba(198,154,84,',  add:false, hazeA:.16, moteA:1 }
};

let cv=null, ctx=null, W=0, H=0, dpr=1, oX=0, oY=0;
let raf=null, last=0, clock=0, ema=16, acc=0;
let reduced=false, hidden=false;
let kSpin=0, kWant=0;                    /* скорость тарелки: цель и текущая */
let pX=0, pY=0, pXT=0, pYT=0;            /* параллакс: текущий и цель */
let warm=0;                              /* тёплая вспышка: село слово / села тарелка */
let sp=null;                             /* спрайты текущей темы */
let haze=[], motes=[], bokeh=[], sparks=[], waves=[];
let dish={x:-1e4, y:-1e4, r:0};          /* центр тарелки в координатах холста */

/* ------------------------------ уровни качества ------------------------------
   На слабом ноутбуке фон не имеет права отъедать кадры, поэтому он умеет
   сам себя урезать: меньше пикселей холста, меньше пыли, меньше дымок.
   Уровень выбирается при старте по железу, а потом подправляется по тому,
   как идут кадры. Ручной выбор: ?amb=off|low|med|high                          */
const TIERS=[
  { name:'low',  dpr:1,    moteK:.32, haze:3, bokeh:0, sparkK:.45, hazeK:.72 },
  { name:'med',  dpr:1.25, moteK:.68, haze:4, bokeh:5, sparkK:1,   hazeK:.86 },
  { name:'high', dpr:1.7,  moteK:1,   haze:5, bokeh:8, sparkK:1,   hazeK:1 }
];
let tier=1, tierTop=1, calm=0;           /* текущий и верхний допустимый уровни */
function Q(){ return TIERS[tier]; }

function pickTier(){
  let want=null;
  try{ want = new URLSearchParams(location.search).get('amb'); }catch(e){}
  if(want==='off' || want==='0' || want==='none') return -1;
  const i = TIERS.findIndex(t=>t.name===want);
  if(i>=0) return i;
  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory || 4;
  const huge  = (window.innerWidth*window.innerHeight) > 2600000;
  if(cores<=2 || mem<=2) return 0;
  if(cores<=4 || mem<=4 || huge) return 1;
  return 2;
}
/* сменить уровень: холст пересевается заново, класс на body tells CSS */
function setTier(next){
  next = clamp(next, 0, TIERS.length-1);
  if(next===tier) return;
  tier=next;
  markBody();
  rebuild();
}
function markBody(){
  const b=document.body;
  if(!b) return;
  b.classList.toggle('amb-low',  tier===0);
  b.classList.toggle('amb-med',  tier===1);
  b.classList.toggle('amb-high', tier===2);
}

/* ------------------------------ спрайты ------------------------------ */
/* Мягкое пятно: stops — [доля радиуса, альфа]. Цвет задаётся группой PAL,
   альфа перемножается в кадре через globalAlpha. */
function softSprite(rgb, stops, size){
  const c=document.createElement('canvas'); c.width=c.height=size;
  const g=c.getContext('2d'), h=size/2;
  const gr=g.createRadialGradient(h,h,0,h,h,h);
  for(const s of stops) gr.addColorStop(s[0], rgb+clamp(s[1],0,1).toFixed(3)+')');
  gr.addColorStop(1, rgb+'0)');
  g.fillStyle=gr; g.fillRect(0,0,size,size);
  return c;
}
function buildSprites(){
  const P=PAL[current()];
  sp={
    haze : softSprite(P.haze , [[0,.9],[.2,.7],[.4,.45],[.6,.24],[.78,.1],[.9,.03],[1,0]], 256),
    mote : softSprite(P.mote , [[0,1],[.14,.82],[.3,.34],[.62,.08],[1,0]], 48),
    bokeh: softSprite(P.bokeh, [[0,.55],[.42,.5],[.62,.3],[.86,.12],[1,0]], 96),
    spark: softSprite(P.spark, [[0,1],[.2,.7],[.5,.18],[1,0]], 40),
    wave : softSprite(P.wave , [[0,0],[.52,0],[.72,.55],[.84,.85],[.93,.25],[1,0]], 256)
  };
}
function current(){
  return (document.documentElement.getAttribute('data-theme')==='light')? 'light' : 'dark';
}

/* ------------------------------ размеры и посев ------------------------------ */
function rebuild(){
  if(!cv) return;
  const r=cv.getBoundingClientRect();
  W=Math.max(280, r.width); H=Math.max(280, r.height);
  oX=r.left; oY=r.top;
  /* чем больше экран, тем дешевле пиксель: полный dpr на большом мониторе
     стоил бы фонаря дороже, чем сама тарелка */
  const area=W*H, soft = area>2200000? .68 : (area>1200000? .85 : 1);
  dpr=Math.min(Q().dpr*soft, window.devicePixelRatio||1);
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  seed();
}
/* количество пылинок — по площади экрана и по уровню качества */
function moteCount(){
  return Math.max(10, Math.round(clamp(W*H/13000, 34, 122)*Q().moteK));
}
function seed(){
  haze=[]; bokeh=[]; sparks=[]; waves=[]; motes=[];
  const dark=current()==='dark', q=Q();
  /* дымка: пятна света, два из них вытянутые — похоже на пряди дыма.
     радиус ограничен: пятно во весь экран стоит дороже всей пыли вместе */
  const big=Math.min(W,H)*q.hazeK;
  for(let i=0;i<q.haze;i++){
    haze.push({ x:rnd(-.1,1.1)*W, y:rnd(-.05,1.05)*H,
      rx:rnd(.2,.42)*big, ry:rnd(.16,.34)*big*(i<2?1.9:1),
      vx:rnd(-4.5,4.5), vy:rnd(-3,3), ph:rnd(0,TAU), sp:rnd(.05,.16),
      a:rnd(.5,1), z:rnd(.25,.7), tilt:rnd(-.5,.5) });
  }
  /* боке — ближе всех к зрителю, потому сильнее тянется за курсором */
  for(let i=0;i<q.bokeh;i++){
    bokeh.push({ x:rnd(0,1)*W, y:rnd(0,1)*H, r:rnd(12,46),
      vx:rnd(-5,5), vy:rnd(-4,4), a:rnd(.07,dark?.2:.1), ph:rnd(0,TAU), sp:rnd(.08,.22) });
  }
  /* пылинки трёх глубин: 0.32 — у стены, 1 — на уровне тарелки, 1.9 — перед ней */
  const DEEP=[[.32,.42],[1,.4],[1.9,.18]];
  const n=moteCount();
  for(let i=0;i<n;i++){
    let u=Math.random(), d=DEEP[0];
    for(const layer of DEEP){ u-=layer[1]; if(u<=0){ d=layer; break; } }
    const z=d[0];
    motes.push({
      x:rnd(0,1)*W, y:rnd(0,1)*H, z:z,
      r: z<.5? rnd(.9,1.7) : (z<1.4? rnd(1.3,2.6) : rnd(2.8,5.6)),
      vx:rnd(-3.5,3.5), vy:rnd(-16,-3)*(z<.5?.5:1),
      sw:rnd(3,16)*z, sp:rnd(.12,.5), ph:rnd(0,TAU),
      a:(z<.5? rnd(.22,.42) : (z<1.4? rnd(.34,.68) : rnd(.14,.32))),
      tw:rnd(.15,.5), tsp:rnd(.3,1.5)
    });
  }
}

/* ------------------------------ ход воздуха ------------------------------ */
function step(dt){
  const dark=current()==='dark';
  /* энергия вращения и параллакс сглаживаем: фон никогда не дёргается */
  kSpin += (kWant-kSpin)*Math.min(1, dt*2.6);
  pX += (pXT-pX)*Math.min(1, dt*2.4);
  pY += (pYT-pY)*Math.min(1, dt*2.4);
  warm = Math.max(0, warm - dt*0.75);
  /* лёгкое дыхание комнаты: застой воздуха и сквозняк поочерёдно */
  const breeze=Math.sin(clock*0.11)*0.6 + Math.sin(clock*0.037)*0.4;

  for(const b of haze){
    b.x += (b.vx + breeze*6*b.z)*dt; b.y += b.vy*dt;
    const rx=b.rx*1.5, ry=b.ry*1.5;
    if(b.x<-rx) b.x=W+rx; else if(b.x>W+rx) b.x=-rx;
    if(b.y<-ry) b.y=H+ry; else if(b.y>H+ry) b.y=-ry;
  }
  for(const b of bokeh){
    b.x += b.vx*dt; b.y += b.vy*dt;
    if(b.x<-b.r) b.x=W+b.r; else if(b.x>W+b.r) b.x=-b.r;
    if(b.y<-b.r) b.y=H+b.r; else if(b.y>H+b.r) b.y=-b.r;
  }
  /* воронка вокруг тарелки: тангенциальный срыв + немного наружу */
  const swirl=kSpin*1.15;
  const R2=Math.max(1, dish.r*dish.r*3.2);
  for(const m of motes){
    const sway=Math.sin(clock*m.sp+m.ph)*m.sw;
    let vx=m.vx + sway*0.35 + breeze*10*m.z;
    let vy=m.vy;
    if(swirl>0.015){
      const dx=m.x-dish.x, dy=m.y-dish.y, d2=dx*dx+dy*dy;
      const f=swirl*Math.exp(-d2/R2)*m.z;
      vx += -dy*0.85*f + dx*0.12*f;
      vy +=  dx*0.85*f + dy*0.12*f;
    }
    m.x += vx*dt; m.y += vy*dt;
    const pad=26;
    if(m.x<-pad) m.x=W+pad; else if(m.x>W+pad) m.x=-pad;
    if(m.y<-pad) m.y=H+pad; else if(m.y>H+pad) m.y=-pad;
  }
  for(let i=sparks.length-1;i>=0;i--){
    const s=sparks[i];
    s.age+=dt;
    if(s.age>=s.life){ sparks.splice(i,1); continue; }
    s.vy += 260*dt;                 /* гравитация: искры остывают по дуге */
    s.vx *= (1-1.9*dt);
    s.x += s.vx*dt; s.y += s.vy*dt;
  }
  for(let i=waves.length-1;i>=0;i--){
    const w=waves[i];
    w.age+=dt;
    if(w.age>=w.life){ waves.splice(i,1); continue; }
    w.r += w.vr*dt; w.vr *= (1-0.75*dt);
  }
}

/* ------------------------------ отрисовка ------------------------------ */
function blit(img, x, y, size, alpha){
  if(alpha<=0.004) return;
  ctx.globalAlpha=alpha;
  ctx.drawImage(img, x-size*0.5, y-size*0.5, size, size);
}
function draw(){
  const P=PAL[current()];
  ctx.clearRect(0,0,W,H);
  ctx.globalCompositeOperation = P.add? 'lighter' : 'source-over';
  const glow = 1 + kSpin*0.55 + warm*0.5;           /* комната светлеет, когда тарелка ходит */

  /* дымка: пятна света с медленным мерцанием и наклоном */
  for(const b of haze){
    const a=b.a*P.hazeA*glow*(0.78+0.22*Math.sin(clock*b.sp+b.ph));
    ctx.globalAlpha=clamp(a,0,1);
    ctx.save();
    ctx.translate(b.x + pX*b.z*0.9, b.y + pY*b.z*0.9);
    ctx.rotate(b.tilt);
    ctx.drawImage(sp.haze, -b.rx, -b.ry, b.rx*2, b.ry*2);
    ctx.restore();
  }
  /* боке: расфокус, потому крупное и очень подвижное по параллаксу */
  for(const b of bokeh){
    const a=b.a*glow*(0.7+0.3*Math.sin(clock*b.sp+b.ph));
    blit(sp.bokeh, b.x + pX*2.1, b.y + pY*2.1, b.r*2, a);
  }
  /* пылинки: дальние меньше и тусклее, ближние крупнее и размытее */
  for(const m of motes){
    const tw = 1 - m.tw + m.tw*Math.sin(clock*m.tsp+m.ph*2);
    const a = m.a*P.moteA*tw*glow;
    blit(sp.mote, m.x + pX*m.z*11, m.y + pY*m.z*8, m.r*5.4, a);
  }
  /* искры — только в ночи: днём они бы просто пачкали стену */
  if(P.add){
    for(const s of sparks){
      const q=1-s.age/s.life;
      blit(sp.spark, s.x + pX*1.6, s.y + pY*1.6, s.r*(6+q*9), 0.85*q*q);
    }
    for(const w of waves){
      const q=1-w.age/w.life;
      blit(sp.wave, w.x, w.y, w.r*2, w.power*q*q*0.55);
    }
  } else {
    for(const w of waves){
      const q=1-w.age/w.life;
      blit(sp.wave, w.x, w.y, w.r*2, w.power*q*q*0.3);
    }
  }
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
}

/* ------------------------------ кадр ------------------------------ */
function tick(now){
  raf=requestAnimationFrame(tick);
  if(hidden){ last=now; return; }
  const raw=(now-last)||16; last=now;
  const dt=Math.min(50, raw)/1000;
  clock+=dt;
  /* фон подстраивается сам: кадры просели — сразу уровень ниже;
     шёл легко шесть секунд — один раз можно вернуть уровень обратно */
  ema += (raw-ema)*0.06;
  if(ema>34 && tier>0){ setTier(tier-1); ema=18; calm=0; }
  else if(ema<11){ calm+=dt; if(calm>6 && tier<tierTop){ setTier(tier+1); calm=0; ema=16; } }
  else if(ema>20) calm=0;
  /* на низком уровне рисуем в ~30 к/с: движение медленное, глазу хватит,
     а половина растра остаётся системе */
  let sdt=dt;
  if(tier===0){ acc+=dt; if(acc<1/30) return; sdt=acc; acc=0; }
  step(sdt); draw();
}
function start(){
  if(raf || !cv) return;
  last=performance.now();
  raf=requestAnimationFrame(tick);
}
function stop(){ if(raf){ cancelAnimationFrame(raf); raf=null; } }
function still(){                       /* reduced motion: один кадр, без цикла */
  if(!ctx) return;
  draw();
}

/* ------------------------------ внешний API ------------------------------ */
const AMB=window.AMB={
  /* повесить движок на canvas; вызывается один раз при старте страницы */
  mount(el){
    if(!el || !el.getContext) return;
    const t=pickTier();
    if(t<0){ document.body.classList.add('amb-off'); return; }   /* ?amb=off — фона нет вовсе */
    tier=t; tierTop=t; markBody();
    cv=el; ctx=cv.getContext('2d');
    reduced = reducedMotion();
    buildSprites(); rebuild();
    if(reduced){ still(); }
    else {
      start();
      let pending=false;
      window.addEventListener('resize', ()=>{
        if(pending) return; pending=true;
        requestAnimationFrame(()=>{ pending=false; rebuild(); });
      }, {passive:true});
      document.addEventListener('visibilitychange', ()=>{
        hidden=document.hidden; if(!hidden) last=performance.now();
      });
      /* фон тянется за курсором: слой за слоем, как за окном на ходу */
      window.addEventListener('pointermove', e=>{
        if(e.pointerType!=='mouse') return;
        pXT=(e.clientX/Math.max(1,window.innerWidth)-0.5)*2;
        pYT=(e.clientY/Math.max(1,window.innerHeight)-0.5)*2;
        const host=document.querySelector('.ambient');
        if(host){
          host.style.setProperty('--ax', (-pXT*14).toFixed(1)+'px');
          host.style.setProperty('--ay', (-pYT*10).toFixed(1)+'px');
        }
      }, {passive:true});
    }
  },
  /* скорость вращения 0..1 — из неё растёт воронка, яркость и дымка */
  frame(v){ kWant=clamp(v||0, 0, 1.4); },
  /* где сейчас тарелка: центр и радиус в экранных координатах */
  dish(x, y, r){ dish.x=x-oX; dish.y=y-oY; dish.r=Math.max(10, r||120); },
  /* искры от храповика: экраные координаты точки удара */
  spark(x, y, n, scale){
    if(reduced || !sp) return;
    const s=Math.max(0.2, scale||1), k=Q().sparkK;
    const X=x-oX, Y=y-oY;
    const room=Math.round(140*k)-sparks.length;
    for(let i=0;i<Math.min(Math.ceil(n*k), room);i++){
      sparks.push({ x:X+rnd(-5,5)*s, y:Y+rnd(-4,4)*s,
        vx:rnd(40,240)*s*(Math.random()<0.22?-1:1), vy:rnd(-190,-20)*s,
        age:0, life:rnd(.32,.75), r:rnd(.8,2.1)*s });
    }
    if(reduced) still();
  },
  /* световое кольцо от удара о штырёк или о пол */
  wave(x, y, power){
    if(reduced || !sp) return;
    waves.push({ x:x-oX, y:y-oY, r:26, vr:300+220*(power||1), age:0, life:1.15,
      power:clamp(power||1, .2, 1) });
    warm=Math.min(1, warm + 0.75*(power||1));
    if(reduced) still();
  },
  /* короткое тепло по всей комнате: нашли слово, объяснили всё */
  pulse(power){
    warm=Math.min(1.1, warm + (power||1));
    if(reduced) still();
  },
  retheme(){ if(!sp) return; buildSprites(); if(reduced) still(); },
  /* для проверки руками: какой уровень взял фон и сколько он рисует */
  stats(){ return { tier:TIERS[tier].name, top:TIERS[tierTop].name, ms:+ema.toFixed(1),
                    dpr:+dpr.toFixed(2), motes:motes.length, haze:haze.length,
                    bokeh:bokeh.length, sparks:sparks.length }; },
  quality(name){ const i=TIERS.findIndex(t=>t.name===name); if(i>=0){ tierTop=i; setTier(i); } }
};
function reducedMotion(){
  try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch(e){ return false; }
}
})();
