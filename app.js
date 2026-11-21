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
const PLATE_OUT=156, PLATE_IN=72, PLATE_H=26; /* плашки: вдоль радиуса, читаются вниз к центру */
const ROMAN_R=60;                  /* римские номера секторов */
const PIVOT_X=200, PIVOT_Y=10;     /* ось защёлки-молоточка */
const KEY='koleso_v1';
const SVGNS='http://www.w3.org/2000/svg';

/* приглушённые «эмалевые» цвета секторов: h, s, l */
const PALETTE=[
  [148,25,25],[350,36,30],[212,30,27],[ 40,44,29],
  [168,22,26],[ 16,44,31],[200,30,28],[ 28,34,27],
  [158,25,26],[335,36,30],[216,15,28],[ 36,46,30]
];

const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a, Math.min(b, v));
function svgEl(name,attrs){ const e=document.createElementNS(SVGNS,name); for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }
function stops(list){ return list.map(([o,c])=>svgEl('stop',{offset:o,'stop-color':c})); }

/* ------------------------------ состояние ------------------------------ */
let state=loadState();
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null')||{};
    return { theme: s.theme||'auto', found: Array.isArray(s.found)? s.found : [], spins: s.spins||0 };
  }catch(e){ return { theme:'auto', found:[], spins:0 }; }
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
/* плашка лежит вдоль радиуса: длина ограничена span между кольцом и ободом */
const PLATE_SPAN = PLATE_OUT - PLATE_IN;
function labelSize(w){
  const base = w.length<=5 ? 19 : w.length<=6 ? 17.5 : w.length<=7 ? 16 : 15;
  const fit = ((PLATE_SPAN-16)/w.length - 0.7)/0.62;
  return Math.round(Math.min(base, fit)*10)/10;
}
function plateLen(txt, size){ return Math.min(PLATE_SPAN, txt.length*(size*0.62+0.7)+16); }
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

  /* тёплое свечение по ободу, растёт вместе со скоростью */
  const haloG=svgEl('radialGradient',{id:'haloG'});
  stops([['0%','rgba(255,200,110,0)'],['62%','rgba(255,200,110,.08)'],
    ['82%','rgba(255,206,120,.45)'],['100%','rgba(255,160,60,0)']]).forEach(s=>haloG.appendChild(s));
  defs.appendChild(haloG);

  const blur=svgEl('filter',{id:'softShadow',x:'-30%',y:'-30%',width:'160%',height:'160%'});
  blur.appendChild(svgEl('feGaussianBlur',{stdDeviation:'7'}));
  defs.appendChild(blur);

  /* волокна дерева: шум, подкрашенный в тёмную древесину и обрезанный по форме */
  function grainFilter(id,fx,fy,seed,rgb,alphaBias){
    const f=svgEl('filter',{id:id,x:'-6%',y:'-6%',width:'112%',height:'112%'});
    f.appendChild(svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:fx+' '+fy,numOctaves:'3',seed:seed,result:'noise'}));
    f.appendChild(svgEl('feColorMatrix',{in:'noise',type:'matrix',result:'tint',
      values:`0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0.95 0.95 0.95 0 ${alphaBias}`}));
    f.appendChild(svgEl('feComposite',{in:'tint',in2:'SourceGraphic',operator:'in'}));
    return f;
  }
  defs.appendChild(grainFilter('grainRim','0.012','0.62','11',[0.13,0.08,0.03],-0.78));
  defs.appendChild(grainFilter('grainHub','0.055','0.045','4',[0.11,0.07,0.03],-0.86));

  svg.appendChild(defs);

  /* свечение за колесом */
  svg.appendChild(svgEl('circle',{id:'halo',cx:CX,cy:CY,r:R+72,fill:'url(#haloG)',opacity:'0','pointer-events':'none'}));

  /* ---- станина: тень на полу, ножки, основание ---- */
  const mount=svgEl('g',{id:'mount'});
  mount.appendChild(svgEl('ellipse',{cx:CX,cy:436,rx:132,ry:11,fill:'rgba(0,0,0,.42)',filter:'url(#softShadow)'}));
  mount.appendChild(svgEl('path',{d:'M172,292 L194,292 L150,420 L110,420 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  mount.appendChild(svgEl('path',{d:'M228,292 L206,292 L250,420 L290,420 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  mount.appendChild(svgEl('rect',{x:'86',y:'412',width:'228',height:'24',rx:'6',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  mount.appendChild(svgEl('rect',{x:'86',y:'412',width:'228',height:'5',rx:'2',fill:'rgba(255,226,170,.14)'}));
  for(const d of ['M172,292 L194,292 L150,420 L110,420 Z','M228,292 L206,292 L250,420 L290,420 Z']){
    mount.appendChild(svgEl('path',{d:d,fill:'#e9c98c',filter:'url(#grainRim)',opacity:'.4'}));
  }
  mount.appendChild(svgEl('rect',{x:'86',y:'412',width:'228',height:'24',rx:'6',fill:'#e9c98c',filter:'url(#grainRim)',opacity:'.4'}));
  const plateTxt=svgEl('text',{class:'mount-txt',x:CX,y:'429','text-anchor':'middle'});
  plateTxt.textContent='КОЛЕСО СЛОВ';
  mount.appendChild(plateTxt);
  for(const bx of [104,296]){
    mount.appendChild(svgEl('circle',{cx:bx,cy:'424',r:'3.2',fill:'url(#brassR)',stroke:'rgba(20,12,4,.6)','stroke-width':'.8'}));
  }
  svg.appendChild(mount);

  /* ---- ротор: обод, сектора, плашки, штырьки ---- */
  const disc=svgEl('g',{id:'disc'});             /* всё колесо: его можно сдвинуть, станина остаётся */
  const rotor=svgEl('g',{id:'rotor'});
  rotor.setAttribute('transform',`rotate(${rot} ${CX} ${CY})`);

  /* деревянный обод и его кромки */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R,fill:'none',stroke:'url(#wood)','stroke-width':BAND_W}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:BAND_R,fill:'none',stroke:'#e9c98c','stroke-width':BAND_W,filter:'url(#grainRim)',opacity:'.5'}));
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

  /* смазанные полосы по ободу: видны только на скорости */
  const streaks=svgEl('g',{id:'streaks',opacity:'0','pointer-events':'none'});
  for(const rr of [BAND_R-8, BAND_R+1, BAND_R+9]){
    streaks.appendChild(svgEl('circle',{cx:CX,cy:CY,r:rr,fill:'none',stroke:'rgba(255,238,198,.6)','stroke-width':'2',
      'stroke-linecap':'round','stroke-dasharray':'64 220 38 268 86 196'}));
  }
  rotor.appendChild(streaks);

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
    const x0=CX+68*Math.cos(a), y0=CY+68*Math.sin(a), x1=CX+R*Math.cos(a), y1=CY+R*Math.sin(a);
    rotor.appendChild(svgEl('line',{x1:x0.toFixed(2),y1:y0.toFixed(2),x2:x1.toFixed(2),y2:y1.toFixed(2),
      stroke:'rgba(14,9,4,.45)','stroke-width':'1.6'}));
    const px=CX+PIN_R*Math.cos(a), py=CY+PIN_R*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:px.toFixed(2),cy:py.toFixed(2),r:'4.6',fill:'url(#brassR)',stroke:'rgba(18,11,4,.6)','stroke-width':'.9'}));
    rotor.appendChild(svgEl('circle',{cx:(px-1.2).toFixed(2),cy:(py-1.4).toFixed(2),r:'1.2',fill:'rgba(255,248,220,.8)'}));
  }

  /* гравированный циферблат: два латунных кольца и римские номера секторов */
  for(const rr of [48,68]){
    rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:rr,fill:'none',stroke:'rgba(10,6,2,.45)','stroke-width':'2.4'}));
    rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:rr+2,fill:'none',stroke:'rgba(222,186,116,.42)','stroke-width':'1.2'}));
  }
  for(let i=0;i<SECTORS;i++){
    const phi=i*TAU+TAU/2;
    const outer=svgEl('g',{transform:`rotate(${phi} ${CX} ${CY})`});
    const inner=svgEl('g',{});
    if(phi>90 && phi<270){ inner.setAttribute('transform',`rotate(180 ${CX} ${CY-ROMAN_R})`); }
    const num=svgEl('text',{class:'roman',x:CX,y:(CY-ROMAN_R+4.6).toFixed(2),'font-size':'13','text-anchor':'middle'});
    num.textContent=ROMAN[i];
    inner.appendChild(num);
    outer.appendChild(inner);
    rotor.appendChild(outer);
  }

  /* плашки со словами: все как одна повёрнуты вниз к центру,
     читаются вдоль радиуса — от обода к середине сектора */
  for(let i=0;i<SECTORS;i++){
    const txt=labelText(words[i]), size=labelSize(txt);
    const len=plateLen(txt, size), mid=(PLATE_OUT+PLATE_IN)/2;
    const y0=CY-mid-len/2, cy=CY-mid;
    const phi=i*TAU+TAU/2;
    const g=svgEl('g',{transform:`rotate(${phi} ${CX} ${CY})`,'data-i':i});
    g.appendChild(svgEl('rect',{class:'plate','data-i':i, x:(CX-PLATE_H/2).toFixed(2), y:y0.toFixed(2),
      width:PLATE_H, height:len.toFixed(2), rx:'9', ry:'9'}));
    const t=svgEl('text',{class:'plate-txt', x:CX, y:cy.toFixed(2), 'font-size':size,
      'text-anchor':'middle', 'dominant-baseline':'central',
      transform:`rotate(90 ${CX} ${cy.toFixed(2)})`});
    t.textContent=txt.toUpperCase();
    g.appendChild(t);
    rotor.appendChild(g);
  }

  /* ступица: деревянный диск с болтами, крутится вместе с колесом */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R,fill:'none',stroke:'rgba(10,6,2,.5)','stroke-width':'4'}));
  rotor.appendChild(svgEl('circle',{class:'hub',cx:CX,cy:CY,r:'44',fill:'url(#hubWood)',stroke:'url(#brass)','stroke-width':'5'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'44',fill:'#e9c98c',filter:'url(#grainHub)',opacity:'.42'}));
  /* розетка: 12 латунных лучей, как у настоящей машинки */
  for(let i=0;i<12;i++){
    const a=(i*30-90)*Math.PI/180, am=(i*30-90+15)*Math.PI/180;
    const rOut=(i%2===0)?38:27;
    const p1=[CX+rOut*Math.cos(a), CY+rOut*Math.sin(a)];
    const p2=[CX+20*Math.cos(am), CY+20*Math.sin(am)];
    rotor.appendChild(svgEl('path',{d:`M ${CX} ${CY} L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z`,
      fill:'rgba(222,186,116,.30)'}));
  }
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'38',fill:'none',stroke:'rgba(222,186,116,.5)','stroke-width':'1.2'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'20',fill:'none',stroke:'rgba(222,186,116,.4)','stroke-width':'1'}));
  for(let i=0;i<6;i++){
    const a=(i*60-90)*Math.PI/180;
    const x=CX+33*Math.cos(a), y=CY+33*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:'3.6',fill:'url(#brassR)',stroke:'rgba(16,10,4,.7)','stroke-width':'.9'}));
  }
  disc.appendChild(rotor);

  /* блик/свет поверх колеса */
  disc.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R+2,fill:'url(#sheen)',class:'sheen','pointer-events':'none'}));

  /* ось */
  disc.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'20',fill:'url(#brassR)',stroke:'rgba(18,11,4,.65)','stroke-width':'2'}));
  disc.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'7',fill:'#241a0d'}));
  disc.appendChild(svgEl('circle',{cx:CX-4,cy:CY-5,r:'3',fill:'rgba(255,248,222,.6)'}));
  svg.appendChild(disc);

  /* тень молоточка, падающая на лицо колеса */
  svg.appendChild(svgEl('ellipse',{cx:CX,cy:CY-R+26,rx:'16',ry:'24',fill:'rgba(0,0,0,.28)',
    filter:'url(#softShadow)','pointer-events':'none'}));

  /* кронштейн и защёлка-молоточек */
  svg.appendChild(svgEl('path',{d:'M181,-2 L219,-2 L213,15 L187,15 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'1.8'}));
  svg.appendChild(svgEl('path',{d:'M181,-2 L219,-2 L217,4 L183,4 Z',fill:'rgba(255,228,176,.16)'}));
  for(const bx of [189,211]){
    svg.appendChild(svgEl('circle',{cx:bx,cy:'6',r:'2.2',fill:'url(#brassR)',stroke:'rgba(20,12,4,.6)','stroke-width':'.7'}));
  }
  /* искры из-под молоточка */
  const fx=svgEl('g',{id:'fx','pointer-events':'none'});
  for(let i=0;i<SPARK_MAX;i++) fx.appendChild(svgEl('circle',{class:'spark',r:'1',cx:'-20',cy:'-20',opacity:'0'}));
  svg.appendChild(fx);

  /* ударная волна при остановке */
  const shock=svgEl('g',{id:'shock','pointer-events':'none'});
  shock.appendChild(svgEl('circle',{cx:CX,cy:'30',r:'26',fill:'none',stroke:'rgba(255,226,158,.9)','stroke-width':'3.4'}));
  shock.appendChild(svgEl('circle',{cx:CX,cy:'30',r:'40',fill:'none',stroke:'rgba(255,196,110,.45)','stroke-width':'1.8'}));
  svg.appendChild(shock);

  const pawl=svgEl('g',{id:'pawl'});
  /* пружина */
  pawl.appendChild(svgEl('path',{d:'M207,14 q9,6 4,14',fill:'none',stroke:'rgba(222,186,116,.55)','stroke-width':'1.6'}));
  /* кованый рычаг */
  pawl.appendChild(svgEl('path',{d:'M194,5 L206,5 L204.5,18 L203,32 L197,32 L195.5,18 Z',
    fill:'url(#brass)',stroke:'rgba(24,15,5,.8)','stroke-width':'1.4'}));
  pawl.appendChild(svgEl('path',{d:'M196.5,7 L199,7 L198.6,30 L197.2,30 Z',fill:'rgba(255,247,220,.45)'}));
  pawl.appendChild(svgEl('circle',{cx:PIVOT_X,cy:PIVOT_Y,r:'8.5',fill:'url(#brassR)',stroke:'rgba(24,15,5,.8)','stroke-width':'1.8'}));
  pawl.appendChild(svgEl('circle',{cx:PIVOT_X,cy:PIVOT_Y,r:'2.6',fill:'#2a1d0d'}));
  /* ударный шарик, который сидит на штырьках */
  pawl.appendChild(svgEl('circle',{class:'foot',cx:CX,cy:'33',r:'4.4',fill:'url(#brassR)',stroke:'rgba(24,15,5,.75)','stroke-width':'1.2'}));
  pawl.appendChild(svgEl('circle',{cx:CX-1.4,cy:'31.4',r:'1.4',fill:'rgba(255,250,226,.85)'}));
  svg.appendChild(pawl);

  highlight(lastWin);
  fxInit();
}
function highlight(i){
  document.querySelectorAll('#wheel .sector').forEach(s=>s.classList.toggle('win', Number(s.dataset.i)===i));
  document.querySelectorAll('#wheel .plate').forEach(p=>p.classList.toggle('hot', Number(p.dataset.i)===i));
}
function setPawl(deg){
  const p=$('#pawl');
  if(!p) return;
  /* когда молоточек в покое, снимаем inline-стиль — тогда работает :hover */
  p.style.transform = Math.abs(deg)<0.06 ? '' : `rotate(${deg.toFixed(2)}deg)`;
}

/* ------------------------------ искры и свечение ------------------------------ */
const SPARK_MAX=48;
let sparks=[], sparkNodes=[], fxRAF=null, fxDtLast=0;

function fxInit(){
  if(fxRAF){ cancelAnimationFrame(fxRAF); fxRAF=null; }
  sparks=[];
  sparkNodes=Array.from(document.querySelectorAll('#fx .spark'));
}
/* молоточек бьёт по штырьку — летят латунные искры */
function sparkBurst(n){
  for(let k=0;k<n && sparks.length<SPARK_MAX;k++){
    sparks.push({ x:CX+(Math.random()*8-4), y:33+(Math.random()*6-3),
      vx:0.18+Math.random()*0.4, vy:-(0.05+Math.random()*0.3),
      age:0, life:160+Math.random()*230, r:0.7+Math.random()*1.2 });
  }
  if(!fxRAF){ fxDtLast=performance.now(); fxRAF=requestAnimationFrame(fxStep); }
}
function fxStep(now){
  const dt=Math.min(48, (now-fxDtLast)||16); fxDtLast=now;
  for(let i=sparks.length-1;i>=0;i--){
    const s=sparks[i];
    s.age+=dt;
    if(s.age>=s.life){ sparks.splice(i,1); continue; }
    s.vy+=0.0012*dt;                /* гравитация */
    s.vx*=(1-0.0035*dt);            /* сопротивление воздуха */
    s.x+=s.vx*dt; s.y+=s.vy*dt;
  }
  for(let i=0;i<sparkNodes.length;i++){
    const s=sparks[i], node=sparkNodes[i];
    if(!s){ node.setAttribute('opacity','0'); continue; }
    const k=1-s.age/s.life;
    node.setAttribute('cx', s.x.toFixed(2));
    node.setAttribute('cy', s.y.toFixed(2));
    node.setAttribute('r', (s.r*(0.55+k*0.85)).toFixed(2));
    node.setAttribute('opacity', (0.2+0.8*k).toFixed(2));
  }
  if(sparks.length) fxRAF=requestAnimationFrame(fxStep);
  else { fxRAF=null; for(const n of sparkNodes) n.setAttribute('opacity','0'); }
}
const V_REF=0.55;                    /* типичная пиковая скорость, градусов на миллисекунду */
function setGlow(v){
  const k=clamp(v/V_REF, 0, 1);
  const h=$('#halo');
  if(h) h.setAttribute('opacity', (k*0.8).toFixed(3));
  const s=$('#streaks');
  if(s) s.setAttribute('opacity', (k*0.55).toFixed(3));
}
function shockWave(){
  const s=$('#shock');
  if(!s) return;
  s.classList.remove('go'); void s.getBoundingClientRect(); s.classList.add('go');
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
const ESCAPE_EVERY=10;                            /* каждое 10-е вращение колесо срывается и укатывается */
const ROLL_K=180/(Math.PI*(BAND_R+BAND_W/2));     /* градусов поворота на единицу пути: качение без проскальзывания */
function reducedMotion(){ try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }

/* на сколько единиц viewBox сдвинуть колесо, чтобы оно скрыто уехало за край экрана */
function offscreenShift(dir){
  const fr=$('#wheel-frame').getBoundingClientRect();
  const k=400/Math.max(1, fr.width);              /* единиц viewBox на CSS-пиксель */
  const cx=fr.left+fr.width/2;                    /* центр колеса на экране */
  const rad=fr.width*(BAND_R+BAND_W/2+8)/400;     /* радиус колеса в CSS-пикселях */
  /* вправо: левый край колеса должен уйти за правый край экрана;
     влево: правый край — за левый край экрана */
  const px = dir>0 ? (window.innerWidth+70-(cx-rad)) : (cx+rad+70);
  return Math.max(520, px)*k;
}
/* станина вздрагивает, когда колесо возвращается на ось */
function shakeMount(){
  const m=document.querySelector('#mount');
  if(!m) return;
  m.classList.remove('shake'); void m.getBoundingClientRect(); m.classList.add('shake');
}

function pickWinner(){
  let i=Math.floor(Math.random()*SECTORS);
  if(i===lastWin) i=(i+1+Math.floor(Math.random()*(SECTORS-1)))%SECTORS;
  lastWin=i;
  return i;
}
function spin(){
  if(spinning) return;
  state.spins=(state.spins||0)+1; save();
  const escape=(state.spins%ESCAPE_EVERY===0) && !reducedMotion();
  const i=pickWinner();
  const jitter=(Math.random()*2-1)*11;              /* стрелка встаёт внутрь сектора */
  const target=(((-(i*TAU+TAU/2)-jitter)%360)+360)%360;
  const turns=SPIN.turns+Math.floor(Math.random()*(SPIN.extra+1));
  const from=rot;
  let delta=target-((((rot%360)+360)%360)); if(delta<0) delta+=360;
  const toFull=from+delta+turns*360;
  const dur=reducedMotion()? 500 : SPIN.dur+Math.random()*SPIN.tail;
  const WIND=reducedMotion()? 0 : 230;              /* взвод: колесо качается назад */
  const BACK=5.5;
  const rotor=$('#rotor'), disc=$('#disc'), halo=$('#halo'), wf=$('#wheel-frame');

  spinning=true;
  $('#spin').classList.add('busy');
  $('#wheel-tap').classList.add('busy');
  wf.classList.add('spin');
  if(escape) wf.classList.add('rolling');
  highlight(-1);
  resetCard();

  const setDisc=(x,y)=>{
    const t=`translate(${x.toFixed(2)}px, ${(y||0).toFixed(2)}px)`;
    if(disc) disc.style.transform=t;
    if(halo) halo.style.transform=t;             /* свечение катится вместе с колесом */
  };
  const decayPawl=()=>{ pawlAngle+=(0-pawlAngle)*0.22; setPawl(pawlAngle); };

  function phase(ms, onFrame, onDone){
    const t0=performance.now();
    (function f(now){
      const p=Math.min(1,(now-t0)/ms);
      onFrame(p);
      if(p<1) requestAnimationFrame(f); else onDone();
    })(performance.now());
  }
  /* ближайший угол, на котором нужный сектор встанет на стрелку */
  function nextTarget(minAngle, extraTurns){
    return minAngle + ((((target-(((minAngle%360)+360)%360))%360)+360)%360) + extraTurns*360;
  }

  /* обычный разгон и торможение: свечение, полосы по ободу, щелчки и искры */
  function run(fromA, toA, durA, done){
    const t0=performance.now();
    let prevRot=fromA, prevT=t0, prevSlot=Math.round((((fromA%360)+360)%360)/TAU);
    (function f(now){
      const p=Math.min(1,(now-t0)/durA);
      rot=fromA+(toA-fromA)*heavyEase(p);
      rotor.setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
      const dt=Math.max(1, now-prevT);
      const v=(rot-prevRot)/dt;                     /* градусов за миллисекунду */
      prevRot=rot; prevT=now;
      if(!reducedMotion()){
        rotor.style.filter = v>0.18 ? `blur(${clamp(v*4,0,3).toFixed(2)}px)` : '';
        setGlow(v);
      }
      const slot=Math.round((((rot%360)+360)%360)/TAU);
      if(slot!==prevSlot){
        pawlAngle=Math.min(11, 4+v*14);
        if(!reducedMotion() && v>V_REF*0.45) sparkBurst(Math.min(5, 1+Math.round(v*7)));
        prevSlot=slot;
      }
      pawlAngle+=(0-pawlAngle)*Math.min(1, dt/70);
      setPawl(pawlAngle);
      if(p<1) requestAnimationFrame(f); else done();
    })(performance.now());
  }

  /* взвод перед пуском */
  function wind(done){
    if(!WIND) return done();
    phase(WIND, (p)=>{
      const e=Math.sin(p*Math.PI/2);
      rot=from-BACK*e;
      rotor.setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
      pawlAngle=7*e; setPawl(pawlAngle);
    }, done);
  }

  /* --- побег колеса: срыв, качение вправо, возврат слева, прыжок на ось --- */
  function roll(x, prevX){
    const dx=x-prevX;
    rot+=dx*ROLL_K;                                 /* качение без проскальзывания */
    rotor.setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    if(!reducedMotion()) setGlow(clamp(Math.abs(dx)*ROLL_K*5, 0, V_REF));
    return x;
  }
  function escapeRun(done){
    const right=offscreenShift(1), left=-offscreenShift(-1);
    let prevX=0;
    /* срыв с оси: подскок, молоточок отлетает, сыплются искры */
    phase(220, (p)=>{
      const e=Math.sin(p*Math.PI);
      setDisc(4*e, -18*e);
      pawlAngle=Math.min(16, 6+10*e); setPawl(pawlAngle);
      if(!reducedMotion()) sparkBurst(3);
    }, ()=>{
      rotor.style.filter='';
      /* укатывается вправо, подпрыгивая на неровностях */
      phase(850, (p)=>{
        const x=right*p*p;
        setDisc(x, 6*Math.sin(p*Math.PI*2.5));
        prevX=roll(x, prevX);
        decayPawl();
      }, ()=>{
        /* за экраном — короткая пауза, потом колесо возвращается слева */
        phase(430, ()=>{}, ()=>{
          prevX=left; setDisc(left, 0);
          phase(950, (p)=>{
            const e=1-Math.pow(1-p, 2.1);
            const x=left*(1-e);
            setDisc(x, 5*Math.sin(p*Math.PI*2.5));
            prevX=roll(x, prevX);
            decayPawl();
          }, ()=> landingOnAxle(done));
        });
      });
    });
  }
  /* приземление: подскок, два удара об ось, звяканье защёлки */
  function landingOnAxle(done){
    let hits=0;
    phase(760, (p)=>{
      let y;
      if(p<0.34)      y=-34*Math.sin((p/0.34)*Math.PI/2);            /* подскок */
      else if(p<0.62) y=-34*Math.cos(((p-0.34)/0.28)*Math.PI/2);     /* падение */
      else            y=-11*Math.sin(((p-0.62)/0.38)*Math.PI)*Math.exp(-2.2*(p-0.62));
      setDisc(0, y);
      const touch=(p>=0.62 && hits===0) || (p>=0.97 && hits===1);
      if(touch){
        hits++;
        pawlAngle=13; setPawl(pawlAngle);
        if(!reducedMotion()){ sparkBurst(4); shakeMount(); }
      }
      decayPawl();
    }, ()=>{
      setDisc(0, 0);
      /* и как ни в чём не бывало доращивает вращение до нужного сектора */
      run(rot, nextTarget(rot+720, 1+Math.floor(Math.random()*2)), dur*0.42, done);
    });
  }

  /* финальное «докачивание» тяжёлого колеса */
  function settle(){
    const t0s=performance.now(), durS=reducedMotion()? 0 : SPIN.wob;
    function s(now){
      const p=Math.min(1,(now-t0s)/durS);
      const wob=Math.sin(p*Math.PI*3)*(1-p)*1.6;
      rotor.setAttribute('transform',`rotate(${(rot+wob).toFixed(2)} ${CX} ${CY})`);
      pawlAngle=Math.sin(p*Math.PI*3)*(1-p)*4;
      setPawl(pawlAngle);
      setGlow(V_REF*0.3*(1-p));
      if(p<1) requestAnimationFrame(s); else land();
    }
    if(durS===0) land(); else requestAnimationFrame(s);
  }
  function land(){
    rotor.style.filter='';
    setDisc(0, 0);
    $('#rotor').setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    setPawl(0);
    setGlow(0);
    if(!reducedMotion()) shockWave();
    spinning=false;
    $('#spin').classList.remove('busy');
    $('#wheel-tap').classList.remove('busy');
    wf.classList.remove('spin');
    wf.classList.remove('rolling');
    wf.classList.remove('hit'); void wf.offsetWidth; wf.classList.add('hit');
    highlight(i);
    showWord(i);
  }
  const finish=()=> settle();

  wind(()=> run(from-BACK, (escape? from+(toFull-from)*0.5 : toFull), (escape? dur*0.55 : dur),
    ()=> escape? escapeRun(finish) : finish()));
}

/* ------------------------------ результат ------------------------------ */
function resetCard(){
  $('#word').textContent='—';
  $('#task').textContent='Найдите это слово в словаре или энциклопедии и скажите, что оно обозначает.';
  $('#word-card').classList.remove('hot');
  $('#found').disabled=true;
}
function showWord(i){
  const w=words[i];
  const el=$('#word');
  el.textContent=w;
  const card=$('#word-card');
  card.style.setProperty('--accent', accentOf(i));
  card.classList.add('hot');
  $('#task').textContent='Найдите слово «'+w+'» в словаре или энциклопедии и расскажите, что оно обозначает.';
  $('#found').disabled=alreadyFound(w);
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
  if(!w || w==='—' || alreadyFound(w)) return;
  const t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  state.found.push({w:w,t:t});
  save(); renderFound();
  $('#found').disabled=true;
}
function alreadyFound(w){
  const key=w.toLowerCase();
  return state.found.some(f=>String(f.w).toLowerCase()===key);
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
/* колесо стоит «как после последнего вращения»: стрелка по центру сектора */
rot=-(Math.floor(Math.random()*SECTORS)*TAU + TAU/2);
applyTheme();
renderFound();
resetCard();
setPawl(0);
