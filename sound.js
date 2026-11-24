/* ============================================================
   Звук тарелки слов.

   Ни одного аудиофайла: весь звук синтезируется на лету через
   Web Audio, а «комната» — короткий синтетический хвост
   (свёртка с затухающим шумом) плюс музыкальное эхо.

   Главный принцип: всё в лад. Лад — до-мажорная пентатоника
   (до, ре, ми, соль, ля): любые два звука, взятые вместе,
   звучат ладно, поэтому никакое сочетание ударов не фальшивит.
   Все голоса — храповик, гул тарелки, звон фарфора, удары об пол,
   свист падения, колокольчики — настроены в этот лад и в одну
   тональность (до). Тарелка звучит как шкатулка, а не как шарманка.

   Что звучит:
      · храповик — золотая точка борта звякает СВОЕЙ нотой: у каждого
        из 12 секторов своя нота, и один оборот тарелки проигрывает
        мелодию-фразу, которая ладно закольцована. Каждое вращение берёт свою
         вариацию фразы (мотив, тот же мотив на ступень выше, спуск к
         основе), а на полном ходу, когда ноты идут часто, тарелка
         играет трезвучие тоники — ясное арпеджио вместо каши. Нота — маримбовая:
        основной тон, октава, квинта-подмешка на быстром ходу, тонкая
        стеклянная атака борта. На разгоне ноты короткие и частые —
        получается арпеджио; на торможении они длиннее и распеваются;
      · гул тарелки на штырьке — не шум и не гул «сам по себе», а
        поющий аккорд: основной тон едет за мелодией щелчков (с
        портаменто), над ним чистая квинта и октава, внизу тёплая
        подкладка. Тремоло = круг тарелки;
      · фарфор — звон тарелки настроен: несовершенные обертоны
        заменены на благозвучный ряд (тон, квинта, октава, дуодецима),
        как у поющей чаши, с лёгким биением двух близко настроенных
        голосов;
      · побег: соскок со штырька, свист падения глиссандо на квинту
        вниз, удары об пол — литавры: каждая посадка звучит своей
        нотой аккорда с характерным «подгибом» высоты. Качение —
        перестук, настроенный в тот же аккорд;
      · посадка на штырёк — мягкий «клак» по квинте и аккордовый
        выдох, после чего гул тарелки возвращается в тонику (до);
      · колокольчик выпавшего слова — та же нота, что тарелка спела
        на этом секторе, плюс квинта и октава; подтверждение —
        трёхнотная фраза; фанфары — восходящий пентатонический
        мотив и финальный аккорд; сброс — мелодия задом наперёд.

   Уровни можно проверить без ушей: SFX.selfTest() прогоняет каждый
   голос через OfflineAudioContext и возвращает пик и RMS по буферу.
   SFX.level() — текущий RMS на выходе мастер-шины (для замера
   живого вращения). SFX.tuningTest() проверяет, что голоса попадают
   в свои ноты (по ДПФ отрендеренного буфера).
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

/* ------------------------------ лад ------------------------------
   Ноты заданы числами MIDI: 60 = до первой октавы (C4).
   Пентатоника до-мажора: 0, 2, 4, 7, 9 полутонов от тоники. */
const hz=(midi)=>440*Math.pow(2, (midi-69)/12);
const PENT=[0,2,4,7,9];
/* Мелодия одного оборота: по ноте на каждый из 12 секторов. Она не
   случайный набор звуков, а построенная фраза: мотив A, тот же мотив
   на ступень выше A', и спуск к основе — фраза разрешается и ладно
   переходит в своё начало на следующем круге. Каждое вращение
   получает свою вариацию (мотив, основа и сдвиг A' выбираются наугад),
   но всегда в том же ладу и регистре, поэтому любая вариация звучит
   красиво и на полном ходу, и на последнем. Ступени лада считаются
   числами 0..8: 0 — до первой, 8 — соль второй. */
const MOTIFS=[[0,2,4,2],[0,4,3,1],[0,3,4,2],[0,1,2,1],[0,2,0],[0,3,1,2],[0,2,4,5,3],[0,4,2,1]];
const PH_OFF=[1,2,-3];             /* A': на ступень выше, на две, или чуть ниже */
const D_LO=0, D_HI=8;              /* регистр фразы */
const degMidi=(d)=>{ const dd=clamp(d|0, D_LO, D_HI); return 72+12*Math.floor(dd/5)+PENT[dd%5]; };
function buildPhrase(mi, base, off){
  const m=MOTIFS[((mi%MOTIFS.length)+MOTIFS.length)%MOTIFS.length];
  const d=[], add=(o)=>{ for(const s of m) d.push(clamp(base+o+s, D_LO, D_HI)); };
  add(0); add(off);
  const need=Math.max(0, 12-d.length);
  let cur=d[d.length-1];                           /* спуск идём от последней ноты,
                                                      чтобы прыжков через полторы октавы не было */
  for(let i=0;i<need;i++){
    const prev=d[d.length-1];
    if(i===need-1) cur=(prev===base)? base+3 : base;   /* разрешение: в тонику, а если она уже
                                                          звучит — в квинту над ней */
    else cur=(cur>base? cur-1 : cur+1);
    d.push(clamp(cur, D_LO, D_HI));
  }
  return d.slice(0,12);
}
const pick=(a)=>a[Math.floor(Math.random()*a.length)];
/* варианты перебираем только те, что не упираются в край регистра
   (иначе ноты повторяются и фраза буксует) и где стык A и A' не скачет
   больше чем на четыре ступени */
const BASES=[0,1,2,3,4];
const phraseChoices=(mi)=>{
  const m=MOTIFS[mi], hi=Math.max.apply(null, m);
  const b=BASES.filter(x=>x+hi<=D_HI);
  const out=[];
  for(let i=0;i<b.length;i++){
    const offs=PH_OFF.filter(o=>b[i]+o>=D_LO && b[i]+o+hi<=D_HI &&
                                Math.abs(o+m[0]-m[m.length-1])<=4);
    if(offs.length) out.push({base:b[i], offs:offs});
  }
  return out;
};
const pickPhraseIndex=()=>{
  const good=[];
  for(let mi=0;mi<MOTIFS.length;mi++) if(phraseChoices(mi).length) good.push(mi);
  return pick(good);
};
const randomPhrase=()=>{
  const mi=pickPhraseIndex(), ch=pick(phraseChoices(mi));
  return buildPhrase(mi, ch.base, pick(ch.offs));
};
const DEFAULT_PHRASE=buildPhrase(0, 0, 1);
let PHRASE=DEFAULT_PHRASE.slice();
/* тоника лада — до; на полном ходу тарелка играет её трезвучие, чтобы
   частые ноты не сливались, а складывались в ясное арпеджио */
const ROOT=60;                    /* тоника — до первой октавы */
const CORE=[60, 64, 67, 72, 76, 79, 84];
const BASS_SEQ=[55, 48, 52, 55];  /* соль-до-ми-соль: настройка перестука и посадок */
function coreNear(m){
  let best=CORE[0], bd=1e9;
  for(let i=0;i<CORE.length;i++){ const d=Math.abs(CORE[i]-m); if(d<bd){ bd=d; best=CORE[i]; } }
  return best;
}

function midiOf(sector){
  const n=PHRASE.length;
  const i=((sector%n)+n)%n;
  return degMidi(PHRASE[i]);
}
/* ближайшая нота пентатоники к произвольной частоте — чтобы любые
   «не музыкальные» вызовы (свист, перестук) попадали в лад */
function snapMidi(f, lo, hi){
  const m=Math.round(69+12*Math.log2(Math.max(20,f)/440));
  const mm=clamp(m, lo, hi);
  let best=mm, bd=1e9;
  for(let o=-1;o<=1;o++){
    for(let k=0;k<PENT.length;k++){
      const c=ROOT+o*12+PENT[k]+ (Math.floor((mm-ROOT)/12))*12;
      const cand=clamp(c, lo, hi);
      const d=Math.abs(cand-mm);
      if(d<bd){ bd=d; best=cand; }
    }
  }
  return best;
}

/* комната: затухающий шум плюс несколько ранних отражений,
   стерео-каналы не одинаковые — хвост шире и мягче */
function makeIR(ac, dur, decay){
  const n=Math.max(8, Math.floor(ac.sampleRate*dur));
  const b=ac.createBuffer(2, n, ac.sampleRate);
  const attack=Math.max(1, ac.sampleRate*0.004);
  const taps=[[0.011,0.5],[0.019,0.4],[0.027,0.33],[0.041,0.24],[0.063,0.16]];
  for(let c=0;c<2;c++){
    const d=b.getChannelData(c);
    const seedOff=c*0.37;
    for(let i=0;i<n;i++){
      const t=i/n;
      d[i]=(Math.random()*2-1)*Math.pow(1-t, decay)*(1-Math.exp(-i/attack));
    }
    for(let k=0;k<taps.length;k++){
      const idx=Math.floor(ac.sampleRate*(taps[k][0]+seedOff*0.02));
      if(idx<n) d[idx]+=taps[k][1]*(c? -1: 1);
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

  /* мастер: общий уровень + мягкая подкраска тембра + лимитер.
      низ чуть теплее, верхи чуть мягче — фарфор перестаёт резать */
  const master=ac.createGain(); master.gain.value=cfg.vol;
  const lowShelf=ac.createBiquadFilter(); lowShelf.type='lowshelf'; lowShelf.frequency.value=240; lowShelf.gain.value=1.8;
  const hiShelf=ac.createBiquadFilter(); hiShelf.type='highshelf'; hiShelf.frequency.value=7200; hiShelf.gain.value=-3.5;
  const lim=ac.createDynamicsCompressor();
  lim.threshold.value=-12; lim.knee.value=8; lim.ratio.value=8;
  lim.attack.value=0.003; lim.release.value=0.32;
  master.connect(lowShelf); lowShelf.connect(hiShelf); hiShelf.connect(lim); lim.connect(ac.destination);
  const tap=ac.createAnalyser(); tap.fftSize=1024; tap.smoothingTimeConstant=0.55;
  lim.connect(tap);
  E.master=master; E.tap=tap;

  /* хвост комнаты */
  const verb=ac.createConvolver(); verb.buffer=makeIR(ac, 1.6, 3.2);
  const verbTone=ac.createBiquadFilter(); verbTone.type='lowpass'; verbTone.frequency.value=4300;
  const wet=ac.createGain(); wet.gain.value=0.85;
  verb.connect(verbTone); verbTone.connect(wet); wet.connect(master);
  const send=ac.createGain(); send.connect(verb);

  /* музыкальное эхо: короткая нотированная задержка с обратной связью.
     Оно держит мелодию в воздухе и делает звучание объёмнее. */
  const echoIn=ac.createGain(); echoIn.gain.value=1;
  const dly=ac.createDelay(1.0); dly.delayTime.value=0.26;
  const fb=ac.createGain(); fb.gain.value=0.33;
  const fbLp=ac.createBiquadFilter(); fbLp.type='lowpass'; fbLp.frequency.value=2600; fbLp.Q.value=0.6;
  const echoOut=ac.createGain(); echoOut.gain.value=0.20;
  echoIn.connect(dly); dly.connect(fbLp); fbLp.connect(fb); fb.connect(dly);
  dly.connect(echoOut); echoOut.connect(master);

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
      Ручки пульта. Голоса внутри шин уже сведены между собой, так что
      общий баланс правится только здесь. Цифры проверены прогоном каждого
      голоса через OfflineAudioContext — SFX.selfTest() считает пик и RMS
      на мастер-шине: ни один звук не должен резать (клиппинг) и не должен
      быть тише шёпота. */
  const MIX={
    click: 2.9,    /* храповик: золотая точка звенит своей нотой */
    air:   2.0,    /* поющий гул тарелки на штырьке */
    roll:  1.0,    /* качение тарелки по полу */
    hit:   4.2,    /* фарфор и литавры: пуск, удары, звон, посадка */
    bell:  4.2,    /* колокольчики слов */
    ui:    14      /* кнопки, наведение, шелест пера */
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
  /* шина: сухая часть + посыл в комнату + посыл в музыкальное эхо */
  function wbus(amp, wetAmt, lpHz, echoAmt){
    const g=ac.createGain(); g.gain.value=amp;
    const top=(lpHz? filt('lowpass', lpHz, 0.7): null);
    if(top){ g.connect(top); top.connect(wheel); } else { g.connect(wheel); }
    if(wetAmt){ const s=gn(wetAmt); (top||g).connect(s); s.connect(send); }
    if(echoAmt){ const s=gn(echoAmt); (top||g).connect(s); s.connect(echoIn); }
    return g;
  }
  function bus(amp, wetAmt, echoAmt){
    const g=ac.createGain(); g.gain.value=amp; g.connect(master);
    if(wetAmt){ const s=gn(wetAmt); g.connect(s); s.connect(send); }
    if(echoAmt){ const s=gn(echoAmt); g.connect(s); s.connect(echoIn); }
    return g;
  }

  E.clickBus=wbus(MIX.click, 0.20, 0, 0.16);
  E.airBus  =wbus(MIX.air,   0.10, 0, 0.06);
  E.rollBus =wbus(MIX.roll,  0.10, 1400, 0.05);
  E.hitBus  =wbus(MIX.hit,   0.38, 0, 0.10);
  E.bellBus =wbus(MIX.bell,  0.50, 9500, 0.22);
  E.uiBus   =bus(MIX.ui,     0.06, 0.08);

  /* чистый тон с огибающей — кирпичик всей мелодии */
  function tone(t, f, amp, atk, dec, dest, type, lpHz){
    const o=ac.createOscillator(); o.type=type||'sine';
    o.frequency.setValueAtTime(Math.max(20, f), t);
    const g=gn(0); o.connect(g);
    if(lpHz){ const lp=filt('lowpass', lpHz, 0.7); g.connect(lp); lp.connect(dest); }
    else g.connect(dest);
    env(g, t, amp, atk, dec);
    o.start(t); o.stop(t+atk+dec+0.06);
    return {o:o, g:g};
  }
  /* тон, у которого высота едет от f0 к f1 (свист падения, подгиб литавр) */
  function glide(t, f0, f1, amp, atk, dec, dest, type){
    const n=tone(t, f0, amp, atk, dec, dest, type);
    n.o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t+atk+dec*0.8);
    return n;
  }

  /* набор обертонов. Раньше ряд был несовершенным — так звучит пластина,
      но фальшивит относительно мелодии. Теперь ряд благозвучный
      (тон, квинта, октава, большая децима, две октавы), а у основного
      тона два голоса чуть врозь на настройку — лёгкое биение, как у
      настоящего колокольчика или поющей чаши. */
  function partials(t, f0, ratios, decs, amp, dest, atkLen, beatCents){
    for(let i=0;i<ratios.length;i++){
      const f=f0*ratios[i]*rnd(0.9992, 1.0008);
      if(f>ac.sampleRate*0.45) continue;
      const a=amp*(i===0? 1: 0.75/(1+i*0.8));
      const o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f,t);
      const g=gn(0); o.connect(g); g.connect(dest);
      env(g,t, a, atkLen||0.002, decs[i]);
      o.start(t); o.stop(t+decs[i]+0.08);
      if(i===0 && beatCents){
        const o2=ac.createOscillator(); o2.type='sine';
        o2.frequency.setValueAtTime(f*Math.pow(2, beatCents/1200), t);
        const g2=gn(0); o2.connect(g2); g2.connect(dest);
        env(g2,t, a*0.8, atkLen||0.002, decs[i]*0.9);
        o2.start(t); o2.stop(t+decs[i]+0.08);
      }
    }
  }
  /* ряд поющей чаши: он благозвучен и длинно живёт */
  const BOWL=[1, 1.5, 2, 2.99, 4];
  function bowlDecs(scale){ return [1.9,1.45,1.1,0.78,0.5].map(d=>d*scale); }

  /* ---------------- храповик: золотая точка звенит нотой ----------------
      Каждому сектору принадлежит своя нота мелодии, поэтому оборот
      тарелки — это проигрывание фразы. Тембр — маримба/филигрань:
      основной тон, октава, на быстром ходу к ноте подмешивается
      квинта (получается арпеджио), и тонкая стеклянная атака борта. */
  let lastClick=-1, clickI=0, humMidi=ROOT;
  E.click=function(vn, sector, at){
    const t=(at==null? T() : at);
    if(t-lastClick<0.011) return;                 /* на полном ходу не сваливаемся в кашу */
    lastClick=t;
    const s=(sector==null? clickI++ : sector);
    clickI=s+1;
    const midi=midiOf(s), k=clamp(vn,0,1.3), mn=Math.min(1,k);
    /* на полном ходу ноты частые, и полная фраза слилась бы в кашу:
       там тарелка играет трезвучие тоники — ясное арпеджио.
       Чуть замедлилась — зазвучала вся фраза целиком */
    const play=(mn>0.8? coreNear(midi) : midi);
    const f=hz(play)*rnd(0.9995,1.0005);
    const amp=0.045+0.20*Math.min(1.05,k);
    /* на медленном ходу нота распевается длиннее, на быстром — короткая,
       иначе на 35 щелчках в секунду выйдет каша вместо арпеджио */
    const dec=0.30+0.60*(1-mn);
    tone(t, f, amp, 0.004, dec, E.clickBus, 'sine');
    tone(t, f*2, amp*0.32, 0.004, dec*0.62, E.clickBus, 'sine');
    if(mn>0.30) tone(t, f*3, amp*0.12*mn, 0.003, dec*0.34, E.clickBus, 'sine');
    if(mn>0.42){                                   /* квинта-подмешка: арпеджио на разгоне */
      const d2=0.012+rnd(0,0.008);
      tone(t+d2, f*1.5, amp*0.30*mn, 0.005, dec*0.75, E.clickBus, 'sine');
    }
    /* фарфор отзывается на каждый удар тонким стеклянным звоном борта */
    partials(t, f*4.1, [1,1.62,2.4], [0.11,0.075,0.05], 0.006+0.016*mn, E.clickBus, 0.001);
    /* атака: остриё по золотой точке, еле слышный щелчок */
    const s2=nz(), bp=filt('bandpass', 2600+2600*mn, 6), g=gn(0);
    s2.connect(bp); bp.connect(g); g.connect(E.clickBus);
    env(g,t, 0.010+0.024*mn, 0.0006, 0.013);
    s2.start(t, rnd(0,1.4)); s2.stop(t+0.08);
    /* гул тарелки тянется за мелодией */
    followHum(play);
  };

  /* ---------------- голос вращения: тарелка поёт на штырьке ----------------
      Никакого шума воздуха. Это живой аккорд: нижний тёплый голос,
      основной тон, который с портаменто идёт за нотой щелчка, чистая
      квинта над ним и октава-мерцание. Тремоло = круг тарелки,
      лёгкое вибрато = штырёк не идеально круглый. */
  const hSub=ac.createOscillator();  hSub.type='triangle';   /* тёплая подкладка */
  const hSubLp=filt('lowpass', 820, 0.9);
  const hA=ac.createOscillator();  hA.type='sine';
  const hB=ac.createOscillator();  hB.type='sine';        /* квинта */
  const hC=ac.createOscillator();  hC.type='sine';        /* октава-мерцание */
  const hSubG=gn(0.20), hAg=gn(0.46), hBg=gn(0.24), hCg=gn(0.10);
  const hMix=gn(1);
  hSub.connect(hSubLp); hSubLp.connect(hSubG);
  hA.connect(hAg); hB.connect(hBg); hC.connect(hCg);
  hSubG.connect(hMix); hAg.connect(hMix); hBg.connect(hMix); hCg.connect(hMix);
  const hTrem=gn(1), hLp=filt('lowpass', 900, 0.9), hG=gn(0);
  hMix.connect(hTrem); hTrem.connect(hLp); hLp.connect(hG); hG.connect(E.airBus);
  /* тремоло = круг тарелки */
  const brLfo=ac.createOscillator(); brLfo.type='sine'; brLfo.frequency.value=7;
  const brLfoG=gn(0.28); brLfo.connect(brLfoG); brLfoG.connect(hTrem.gain);
  /* вибрато: два медленных движения, тон «дышит», а не стоит на месте */
  const vibLfo=ac.createOscillator(); vibLfo.type='sine'; vibLfo.frequency.value=5.2;
  const vibG=gn(2); vibLfo.connect(vibG);
  const swLfo=ac.createOscillator(); swLfo.type='sine'; swLfo.frequency.value=0.23;
  const swG=gn(3); swLfo.connect(swG);
  [hA,hB,hC].forEach(o=>{ vibG.connect(o.frequency); swG.connect(o.frequency); });
  vibG.connect(hSub.frequency); swG.connect(hSub.frequency);
  hSub.start(); hA.start(); hB.start(); hC.start(); brLfo.start(); vibLfo.start(); swLfo.start();

  function humSet(midi, tau){
    const t=T(), f=hz(midi);
    hSub.frequency.setTargetAtTime(Math.max(40, f*0.5), t, tau);
    hA.frequency.setTargetAtTime(f, t, tau);
    hB.frequency.setTargetAtTime(f*1.4983, t, tau);   /* чистая квинта */
    hC.frequency.setTargetAtTime(f*2, t, tau);
  }
  function followHum(midi){
    const hm=midi-12;                              /* на октаву ниже щелчка */
    if(Math.abs(hm-humMidi)<=1) return;            /* уже там */
    humMidi=hm;
    humSet(hm, 0.14);
  }
  humSet(ROOT, 0.01);

  E.setSpeed=function(vn){
    const t=T(), k=clamp(vn,0,1.25), mn=Math.min(1,k);
    /* степени 2.2 хватает, чтобы на медленном ходу голоса почти не было */
    hG.gain.setTargetAtTime(k<0.04?0 : Math.pow(mn,2.2)*0.042, t, 0.10);
    /* чем быстрее ход, тем больше мерцающих верхних голосов */
    hCg.gain.setTargetAtTime(0.05+0.13*mn, t, 0.14);
    hBg.gain.setTargetAtTime(0.18+0.12*mn, t, 0.14);
    hLp.frequency.setTargetAtTime(760+1500*mn, t, 0.14);
    brLfo.frequency.setTargetAtTime(3.5+22*mn, t, 0.12);
    brLfoG.gain.setTargetAtTime(0.16+0.30*mn, t, 0.15);
    vibLfo.frequency.setTargetAtTime(4+14*mn, t, 0.15);
    vibG.gain.setTargetAtTime(1.5+7*mn, t, 0.15);
  };
  /* оседаем в тонику: тарелка замирает настроенной */
  E.restHum=function(){ humMidi=ROOT; humSet(ROOT, 0.5); };

  /* ---------------- мелодия вращения ----------------
      Каждое вращение — своя вариация фразы: новый мотив, другая основа,
      другой сдвиг второй копии мотива. Колокольчик выпавшего слова
      берёт ноту из ЭТОЙ же фразы, так что слово всегда «допевает» то,
      что тарелка спела на его секторе. */
  E.newPhrase=function(){
    PHRASE=randomPhrase();
    return PHRASE.map(degMidi);
  };
  E.setPhrase=function(p){ PHRASE=p.slice(0,12); return PHRASE.map(degMidi); };
  E.phrase=function(){ return PHRASE.map(degMidi); };

  /* ---------------- качение: перестук, настроенный в аккорд ---------------- */
  const rollSrc=nz(); rollSrc.loop=true;
  const rollLp=filt('lowpass', 300, 0.8), rollAm=gn(1), rollG=gn(0);
  rollSrc.connect(rollLp); rollLp.connect(rollAm); rollAm.connect(rollG); rollG.connect(E.rollBus);
  /* зерно качения: тарелка катится по неровностям пола */
  const rollLfo=ac.createOscillator(); rollLfo.type='sawtooth'; rollLfo.frequency.value=9;
  const rollLfoG=gn(0.4); rollLfo.connect(rollLfoG); rollLfoG.connect(rollAm.gain);
  /* чуть скрежета по полу, приглушённого и ненавязчивого */
  const rollScBp=filt('bandpass', 1500, 1.2), rollScG=gn(0);
  rollSrc.connect(rollScBp); rollScBp.connect(rollScG); rollScG.connect(E.rollBus);
  rollSrc.start(); rollLfo.start();

  function rollK(k){
    const t=T(); k=clamp(k,0,1);
    /* не ровный гул, а перестук: постель потише, зёрен пожиже и почаще */
    rollG.gain.setTargetAtTime(k<0.02?0 : 0.020+0.062*k, t, 0.09);
    rollLp.frequency.setTargetAtTime(300+700*k, t, 0.12);
    rollLfo.frequency.setTargetAtTime(7+30*k, t, 0.1);
    rollLfoG.gain.setTargetAtTime(k<0.02?0 : 0.35+0.55*k, t, 0.1);
    rollScG.gain.setTargetAtTime(k<0.2?0 : 0.003+0.010*k, t, 0.15);
  }
  E.setRoll=rollK;
  E.rollStop=()=>rollK(0);
  /* dist — путь тарелки в единицах viewBox; считаем его и рассыпаем удары */
  let rollDist=0, rollNext=rnd(30,90), rollI=0;
  E.rollGrain=function(dist, k){
    rollDist+=dist;
    if(rollDist<rollNext) return;
    rollDist=0; rollNext=rnd(24,70);
    thump(0.016+0.040*clamp(k,0,1), hz(BASS_SEQ[(rollI++)%BASS_SEQ.length]));
  };
  /* глухой короткий удар о пол (зёрна качения и мелкие посадки) */
  function thump(amp, f, at){
    const t=(at==null? T(): at);
    const m=snapMidi(f, 43, 60), f0=hz(m);
    const o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f0*1.08,t);
    o.frequency.exponentialRampToValueAtTime(f0, t+0.05);          /* мягко допевает в ноту */
    const g=gn(0); o.connect(g); g.connect(E.hitBus);
    env(g,t, amp, 0.003, 0.24); o.start(t); o.stop(t+0.45);
    tone(t, f0*2, amp*0.28, 0.003, 0.1, E.hitBus, 'sine');
    const s=nz(), lp=filt('lowpass', 750, 0.8), sg=gn(0);
    s.connect(lp); lp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, amp*0.26, 0.001, 0.028); s.start(t, rnd(0,1.4)); s.stop(t+0.1);
  }
  E.thump=thump;

  /* ---------------- фарфор: звон и удары ---------------- */
  /* звон самой пластины: настроенный ряд обертонов, как у поющей чаши.
      Тон задаётся тоникой лада, поэтому звон фарфора всегда в музыку. */
  let bowlI=0;
  E.ringPlate=function(power, at, midi){
    const t=(at==null? T(): at), p=clamp(power,0.02,1);
    const m=(midi==null? (bowlI%2? ROOT+12: ROOT) : midi);
    const f=hz(m)*rnd(0.999,1.001);
    partials(t, f, BOWL, bowlDecs(0.55+0.5*p), 0.012+0.045*p, E.hitBus, 0.004, 5);
    partials(t, f*3, [1,1.5,2], [0.42,0.28,0.18], 0.005+0.016*p, E.hitBus, 0.003);
  };
  /* удар об пол — литавра: своя нота аккорда и характерный подгиб высоты */
  E.impact=function(power, at){
    const t=(at==null? T(): at); power=clamp(power,0.05,1);
    const m=BASS_SEQ[(bowlI++)%BASS_SEQ.length], f0=hz(m);
    /* корпус: нота чуть выше и съезжает к своей — «та-а-м» */
    const o=ac.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(f0*1.22, t);
    o.frequency.exponentialRampToValueAtTime(f0, t+0.24);
    const g=gn(0); o.connect(g); g.connect(E.hitBus);
    env(g,t, 0.07+0.26*power, 0.005, 0.42); o.start(t); o.stop(t+0.75);
    tone(t, f0*2, (0.05+0.16*power)*0.4, 0.005, 0.22, E.hitBus, 'sine');
    /* шлепок об пол — приглушённый, без верхов, которые режут слух */
    const s=nz(), lp=filt('lowpass', 620+900*power, 0.9), sg=gn(0);
    s.connect(lp); lp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, 0.04+0.16*power, 0.0012, 0.075); s.start(t, rnd(0,1.4)); s.stop(t+0.3);
    /* и звон: по фарфору ударили всерьёз — он звенит в лад */
    partials(t, hz(ROOT)*rnd(0.999,1.001), BOWL, bowlDecs(0.62+0.5*power), 0.014+0.05*power, E.hitBus, 0.004, 4);
    tone(t, 55, 0.02*power, 0.004, 0.5, E.hitBus, 'sine');   /* гул комнаты */
  };
  /* короткий «динь»: штырёк, скоба, кронштейн — тоже в ладу */
  E.ping=function(power, at){
    const t=(at==null? T(): at), p=clamp(power,0.05,1);
    partials(t, hz(ROOT+24)*rnd(0.999,1.001), [1,1.5,2,2.99],
      [0.5,0.34,0.26,0.18], 0.012+0.042*p, E.hitBus, 0.002, 3);
    const s=nz(), bp=filt('bandpass', 3200, 6), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.012+0.04*p, 0.0006, 0.016); s.start(t, rnd(0,1.4)); s.stop(t+0.08);
  };
  /* свист падения: не писк, а нота, которая соскальзывает на квинту вниз */
  E.fall=function(dur, from, to, at){
    const t=(at==null? T(): at); dur=clamp(dur,0.06,1.5);
    const m1=snapMidi(from, 60, 84), m2=Math.max(55, m1-7);
    const f0=hz(m1), f1=hz(m2);
    const a=Math.min(0.045, 0.018+0.010*Math.max(0, m1-60));
    glide(t, f0, f1, a, 0.03, dur*0.85, E.hitBus, 'sine');
    glide(t, f0*1.5, f1*1.5, a*0.42, 0.035, dur*0.8, E.hitBus, 'sine');
    glide(t, f0*2, f1*2, a*0.16, 0.04, dur*0.6, E.hitBus, 'sine');
    const s=nz(), bp=filt('bandpass', f0*1.6, 4), sg=gn(0);
    bp.frequency.setValueAtTime(f0*1.6, t); bp.frequency.exponentialRampToValueAtTime(f1*1.6, t+dur);
    s.connect(bp); bp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, 0.022, 0.04, dur*0.75); s.start(t, rnd(0,1.4)); s.stop(t+dur+0.15);
  };
  /* шелест-волна: пуск тарелки, ударная волна при остановке, выдох.
      К шуму добавлен аккордовый подзвук — выдох звучит музыкально. */
  E.whoosh=function(power, f0, f1, dur, at){
    const t=(at==null? T(): at); power=clamp(power,0.02,1); dur=clamp(dur,0.06,2);
    const s=nz(), bp=filt('bandpass', f0, 0.9), g=gn(0);
    bp.frequency.setValueAtTime(f0,t); bp.frequency.exponentialRampToValueAtTime(Math.max(40,f1), t+dur);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.02+0.08*power, dur*0.16, dur*0.84);
    s.start(t, rnd(0,1.2)); s.stop(t+dur+0.12);
    /* подзвук: та же дуга частот, но тоном — слышна нота, а не только воздух */
    const lo=Math.min(f0,f1), hi=Math.max(f0,f1);
    const mA=snapMidi(hi, 55, 72), mB=snapMidi(lo, 48, 60);
    glide(t, hz(mA), hz(mB), 0.012+0.05*power, dur*0.2, dur*0.8, E.hitBus, 'triangle');
    tone(t+dur*0.35, hz(mB+7), 0.008+0.026*power, dur*0.2, dur*0.6, E.hitBus, 'sine');
  };
  /* подставка при взводе: вместо скрежета — струящийся струнный звук,
      который подтягивается на квинту вверх и в конце взвода звякает */
  E.creak=function(dur, at){
    const t=(at==null? T(): at); dur=clamp(dur,0.06,1);
    const f0=hz(57), f1=hz(64);                 /* ля-бемоль -> ми: подъём на квинту */
    const o=ac.createOscillator(); o.type='sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t+dur);
    const bp=filt('bandpass', 500, 3.2), lp=filt('lowpass', 1600, 0.9), trem=gn(0.6), g=gn(0);
    o.connect(bp); bp.connect(lp); lp.connect(trem); trem.connect(g); g.connect(E.hitBus);
    const lfo=ac.createOscillator(); lfo.type='sine'; lfo.frequency.setValueAtTime(6.5,t);
    const lg=gn(0.35); lfo.connect(lg); lg.connect(trem.gain);
    const vib=ac.createOscillator(); vib.type='sine'; vib.frequency.setValueAtTime(5.5,t);
    const vg=gn(6); vib.connect(vg); vg.connect(o.frequency);
    bp.frequency.setValueAtTime(420,t); bp.frequency.linearRampToValueAtTime(760, t+dur);
    env(g,t, 0.028, 0.05, dur*0.9);
    o.start(t); o.stop(t+dur+0.1); lfo.start(t); lfo.stop(t+dur+0.1); vib.start(t); vib.stop(t+dur+0.1);
    /* мягкий шелест по дереву, еле слышный */
    const s=nz(), sbp=filt('bandpass', 900, 2), sg=gn(0);
    s.connect(sbp); sbp.connect(sg); sg.connect(E.hitBus);
    env(sg,t, 0.012, 0.05, dur*0.8); s.start(t, rnd(0,1.2)); s.stop(t+dur+0.06);
    /* пружинка стрелки звякнет на конце взвода — нота лада */
    partials(t+dur*0.6, hz(76), [1,1.5,2.25], [0.16,0.11,0.07], 0.012, E.hitBus, 0.002);
  };

  /* ---------------- слова: колокольчики ---------------- */
  E.bell=function(freq, amp, dur, at){
    const t=(at==null? T(): at);
    const soft=1/(1+(freq/2600)*0.55);
    partials(t, freq, [1,1.5,2,2.99,4],
      [dur, dur*0.7, dur*0.52, dur*0.33, dur*0.2], amp*soft, E.bellBus, 0.006, 4);
    /* мягкая палочка в атаке */
    const s=nz(), bp=filt('bandpass', Math.min(9000, freq*4), 5), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.bellBus);
    env(g,t, amp*0.16*soft, 0.001, 0.02); s.start(t, rnd(0,1.4)); s.stop(t+0.06);
  };
  function chime(t, midi, amp, dur){ E.bell(hz(midi), amp, dur, t); }

  /* колокольчик слова = та же нота, что тарелка спела на этом секторе,
      плюс квинта и октава — аккорд, а не одинокий звонок */
  E.reveal=function(i){
    const t=T(), m=midiOf(i);
    chime(t, m, 0.075, 2.2);
    chime(t+0.09, m+7, 0.040, 1.8);
    chime(t+0.18, m+12, 0.020, 1.3);
    chime(t+0.01, ROOT, 0.018, 2.4);            /* тоника держит лад под нотой */
  };
  /* подтверждение: короткая фраза «вопрос-ответ» плюс чёрка пера */
  E.confirm=function(i){
    const t=T(), m=midiOf(i);
    chime(t, m-12, 0.042, 1.1);
    chime(t+0.11, m, 0.044, 1.25);
    chime(t+0.22, m+7, 0.034, 1.6);
    /* чёрка по слову: короткий шелест пера, настроенный по дуге вверх */
    const s=nz(), bp=filt('bandpass', 900, 1.4), g=gn(0);
    bp.frequency.setValueAtTime(900,t); bp.frequency.exponentialRampToValueAtTime(2940, t+0.18);
    s.connect(bp); bp.connect(g); g.connect(E.uiBus);
    env(g,t, 0.032, 0.03, 0.14); s.start(t, rnd(0,1.4)); s.stop(t+0.3);
  };
  /* все слова объяснены: восходящий мотив пентатоники и финальный аккорд */
  E.fanfare=function(){
    const t=T();
    const seq=[72,76,79,84,81,84,88];
    const off=[0,0.115,0.23,0.345,0.48,0.595,0.74];
    for(let k=0;k<seq.length;k++) chime(t+off[k], seq[k], 0.042+0.006*(k%2), 1.7);
    const t2=t+off[seq.length-1]+0.1;
    [72,76,79,84].forEach(m=>chime(t2, m, 0.026, 2.8));
    E.ringPlate(0.42, t2, ROOT);
    /* искры сверху: три ноты вниз, их подхватывает эхо */
    [91,88,84].forEach((m,k)=>chime(t2+0.34+k*0.12, m, 0.018, 1.1));
  };
  /* сброс: тарелка быстро прокручивается назад — мелодия задом наперёд */
  E.rewind=function(){
    const t=T();
    for(let k=0;k<12;k++) E.click(0.8-k*0.045, 11-k, t+k*0.058);
    E.whoosh(0.22, 1500, 420, 0.3, t);
    E.ringPlate(0.22, t+0.1, ROOT+12);
  };
  /* смена темы: светлая поднимается на квинту, тёмная опускается */
  E.theme=function(dark){
    const t=T();
    if(dark){ chime(t, 81, 0.04, 1.5); chime(t+0.09, 76, 0.03, 1.9); chime(t+0.18, 64, 0.016, 2.2); }
    else    { chime(t, 72, 0.038, 1.2); chime(t+0.09, 79, 0.03, 1.5); chime(t+0.18, 84, 0.018, 1.9); }
  };

  /* ---------------- интерфейс: всё в ладу ---------------- */
  E.ui=function(kind){
    const t=T();
    /* деревянная атака кнопки */
    const s=nz(), bp=filt('bandpass', kind==='back'? 900: 1600, 5), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.uiBus);
    env(g,t, 0.028, 0.0008, kind==='back'? 0.028: 0.013);
    s.start(t, rnd(0,1.4)); s.stop(t+0.08);
    if(kind==='back'){ glide(t, hz(72), hz(67), 0.022, 0.003, 0.16, E.uiBus, 'sine'); }
    else             { chime(t, 84, 0.02, 0.4); }
  };
  E.hover=function(kind){
    const t=T();
    if(kind==='dish'){
      /* навёл курсор на фарфор: еле слышный позвяк высокой нотой лада */
      const m=[84,86,88,91][Math.floor(Math.random()*4)];
      partials(t, hz(m)*rnd(0.995,1.005), [1,1.62,2.4], [0.07,0.05,0.03], 0.010, E.uiBus, 0.001);
      const s=nz(), bp=filt('bandpass', 5200, 7), g=gn(0);
      s.connect(bp); bp.connect(g); g.connect(E.uiBus);
      env(g,t, 0.010, 0.0008, 0.011); s.start(t, rnd(0,1.4)); s.stop(t+0.05);
    } else {
      tone(t, hz(79), 0.012, 0.002, 0.09, E.uiBus, 'sine');
    }
  };
  E.muteSfx=function(on){
    const t=T();
    if(on){ chime(t, 72, 0.028, 0.6); chime(t+0.08, 79, 0.024, 0.8); }
    else  { chime(t, 79, 0.028, 0.6); chime(t+0.08, 72, 0.024, 0.9); }
  };

  /* короткий щелчок пальцем по борту: пуск тарелки — это удар, а не дуновение */
  E.flick=function(power, at){
    const t=(at==null? T(): at), p=clamp(power,0.1,1);
    const s=nz(), bp=filt('bandpass', 1700*rnd(0.9,1.1), 3), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.026+0.044*p, 0.0008, 0.015); s.start(t, rnd(0,1.4)); s.stop(t+0.06);
    glide(t, hz(48)*1.1, hz(48), 0.018+0.026*p, 0.002, 0.16, E.hitBus, 'sine');
    tone(t, hz(60), 0.008+0.014*p, 0.002, 0.1, E.hitBus, 'sine');
  };
  E.spinStart=function(power){
    const t=T(), p=clamp(power,0.1,1);
    E.newPhrase();                                 /* новое вращение — новая вариация фразы */
    E.flick(p, t);                                 /* палец соскочил с борта */
    E.ringPlate(0.65*p, t+0.015, ROOT+12);
    /* тарелка трогается: гул поднимается на квинту вместе с первым кругом */
    humMidi=ROOT+7; humSet(ROOT+7, 0.12);
    tone(t+0.05, hz(72), 0.010+0.012*p, 0.02, 0.5, E.airBus, 'sine');
  };
  E.takeOff=function(){
    const t=T();
    E.ping(0.5, t);
    E.creak(0.22, t);
    E.fall(0.34, hz(76), hz(67), t+0.02);
    /* слёт со штырька: тон тарелки соскакивает вверх, как соскользящая струна */
    glide(t+0.03, hz(60), hz(72), 0.016, 0.02, 0.3, E.airBus, 'triangle');
  };
  E.jumpPush=function(){
    const t=T();
    E.whoosh(0.3, 300, 900, 0.16, t);
    const s=nz(), bp=filt('bandpass', 1300, 2), g=gn(0);
    s.connect(bp); bp.connect(g); g.connect(E.hitBus);
    env(g,t, 0.08, 0.004, 0.11); s.start(t, rnd(0,1.4)); s.stop(t+0.25);
    thump(0.20, hz(48), t);
  };
  E.settle=function(){
    const t=T();
    E.whoosh(0.25, 1100, 440, 0.16, t);             /* короткий выдох остановки */
    E.ping(0.45, t);
    /* села на штырёк: мягкий «клак» по квинте, а не глухая тычка */
    tone(t+0.01, hz(48), 0.10, 0.003, 0.22, E.hitBus, 'sine');
    tone(t+0.01, hz(55), 0.055, 0.003, 0.18, E.hitBus, 'sine');
    E.ringPlate(0.32, t, ROOT);
    E.restHum();                                    /* и гул оседает в тонику */
  };
  E.stopLayers=function(){ E.setSpeed(0); E.rollStop(); E.restHum(); };
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
  click:function(v, sector){ call('click', v, sector); },
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
    const jobs=runOffline({
      clickFast:  e=>e.click(1.0, 5),
      clickSlow:  e=>e.click(0.15, 2),
      clickRun:   e=>{ for(let k=0;k<12;k++) e.click(0.85, k, k*0.07); },
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
    }, 2.6);
    return jobs.then(list=>list.map(r=>({name:r.name, peak:+r.peak.toFixed(3), rms:+r.rms.toFixed(4), clip:r.peak>0.99})));
  },

  /* Проверка строя: рендерим голос, берём окно сразу после атаки (там
      ещё нет диффузного хвоста комнаты) и сравниваем энергию ровно на
      ожидаемой ноте с энергией на ноте, отстоящей на 100 центов. Если
      звук настроен — отношение большое; если фальшивит, оно около единицы. */
  tuningTest:function(){
    const D=DEFAULT_PHRASE.map(degMidi);
    const pin=(e)=>e.setPhrase(DEFAULT_PHRASE);
    const want={
      click0:  {e:e=>{ pin(e); e.click(0.5, 0); },   at:[D[0]],          tail:[0.02,0.22]},
      click5:  {e:e=>{ pin(e); e.click(0.5, 5); },   at:[D[5]],          tail:[0.02,0.22]},
      click9:  {e:e=>{ pin(e); e.click(0.5, 9); },   at:[D[9]],          tail:[0.02,0.22]},
      reveal7: {e:e=>{ pin(e); e.reveal(7); },       at:[D[7],D[7]+7,D[7]+12], tail:[0.05,0.35]},
      reveal2: {e:e=>{ pin(e); e.reveal(2); },       at:[D[2],D[2]+7,D[2]+12], tail:[0.05,0.35]},
      plate:   {e:e=>e.ringPlate(0.6),  at:[60,67,72,79], tail:[0.05,0.60]},
      thump:   {e:e=>e.thump(0.2, 120), at:[48],          tail:[0.06,0.20]},
      hum:     {e:e=>{ e.setSpeed(1); e.setSpeed(1); },   at:[60,67,72], tail:[0.60,1.60]},
      fanfare: {e:e=>e.fanfare(),       at:[72,76,79,84], tail:[0.98,1.30]}
    };
    const names=Object.keys(want);
    return Promise.all(names.map(name=>runOffline({x: want[name].e}, 2.6).then(list=>{
      const r=list[0], t0=want[name].tail[0], t1=want[name].tail[1];
      const rows=want[name].at.map(m=>{
        const f=hz(m);
        const on=bandEnergy(r.buf, r.rate, f, t0, t1);
        const off=bandEnergy(r.buf, r.rate, f*Math.pow(2, 100/1200), t0, t1);
        return {midi:m, hz:+f.toFixed(1), ratio:+(on/Math.max(1e-9, off)).toFixed(2), tuned:on>off*1.6};
      });
      return {name:name, ok:rows.every(x=>x.tuned), notes:rows};
    })));
  },

  /* прогон целого вращения тем же темпом, что в игре: разгон, восемь
      кругов с щелчками, торможение, посадка, колокольчик. Проверяет то,
      чего по отдельным голосам не видно: не клиппит ли вся тарелка сразу
      и стоит ли её шум в ладу (scaleRatio — отношение энергии в нотах
      пентатоники к энергии между нотами; больше единицы — звук музыкален) */
  spinTest:function(){
    const V_REF=0.55, T=7.6, TURNS=8, N=380, SECT=12;
    let clicks=0;
    return runOffline({x:e=>{
      e.spinStart(1);
      let prevSlot=0, prevRot=0;
      for(let i=1;i<=N;i++){
        const p=i/N, t=0.3+p*T;
        const rot=360*TURNS*(1-Math.pow(1-p,2));
        const v=(rot-prevRot)/(T*1000/N);          /* градусов на миллисекунду */
        prevRot=rot;
        e.setSpeed(v/V_REF);
        const slot=Math.round((((rot%360)+360)%360)/(360/SECT));
        if(slot!==prevSlot){ clicks++; e.click(v/V_REF, slot%SECT, t); prevSlot=slot; }
      }
      e.setSpeed(0); e.settle(); e.reveal(4);
    }}, 11).then(list=>{
      const r=list[0];
      const IN=[261.63,293.66,329.63,392,440,523.25,587.33,659.25,783.99,880];
      const OUT=[277.18,311.13,369.99,415.3,466.16,554.37,622.25,739.99,830.61,932.33];
      const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
      return {peak:+r.peak.toFixed(3), rms:+r.rms.toFixed(4), clip:r.peak>0.99,
              clicks:clicks, scaleRatio:+(avg(IN.map(f=>bandEnergy(r.buf,r.rate,f,0.3,8)))/
                                          avg(OUT.map(f=>bandEnergy(r.buf,r.rate,f,0.3,8)))).toFixed(2)};
    });
  },

  /* мелодия: генератор вариаций обязан держаться лада, регистра и
      умеренных прыжков — иначе «красиво всегда» не выйдет. Прогоняем
      несколько сотен вариаций и считаем нарушения. */
  phraseTest:function(){
    const PC=[0,2,4,7,9], T=400;
    let bad=0, maxJump=0, loopJump=0, triple=0; const seen=new Set();
    for(let k=0;k<T;k++){
      const p=randomPhrase();
      const m=p.map(degMidi);
      seen.add(m.join(','));
      if(m.length!==12){ bad++; continue; }
      for(let i=0;i<12;i++){
        if(m[i]<72 || m[i]>91 || PC.indexOf(m[i]%12)<0){ bad++; break; }
      }
      for(let i=0;i<11;i++) maxJump=Math.max(maxJump, Math.abs(m[i+1]-m[i]));
      for(let i=2;i<12;i++) if(m[i]===m[i-1] && m[i-1]===m[i-2]) triple++;
      loopJump=Math.max(loopJump, Math.abs(m[0]-m[11]));
    }
    return {tries:T, bad:bad, distinct:seen.size, maxJump:maxJump, loopJump:loopJump, tripleRun:triple};
  },

  /* что играется прямо сейчас (ноты текущей вариации фразы) */
  phrase:function(){ return E? E.phrase() : PHRASE.map(degMidi); },

  /* несколько вариаций подряд — посмотреть глазами, что генератор
      выдаёт фразы, а не набор звуков */
  phrases:function(n){
    const out=[];
    for(let k=0;k<(n||6);k++) out.push(randomPhrase().map(degMidi));
    return out;
  }
};

/* энергия сигнала на одной частоте: алгоритм Гёрцеля по окну [t0,t1) */
function bandEnergy(bufs, rate, f, t0, t1){
  const i0=Math.floor(rate*t0), i1=Math.min(bufs[0].length, Math.floor(rate*t1));
  const coeff=2*Math.cos(2*Math.PI*f/rate);
  let s1=0, s2=0;
  for(let i=i0;i<i1;i++){
    const v=(bufs[0][i]+(bufs[1]? bufs[1][i]:0))*0.5;
    const s0=v+coeff*s1-s2;
    s2=s1; s1=s0;
  }
  return Math.sqrt(Math.max(0, s1*s1+s2*s2-coeff*s1*s2))/(i1-i0);
}

/* прогон набора тестов через OfflineAudioContext: возвращает уровни
   и сам буфер (для проверки строя) */
function runOffline(tests, dur){
  const OAC=global.OfflineAudioContext||global.webkitOfflineAudioContext;
  if(!OAC) return Promise.reject(new Error('OfflineAudioContext нет'));
  const SR=44100;
  const names=Object.keys(tests);
  const out=[];
  return names.reduce((chain, name)=>chain.then(()=>{
    const oc=new OAC(2, Math.floor(SR*dur), SR);
    const e=makeEngine(oc);
    tests[name](e);
    return oc.startRendering().then(buf=>{
      let peak=0, sum=0, n=0;
      const chans=[];
      for(let c=0;c<buf.numberOfChannels;c++){
        const d=buf.getChannelData(c); chans.push(d);
        for(let i=0;i<d.length;i++){ const v=d[i]; const a=Math.abs(v); if(a>peak) peak=a; sum+=v*v; n++; }
      }
      out.push({name:name, peak:peak, rms:Math.sqrt(sum/n), buf:chans, rate:buf.sampleRate});
    });
  }), Promise.resolve()).then(()=>out);
}

/* вкладка свернута — контекст спит, а не жжёт процессор */
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{
    if(!ac) return;
    try{ if(document.hidden){ ac.suspend(); } else if(cfg.on){ ac.resume(); } }catch(e){}
  });
}

global.SFX=SFX;
})(typeof window!=='undefined'? window: this);
