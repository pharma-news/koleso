/* ============================================================
   Звук тарелки слов.

   Ни одного аудиофайла: весь звук синтезируется на лету через
   Web Audio, а «комната» — короткий синтетический хвост
   (свёртка с затухающим шумом).

   Что звучит:
     · храповик — остриё стрелки бьёт по золотым точкам борта;
       сила и тембр щелчка зависят от скорости тарелки, фарфор
       на каждый удар отзывается тонким звоном;
     · гул тарелки на штырьке — тон, который растёт вместе со скоростью,
       с тремоло по кругу вращения; шума воздуха нет и в помине;
     · фарфор — звон тарелки при пуске и при ударе (негармонический
       ряд обертонов, как у настоящей пластины);
     · побег: соскок со штырька, свист падения, удары об пол с
       отскоками, качение по полу со зёрнами-неровностями. Звук
       едет за тарелкой по панораме и глохнет, когда она за экраном;
     · посадка на штырёк, финальный «клёц» и ударная волна;
     · колокольчик выпавшего слова — свой лад на каждый сектор
       (пентатоника: любые два слова звучат ладно), подтверждение,
       фанфары, сброс, смена темы, кнопки, наведение курсора.

   Уровни можно проверить без ушей: SFX.selfTest() прогоняет каждый
   голос через OfflineAudioContext и возвращает пик и RMS по буферу.
   SFX.level() — текущий RMS на выходе мастер-шины (для замера
   живого вращения).
   ============================================================ */
(function(global){
'use strict';

const SET_KEY='tarelka_sound_v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);

let cfg={on:true, vol:0.85};
try{
  const s=JSON.parse(localStorage.getItem(SET_KEY)||'null');
  if(s){ if(typeof s.on==='boolean') cfg.on=s.on; if(typeof s.vol==='number') cfg.vol=clamp(s.vol,0.2,1); }
}catch(e){}
function saveCfg(){ try{ localStorage.setItem(SET_KEY, JSON.stringify(cfg)); }catch(e){} }

/* лад выпавших слов: пентатоника, 12 ступеней на 12 секторов */
const SCALE=[523.25,587.33,659.25,783.99,880.0,1046.5,1174.66,1318.51,1567.98,1760.0,2093.0,2349.32];

/* комната: затухающий шум вместо измерения реального помещения */
function makeIR(ac, dur, decay){
  const n=Math.max(8, Math.floor(ac.sampleRate*dur));
  const b=ac.createBuffer(2, n, ac.sampleRate);
  const attack=Math.max(1, ac.sampleRate*0.004);
  for(let c=0;c<2;c++){
    const d=b.getChannelData(c);
    for(let i=0;i<n;i++){
      const t=i/n;
      d[i]=(Math.random()*2-1)*Math.pow(1-t, decay)*(1-Math.exp(-i/attack));
    }
  }
  return b;
}

/* ------------------------------ движок ------------------------------ */
/* Граф строится в переданном контексте — в настоящем AudioContext
   для игры и в OfflineAudioContext для замера уровней. */
function makeEngine(ac){
  const E={ac:ac};
  const T=()=>ac.currentTime;

  /* мастер: общий уровень + мягкий лимитер, чтобы частые щелчки
     на полном ходу не резали звук */
  const master=ac.createGain(); master.gain.value=cfg.vol;
  const lim=ac.createDynamicsCompressor();
  lim.threshold.value=-10; lim.knee.value=4; lim.ratio.value=12;
  lim.attack.value=0.002; lim.release.value=0.25;
  master.connect(lim); lim.connect(ac.destination);
  const tap=ac.createAnalyser(); tap.fftSize=1024; tap.smoothingTimeConstant=0.55;
  lim.connect(tap);
  E.master=master; E.tap=tap;

  /* хвост комнаты */
  const verb=ac.createConvolver(); verb.buffer=makeIR(ac, 1.3, 2.8);
  const verbTone=ac.createBiquadFilter(); verbTone.type='lowpass'; verbTone.frequency.value=4800;
  const wet=ac.createGain(); wet.gain.value=0.8;
  verb.connect(verbTone); verbTone.connect(wet); wet.connect(master);
  const send=ac.createGain(); send.connect(verb);

  /* шина пространства: панорама идёт за тарелкой, «дальность»
     глохнет, когда тарелка уезжает за край экрана */
  const wheel=ac.createGain();
  const pan=(ac.createStereoPanner? ac.createStereoPanner(): null);
  const wheelOut=ac.createGain();
  if(pan){ wheel.connect(pan); pan.connect(wheelOut); } else { wheel.connect(wheelOut); }
  wheelOut.connect(master);
  E.setSpace=function(p, duck){
    const t=T(), k=clamp(duck==null?1:duck, 0.15, 1);
    if(pan) pan.pan.setTargetAtTime(clamp(p,-1,1), t, 0.04);
    wheelOut.gain.setTargetAtTime(0.35+0.65*k, t, 0.06);
  };

  /* ------------------------------ сводка ------------------------------
     Ручки пульта. Голосы внутри шин уже сведены между собой, так что
     общий баланс правится только здесь. Цифры проверены прогоном каждого
     голоса через OfflineAudioContext — SFX.selfTest() считает пик и RMS
     на мастер-шине: ни один звук не должен резать (клиппинг) и не должен
     быть тише шёпота. */
  const MIX={
    click: 10,     /* храповик: остриё стрелки по золотым точкам */
    air:   1.6,    /* шелест вращения: надувается на разгоне и торможении */
    roll:  1.1,    /* качение тарелки по полу */
    hit:   5.5,    /* фарфор: пуск, удары о пол, звон, посадка на штырёк */
    bell:  4,      /* колокольчики слов */
    ui:    16      /* кнопки, наведение, шелест пера */
  };

  /* шумовой буфер — источник для всех «не тональных» звуков */
  const N=ac.createBuffer(1, Math.floor(ac.sampleRate*2), ac.sampleRate);
  { const d=N.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }

  function filt(type,f,q){ const b=ac.createBiquadFilter(); b.type=type; b.frequency.value=f; if(q!=null) b.Q.value=q; return b; }
  function gn(v){ const g=ac.createGain(); g.gain.value=(v==null?0:v); return g; }
  function nz(){ const s=ac.createBufferSource(); s.buffer=N; return s; }
  /* огибающая ударного звука: очень короткий подъём, экспоненциальное затухание */
  function env(g,t,peak,atk,dec){
    const p=g.gain, pk=Math.max(0.0002, peak);
    p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(pk, t+Math.max(0.0005,atk));
    p.exponentialRampToValueAtTime(0.0001, t+Math.max(0.0005,atk)+Math.max(0.005,dec));
  }
  /* шина: сухая часть + посыл в комнату */
  function wbus(amp, wetAmt, lpHz){
    const g=ac.createGain(); g.gain.value=amp;
    if(lpHz){ const lp=filt('lowpass', lpHz, 0.7); g.connect(lp); lp.connect(wheel); if(wetAmt){ const s=gn(wetAmt); lp.connect(s); s.connect(send); } }
    else { g.connect(wheel); if(wetAmt){ const s=gn(wetAmt); g.connect(s); s.connect(send); } }
    return g;
  }
  function bus(amp, wetAmt){
    const g=ac.createGain(); g.gain.value=amp; g.connect(master);
    if(wetAmt){ const s=gn(wetAmt); g.connect(s); s.connect(send); }
    return g;
  }

  E.clickBus=wbus(MIX.click, 0.10);
  E.airBus  =wbus(MIX.air,  0.0);
  E.rollBus =wbus(MIX.roll, 0.12, 1400);
  E.hitBus  =wbus(MIX.hit,  0.35);
  E.bellBus =wbus(MIX.bell, 0.55, 9500);
  E.uiBus   =bus(MIX.ui,    0.06);

  /* набор обертонов: так звучит пластина — ряд несовершенных интервалов */
  function partials(t, f0, ratios, decs, amp, dest, atkLen){
    for(let i=0;i<ratios.length;i++){
      const f=f0*ratios[i]*rnd(0.996,1.004);
      if(f>ac.sampleRate*0.45) continue;
      const o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f,t);
      const g=gn(0); o.connect(g); g.connect(dest);
      env(g,t, amp*(i===0?1:0.7/(1+i*0.85)), atkLen||0.002, decs[i]);
      o.start(t); o.stop(t+decs[i]+0.08);
    }
  }

  /* ---------------- храповик: остриё по золотой точке ---------------- */
  let lastClick=-1;
  E.click=function(vn, at){
    const t=(at==null? T() : at);
    if(t-lastClick<0.011) return;                 /* на полном ходу не сваливаемся в кашу */
    lastClick=t;
    const k=clamp(vn,0,1.3), j=rnd(0.94,1.06);    /* j — точки борта не одинаковые */
    const amp=0.05+0.30*Math.min(1.15,k);
    /* щёлк: шум в узкой полосе, чем быстрее — тем выше и злее */
    const s=nz(), hp=filt('highpass', 800+700*k), bp=filt('bandpass', (2200+2300*k)*j, 5+3*k), g=gn(0);
    s.connect(hp); hp.connect(bp); bp.connect(g); g.connect(E.clickBus);
    env(g,t, amp, 0.0006, 0.024+0.014*(1-Math.min(1,k)));
    s.start(t, rnd(0,1.4)); s.stop(t+0.14);
    /* золотая точка звякает, рычажок отдаётся коротким стуком */
    const o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(1150*j, t);
    const og=gn(0); o.connect(og); og.connect(E.clickBus);
    env(og,t, amp*(0.14+0.06*Math.min(1,k)), 0.0008, 0.065); o.start(t); o.stop(t+0.14);
    const o2=ac.createOscillator(); o2.type='triangle'; o2.frequency.setValueAtTime((300+120*k)*j, t);
    const o2g=gn(0); o2.connect(o2g); o2g.connect(E.clickBus);
    env(o2g,t, amp*0.14, 0.001, 0.032); o2.start(t); o2.stop(t+0.09);
    /* фарфор отзывается на каждый удар тонким звоном борта */
    partials(t, 2600*j, [1,1.9,3.2], [0.17,0.11,0.07], 0.012+0.022*Math.min(1,k), E.clickBus, 0.001);
  };

  /* ---------------- голос вращения: тарелка гудит на штырьке ----------------
     Никакого широкого шума воздуха: фарфоровая тарелка, которая крутится на
     золотом штырьке, не шумит — она тихо гудит, и тон растёт вместе со
     скоростью. Это два осциллятора (мода фарфора и голос штырька) с тремоло
     по частоте вращения: слышно круг, по которому идёт тарелка, а не фен. */
  const brA=ac.createOscillator(); brA.type='triangle'; brA.frequency.value=430;
  const brB=ac.createOscillator(); brB.type='sine';     brB.frequency.value=866;
  const brForm=filt('bandpass', 900, 3.4);
  const brTrem=gn(1), brG=gn(0);
  brA.connect(brForm); brB.connect(brForm); brForm.connect(brTrem); brTrem.connect(brG); brG.connect(E.airBus);
  /* тремоло = круг тарелки: тон не стоит на месте, а подрагивает */
  const brLfo=ac.createOscillator(); brLfo.type='sine'; brLfo.frequency.value=7;
  const brLfoG=gn(0.3); brLfo.connect(brLfoG); brLfoG.connect(brTrem.gain);
  /* штырёк не идеально круглый — тон чуть гуляет по высоте */
  const vibLfo=ac.createOscillator(); vibLfo.type='sine'; vibLfo.frequency.value=5.5;
  const vibG=gn(3); vibLfo.connect(vibG); vibG.connect(brA.frequency); vibG.connect(brB.frequency);
  brA.start(); brB.start(); brLfo.start(); vibLfo.start();

  E.setSpeed=function(vn){
    const t=T(), k=clamp(vn,0,1.25), mn=Math.min(1,k);
    /* степени 2.2 хватает, чтобы на медленном ходу голоса почти не было */
    brG.gain.setTargetAtTime(k<0.04?0 : Math.pow(mn,2.2)*0.026, t, 0.10);
    brA.frequency.setTargetAtTime(360+300*mn, t, 0.14);
    brB.frequency.setTargetAtTime(720+620*mn, t, 0.14);
    brForm.frequency.setTargetAtTime(760+1100*mn, t, 0.14);
    brLfo.frequency.setTargetAtTime(3.5+24*mn, t, 0.12);
    brLfoG.gain.setTargetAtTime(0.20+0.42*mn, t, 0.15);
    vibLfo.frequency.setTargetAtTime(4+18*mn, t, 0.15);
    vibG.gain.setTargetAtTime(2+10*mn, t, 0.15);
  };

  const rollSrc=nz(); rollSrc.loop=true;
  const rollLp=filt('lowpass', 300, 0.8), rollAm=gn(1), rollG=gn(0);
  rollSrc.connect(rollLp); rollLp.connect(rollAm); rollAm.connect(rollG); rollG.connect(E.rollBus);
  /* зерно качения: тарелка катится по неровностям пола */
  const rollLfo=ac.createOscillator(); rollLfo.type='sawtooth'; rollLfo.frequency.value=9;
  const rollLfoG=gn(0.4); rollLfo.connect(rollLfoG); rollLfoG.connect(rollAm.gain);
  /* чуть скрежета по полу */
  const rollScBp=filt('bandpass', 1500, 1.2), rollScG=gn(0);
  rollSrc.connect(rollScBp); rollScBp.connect(rollScG); rollScG.connect(E.rollBus);
  rollSrc.start(); rollLfo.start();

  function rollK(k){
    const t=T(); k=clamp(k,0,1);
    /* не ровный гул, а перестук: постель потише, зёрен пожиже и почаще */
    rollG.gain.setTargetAtTime(k<0.02?0 : 0.022+0.070*k, t, 0.09);
    rollLp.frequency.setTargetAtTime(300+700*k, t, 0.12);
    rollLfo.frequency.setTargetAtTime(7+30*k, t, 0.1);
    rollLfoG.gain.setTargetAtTime(k<0.02?0 : 0.35+0.55*k, t, 0.1);
    rollScG.gain.setTargetAtTime(k<0.2?0 : 0.004+0.014*k, t, 0.15);
  }
  E.setRoll=rollK;
  E.rollStop=()=>rollK(0);
  /* dist — путь тарелки в единицах viewBox; считаем его и рассыпаем удары */
  let rollDist=0, rollNext=rnd(30,90);
  E.rollGrain=function(dist, k){
    rollDist+=dist;
    if(rollDist<rollNext) return;
    rollDist=0; rollNext=rnd(24,70);
    thump(0.016+0.042*clamp(k,0,1), 105+rnd(-30,40));
  };
  /* глухой короткий удар о пол (зёрна качения и мелкие посадки) */
  function thump(amp, f, at){
    const t=(at==null? T(): at);
    const o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(34,f*0.42), t+0.09);
    const g=gn(0); o.connect(g); g.connect(E.hitBus);
    env(g,t, amp, 0.002, 0.1); o.start(t); o.stop(t+0.22);
    const s=nz(), lp=filt('lowpass', 900, 0.8), sg=gn(0);
    s.connect(lp); lp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, amp*0.45, 0.001, 0.03); s.start(t, rnd(0,1.4)); s.stop(t+0.1);
  }
  E.thump=thump;

  /* ---------------- фарфор: звон и удары ---------------- */
  /* звон самой пластины: ряд несовершенных обертонов, как у тарелки */
  E.ringPlate=function(power, at){
    const t=(at==null? T(): at), p=clamp(power,0.02,1);
    partials(t, 392*rnd(0.97,1.03), [1,2.59,4.08,5.67,7.12],
      [1.9,1.3,0.95,0.7,0.5].map(d=>d*(0.55+0.5*p)), 0.010+0.045*p, E.hitBus);
    partials(t, 1176*rnd(0.98,1.02), [1,2.3,3.9], [0.5,0.3,0.2], 0.004+0.014*p, E.hitBus);
  };
  E.impact=function(power, at){
    const t=(at==null? T(): at); power=clamp(power,0.05,1);
    /* корпус: низ, быстро съезжающий вниз */
    const o=ac.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(150+110*power, t);
    o.frequency.exponentialRampToValueAtTime(46, t+0.22);
    const g=gn(0); o.connect(g); g.connect(E.hitBus);
    env(g,t, 0.09+0.36*power, 0.004, 0.3); o.start(t); o.stop(t+0.55);
    /* шлепок об пол */
    const s=nz(), lp=filt('lowpass', 700+1100*power, 0.9), sg=gn(0);
    s.connect(lp); lp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, 0.05+0.22*power, 0.0012, 0.09); s.start(t, rnd(0,1.4)); s.stop(t+0.3);
    /* и звон: по фарфору ударили всерьёз */
    partials(t, 392*rnd(0.98,1.02), [1,2.59,4.08,5.67,7.12],
      [1.35,0.95,0.7,0.5,0.34].map(d=>d*(0.6+0.55*power)), 0.016+0.06*power, E.hitBus);
  };
  /* короткий металлический «динь»: штырёк, скоба, кронштейн */
  E.ping=function(power, at){
    const t=(at==null? T(): at), p=clamp(power,0.05,1);
    partials(t, 1120*rnd(0.97,1.03), [1,1.62,2.35,3.11,4.3],
      [0.42,0.3,0.22,0.16,0.12], 0.014+0.05*p, E.hitBus, 0.001);
    const s=nz(), bp=filt('bandpass', 3600, 6), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.02+0.07*p, 0.0006, 0.02); s.start(t, rnd(0,1.4)); s.stop(t+0.08);
  };
  /* свист падения: тон едет вниз, как падающий предмет */
  E.fall=function(dur, from, to, at){
    const t=(at==null? T(): at); dur=clamp(dur,0.06,1.5);
    const o=ac.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(from,t); o.frequency.exponentialRampToValueAtTime(to, t+dur);
    const g=gn(0); o.connect(g); g.connect(E.hitBus);
    env(g,t, 0.035, 0.03, dur*0.85); o.start(t); o.stop(t+dur+0.15);
    const s=nz(), bp=filt('bandpass', from*1.6, 3.5), sg=gn(0);
    bp.frequency.setValueAtTime(from*1.6, t); bp.frequency.exponentialRampToValueAtTime(to*1.6, t+dur);
    s.connect(bp); bp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, 0.035, 0.04, dur*0.8); s.start(t, rnd(0,1.4)); s.stop(t+dur+0.15);
  };
  /* шелест-волна: пуск тарелки, ударная волна при остановке, выдох */
  E.whoosh=function(power, f0, f1, dur, at){
    const t=(at==null? T(): at); power=clamp(power,0.02,1); dur=clamp(dur,0.06,2);
    const s=nz(), bp=filt('bandpass', f0, 0.9), g=gn(0);
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(Math.max(40,f1), t+dur);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.025+0.10*power, dur*0.16, dur*0.84);
    s.start(t, rnd(0,1.2)); s.stop(t+dur+0.12);
  };
  /* скрип дерева подставки при взводе */
  E.creak=function(dur, at){
    const t=(at==null? T(): at); dur=clamp(dur,0.06,1);
    const s=nz(); s.loop=true;
    const bp=filt('bandpass', 330, 9), trem=gn(0.45), g=gn(0);
    s.connect(bp); bp.connect(trem); trem.connect(g); g.connect(E.hitBus);
    const lfo=ac.createOscillator(); lfo.type='square'; lfo.frequency.setValueAtTime(13,t);
    const lg=gn(0.4); lfo.connect(lg); lg.connect(trem.gain);
    bp.frequency.setValueAtTime(300,t); bp.frequency.linearRampToValueAtTime(440, t+dur);
    env(g,t, 0.035, 0.02, dur);
    s.start(t, rnd(0,1.2)); s.stop(t+dur+0.06); lfo.start(t); lfo.stop(t+dur+0.06);
    /* пружинка стрелки звякнет на конце взвода */
    partials(t+dur*0.6, 1520, [1,1.7,2.6], [0.12,0.08,0.05], 0.012, E.hitBus, 0.001);
  };

  /* ---------------- слова: колокольчики ---------------- */
  E.bell=function(freq, amp, dur, at){
    const t=(at==null? T(): at);
    const soft=1/(1+(freq/2600)*0.6);
    partials(t, freq, [1,2.0,2.99,4.21,5.45],
      [dur, dur*0.62, dur*0.46, dur*0.34, dur*0.24], amp*soft, E.bellBus, 0.006);
    /* мягкая палочка в атаке */
    const s=nz(), bp=filt('bandpass', Math.min(9000, freq*4), 5), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.bellBus);
    env(g,t, amp*0.22*soft, 0.001, 0.022); s.start(t, rnd(0,1.4)); s.stop(t+0.06);
  };
  E.reveal=function(i){
    const t=T(), f=SCALE[((i%12)+12)%12];
    E.bell(f, 0.085, 2.1, t);
    E.bell(f*1.5, 0.046, 1.7, t+0.085);
    E.bell(f*2, 0.02, 1.2, t+0.17);
  };
  E.confirm=function(i){
    const t=T(), f=SCALE[((i%12)+12)%12]*0.5;
    E.bell(f, 0.05, 1.0, t);
    E.bell(f*1.5, 0.048, 1.15, t+0.1);
    /* чёрка по слову: короткий шелест пера */
    const s=nz(), bp=filt('bandpass', 900, 1.4), g=gn(0);
    bp.frequency.setValueAtTime(900,t); bp.frequency.exponentialRampToValueAtTime(3200, t+0.18);
    s.connect(bp); bp.connect(g); g.connect(E.uiBus);
    env(g,t, 0.04, 0.03, 0.15); s.start(t, rnd(0,1.4)); s.stop(t+0.3);
  };
  E.fanfare=function(){
    const t=T(), steps=[0,2,4,5,7,10,11];
    for(let k=0;k<steps.length;k++) E.bell(SCALE[steps[k]], 0.055, 1.8, t+k*0.13);
    const t2=t+steps.length*0.13;
    [SCALE[0],SCALE[4],SCALE[7]].forEach(f=>E.bell(f, 0.04, 2.6, t2));
    E.ringPlate(0.4, t2);
  };
  /* сброс: тарелка быстро прокручивается назад */
  E.rewind=function(){
    const t=T();
    for(let k=0;k<12;k++) E.click(0.8-k*0.045, t+k*0.058);
    E.whoosh(0.22, 1800, 500, 0.3, t);
    E.ringPlate(0.22, t+0.1);
  };
  E.theme=function(dark){
    const t=T();
    if(dark){ E.bell(392, 0.045, 1.5, t); E.bell(261.63, 0.03, 1.8, t+0.05); }
    else    { E.bell(1046.5, 0.04, 1.1, t); E.bell(1567.98, 0.026, 1.0, t+0.05); }
  };

  /* ---------------- интерфейс ---------------- */
  E.ui=function(kind){
    const t=T();
    const s=nz(), bp=filt('bandpass', kind==='back'?900:1600, 5), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.uiBus);
    env(g,t, 0.035, 0.0008, kind==='back'?0.03:0.014);
    s.start(t, rnd(0,1.4)); s.stop(t+0.08);
    const o=ac.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(kind==='back'?520:720, t);
    if(kind==='back') o.frequency.exponentialRampToValueAtTime(340, t+0.09);
    const og=gn(0); o.connect(og); og.connect(E.uiBus);
    env(og,t, 0.025, 0.002, 0.05); o.start(t); o.stop(t+0.12);
  };
  E.hover=function(kind){
    const t=T();
    if(kind==='dish'){
      /* навёл курсор на фарфор: еле слышный позвяк */
      partials(t, 4300*rnd(0.95,1.05), [1,1.7,2.6], [0.05,0.035,0.02], 0.012, E.uiBus, 0.001);
      const s=nz(), bp=filt('bandpass', 5200, 7), g=gn(0);
      s.connect(bp); bp.connect(g); g.connect(E.uiBus);
      env(g,t, 0.014, 0.0008, 0.012); s.start(t, rnd(0,1.4)); s.stop(t+0.05);
    } else {
      const s=nz(), bp=filt('bandpass', 2400, 6), g=gn(0);
      s.connect(bp); bp.connect(g); g.connect(E.uiBus);
      env(g,t, 0.012, 0.0008, 0.012); s.start(t, rnd(0,1.4)); s.stop(t+0.05);
    }
  };
  E.muteSfx=function(on){
    const t=T();
    if(on){ E.bell(880, 0.03, 0.5, t); E.bell(1320, 0.024, 0.5, t+0.07); }
    else  { E.bell(660, 0.03, 0.5, t); E.bell(440, 0.026, 0.6, t+0.07); }
  };

  /* короткий щелчок пальцем по борту: пуск тарелки — это удар, а не дуновение */
  E.flick=function(power, at){
    const t=(at==null? T(): at), p=clamp(power,0.1,1);
    const s=nz(), bp=filt('bandpass', 1700*rnd(0.9,1.1), 3), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.03+0.05*p, 0.0008, 0.016); s.start(t, rnd(0,1.4)); s.stop(t+0.06);
    const o=ac.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(230,t); o.frequency.exponentialRampToValueAtTime(150, t+0.09);
    const og=gn(0); o.connect(og); og.connect(E.hitBus);
    env(og,t, 0.02+0.03*p, 0.002, 0.09); o.start(t); o.stop(t+0.2);
  };
  E.spinStart=function(power){
    const t=T(), p=clamp(power,0.1,1);
    E.flick(p, t);                                 /* палец соскочил с борта */
    E.ringPlate(0.65*p, t+0.015);
  };
  E.takeOff=function(){
    const t=T();
    E.ping(0.5, t);
    E.creak(0.22, t);
    E.fall(0.34, 760, 300, t+0.02);
  };
  E.jumpPush=function(){
    const t=T();
    E.whoosh(0.3, 300, 1000, 0.16, t);
    const s=nz(), bp=filt('bandpass', 1300, 2), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.1, 0.004, 0.12); s.start(t, rnd(0,1.4)); s.stop(t+0.25);
    thump(0.22, 130, t);
  };
  E.settle=function(){
    const t=T();
    E.whoosh(0.25, 1200, 500, 0.16, t);           /* короткий выдох остановки */
    E.ping(0.45, t);
    thump(0.2, 120, t+0.01);                      /* фарфор сел на штырёк */
    E.ringPlate(0.3, t);
  };
  E.stopLayers=function(){ E.setSpeed(0); E.rollStop(); };
  E.level=function(){
    const n=tap.fftSize, buf=new Float32Array(n);
    tap.getFloatTimeDomainData(buf);
    let s=0, peak=0;
    for(let i=0;i<n;i++){ const v=buf[i]; s+=v*v; const a=Math.abs(v); if(a>peak) peak=a; }
    return {rms:Math.sqrt(s/n), peak:peak};
  };
  return E;
}

/* ------------------------------ жизнь движка ------------------------------ */
let ac=null, E=null, hoverT=0, sleepTimer=null;

function ensure(){
  if(E){ if(cfg.on && ac.state==='suspended'){ try{ ac.resume(); }catch(e){} } return true; }
  const AC=global.AudioContext||global.webkitAudioContext;
  if(!AC) return false;
  try{ ac=new AC({latencyHint:'interactive'}); }
  catch(e){ try{ ac=new AC(); }catch(e2){ ac=null; return false; } }
  E=makeEngine(ac);
  if(!cfg.on) E.master.gain.value=0;
  return true;
}
function live(){ return !!E && cfg.on; }
function call(name, a, b, c, d, e2){ if(!live()) return; const f=E[name]; if(f) f(a,b,c,d,e2); }
function fadeMaster(v, ms){
  if(!E) return;
  const g=E.master.gain, t=ac.currentTime;
  try{ g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v, t+ms/1000); }
  catch(e){ g.value=v; }
}

function setVol(v){
  cfg.vol=clamp(v,0.2,1); saveCfg();
  if(cfg.on) fadeMaster(cfg.vol, 120);
}
function toggle(){
  cfg.on=!cfg.on; saveCfg();
  if(!cfg.on){
    fadeMaster(0, 60);
    if(sleepTimer) clearTimeout(sleepTimer);
    sleepTimer=setTimeout(()=>{ try{ if(!cfg.on && ac && ac.state==='running') ac.suspend(); }catch(e){} }, 400);
    return false;
  }
  if(sleepTimer){ clearTimeout(sleepTimer); sleepTimer=null; }
  if(!ensure()) return false;
  fadeMaster(cfg.vol, 220);
  E.muteSfx(true);
  return true;
}

const SFX={
  /* первый жест пользователя: без него браузер не пустит звук */
  arm:function(){ if(cfg.on) ensure(); return !!E; },
  on:function(){ return cfg.on; },
  toggle:toggle,
  setVol:setVol,
  level:function(){ return E? E.level() : {rms:0, peak:0}; },

  space:function(p, d){ call('setSpace', p, d); },
  setSpeed:function(v){ call('setSpeed', v); },
  click:function(v){ call('click', v); },
  setRoll:function(k){ call('setRoll', k); },
  rollStop:function(){ call('rollStop'); },
  rollGrain:function(dist, k){ call('rollGrain', dist, k); },
  stopLayers:function(){ call('stopLayers'); },

  spinStart:function(p){ call('spinStart', p); },
  creak:function(d){ call('creak', d); },
  ringPlate:function(p){ call('ringPlate', p); },
  takeOff:function(){ call('takeOff'); },
  fall:function(dur, a, b){ call('fall', dur, a, b); },
  impact:function(p){ call('impact', p); },
  ping:function(p){ call('ping', p); },
  thump:function(a,b){ call('thump', a, b); },
  whoosh:function(p, f0, f1, d){ call('whoosh', p, f0, f1, d); },
  jumpPush:function(){ call('jumpPush'); },
  settle:function(){ call('settle'); },

  reveal:function(i){ call('reveal', i); },
  confirm:function(i){ call('confirm', i); },
  fanfare:function(){ call('fanfare'); },
  rewind:function(){ call('rewind'); },
  theme:function(dark){ call('theme', dark); },
  ui:function(kind){ call('ui', kind); },
  hover:function(kind){
    const t=performance.now(), gap=(kind==='dish'? 320: 90);
    if(t-hoverT<gap || !live()) return;
    hoverT=t; E.hover(kind);
  },

  /* замер уровней каждого голоса: пик и RMS на мастер-шине.
     Слухов не требует, ищет клиппинг и «тихие» звуки. */
  selfTest:function(){
    const OAC=global.OfflineAudioContext||global.webkitOfflineAudioContext;
    if(!OAC) return Promise.reject(new Error('OfflineAudioContext нет'));
    const SR=44100, DUR=2.6;
    const tests={
      clickFast:  e=>e.click(1.0),
      clickSlow:  e=>e.click(0.15),
      spinTone:   e=>e.setSpeed(1.0),
      spinIdle:   e=>e.setSpeed(0.06),
      rollBed:    e=>e.setRoll(1),
      rollGrain:  e=>{ e.setRoll(1); e.rollGrain(60,1); e.rollGrain(60,1); },
      spinStart:  e=>e.spinStart(1),
      impactHard: e=>e.impact(1),
      impactSoft: e=>e.impact(0.35),
      ping:       e=>e.ping(1),
      thump:      e=>e.thump(0.2, 120),
      fall:       e=>e.fall(0.34, 760, 300),
      whoosh:     e=>e.whoosh(0.5, 1500, 260, 0.42),
      creak:      e=>e.creak(0.25),
      reveal:     e=>e.reveal(3),
      confirm:    e=>e.confirm(5),
      fanfare:    e=>e.fanfare(),
      rewind:     e=>e.rewind(),
      settle:     e=>e.settle(),
      takeOff:    e=>e.takeOff(),
      jumpPush:   e=>e.jumpPush(),
      theme:      e=>e.theme(true),
      ui:         e=>e.ui('click'),
      hover:      e=>e.hover('dish'),
      mute:       e=>e.muteSfx(true)
    };
    const names=Object.keys(tests);
    const out=[];
    return names.reduce((chain, name)=>chain.then(()=>{
      const oc=new OAC(2, Math.floor(SR*DUR), SR);
      const e=makeEngine(oc);
      tests[name](e);
      return oc.startRendering().then(buf=>{
        let peak=0, sum=0, n=0;
        for(let c=0;c<buf.numberOfChannels;c++){
          const d=buf.getChannelData(c);
          for(let i=0;i<d.length;i++){ const v=d[i]; const a=Math.abs(v); if(a>peak) peak=a; sum+=v*v; n++; }
        }
        out.push({name:name, peak:+peak.toFixed(3), rms:+Math.sqrt(sum/n).toFixed(4), clip:peak>0.99});
      });
    }), Promise.resolve()).then(()=>out);
  }
};

/* вкладка свернута — контекст спит, а не жжёт процессор */
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{
    if(!ac) return;
    try{ if(document.hidden){ ac.suspend(); } else if(cfg.on){ ac.resume(); } }catch(e){}
  });
}

global.SFX=SFX;
})(typeof window!=='undefined'? window: this);
