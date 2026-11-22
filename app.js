/* ============================================================
   Тарелка слов
   12 секторов, слова зафиксированы (добавлять свои нельзя).
   Фарфоровая тарелка: глазурованные сектора, золотой кант и
   золотые точки по борту, роспись в середине, деревянный
   мольберт-подставка и ложечка-защёлка у края тарелки.
   Звука и озвучки слов нет.
   ============================================================ */
const WORDS=['Бумага','Арена','Награда','Чемодан','Маскарад','Ураган','Радуга','Мешок','Басня','Лагерь','Договор','Обычай'];
const SECTORS=WORDS.length, TAU=360/SECTORS;
const CX=200, CY=196;              /* центр тарелки в единицах viewBox */
const DISH_R=186;                  /* внешний край тарелки */
const R=160;                       /* глазурованное поле с секторами */
const RIM_MID=(DISH_R+R)/2;        /* середина широкого борта тарелки */
const DOT_R=176;                   /* золотые точки по борту, о них стучит ложечка */
const WELL=72;                     /* фарфоровое поле в середине тарелки */
const TILE_OUT=150, TILE_IN=72, TILE_H=26; /* плашки со словами: вдоль радиуса, читаются вниз к центру */
const ROMAN_R=60;                  /* римские номера секторов */
const PIVOT_X=200, PIVOT_Y=6;      /* ось ложечки-защёлки */
const KEY='tarelka_v1', OLD_KEY='koleso_v1';
const SVGNS='http://www.w3.org/2000/svg';

/* приглушённые «глазурные» цвета секторов: h, s, l */
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
    /* ключ от старой версии: если записи ещё нет, переносим список объяснённых слов */
    let raw=localStorage.getItem(KEY);
    if(raw===null){ raw=localStorage.getItem(OLD_KEY); if(raw!==null) try{ localStorage.setItem(KEY, raw); }catch(e){} }
    const s=JSON.parse(raw||'null')||{};
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
  const up = isDark()? 0 : 6;                        /* днём глазурь чуть светлее */
  const dark = isDark()? -6 : 0;
  return { deep:`hsl(${h} ${clamp(s+6,0,100)}% ${clamp(l+dark,8,80)}%)`, bright:`hsl(${h} ${clamp(s+14,0,100)}% ${clamp(l+10+up,10,88)}%)` };
}
function accentOf(i){
  const [h,s,l]=PALETTE[i%PALETTE.length];
  return `hsl(${h} ${clamp(s+22,20,80)}% ${clamp(l+26,30,72)}%)`;
}
/* плашка лежит вдоль радиуса: длина ограничена полем от середины до борта */
const TILE_SPAN = TILE_OUT - TILE_IN;
function labelSize(w){
  const base = w.length<=5 ? 19 : w.length<=6 ? 17.5 : w.length<=7 ? 16 : 15;
  const fit = ((TILE_SPAN-16)/w.length - 0.7)/0.62;
  return Math.round(Math.min(base, fit)*10)/10;
}
function tileLen(txt, size){ return Math.min(TILE_SPAN, txt.length*(size*0.62+0.7)+16); }
function labelText(w){ return w.length>11 ? w.slice(0,10)+'…' : w; }

/* ------------------------------ сборка тарелки ------------------------------ */
function buildDish(){
  const svg=$('#dish');
  svg.innerHTML='';

  /* ---- градиенты и фильтры ---- */
  const defs=svgEl('defs',{});

  const gold=svgEl('linearGradient',{id:'gold',x1:'0',y1:'0',x2:'1',y2:'1'});
  stops([['0%','#8a6a20'],['16%','#f0d79a'],['34%','#c19b45'],['52%','#fbf0c8'],['70%','#a9873a'],['100%','#7d5f1c']])
    .forEach(s=>gold.appendChild(s));
  defs.appendChild(gold);

  const goldR=svgEl('radialGradient',{id:'goldR',cx:'34%',cy:'28%',r:'78%'});
  stops([['0%','#fff6dc'],['42%','#e8d29a'],['78%','#b3923f'],['100%','#7f6320']])
    .forEach(s=>goldR.appendChild(s));
  defs.appendChild(goldR);

  /* фарфор: светлый сверху-слева, тёплая тень снизу-справа */
  const porc=svgEl('radialGradient',{id:'porc',cx:'32%',cy:'24%',r:'86%'});
  stops([['0%','#fffefb'],['34%','#fdfaf3'],['62%','#f4eee1'],['84%','#e6dccb'],['100%','#cfc3ad']])
    .forEach(s=>porc.appendChild(s));
  defs.appendChild(porc);

  /* борт тарелки: он чуть темнее середины и скруглён к краю */
  const rim=svgEl('radialGradient',{id:'rimG',cx:'32%',cy:'24%',r:'86%'});
  stops([['0%','#fffdf7'],['40%','#f8f3e8'],['70%','#ece3d3'],['100%','#d8ccb8']])
    .forEach(s=>rim.appendChild(s));
  defs.appendChild(rim);

  /* фарфоровое поле в середине тарелки (пипка) */
  const wellG=svgEl('radialGradient',{id:'wellG',cx:'34%',cy:'26%',r:'84%'});
  stops([['0%','#fffffb'],['46%','#f6f0e2'],['100%','#ded3bd']]).forEach(s=>wellG.appendChild(s));
  defs.appendChild(wellG);

  const wood=svgEl('linearGradient',{id:'wood',x1:'0.1',y1:'0',x2:'0.7',y2:'1'});
  stops([['0%','#4c3320'],['22%','#2a1b10'],['44%','#5d4026'],['64%','#241608'],['84%','#432c19'],['100%','#1c1207']])
    .forEach(s=>wood.appendChild(s));
  defs.appendChild(wood);

  for(let i=0;i<SECTORS;i++){
    const c=sectorColors(i);
    const a=(i*TAU-90+TAU/2)*Math.PI/180;
    const g=svgEl('linearGradient',{id:'sg'+i, gradientUnits:'userSpaceOnUse',
      x1:CX, y1:CY, x2:(CX+R*Math.cos(a)).toFixed(2), y2:(CY+R*Math.sin(a)).toFixed(2)});
    stops([['0%',c.deep],['100%',c.bright]]).forEach(s=>g.appendChild(s));
    defs.appendChild(g);
  }

  /* неподвижный свет по фарфору: сверху-слева блик, снизу-справа тёплая тень */
  const sheen=svgEl('linearGradient',{id:'sheen',x1:'0.14',y1:'0',x2:'0.72',y2:'1'});
  stops([['0%','rgba(255,255,255,.46)'],['34%','rgba(255,252,240,.10)'],['66%','rgba(96,74,40,.08)'],['100%','rgba(58,44,22,.20)']])
    .forEach(s=>sheen.appendChild(s));
  defs.appendChild(sheen);

  /* блик на глазури: мягкое белое пятно, не крутится вместе с тарелкой */
  const gloss=svgEl('radialGradient',{id:'glossB',cx:'50%',cy:'50%',r:'50%'});
  stops([['0%','rgba(255,255,255,.60)'],['52%','rgba(255,255,255,.16)'],['100%','rgba(255,255,255,0)']])
    .forEach(s=>gloss.appendChild(s));
  defs.appendChild(gloss);

  /* тёплое свечение вокруг тарелки, растёт вместе со скоростью */
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
  /* редкие вкрапления в глазури: мелкие тёмные крапинки по фарфору */
  function speckFilter(id,freq,seed,rgb,alphaBias){
    const f=svgEl('filter',{id:id,x:'-2%',y:'-2%',width:'104%',height:'104%'});
    f.appendChild(svgEl('feTurbulence',{type:'fractalNoise',baseFrequency:freq+' '+freq,numOctaves:'2',seed:seed,result:'noise'}));
    f.appendChild(svgEl('feColorMatrix',{in:'noise',type:'matrix',result:'tint',
      values:`0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  1.6 1.6 1.6 0 ${alphaBias}`}));
    f.appendChild(svgEl('feComposite',{in:'tint',in2:'SourceGraphic',operator:'in'}));
    return f;
  }
  defs.appendChild(grainFilter('grainWood','0.012','0.62','11',[0.13,0.08,0.03],-0.78));
  defs.appendChild(speckFilter('speck','0.9','5',[0.30,0.24,0.15],-1.9));

  svg.appendChild(defs);

  /* свечение за тарелкой */
  svg.appendChild(svgEl('circle',{id:'halo',cx:CX,cy:CY,r:DISH_R+50,fill:'url(#haloG)',opacity:'0','pointer-events':'none'}));
  /* тень под тарелкой, когда она катится по полу */
  svg.appendChild(svgEl('ellipse',{id:'rollShadow',cx:CX,cy:FLOOR_Y,rx:'150',ry:'10',
    fill:'rgba(0,0,0,.45)',filter:'url(#softShadow)',opacity:'0','pointer-events':'none'}));

  /* ---- подставка-мольберт: тень на полу, задние ножки, основание с табличкой ---- */
  const standBack=svgEl('g',{id:'stand-back','class':'stand'});
  standBack.appendChild(svgEl('ellipse',{cx:CX,cy:436,rx:132,ry:11,fill:'rgba(0,0,0,.42)',filter:'url(#softShadow)'}));
  for(const d of ['M168,296 L192,296 L148,420 L106,420 Z','M232,296 L208,296 L252,420 L294,420 Z']){
    standBack.appendChild(svgEl('path',{d:d,fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
    standBack.appendChild(svgEl('path',{d:d,fill:'#e9c98c',filter:'url(#grainWood)',opacity:'.38'}));
  }
  standBack.appendChild(svgEl('rect',{x:'82',y:'410',width:'236',height:'26',rx:'7',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  standBack.appendChild(svgEl('rect',{x:'82',y:'410',width:'236',height:'5',rx:'2',fill:'rgba(255,226,170,.14)'}));
  standBack.appendChild(svgEl('rect',{x:'82',y:'410',width:'236',height:'26',rx:'7',fill:'#e9c98c',filter:'url(#grainWood)',opacity:'.38'}));
  const nameTxt=svgEl('text',{class:'mount-txt',x:CX,y:'428','text-anchor':'middle'});
  nameTxt.textContent='ТАРЕЛКА СЛОВ';
  standBack.appendChild(nameTxt);
  for(const bx of [100,300]){
    standBack.appendChild(svgEl('circle',{cx:bx,cy:'423',r:'3.2',fill:'url(#goldR)',stroke:'rgba(20,12,4,.6)','stroke-width':'.8'}));
  }
  svg.appendChild(standBack);

  /* ---- сама тарелка: фарфор, борт, кант, сектора, плашки ---- */
  const disc=svgEl('g',{id:'disc'});             /* вся тарелка: её можно сдвинуть, подставка остаётся */
  const rotor=svgEl('g',{id:'rotor'});
  rotor.setAttribute('transform',`rotate(${rot} ${CX} ${CY})`);

  /* фарфоровый корпус: сплошной диск и широкий борт вокруг поля с росписью */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R,fill:'url(#porc)',stroke:'rgba(70,54,28,.5)','stroke-width':'2'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:RIM_MID,fill:'none',stroke:'url(#rimG)','stroke-width':(DISH_R-R)}));
  /* редкие крапинки в глазури по бортам */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R-2,fill:'#7a6a4c','filter':'url(#speck)',opacity:'.16','pointer-events':'none'}));
  /* переход от поля к бортам: мягкая тень и золотой кант */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R+4,fill:'none',stroke:'rgba(60,44,20,.18)','stroke-width':'6'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R+10,fill:'none',stroke:'url(#gold)','stroke-width':'2.2'}));
  /* кант по внешнему краю тарелки и тонкая золотая линия по борту */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R-4,fill:'none',stroke:'url(#gold)','stroke-width':'3.2'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R-14,fill:'none',stroke:'rgba(172,138,66,.55)','stroke-width':'1.2'}));
  /* борт освещён сверху и в тени снизу */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R-3,fill:'none',stroke:'rgba(255,255,250,.26)','stroke-width':'1.8','stroke-dasharray':'150 60 90 40'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R-6,fill:'none',stroke:'rgba(58,42,18,.14)','stroke-width':'1.6','stroke-dasharray':'60 120 40 150'}));

  /* золотые точки по борту: по ним стучит ложечка */
  for(let i=0;i<24;i++){
    const a=(i*15-90)*Math.PI/180;
    const x=CX+DOT_R*Math.cos(a), y=CY+DOT_R*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:'3',fill:'url(#goldR)',stroke:'rgba(96,70,26,.5)','stroke-width':'.8'}));
    rotor.appendChild(svgEl('circle',{cx:(x-0.9).toFixed(2),cy:(y-1.1).toFixed(2),r:'.9',fill:'rgba(255,252,238,.8)'}));
  }

  /* блики по глазури: видны только на скорости */
  const streaks=svgEl('g',{id:'streaks',opacity:'0','pointer-events':'none'});
  for(const rr of [DISH_R-18, DISH_R-8, DOT_R+5]){
    streaks.appendChild(svgEl('circle',{cx:CX,cy:CY,r:rr,fill:'none',stroke:'rgba(255,255,250,.6)','stroke-width':'2',
      'stroke-linecap':'round','stroke-dasharray':'64 220 38 268 86 196'}));
  }
  rotor.appendChild(streaks);

  /* сектора: глазурованные поля, разделённые тонкими мазками кисти */
  for(let i=0;i<SECTORS;i++){
    const a0=(i*TAU-90)*Math.PI/180, a1=((i+1)*TAU-90)*Math.PI/180;
    const x0=CX+R*Math.cos(a0), y0=CY+R*Math.sin(a0), x1=CX+R*Math.cos(a1), y1=CY+R*Math.sin(a1);
    rotor.appendChild(svgEl('path',{class:'sector','data-i':i,
      d:`M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`,
      fill:`url(#sg${i})`}));
  }
  /* границы секторов: тонкие мазки кисти от середины до края поля,
     и на бортах против них — короткие золотые лучинки */
  for(let i=0;i<SECTORS;i++){
    const a=(i*TAU-90)*Math.PI/180;
    const x0=CX+WELL*Math.cos(a), y0=CY+WELL*Math.sin(a), x1=CX+(R+3)*Math.cos(a), y1=CY+(R+3)*Math.sin(a);
    rotor.appendChild(svgEl('line',{x1:x0.toFixed(2),y1:y0.toFixed(2),x2:x1.toFixed(2),y2:y1.toFixed(2),
      stroke:'rgba(46,32,14,.38)','stroke-width':'1.6'}));
    const gx0=CX+(R+3.5)*Math.cos(a), gy0=CY+(R+3.5)*Math.sin(a);
    const gx1=CX+(R+8)*Math.cos(a), gy1=CY+(R+8)*Math.sin(a);
    rotor.appendChild(svgEl('line',{x1:gx0.toFixed(2),y1:gy0.toFixed(2),x2:gx1.toFixed(2),y2:gy1.toFixed(2),
      stroke:'rgba(176,142,70,.7)','stroke-width':'1.8','stroke-linecap':'round'}));
  }
  /* крапинки в глазури поверх секторов */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:R-1,fill:'#7a6a4c','filter':'url(#speck)',opacity:'.08','pointer-events':'none'}));

  /* роспись вокруг середины: два золотых колечка и римские номера секторов */
  for(const rr of [48,68]){
    rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:rr,fill:'none',stroke:'rgba(84,62,26,.42)','stroke-width':'1.8'}));
    rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:rr+2,fill:'none',stroke:'rgba(182,146,70,.6)','stroke-width':'1.4'}));
  }
  for(let i=0;i<SECTORS;i++){
    const phi=i*TAU+TAU/2;
    const outer=svgEl('g',{transform:`rotate(${phi} ${CX} ${CY})`});
    const inner=svgEl('g',{});
    if(phi>90 && phi<270){ inner.setAttribute('transform',`rotate(180 ${CX} ${CY-ROMAN_R})`); }
    const num=svgEl('text',{class:'roman',x:CX,y:(CY-ROMAN_R+3.6).toFixed(2),'font-size':'10','text-anchor':'middle'});
    num.textContent=ROMAN[i];
    inner.appendChild(num);
    outer.appendChild(inner);
    rotor.appendChild(outer);
  }

  /* плашки со словами: все как одна повёрнуты вниз к центру,
     читаются вдоль радиуса — от борта к середине сектора.
     Это роспись по глазури: белая плашка в тонкой золотой оправке. */
  for(let i=0;i<SECTORS;i++){
    const txt=labelText(words[i]), size=labelSize(txt);
    const len=tileLen(txt, size), mid=(TILE_OUT+TILE_IN)/2;
    const y0=CY-mid-len/2, cy=CY-mid;
    const phi=i*TAU+TAU/2;
    const g=svgEl('g',{transform:`rotate(${phi} ${CX} ${CY})`,'data-i':i});
    /* тень под плашкой: глазурь чуть приподнята над полем */
    g.appendChild(svgEl('rect',{x:(CX-TILE_H/2+1.4).toFixed(2), y:(y0+2.4).toFixed(2),
      width:TILE_H, height:len.toFixed(2), rx:(TILE_H/2).toFixed(2), ry:(TILE_H/2).toFixed(2),
      fill:'rgba(28,18,6,.30)', filter:'url(#softShadow)','pointer-events':'none'}));
    /* золотая оправка чуть шире самой плашки */
    g.appendChild(svgEl('rect',{x:(CX-TILE_H/2-1.6).toFixed(2), y:(y0-1.6).toFixed(2),
      width:(TILE_H+3.2), height:(len+3.2).toFixed(2), rx:((TILE_H+3.2)/2), ry:((TILE_H+3.2)/2),
      fill:'url(#gold)','pointer-events':'none'}));
    g.appendChild(svgEl('rect',{class:'tile','data-i':i, x:(CX-TILE_H/2).toFixed(2), y:y0.toFixed(2),
      width:TILE_H, height:len.toFixed(2), rx:(TILE_H/2).toFixed(2), ry:(TILE_H/2).toFixed(2)}));
    const t=svgEl('text',{class:'tile-txt', 'data-i':i, x:CX, y:cy.toFixed(2), 'font-size':size,
      'text-anchor':'middle', 'dominant-baseline':'central',
      transform:`rotate(90 ${CX} ${cy.toFixed(2)})`});
    t.textContent=txt.toUpperCase();
    g.appendChild(t);
    /* зачёркивание: отдельная линия вдоль слова (в SVG text-decoration ненадёжен) */
    g.appendChild(svgEl('line',{class:'strike','data-i':i, x1:CX, x2:CX,
      y1:(cy-(len-18)/2).toFixed(2), y2:(cy+(len-18)/2).toFixed(2)}));
    rotor.appendChild(g);
  }

  /* середина тарелки: фарфоровая пипка с золотой розеткой — по ней видно вращение */
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:WELL,fill:'url(#wellG)',stroke:'rgba(78,58,24,.35)','stroke-width':'2.4'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:WELL,fill:'#7a6a4c','filter':'url(#speck)',opacity:'.10','pointer-events':'none'}));
  /* розетка: 12 золотых лучей по центру */
  for(let i=0;i<12;i++){
    const a=(i*30-90)*Math.PI/180, am=(i*30-90+15)*Math.PI/180;
    const rOut=(i%2===0)?38:27;
    const p1=[CX+rOut*Math.cos(a), CY+rOut*Math.sin(a)];
    const p2=[CX+20*Math.cos(am), CY+20*Math.sin(am)];
    rotor.appendChild(svgEl('path',{d:`M ${CX} ${CY} L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} L ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z`,
      fill:'rgba(184,148,72,.34)'}));
  }
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'38',fill:'none',stroke:'rgba(178,142,66,.55)','stroke-width':'1.4'}));
  rotor.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'20',fill:'none',stroke:'rgba(178,142,66,.45)','stroke-width':'1.2'}));
  for(let i=0;i<6;i++){
    const a=(i*60-90)*Math.PI/180;
    const x=CX+33*Math.cos(a), y=CY+33*Math.sin(a);
    rotor.appendChild(svgEl('circle',{cx:x.toFixed(2),cy:y.toFixed(2),r:'2.6',fill:'url(#goldR)',stroke:'rgba(96,70,26,.5)','stroke-width':'.7'}));
  }
  disc.appendChild(rotor);

  /* неподвижный свет и блик глазури поверх тарелки */
  disc.appendChild(svgEl('circle',{cx:CX,cy:CY,r:DISH_R,fill:'url(#sheen)',class:'sheen','pointer-events':'none'}));
  disc.appendChild(svgEl('ellipse',{cx:'140',cy:'120',rx:'60',ry:'28',fill:'url(#glossB)',class:'gloss',
    transform:'rotate(-26 140 120)','pointer-events':'none'}));
  disc.appendChild(svgEl('ellipse',{cx:'262',cy:'280',rx:'38',ry:'15',fill:'url(#glossB)',opacity:'.4',
    transform:'rotate(-24 262 280)','pointer-events':'none'}));

  /* штырёк подставки, на котором висит тарелка */
  disc.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'13',fill:'url(#goldR)',stroke:'rgba(70,50,18,.6)','stroke-width':'1.6'}));
  disc.appendChild(svgEl('circle',{cx:CX,cy:CY,r:'4.6',fill:'#3a2a12'}));
  disc.appendChild(svgEl('circle',{cx:CX-2.6,cy:CY-3.2,r:'1.8',fill:'rgba(255,252,236,.7)'}));
  svg.appendChild(disc);

  /* передняя полочка мольберта: тарелка лежит за ней */
  const standFront=svgEl('g',{id:'stand-front','class':'stand'});
  standFront.appendChild(svgEl('rect',{x:'106',y:'362',width:'188',height:'18',rx:'8',fill:'url(#wood)',stroke:'#150d05','stroke-width':'2'}));
  standFront.appendChild(svgEl('rect',{x:'106',y:'362',width:'188',height:'18',rx:'8',fill:'#e9c98c',filter:'url(#grainWood)',opacity:'.38'}));
  standFront.appendChild(svgEl('rect',{x:'106',y:'362',width:'188',height:'4',rx:'2',fill:'rgba(255,228,176,.20)'}));
  for(const bx of [120,280]){
    standFront.appendChild(svgEl('circle',{cx:bx,cy:'371',r:'3',fill:'url(#goldR)',stroke:'rgba(20,12,4,.6)','stroke-width':'.8'}));
  }
  svg.appendChild(standFront);

  /* тень ложечки, падающая на глазурь */
  svg.appendChild(svgEl('ellipse',{cx:CX,cy:CY-R+20,rx:'14',ry:'22',fill:'rgba(40,28,10,.20)',
    filter:'url(#softShadow)','pointer-events':'none'}));

  /* кронштейн и ложечка-защёлка */
  svg.appendChild(svgEl('path',{d:'M181,-4 L219,-4 L213,11 L187,11 Z',fill:'url(#wood)',stroke:'#150d05','stroke-width':'1.8'}));
  svg.appendChild(svgEl('path',{d:'M181,-4 L219,-4 L217,3 L183,3 Z',fill:'rgba(255,228,176,.16)'}));
  for(const bx of [189,211]){
    svg.appendChild(svgEl('circle',{cx:bx,cy:'2',r:'2.2',fill:'url(#goldR)',stroke:'rgba(20,12,4,.6)','stroke-width':'.7'}));
  }
  /* искры из-под ложечки */
  const fx=svgEl('g',{id:'fx','pointer-events':'none'});
  for(let i=0;i<SPARK_MAX;i++) fx.appendChild(svgEl('circle',{class:'spark',r:'1',cx:'-20',cy:'-20',opacity:'0'}));
  svg.appendChild(fx);

  /* ударная волна при остановке */
  const shock=svgEl('g',{id:'shock','pointer-events':'none'});
  shock.appendChild(svgEl('circle',{cx:CX,cy:'24',r:'26',fill:'none',stroke:'rgba(255,236,190,.9)','stroke-width':'3.4'}));
  shock.appendChild(svgEl('circle',{cx:CX,cy:'24',r:'40',fill:'none',stroke:'rgba(255,214,140,.45)','stroke-width':'1.8'}));
  svg.appendChild(shock);

  const pawl=svgEl('g',{id:'pawl'});
  /* пружинка */
  pawl.appendChild(svgEl('path',{d:'M206,10 q9,5 4,13',fill:'none',stroke:'rgba(198,164,88,.6)','stroke-width':'1.6'}));
  /* рычажок */
  pawl.appendChild(svgEl('path',{d:'M194.5,1 L205.5,1 L203.8,13 L202.6,21 L197.4,21 L196.2,13 Z',
    fill:'url(#gold)',stroke:'rgba(70,50,18,.75)','stroke-width':'1.3'}));
  pawl.appendChild(svgEl('path',{d:'M196.6,3 L199,3 L198.4,19 L197.2,19 Z',fill:'rgba(255,252,236,.5)'}));
  pawl.appendChild(svgEl('circle',{cx:PIVOT_X,cy:PIVOT_Y,r:'8',fill:'url(#goldR)',stroke:'rgba(70,50,18,.75)','stroke-width':'1.6'}));
  pawl.appendChild(svgEl('circle',{cx:PIVOT_X,cy:PIVOT_Y,r:'2.4',fill:'#3a2a12'}));
  /* ложечка: её чашечка стукает по золотым точкам по борту */
  pawl.appendChild(svgEl('ellipse',{class:'foot',cx:CX,cy:'24',rx:'6.2',ry:'7.8',
    fill:'url(#goldR)',stroke:'rgba(70,50,18,.7)','stroke-width':'1.2'}));
  pawl.appendChild(svgEl('ellipse',{cx:CX,cy:'24.6',rx:'4.2',ry:'5.6',fill:'rgba(112,82,30,.22)','pointer-events':'none'}));
  pawl.appendChild(svgEl('ellipse',{cx:CX-1.8,cy:'21',rx:'1.6',ry:'2.2',fill:'rgba(255,252,236,.8)','pointer-events':'none'}));
  svg.appendChild(pawl);

  highlight(lastWin);
  markDone();
  fxInit();
}
/* объяснённые слова зачёркиваются на тарелке */
function markDone(){
  const done=new Set(state.found.map(f=>String(f.w).toLowerCase()));
  document.querySelectorAll('#dish .tile, #dish .tile-txt, #dish .strike').forEach(el=>{
    el.classList.toggle('done', done.has(String(words[Number(el.dataset.i)]).toLowerCase()));
  });
}
function highlight(i){
  document.querySelectorAll('#dish .sector').forEach(s=>s.classList.toggle('win', Number(s.dataset.i)===i));
  document.querySelectorAll('#dish .tile').forEach(p=>p.classList.toggle('hot', Number(p.dataset.i)===i));
}
function setPawl(deg){
  const p=$('#pawl');
  if(!p) return;
  /* когда ложечка в покое, снимаем inline-стиль — тогда работает :hover */
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
/* ложечка стукает по золотой точке на борту — летят искры;
   можно указать своё место удара (например, точку на полу) и разлёт в обе стороны */
function sparkBurst(n, ox, oy, both){
  const X=(ox===undefined? CX : ox), Y=(oy===undefined? 24 : oy);
  for(let k=0;k<n && sparks.length<SPARK_MAX;k++){
    const dir=both ? (Math.random()<0.5?-1:1) : 1;
    sparks.push({ x:X+(Math.random()*8-4), y:Y+(Math.random()*6-3),
      vx:dir*(0.18+Math.random()*0.4), vy:-(0.05+Math.random()*0.32),
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
/* профиль скорости большой фарфоровой тарелки: быстрый разгон, длинное
   плавное торможение. Таблица интеграла строится один раз. */
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
const ESCAPE_EVERY=5;                             /* каждое 5-е вращение тарелка срывается и укатывается */
const ROLL_K=180/(Math.PI*DISH_R);                /* градусов поворота на единицу пути: качение без проскальзывания */
const FLOOR_Y=436;                                /* пол: низ основания подставки */
const FLOOR_DROP=FLOOR_Y-DISH_R-CY;               /* на сколько тарелка опустится, встав на пол (54) */
const ESCAPE_V=0.62;                              /* предельная скорость побега, градусов на миллисекунду */
function slotOf(a){ return Math.round((((a%360)+360)%360)/TAU); }
function reducedMotion(){ try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }

/* на сколько единиц viewBox сдвинуть тарелку, чтобы она скрытно уехала за край экрана */
function offscreenShift(dir){
  const fr=$('#dish-frame').getBoundingClientRect();
  const k=400/Math.max(1, fr.width);              /* единиц viewBox на CSS-пиксель */
  const cx=fr.left+fr.width/2;                    /* центр тарелки на экране */
  const rad=fr.width*(DISH_R+8)/400;              /* радиус тарелки в CSS-пикселях */
  /* вправо: левый край тарелки должен уйти за правый край экрана;
     влево: правый край — за левый край экрана */
  const px = dir>0 ? (window.innerWidth+70-(cx-rad)) : (cx+rad+70);
  return Math.max(520, px)*k;
}
/* подставка вздрагивает, когда тарелка возвращается на штырёк */
function shakeMount(){
  const parts=document.querySelectorAll('.stand');
  if(!parts.length) return;
  for(const m of parts) m.classList.remove('shake');
  void document.querySelector('#dish').getBoundingClientRect();
  for(const m of parts) m.classList.add('shake');
}

/* слова, которые ещё не объясняли */
function available(){
  const done=new Set(state.found.map(f=>String(f.w).toLowerCase()));
  const pool=[];
  for(let i=0;i<words.length;i++) if(!done.has(String(words[i]).toLowerCase())) pool.push(i);
  return pool;
}
function pickWinner(){
  const pool=available();
  if(!pool.length) return -1;
  let i=pool[Math.floor(Math.random()*pool.length)];
  if(i===lastWin && pool.length>1)
    i=pool[(pool.indexOf(i)+1+Math.floor(Math.random()*(pool.length-1)))%pool.length];
  lastWin=i;
  return i;
}
/* тарелка объяснена целиком: крутить больше нечего */
function allExplained(){
  $('#word').textContent='✓';
  $('#task').textContent='Все слова объяснены. Нажмите «Сначала» — и они снова встанут на тарелку.';
  $('#word-card').classList.add('hot');
  $('#found').disabled=true;
  $('#spin').disabled=true;
}
function updateSpinState(){
  const left=available().length;
  $('#spin').disabled = left===0;
  return left;
}
function spin(){
  if(spinning) return;
  const i=pickWinner();
  if(i<0){ allExplained(); return; }
  state.spins=(state.spins||0)+1; save();
  const escape=(state.spins%ESCAPE_EVERY===0) && !reducedMotion();
  const jitter=(Math.random()*2-1)*11;              /* ложечка встаёт внутрь сектора */
  const target=(((-(i*TAU+TAU/2)-jitter)%360)+360)%360;
  const turns=SPIN.turns+Math.floor(Math.random()*(SPIN.extra+1));
  const from=rot;
  let delta=target-((((rot%360)+360)%360)); if(delta<0) delta+=360;
  const toFull=from+delta+turns*360;
  const dur=reducedMotion()? 500 : SPIN.dur+Math.random()*SPIN.tail;
  const WIND=reducedMotion()? 0 : 230;              /* взвод: тарелка качается назад */
  const BACK=5.5;
  const rotor=$('#rotor'), disc=$('#disc'), halo=$('#halo'), rollShadow=$('#rollShadow'), wf=$('#dish-frame');

  spinning=true;
  document.body.classList.add('lit');          /* свет в комнате крепчает, когда тарелка ходит */
  $('#spin').classList.add('busy');
  $('#dish-tap').classList.add('busy');
  wf.classList.add('spin');
  if(escape) wf.classList.add('rolling');
  highlight(-1);
  resetCard();

  const setDisc=(x,y)=>{
    const yy=y||0, t=`translate(${x.toFixed(2)}px, ${yy.toFixed(2)}px)`;
    if(disc) disc.style.transform=t;
    if(halo) halo.style.transform=t;             /* свечение катится вместе с тарелкой */
    if(rollShadow){                              /* тень на полу: появляется, когда тарелка внизу */
      rollShadow.setAttribute('cx',(CX+x).toFixed(1));
      rollShadow.setAttribute('opacity',(clamp(1-Math.abs(yy-FLOOR_DROP)/42,0,1)*0.5).toFixed(2));
    }
  };

  function phase(ms, onFrame, onDone){
    const t0=performance.now();
    (function f(now){
      const p=Math.min(1,(now-t0)/ms);
      const early=onFrame(p, now)===true;            /* фаза может закончиться раньше срока */
      if(!early && p<1) requestAnimationFrame(f); else onDone();
    })(performance.now());
  }
  /* ближайший угол, на котором нужный сектор встанет на ложечку */
  function nextTarget(minAngle, extraTurns){
    return minAngle + ((((target-(((minAngle%360)+360)%360))%360)+360)%360) + extraTurns*360;
  }

  /* обычный разгон и торможение: свечение, блики по глазури, щелчки и искры */
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

  /* --- побег тарелки: разгон до предела, слёт со штырька, качение, прыжок обратно ---
     Всю дорогу живёт одна величина v — скорость вращения в градусах на
     миллисекунду. Она меняется плавно (экспоненциально к цели), поэтому
     тарелка нигде не дёргается: ни в момент слёта, ни в момент посадки. */
  let v=0, prevT=performance.now(), prevSlot=slotOf(rot), onAxle=true;
  function chase(target, dt){ v += (target-v)*Math.min(1, dt*0.004); }
  function drawSpin(dt){
    rotor.setAttribute('transform',`rotate(${rot.toFixed(2)} ${CX} ${CY})`);
    if(reducedMotion()) return;
    rotor.style.filter = v>0.18 ? `blur(${clamp(v*4,0,3).toFixed(2)}px)` : '';
    setGlow(v);
    if(onAxle){                                  /* ложечка щёлкает только по своим золотым точкам */
      const slot=slotOf(rot);
      if(slot!==prevSlot){
        pawlAngle=Math.min(11, 4+v*14);
        if(v>V_REF*0.45) sparkBurst(Math.min(5, 1+Math.round(v*7)));
        prevSlot=slot;
      }
    }
    pawlAngle+=(0-pawlAngle)*Math.min(1, dt/70);
    setPawl(pawlAngle);
  }
  function spinBy(dt){ rot+=v*dt; drawSpin(dt); }
  function tick(now){ const dt=Math.max(1, now-prevT); prevT=now; return dt; }

  /* разгон: скорость растёт до предельной и к моменту слёта уже не растёт */
  function windUpTo(maxSpeed, ms, done){
    v=0.16; prevT=performance.now(); prevSlot=slotOf(rot);
    phase(ms, (p, now)=>{ const dt=tick(now); chase(maxSpeed, dt); spinBy(dt); }, done);
  }
  /* слёт: соскок со штырька, падение, отскоки на месте — и только потом улетает вперёд */
  function flyOff(done){
    const right=offscreenShift(1), F=FLOOR_DROP;
    const LEAVE=170, HIT1=520, HIT2=900, SETTLE=1240;   /* соскок, удар, отскок, начало качения */
    const t0=performance.now(); prevT=t0;
    let x=0, hits=0;
    const creepEnd=8+26+12;                              /* сколько подтянется вперёд за отскоки */
    function fallY(t){
      if(t<LEAVE) return -18*Math.sin((t/LEAVE)*Math.PI/2);
      if(t<HIT1){ const q=(t-LEAVE)/(HIT1-LEAVE); return -18+(F+18)*q*q; }
      if(t<HIT2){ const q=(t-HIT1)/(HIT2-HIT1); return F-15*Math.sin(q*Math.PI); }
      if(t<SETTLE){ const q=(t-HIT2)/(SETTLE-HIT2); return F-6*Math.sin(q*Math.PI); }
      return F+1.8*Math.sin(t/260);
    }
    function creep(t){
      if(t<LEAVE) return 8*(t/LEAVE);
      if(t<HIT2)  return 8+26*(t-LEAVE)/(HIT2-LEAVE);
      if(t<SETTLE)return 34+12*(t-HIT2)/(SETTLE-HIT2);
      return creepEnd;
    }
    onAxle=false;
    phase(9000, (p, now)=>{
      const dt=tick(now), t=now-t0;
      chase(ESCAPE_V, dt);
      spinBy(dt);                                    /* вращение не падает нигде */
      let px;
      if(t<SETTLE) px=creep(t);
      else{
        const q=Math.min(1,(t-SETTLE)/320);          /* пол цепляет тарелку: разгон качения */
        x += v*dt/ROLL_K*(0.2+0.8*q*q);
        px=creepEnd+x;
      }
      setDisc(px, fallY(t));
      if(hits<3 && t>=[LEAVE,HIT1,HIT2][hits]){
        hits++;
        if(!reducedMotion()){
          sparkBurst(hits===1?4:(hits===2?6:3), CX+creep(t), hits===1?26:FLOOR_Y-6, hits>1);
          shakeMount();
        }
      }
      /* за краем экрана тарелка катится ещё немного, потом возвращается слева */
      return px >= right+140 && t > SETTLE+900;
    }, ()=> rollBack(done));
  }
  /* возвращается слева, накатом, с той же скоростью, и доезжает до подставки */
  function rollBack(done){
    const left=-offscreenShift(-1);
    let x=left; const t0=performance.now(); prevT=t0;
    setDisc(x, FLOOR_DROP);
    phase(9000, (p, now)=>{
      const dt=tick(now), t=now-t0;
      chase(ESCAPE_V, dt);
      x += v*dt/ROLL_K;
      spinBy(dt);
      setDisc(Math.min(0, x), FLOOR_DROP+1.8*Math.sin(t/260));
      return x >= 0;
    }, ()=> leapToAxle(done));
  }
  /* прыжок с пола на штырёк: в воздухе тарелка крутится ровно с той же скоростью */
  function leapToAxle(done){
    const F=FLOOR_DROP, t0=performance.now(); prevT=t0;
    let hits=0;
    phase(780, (p, now)=>{
      const dt=tick(now), t=now-t0;
      chase(ESCAPE_V, dt);
      spinBy(dt);
      let y;
      if(t<300)      y=F-(F+20)*Math.sin((t/300)*Math.PI/2);
      else if(t<560){ const q=(t-300)/260; y=-20+20*q*q; }
      else if(t<740){ const q=(t-560)/180; y=-7*Math.sin(q*Math.PI); }
      else            y=0;
      setDisc(0, y);
      if((t>=560 && hits===0) || (t>=740 && hits===1)){
        hits++;
        onAxle=true; prevSlot=slotOf(rot);
        pawlAngle=hits===1?13:8; setPawl(pawlAngle);
        if(!reducedMotion()){ sparkBurst(hits===1?5:2); shakeMount(); }
      }
      return t>=780;
    }, ()=> brakeToTarget(done));
  }
  /* плавное торможение: начинаем ровно с текущей скорости и гасим её до нуля
     как раз на нужном секторе — без единого рывка */
  function brakeToTarget(done){
    const start=rot, v0=Math.max(0.2, v);
    const D=nextTarget(start+360, 1)-start;
    const T=2*D/v0;                                  /* при таком T начальная скорость совпадает */
    prevT=performance.now(); prevSlot=slotOf(start);
    phase(T, (p, now)=>{
      const dt=tick(now);
      rot = start + D*(1-Math.pow(1-p, 2));
      v   = 2*D*(1-p)/T;
      drawSpin(dt);
    }, done);
  }

  /* финальное «докачивание» большой тарелки */
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
    $('#dish-tap').classList.remove('busy');
    wf.classList.remove('spin');
    wf.classList.remove('rolling');
    document.body.classList.remove('lit');
    wf.classList.remove('hit'); void wf.offsetWidth; wf.classList.add('hit');
    highlight(i);
    showWord(i);
  }
  const finish=()=> settle();
  if(escape){
    wind(()=> windUpTo(ESCAPE_V, 1700, ()=> flyOff(finish)));
  } else {
    wind(()=> run(from-BACK, toFull, dur, finish));
  }
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
  const chip=$('#btn-reset');
  if(chip) chip.textContent = state.found.length? '↺ Сначала · '+state.found.length : '↺ Сначала';
  if(!state.found.length){ box.innerHTML='<span class="empty-note">Пока ничего не нашли — крутите тарелку и ищите слово в книгах.</span>'; return; }
  box.innerHTML=state.found.slice().reverse().map(f=>'<span class="fchip">'+f.w+' <small>'+f.t+'</small></span>').join('');
}
function markFound(){
  const w=$('#word').textContent;
  if(!w || w==='—' || alreadyFound(w)) return;
  const t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  state.found.push({w:w,t:t});
  save(); renderFound(); markDone();
  if(!updateSpinState()) allExplained();
  $('#found').disabled=true;
}
function alreadyFound(w){
  const key=w.toLowerCase();
  return state.found.some(f=>String(f.w).toLowerCase()===key);
}

/* ------------------------------ живой фон ------------------------------ */
/* пылинки в луче света: их количество зависит от ширины экрана */
function initAmbient(){
  const box=$('#amb-motes');
  if(!box) return;
  box.innerHTML='';
  if(reducedMotion()) return;
  const n=Math.max(14, Math.min(30, Math.round(window.innerWidth/44)));
  const frag=document.createDocumentFragment();
  for(let k=0;k<n;k++){
    const m=document.createElement('span');
    m.className='mote';
    const size=(1.8+Math.random()*2.4).toFixed(1);
    m.style.cssText =
      'left:'+(Math.random()*100).toFixed(2)+'%;top:'+(18+Math.random()*86).toFixed(2)+'%;'+
      'width:'+size+'px;height:'+size+'px;'+
      '--d:'+(17+Math.random()*25).toFixed(1)+'s;'+
      '--o:'+(0.22+Math.random()*0.45).toFixed(2)+';'+
      '--dx:'+(Math.random()*90-45).toFixed(0)+'px;'+
      '--dy:'+(-120-Math.random()*260).toFixed(0)+'px;'+
      'animation-delay:'+(-Math.random()*42).toFixed(1)+'s';
    frag.appendChild(m);
  }
  box.appendChild(frag);
}
/* фон чуть смещается за курсором — получается глубина */
let ambPending=false, ambX=0, ambY=0;
function ambShift(){
  ambPending=false;
  const amb=$('.ambient');
  if(!amb) return;
  amb.style.setProperty('--ax',(ambX*-13).toFixed(1)+'px');
  amb.style.setProperty('--ay',(ambY*-9).toFixed(1)+'px');
}
window.addEventListener('pointermove',e=>{
  if(reducedMotion() || e.pointerType!=='mouse') return;
  ambX=e.clientX/Math.max(1,window.innerWidth)-0.5;
  ambY=e.clientY/Math.max(1,window.innerHeight)-0.5;
  if(!ambPending){ ambPending=true; requestAnimationFrame(ambShift); }
},{passive:true});

/* ------------------------------ тема ------------------------------ */
function applyTheme(){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = state.theme==='dark' || (state.theme==='auto' && (!window.matchMedia || prefersDark));
  document.documentElement.setAttribute('data-theme', dark? 'dark':'light');
  $('#btn-theme').textContent = dark? '🌙 Ночная' : '☀️ Светлая';
  buildDish();
}
function toggleTheme(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  state.theme = dark? 'light' : 'dark';
  save(); applyTheme();
}

/* ------------------------------ кнопки и клавиатура ------------------------------ */
$('#spin').addEventListener('click',spin);
$('#dish-tap').addEventListener('click',spin);
$('#found').addEventListener('click',markFound);
$('#clear-found').addEventListener('click',()=>{
  if(!state.found.length) return;
  if(!confirm('Удалить список найденных слов?')) return;
  state.found=[]; save(); renderFound(); markDone(); updateSpinState();
});
$('#btn-reset').addEventListener('click',()=>{
  if(!state.found.length && !state.spins) return;
  if(!confirm('Начать заново? Список объяснённых слов очистится, и все слова снова встанут на тарелку.')) return;
  state.found=[]; state.spins=0; save();
  renderFound(); markDone(); highlight(-1); resetCard(); updateSpinState();
});
$('#btn-theme').addEventListener('click',toggleTheme);
document.addEventListener('keydown',e=>{
  if((e.key===' '||e.key==='Enter') && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)){ e.preventDefault(); spin(); }
});
let resizeTimer=null;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{ if(!spinning) buildDish(); }, 220);
});

/* ------------------------------ старт ------------------------------ */
/* тарелка стоит «как после последнего вращения»: ложечка по центру сектора */
rot=-(Math.floor(Math.random()*SECTORS)*TAU + TAU/2);
applyTheme();
initAmbient();
renderFound();
resetCard();
updateSpinState();
setPawl(0);
