'use strict';
/*
 * Serena Nihongo Arcade — no frameworks, CDNs, accounts, external fonts or API calls.
 * Learning loop: preview => contextual response => immediate feedback => delayed retry.
 * All UI input is delegated, so changing scenes leaves no orphaned listeners.
 */
(() => {
  const el = document.getElementById('app');
  const SCHEMA = 'serena_nihongo_arcade_v1';
  const ALL = Object.values(LESSONS).flat();
  const TOTAL = ALL.length;
  const BUILD_QUEUE = ALL.filter(q=>Array.isArray(q.build));
  const byId = Object.fromEntries(ALL.map(q => [q.id,q]));
  const defaults = () => ({best:0,cleared:{},seen:{},mistakes:{},difficulty:'beginner',level:'all',voiceSpeed:'slow',sound:true});
  let saved;
  try { saved = {...defaults(),...JSON.parse(localStorage.getItem(SCHEMA) || '{}')}; } catch { saved = defaults(); }
  for (const k of ['cleared','seen','mistakes']) if(!saved[k] || typeof saved[k] !== 'object' || Array.isArray(saved[k])) saved[k]={};
  if(!['beginner','normal','challenge'].includes(saved.difficulty)) saved.difficulty='beginner';
  if(!['all','n5','n4'].includes(saved.level)) saved.level='all';
  if(!['slow','normal'].includes(saved.voiceSpeed)) saved.voiceSpeed='slow';
  const state = {screen:'home',world:'airport',mode:'story',library:'airport',s:null,modal:null};
  let raf=null,autoAdvance=null,toastTimer=null,ac=null;
  const diffInfo={beginner:'입문 · 한국어 자막 · 25초',normal:'기본 · 자막 숨김 · 17초',challenge:'도전 · 자막 숨김 · 11초'};
  const difficultyTimes={beginner:25,normal:17,challenge:11};
  const $=sel=>document.querySelector(sel);
  const escapeHTML=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Math.max(0,Math.round(n||0)).toLocaleString('ko-KR');
  const pause = () => {if(raf!==null){cancelAnimationFrame(raf);raf=null;}if(autoAdvance!==null){clearTimeout(autoAdvance);autoAdvance=null;}};
  const persist=()=>{try{localStorage.setItem(SCHEMA,JSON.stringify(saved))}catch{ /* blocked/private storage: play still works */ } updateStats();};
  const updateStats=()=>{const kc=$('#known-count'),ts=$('#top-score'),sb=$('#sound-button'),label=document.querySelector('.mini-stat-name'); if(kc)kc.textContent=Object.keys(saved.seen).length; if(label)label.textContent=`/ ${TOTAL} 표현`; if(ts)ts.textContent=num(saved.best); if(sb)sb.textContent=saved.sound?'🔊':'🔇';};
  function sound(kind){
    if(!saved.sound) return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx)return;
      ac=ac||new Ctx();if(ac.state==='suspended')ac.resume().catch(()=>{});
      const notes=kind==='win'?[523,659,784]:kind==='miss'?[220,185]:kind==='boss'?[392,523,659,880]:[392,523];
      const start=ac.currentTime;
      notes.forEach((freq,i)=>{
        const o=ac.createOscillator(),g=ac.createGain();o.type=kind==='miss'?'triangle':'sine';o.frequency.setValueAtTime(freq,start+i*.095);
        g.gain.setValueAtTime(.0001,start+i*.095);g.gain.exponentialRampToValueAtTime(.075,start+i*.095+.014);
        g.gain.exponentialRampToValueAtTime(.0001,start+i*.095+.16);o.connect(g).connect(ac.destination);o.start(start+i*.095);o.stop(start+i*.095+.17);
      });
    }catch{ /* sound is decorative only */ }
  }
  function speak(phrase){
    if(!('speechSynthesis'in window)){toast('이 기기에는 일본어 음성 합성 기능이 없습니다.');return;}
    try{
      speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(phrase);u.lang='ja-JP';u.rate=saved.voiceSpeed==='slow'?.72:.96;u.pitch=1.04;u.volume=1;
      const voices=speechSynthesis.getVoices();const voice=voices.find(v=>v.lang.toLowerCase().startsWith('ja'));
      if(voice)u.voice=voice;
      speechSynthesis.speak(u);
    }catch{toast('음성 출력이 지원되지 않습니다. 텍스트로 학습할 수 있습니다.');}
  }
  function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2450);}
  function img(name,klass,alt){return `<img class="${klass}" src="assets/${name}.webp" alt="${escapeHTML(alt)}" draggable="false">`;}
  function world(id){return WORLDS.find(w=>w.id===id)||WORLDS[0]}
  function activeQuestions(id){return LESSONS[id].filter(q=>saved.level==='all'||q.level===saved.level);}
  function levelButtons(){return `<div class="level-buttons" role="group" aria-label="학습 단계 선택">${[['all','🌏 전체'],['n5','🌱 기초 · N5형'],['n4','🌸 응용 · N4형']].map(([k,t])=>`<button class="difficulty-btn ${saved.level===k?'active':''}" data-action="level" data-level="${k}" aria-pressed="${saved.level===k}">${t}</button>`).join('')}</div>`;}
  function stars(id){const n=saved.cleared[id]||0;return '★'.repeat(n)+'☆'.repeat(3-n)}
  function shuffle(list){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function top(){updateStats();window.scrollTo({top:0,behavior:'instant'});}
  function goHome(){pause();speechSynthesisSafeCancel();state.s=null;state.screen='home';renderHome();top();}
  function speechSynthesisSafeCancel(){try{window.speechSynthesis?.cancel()}catch{}}
  function titleLine(tag,title,desc){return `<div class="section-heading"><div><div class="section-tag">${tag}</div><h2>${title}</h2></div><div class="subtext">${desc}</div></div>`;}

  function renderHome(){
    state.screen='home';
    const totalSeen=Object.keys(saved.seen).length;
    const clearCount=Object.values(saved.cleared).filter(Boolean).length;
    el.innerHTML=`<div class="home-cover">
       <div class="cover-content"><div class="eyebrow">✦ JAPANESE CONVERSATION ARCADE · 2026</div>
         <h1>일본어 회화<br><em>어드벤처!</em></h1>
         <div class="subtitle-jp" lang="ja">日本語で、冒険しよう！</div>
         <p>여행과 출장, 학교·카페·쇼핑까지. <strong>읽기 → 듣기 → 조합하기</strong>로 실전 회화 반응을 키워 보세요.</p>
         <div class="cover-actions"><button class="primary" data-action="intro" data-world="classroom">▶ 회화 모험 시작</button><button class="secondary" data-action="rush">⚡ 60초 스피드 러시</button></div>
       </div>${img('serena-idle','cover-serena','안내 캐릭터 세레나')}${img('mascot-wave','cover-mascot','고양이 마스코트 마루')}
     </div>
     <div class="home-summary">
       <div class="summary-tile"><span class="tile-icon">💬</span><div><strong>${TOTAL}</strong><span>실전 회화 장면</span></div></div>
       <div class="summary-tile"><span class="tile-icon">📖</span><div><strong>${totalSeen} / ${TOTAL}</strong><span>학습한 대화</span></div></div>
       <div class="summary-tile"><span class="tile-icon">🎖️</span><div><strong>${clearCount} / ${WORLDS.length}</strong><span>클리어한 여행지</span></div></div>
     </div>
     <div class="training-panel card-glass"><div><div class="section-tag">YOUR LEVEL / 내 학습 단계</div><h2>나에게 맞는 회화 선택</h2><p>기초는 짧고 친숙한 표현, 응용은 조건·권유·정중한 부탁을 연습해요. JLPT 등급은 편의를 위한 대략적 구분입니다.</p>${levelButtons()}</div><div class="sound-settings"><strong>🔊 발음 재생 속도</strong><div class="difficulty-bar"><button class="difficulty-btn ${saved.voiceSpeed==='slow'?'active':''}" data-action="voice-speed" data-speed="slow">🐢 천천히</button><button class="difficulty-btn ${saved.voiceSpeed==='normal'?'active':''}" data-action="voice-speed" data-speed="normal">🎶 보통</button></div><small>브라우저 일본어 음성(TTS) 사용 · 기기마다 차이 있음</small></div></div>
     <div class="mode-grid"><button class="mode-card" data-action="listen"><span>🎧</span><strong>리스닝 챌린지</strong><small>일본어 음성을 듣고 상황에 맞게 응답하기</small></button><button class="mode-card" data-action="builder"><span>🧩</span><strong>문장 조립 배틀</strong><small>N5형 기초 문장을 조합하며 어순 익히기</small></button><button class="mode-card" data-action="rush"><span>⚡</span><strong>스피드 러시</strong><small>60초간 가장 빠르고 정확하게 대답하기</small></button></div>
     ${titleLine('SELECT DESTINATION','학습할 장소를 선택하세요','원하는 장소부터 시작할 수 있어요. 현재 단계의 문장이 출제됩니다.')}
     <div class="world-grid">${WORLDS.map((w,i)=>`<button class="world-card" data-action="intro" data-world="${w.id}" aria-label="${escapeHTML(w.name)} 시작">
         <div class="world-thumb" style="background-image:url('assets/bg-${w.id}.webp')"><span class="world-emoji">${w.emoji}</span><span class="world-stars">${stars(w.id)}</span></div>
         <div class="world-info"><small>CHAPTER ${String(i+1).padStart(2,'0')} · ${w.jp} · ${activeQuestions(w.id).length}문장</small><h3>${w.name}</h3><p>${w.sub}</p></div></button>`).join('')}</div>
     <div class="bottom-actions"><button class="secondary" data-action="review">🔁 틀린 표현 다시 도전 <b>(${Object.keys(saved.mistakes).length})</b></button>
       <button class="secondary" data-action="library">📒 ${TOTAL}문장 회화 도감</button><button class="secondary" data-action="howto">🎮 게임 방법 / 발음 설정</button><button class="secondary" data-action="gallery">🎨 게임 콘셉트 아트</button></div>`;
  }
  function intro(worldId){
    pause();state.world=worldId;state.screen='intro';const w=world(worldId),qs=activeQuestions(worldId);
    el.innerHTML=`<div class="intro-banner" style="background-image:url('assets/bg-${w.id}.webp')"><div>
      <div class="eyebrow">${w.emoji} ${escapeHTML(w.jp)} · CHAPTER ${WORLDS.indexOf(w)+1}</div><h1>${escapeHTML(w.title)}</h1>
      <p>${escapeHTML(w.skill)}<br>총 ${qs.length}문장 · 마지막은 챕터 보스 대화!</p></div>${img('serena-idle','','세레나')}</div>
    <div class="intro-frame">
      <div class="intro-card card-glass"><div class="section-tag">WARM UP / 시작 전 입에 익히기</div><h2>이 표현들을 먼저 만나 보세요</h2>
      <div class="warm-grid">${qs.slice(0,4).map(q=>`<div class="warm-card"><div class="jp" lang="ja">${escapeHTML(q.ans)}</div><div class="roman">${escapeHTML(q.ansRoma)}</div><div class="ko">${escapeHTML(q.ansKo)}</div></div>`).join('')}</div>
      <p class="subtext">정답을 외우기보다는 상황에 맞게 대답할 수 있는지 게임에서 확인하세요.</p></div>
      <div class="intro-side card-glass"><div><div class="section-tag">SELECT DIFFICULTY</div><h3>학습 난이도</h3></div>
        ${levelButtons()}<div class="difficulty-bar">${Object.entries(diffInfo).map(([k,v])=>`<button class="difficulty-btn ${saved.difficulty===k?'active':''}" data-action="difficulty" data-difficulty="${k}" title="${v}">${k==='beginner'?'🌱 입문':k==='normal'?'🌸 기본':'🔥 도전'}</button>`).join('')}</div>
        <p>${diffInfo[saved.difficulty]}<br><b>${saved.level==='all'?'전체':saved.level.toUpperCase()+'형'}</b> ${qs.length}문장. 정답을 틀리면 하트가 줄어들고, 한 번 더 등장해요.</p>
        <button class="primary" data-action="begin" data-world="${w.id}">⚔️ 대화 미션 시작!</button><button class="quiet" data-action="home">← 여행 지도 보기</button>
      </div></div>`;
    top();
  }
  function findQuestion(qid){return byId[qid]||ALL[0]}
  function startSession(mode,worldId,oneId){
    pause();speechSynthesisSafeCancel();
    const missing=Object.keys(saved.mistakes).filter(id=>byId[id]);
    let questions;
    if(oneId)questions=[findQuestion(oneId)];
    else if(mode==='rush')questions=shuffle(ALL.filter(q=>saved.level==='all'||q.level===saved.level));
    else if(mode==='listen')questions=shuffle(ALL.filter(q=>saved.level==='all'||q.level===saved.level)).slice(0,12);
    else if(mode==='builder')questions=shuffle(BUILD_QUEUE).slice(0,10);
    else if(mode==='review')questions=shuffle(missing.length?missing.map(id=>byId[id]):ALL.filter(q=>saved.level==='all'||q.level===saved.level).slice(0,10));
    else questions=[...activeQuestions(worldId)];
    state.mode=mode;state.world=worldId||questions[0].world;state.screen='game';
    state.s={queue:questions.slice(),originalCount:questions.length,idx:0,attempted:new Set(),missedOnce:new Set(),retryAdded:new Set(),round:0,hearts:3,score:0,streak:0,bestStreak:0,perfect:0,recovered:0,wrong:0,answered:false,hint:false,selected:-2,order:[],picked:[],pieceOrder:[],deadline:0,remaining:0,rushDeadline:mode==='rush'?performance.now()+60000:0,pausedRemaining:0,pausedRushRemaining:0};
    nextQuestion();top();
  }
  function nextQuestion(){
    pause();const s=state.s;if(!s)return;
    if(s.hearts<=0 || s.idx>=s.queue.length || (s.rushDeadline && performance.now()>=s.rushDeadline)){finish();return;}
    s.current=s.queue[s.idx];s.order=shuffle([0,1,2]);s.picked=[];s.pieceOrder=s.current.build?shuffle(s.current.build.map((_,i)=>i)):[];s.selected=-2;s.answered=false;s.hint=false;s.round+=1;s.remaining=state.mode==='rush'?9:state.mode==='builder'?30:state.mode==='listen'?20:difficultyTimes[saved.difficulty];
    s.deadline=performance.now()+s.remaining*1000;
    renderGame();raf=requestAnimationFrame(tick);
    if(state.mode==='listen')speak(s.current.npc);
  }
  function tick(){
    const s=state.s;if(!s||s.answered||state.screen!=='game')return;
    let remain=Math.max(0,s.deadline-performance.now());
    if(state.mode==='rush')remain=Math.min(remain,Math.max(0,s.rushDeadline-performance.now()));
    const t=$('#timer-value'),bar=$('#timer-bar');
    if(t)t.textContent=(remain/1000).toFixed(1);
    if(bar){const percentage=Math.max(0,remain/(s.remaining*1000)*100);bar.style.width=percentage+'%';bar.classList.toggle('danger',percentage<27);}
    if(remain<=0){choose(-1);return;}
    raf=requestAnimationFrame(tick);
  }
  function renderGame(){
    const s=state.s,q=s.current,w=world(q.world),answered=s.answered;
    const builder=state.mode==='builder',listening=state.mode==='listen';
    const n=s.attempted.size;
    const progressText=state.mode==='rush'?`${Math.ceil(Math.max(0,s.rushDeadline-performance.now())/1000)}초 러시`:`${Math.min(n,s.originalCount)} / ${s.originalCount} 대화`;
    const beginner=saved.difficulty==='beginner' && !['rush','listen'].includes(state.mode);
    const subtitleVisible=answered||s.hint||beginner;
    const showQuestion=!listening||answered||s.hint;
    const boss=state.mode==='story' && s.idx===s.originalCount-1;
    const durationPct=Math.max(0,Math.min(100,(s.deadline-performance.now())/(s.remaining*1000)*100));
    const dialogBody=showQuestion?`<div lang="ja" class="dialog-jp">${escapeHTML(q.npc)}</div>`:
      `<div class="listening-placeholder"><span class="ear-icon">🎧</span><strong>소리를 듣고 대답해 보세요!</strong><small>일본어 문장을 가리고 있습니다. 듣기가 안 되면 🔊 듣기를 눌러 주세요.</small></div>`;
    const chunks=builder?`<div class="builder-answer" role="status" aria-live="polite"><div class="builder-label">내가 만든 문장</div><div class="builder-sentence" lang="ja">${s.picked.length?s.picked.map(i=>escapeHTML(q.build[i])).join(''):'아래 일본어 조각을 순서대로 눌러 보세요.'}</div></div>
      <div class="builder-pieces" role="group" aria-label="문장 조합 재료">${s.pieceOrder.map((index,displayIndex)=>`<button class="builder-piece" data-action="build-piece" data-index="${index}" ${s.picked.includes(index)||answered?'disabled':''} aria-label="${displayIndex+1}번 조각 ${escapeHTML(q.build[index])}"><span class="option-index">${displayIndex+1}</span><span lang="ja">${escapeHTML(q.build[index])}</span></button>`).join('')}</div>
      <div class="builder-controls"><button class="secondary" data-action="build-undo" ${!s.picked.length||answered?'disabled':''}>↩ 마지막 조각 취소</button><button class="primary" data-action="build-submit" ${s.picked.length!==q.build.length||answered?'disabled':''}>✨ 문장 완성 · 제출</button></div>`:'';
    const choices=builder?chunks:`<div class="choices">${s.order.map((index,displayIndex)=>{
      const [jp,ko]=q.choices[index];let css='answer-option';
      if(answered){if(index===0)css+=' correct';if(index===s.selected&&index!==0)css+=' wrong';}
      return `<button class="${css}" data-action="answer" data-index="${index}" ${answered?'disabled':''} aria-label="선택지 ${displayIndex+1}, ${escapeHTML(jp)}"><span class="option-index">${displayIndex+1}</span><span><span class="option-jp" lang="ja">${escapeHTML(jp)}</span>${s.hint||answered?`<div class="option-ko">${escapeHTML(ko)}</div>`:''}</span></button>`;
    }).join('')}</div>`;
    el.innerHTML=`<div class="game-hud">
      <div class="hud-left"><button class="back-button" data-action="home" title="여행 지도로 돌아가기">← 지도</button>
       <span class="hud-small">${w.emoji} ${escapeHTML(w.name)} ${boss?'👑 BOSS TALK':''} <span class="level-chip">${q.level==='n4'?'N4형':'N5형'}</span></span></div>
      <div class="hud-right"><span class="hud-small">${progressText}</span><span class="hud-hearts" aria-label="남은 하트 ${s.hearts}개">${'❤️'.repeat(s.hearts)}${'🖤'.repeat(3-s.hearts)}</span><span class="hud-score">${num(s.score)}p</span></div>
    </div>
    <div class="timer-wrap" aria-label="남은 시간"><div id="timer-bar" class="timer-bar ${durationPct<27?'danger':''}" style="width:${durationPct}%"></div></div>
    <div class="arena ${listening?'listening-arena':''}" id="arena" style="background-image:url('assets/bg-${w.id}.webp')">
      <div class="petal-field" aria-hidden="true">${Array.from({length:10},(_,i)=>`<span class="petal" style="--i:${i};--delay:${((i*3)%13)*-.7}s"></span>`).join('')}</div>
      ${img(`npc-${w.id}`,'arena-npc',w.npc)}
      ${img(answered&&s.selected===0?'serena-cheer':'serena-idle',`arena-serena ${answered?(s.selected===0?'cheer':'fail'):''}`,'세레나')}
      <div class="dialog-card"><div class="speaker-label">${escapeHTML(w.npc)}<button class="speaker-btn" data-action="speak-npc" title="일본어 발음 듣기" aria-label="상대방 일본어 듣기">🔊 ${listening?'다시 듣기':'듣기'}</button></div>
        ${dialogBody}
        ${subtitleVisible?`<div class="dialog-kana" lang="ja">${escapeHTML(q.kana)}</div><div class="dialog-romaji">${escapeHTML(q.roma)}</div><div class="dialog-ko">${escapeHTML(q.ko)}</div>`:
          `<div class="dialog-hidden">${listening?'음성부터 듣고, 필요할 때 힌트를 눌러 문장을 확인하세요.':'뜻이 궁금하면 아래 힌트 버튼을 누르세요.'}</div>`}
      </div><div class="nameplate npc">${escapeHTML(w.npc)}</div><div class="nameplate player">✦ 세레나의 회화 가이드</div>
    </div>
    <section class="game-body"><div class="task-label"><span>${builder?'🧩 조각을 올바른 순서로 배치해 일본어 대답을 완성하세요!':listening?'🎧 상대방의 일본어를 듣고 자연스럽게 대답하세요!':'⚡ 가장 자연스러운 일본어 대답을 선택하세요!'}</span>
      ${!answered?`<div class="hint-tools"><button class="secondary" data-action="hint" ${s.hint?'disabled':''} title="한국어 뜻 표시, 점수 -20">💡 ${listening?'문장 보기':'힌트'} −20p</button></div>`:`<span class="hud-combo">${s.streak>=2?`🔥 ${s.streak} COMBO!`:''}</span>`}</div>
      ${choices}
      ${answered?`<div class="feedback ${s.selected===0?'':'failed'}" role="status"><div><h3>${s.selected===0?'✨ 대화 성공!':'💫 이번 표현은 다시 기억해요'}</h3>
          <strong lang="ja">${escapeHTML(q.ans)}</strong><div class="roma">${escapeHTML(q.ansRoma)}</div><div class="meaning">${escapeHTML(q.ansKo)}</div>
          <div class="tip">🧠 ${escapeHTML(q.tip)}</div><button class="quiet" data-action="speak-answer">🔊 정답 발음 듣기</button></div>
          <button class="primary" data-action="next">${s.idx+1>=s.queue.length?'🏁 결과 보기':'다음 대화 ▶'}</button></div>`:''}
      <div class="note">🎮 ${builder?'조각 클릭 / 숫자키 1~4 · Backspace 취소 · Enter 제출':`숫자키 1 / 2 / 3 선택 · H 힌트 · S 듣기 · Enter 다음`} · Esc 지도</div>
    </section>`;
    if(builder&&answered){ /* keep selected chunks visible; feedback explains their correct order */ }
  }
  function buildPiece(index){
    const s=state.s;if(!s||state.screen!=='game'||state.mode!=='builder'||s.answered)return;
    if(!Number.isInteger(index)||index<0||index>=s.current.build.length||s.picked.includes(index))return;
    s.picked.push(index);renderGame();
  }
  function undoPiece(){const s=state.s;if(!s||s.answered||state.mode!=='builder')return;s.picked.pop();renderGame();}
  function submitBuild(){
    const s=state.s;if(!s||s.answered||state.mode!=='builder'||s.picked.length!==s.current.build.length)return;
    choose(s.picked.map(i=>s.current.build[i]).join('')===s.current.ans?0:-1);
  }
  function choose(originalIndex){
    const s=state.s;if(!s||s.answered||state.screen!=='game')return;
    if(raf!==null){cancelAnimationFrame(raf);raf=null;}
    const q=s.current,correct=originalIndex===0,isFirst=!s.attempted.has(q.id);
    s.attempted.add(q.id);s.answered=true;s.selected=originalIndex;
    if(correct){
      let gain=100+Math.round(Math.max(0,s.deadline-performance.now())/(s.remaining*1000)*60)+Math.min(100,s.streak*15);
      
      s.streak+=1;s.bestStreak=Math.max(s.streak,s.bestStreak);s.score+=gain;
      if(isFirst&&!s.hint){s.perfect++;}else if(s.missedOnce.has(q.id)){s.recovered++;}
      saved.seen[q.id]=Date.now();delete saved.mistakes[q.id];
      saved.best=Math.max(saved.best,s.score);sound((state.mode==='story'&&s.idx===s.originalCount-1)?'boss':'win');
    }else{
      s.hearts-=1;s.streak=0;s.wrong+=1;s.missedOnce.add(q.id);saved.mistakes[q.id]=(saved.mistakes[q.id]||0)+1;
      if(['story','builder'].includes(state.mode)&&!s.retryAdded.has(q.id)&&s.hearts>0){s.queue.push(q);s.retryAdded.add(q.id);}
      sound('miss');
    }
    persist();renderGame();
    if(correct)particles();
    if(state.mode==='rush')autoAdvance=setTimeout(()=>{if(state.screen==='game'&&state.s?.answered)advance()},1100);
  }
  function particles(){const scene=$('#arena');if(!scene)return;for(let i=0;i<19;i++){
    const e=document.createElement('span');e.className='particle';
    e.style.left=(39+Math.random()*22)+'%';e.style.top=(43+Math.random()*18)+'%';
    e.style.setProperty('--dx',(Math.random()*420-210)+'px');e.style.setProperty('--dy',(Math.random()*-330+70)+'px');
    scene.appendChild(e);setTimeout(()=>e.remove(),900);
  }}
  function hint(){const s=state.s;if(!s||s.answered||s.hint)return;s.hint=true;s.score=Math.max(0,s.score-20);renderGame();toast('한국어 자막과 선택지 뜻을 열었습니다.');}
  function advance(){const s=state.s;if(!s||!s.answered)return;pause();s.idx++;nextQuestion();}
  function finish(){
    pause();speechSynthesisSafeCancel();const s=state.s;if(!s)return;
    state.screen='result';const w=world(state.world),story=state.mode==='story';
    const completed=story&&s.hearts>0&&s.attempted.size>=s.originalCount&&s.idx>=s.originalCount;
    const starsEarned=completed?(s.perfect>=s.originalCount?3:s.perfect>=Math.ceil(s.originalCount*.7)?2:1):0;
    if(story) saved.cleared[w.id]=Math.max(saved.cleared[w.id]||0,starsEarned);
    saved.best=Math.max(saved.best,s.score);persist();
    const outcome=state.mode==='rush'?'스피드 러시 종료!':state.mode==='listen'?'리스닝 챌린지 결과':state.mode==='builder'?'문장 조립 배틀 결과':completed?'미션 완료!':s.hearts<=0?'하트를 모두 소진했어요':'대화 훈련 완료!';
    el.innerHTML=`<div class="result-banner" style="background-image:url('assets/bg-${w.id}.webp')"><div>
       <div class="section-tag">MISSION RESULT / ${state.mode.toUpperCase()}</div><h1>${escapeHTML(outcome)}</h1>
       <div class="stars-big" aria-label="${starsEarned}성 획득">${'★'.repeat(starsEarned)}${'☆'.repeat(3-starsEarned)}</div>
       <p class="subtext">${story?`${w.name}에서 배운 표현을 실제 생활에서도 써보세요.`:'짧은 반복으로 즉시 대답하는 연습을 했습니다.'}</p>
     </div>${img('serena-cheer','','칭찬하는 세레나')}</div>
    <div class="result-shell"><div class="result-kpi card-glass"><b>${num(s.score)} p</b><span>이번 획득 점수</span></div>
      <div class="result-kpi card-glass"><b>${s.perfect}</b><span>힌트 없이 첫 시도 정답</span></div>
      <div class="result-kpi card-glass"><b>${s.bestStreak}</b><span>최고 연속 콤보</span></div></div>
    <div class="result-tips card-glass"><h3>💌 세레나의 학습 리포트</h3>
       <p>${s.wrong?`틀린 답 ${s.wrong}회가 기록되었습니다. 틀린 문장은 복습 모드에서 다시 만나세요.`:'모든 응답을 잘 연결했습니다! 다음 장소에 도전해도 좋습니다.'}
       ${s.recovered?` 다시 등장한 표현 ${s.recovered}개를 성공적으로 익혔습니다.`:''}
       ${story&&!completed?' 하트가 소진되어 클리어 별은 지급되지 않았습니다. 천천히 재도전해 보세요.':''}</p></div>
    <div class="result-buttons"><button class="primary" data-action="retry">↻ 다시 도전</button>
      ${story?`<button class="secondary" data-action="next-world">▶ 다음 여행지</button>`:''}<button class="secondary" data-action="review">🔁 복습</button>
      <button class="secondary" data-action="home">🗺️ 여행 지도로</button></div>`;
    top();
  }
  function renderLibrary(){
    pause();state.screen='library';const w=world(state.library);const qs=activeQuestions(w.id);
    el.innerHTML=`${titleLine('THE PHRASE COLLECTION','일본어 회화 도감','상황 · 일본어 · 읽기 · 뜻을 한 번에 복습하세요.')}
      <div class="library-toolbar">${levelButtons()}${WORLDS.map(a=>`<button class="difficulty-btn ${state.library===a.id?'active':''}" data-action="library-world" data-world="${a.id}">${a.emoji} ${a.name}</button>`).join('')}
      <button class="secondary" data-action="home">← 돌아가기</button></div>
      <div class="section-tag" style="margin:15px 0">${w.jp} / ${escapeHTML(w.sub)}</div>
      <div class="library-items">${qs.map((q,i)=>`<article class="phrase"><div class="phrase-head"><span>#${String(i+1).padStart(2,'0')} · ${q.level.toUpperCase()}형 · ${saved.seen[q.id]?'✅ 학습':'○ 미학습'}</span>
        <span>${saved.mistakes[q.id]?'🔁 복습 필요':''}</span></div>
        <div class="jp" lang="ja">${escapeHTML(q.npc)}</div><div class="kana" lang="ja">${escapeHTML(q.kana)}</div><div class="kana">${escapeHTML(q.roma)}</div>
        <div class="ko">${escapeHTML(q.ko)}</div><div class="phrase-answer"><strong lang="ja">↪ ${escapeHTML(q.ans)}</strong>
        <div class="rom">${escapeHTML(q.ansRoma)}</div><p>${escapeHTML(q.ansKo)}</p></div>
        <button class="secondary" data-action="speak-phrase" data-id="${q.id}">🔊 대화 듣기</button>
        <button class="secondary" data-action="practice-one" data-id="${q.id}">⚔️ 연습</button>
      </article>`).join('')}</div>`;
    top();
  }
  function howto(){
    pause();state.screen='howto';el.innerHTML=`<div class="howto card-glass"><div class="section-tag">GAME GUIDE</div><h2>🎮 일본어 회화를 게임으로 익히는 법</h2>
    <p>이 게임은 상대방의 말 이해 → 자연스러운 일본어 대답 선택 → 정답 확인 → 틀린 표현 재도전 순서로 진행됩니다. 문법 문제보다 실제 대화 대응력을 우선합니다.</p>
    <ol><li><b>회화 단계:</b> N5형 기초 / N4형 응용은 학습 편의를 위한 대략적인 수준 구분입니다. 공식 JLPT 문항 구분은 아닙니다.</li><li><b>장소 선택:</b> 공항·전철·호텔·식당·일본 특허청·교실·편의점·카페·쇼핑 중 하나를 선택합니다.</li>
    <li><b>입문 모드:</b> 일본어, 히라가나, 로마자, 한국어 뜻을 함께 봅니다. 25초 제한입니다.</li>
    <li><b>기본·도전 모드:</b> 한국어 자막이 가려지고 제한 시간이 17초·11초로 짧아집니다.</li>
    <li><b>힌트:</b> 점수 20점을 써서 한국어 자막과 선택지의 뜻을 표시합니다.</li>
    <li><b>틀린 문제:</b> 하트 한 개를 잃고, 챕터 마지막에 한 번 더 등장합니다.</li>
    <li><b>60초 러시:</b> 모든 상황이 무작위로 나오고, 60초 동안 빠르게 대답합니다.</li><li><b>리스닝 챌린지:</b> 질문을 가리고 TTS 음성을 듣고 대답합니다. 음성이 들리지 않으면 듣기 버튼을 다시 누르거나 힌트로 글자를 펼치세요.</li><li><b>문장 조립 배틀:</b> 정답 문장을 조각으로 직접 만들며, 순서가 틀렸을 때 정답과 비교합니다.</li></ol>
    <h2>🔊 발음과 오프라인 사용</h2><p>일본어 발음 버튼은 브라우저 기기에 설치된 음성 합성(TTS)을 이용합니다. 일본어 음성이 설치되어 있지 않거나 해당 환경에서 지원되지 않는 경우 발음이 재생되지 않을 수 있습니다. <b>게임 자체는 인터넷 없이 작동하며</b>, 효과음은 Web Audio API로 만듭니다. PC에서는 숫자키 1·2·3, H(힌트), S(듣기), Enter(다음), Esc(지도)를 사용하세요.</p>
    <p>발음 속도는 메인 화면에서 '천천히/보통'을 선택할 수 있습니다. 발음 로마자는 일본어 학습용이며 장음 ō/ū 표기를 사용합니다. 교재의 대화는 학습을 위해 만든 가상 상황으로 실제 입국 심사·호텔·회의 상황의 요구 사항과 다를 수 있습니다.</p>
    <div class="bottom-actions"><button class="primary" data-action="home">🗺️ 게임 시작하기</button></div></div>`;top();
  }
  function gallery(){
    pause();state.screen='gallery';el.innerHTML=`<div class="howto card-glass"><div class="section-tag">BONUS / VISUAL CONCEPT</div><h2>🎨 일본어 모험 게임 콘셉트 아트</h2>
      <p>게임의 분위기와 세계관을 잡기 위해 생성한 홍보용 콘셉트 이미지입니다. 이미지 속 문구와 UI는 실제 플레이 화면과 다를 수 있습니다.</p>
      <img class="concept-image" src="assets/concept-gallery.webp" alt="일본어 어드벤처 콘셉트 이미지">
      <div class="bottom-actions"><button class="primary" data-action="home">← 게임으로 돌아가기</button></div></div>`;top();
  }
  el.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const {action,world:worldId,index,id,difficulty}=btn.dataset;
    switch(action){
      case 'home':goHome();break;
      case 'intro':intro(worldId||'airport');break;
      case 'difficulty':saved.difficulty=difficulty;persist();intro(state.world);break;
      case 'begin':startSession('story',worldId);break;
      case 'rush':startSession('rush','airport');break;
      case 'listen':startSession('listen','airport');break;
      case 'builder':startSession('builder','classroom');break;
      case 'level':saved.level=btn.dataset.level;persist();if(state.screen==='intro')intro(state.world);else if(state.screen==='library')renderLibrary();else renderHome();break;
      case 'voice-speed':saved.voiceSpeed=btn.dataset.speed;persist();renderHome();toast(saved.voiceSpeed==='slow'?'천천히 듣기 모드':'보통 속도 모드');break;
      case 'build-piece':buildPiece(Number(index));break;
      case 'build-undo':undoPiece();break;
      case 'build-submit':submitBuild();break;
      case 'review':startSession('review',null);if(!Object.keys(saved.mistakes).length)toast('복습 대기 문장이 없어 기본 10문장으로 연습합니다.');break;
      case 'answer':choose(Number(index));break;
      case 'next':advance();break;
      case 'retry':startSession(state.mode,state.world);break;
      case 'next-world':intro(WORLDS[(WORLDS.findIndex(w=>w.id===state.world)+1)%WORLDS.length].id);break;
      case 'hint':hint();break;
      case 'speak-npc':if(state.s)speak(state.s.current.npc);break;
      case 'speak-answer':if(state.s)speak(state.s.current.ans);break;
      case 'library':renderLibrary();break;
      case 'library-world':state.library=worldId;renderLibrary();break;
      case 'speak-phrase':if(byId[id])speak(byId[id].npc+' '+byId[id].ans);break;
      case 'practice-one':if(byId[id])startSession('review',byId[id].world,id);break;
      case 'howto':howto();break;
      case 'gallery':gallery();break;
    }
  });
  $('#home-button').addEventListener('click',goHome);
  $('#sound-button').addEventListener('click',()=>{saved.sound=!saved.sound;persist();toast(saved.sound?'효과음 켜짐':'효과음 꺼짐');});
  window.addEventListener('keydown',e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    if(state.screen==='game'){
      const s=state.s;
      if(state.mode==='builder'&&!s.answered){
        if(['1','2','3','4'].includes(e.key)){e.preventDefault();buildPiece(s.pieceOrder[Number(e.key)-1]);}
        else if(e.key==='Backspace'){e.preventDefault();undoPiece();}
        else if(e.key==='Enter'){e.preventDefault();submitBuild();}
      }else if(['1','2','3'].includes(e.key)&&!s.answered){e.preventDefault();choose(s.order[Number(e.key)-1]);}
      else if(e.key.toLowerCase()==='h'&&!s.answered){e.preventDefault();hint();}
      else if(e.key.toLowerCase()==='s'){e.preventDefault();speak(s.current.npc);}
      else if(e.key==='Enter'&&s.answered){e.preventDefault();advance();}
      else if(e.key==='Escape'){e.preventDefault();goHome();}
    }
  });
  document.addEventListener('visibilitychange',()=>{
    const s=state.s;if(!s||state.screen!=='game'||s.answered)return;
    if(document.hidden){s.pausedRemaining=Math.max(0,s.deadline-performance.now());s.pausedRushRemaining=s.rushDeadline?Math.max(0,s.rushDeadline-performance.now()):0;if(raf!==null)cancelAnimationFrame(raf);raf=null;}
    else if(s.pausedRemaining){s.deadline=performance.now()+s.pausedRemaining;s.rushDeadline=s.rushDeadline?performance.now()+s.pausedRushRemaining:0;s.pausedRemaining=0;raf=requestAnimationFrame(tick);}
  });
  // On failure to load any sprite, gameplay remains usable through accessible text + choices.
  renderHome();updateStats();
  // Tiny read-only diagnostic API for local automated smoke tests.
  window.__serenaGameTest={getState:()=>({screen:state.screen,mode:state.mode,question:state.s?.current.id,answered:state.s?.answered,hearts:state.s?.hearts,score:state.s?.score,order:state.s?.order}),questionCount:TOTAL};
})();
