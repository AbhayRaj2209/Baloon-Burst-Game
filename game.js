
(() => {
  const gameArea = document.getElementById('game-area');
  const timerEl = document.getElementById('timer');
  const scoreEl = document.getElementById('score');
  const targetEl = document.getElementById('target');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const overlayBtn = document.getElementById('overlay-btn');

  let spawnTimer = null;
  let gameTimer = null;
  // default mode values (can be overridden by URL params)
  let TIME = 20; // seconds (MODIFIED: Remains 20)
  let TARGET = 21; // balloons to pop (MODIFIED: Was 20)
  let secondsLeft = TIME;
  let popped = 0;
  let hits = 0; // total balloon clicks (including bombs)
  let score = 0;
  let running = false;

  // audio context (lazy)
  let audioCtx = null;

  // allow mode override via query params, e.g. ?time=30&target=20
  try{
    const params = new URLSearchParams(window.location.search);
    const t = parseInt(params.get('time'), 10);
    const targ = parseInt(params.get('target'), 10);
    if(!Number.isNaN(t) && t > 0) TIME = t;
    if(!Number.isNaN(targ) && targ > 0) TARGET = targ;
  }catch(e){/* ignore */}

  secondsLeft = TIME;
  targetEl.textContent = TARGET;

  function rand(min, max){ return Math.random()*(max-min)+min }

  function spawnBalloon(){
    const el = document.createElement('div');
    const left = rand(4, 94);
    el.className = 'balloon';
    // decide type: small chance to be bomb
    const isBomb = Math.random() < 0.35; // 35% bombs (MODIFIED: Was 0.25)
    el.classList.add(isBomb ? 'bomb' : 'normal');
    el.style.left = left + '%';

    // random size
    const scale = rand(0.8, 1.2);
    el.style.width = `${60*scale}px`;
    el.style.height = `${80*scale}px`;

    // random float duration
    const duration = rand(4.5, 9.5); // seconds
    el.style.animation = `floatUp ${duration}s linear forwards`;

    // hide bomb label (bombs are visually hidden per request)
    if(!isBomb) {
      // small chance to show a decorative symbol for normal balloons (optional)
      // el.textContent = '';
    }

    el.dataset.type = isBomb ? 'bomb' : 'normal';

    // click handler
    function onClick(e){
      if(!running) return;
      // avoid double clicks
      if(el.classList.contains('popped') || el.classList.contains('exploded')) return;
      // count this as a hit (even if it's a bomb)
      hits += 1;

      const clickX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      const clickY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;

      if(el.dataset.type === 'bomb'){
        // bomb: penalize and show slice
        score = Math.max(0, score - 1);
        const rect = el.getBoundingClientRect();
        createBombSlice(rect, clickX, clickY);
        createScorePopup(clickX, clickY, false);
        playTone(160, 0.28);
        el.classList.add('exploded');
      } else {
        // normal balloon popped
        el.classList.add('popped');
        popped += 1;
        score += 1;
        createPopEffect(clickX, clickY, false);
        createScorePopup(clickX, clickY, true);
        playTone(900, 0.18);
      }

      // prevent further interaction
      el.style.pointerEvents = 'none';
      updateUI();

      // remove after short delay to allow animations
      setTimeout(()=>{ if(el && el.remove) el.remove(); }, 420);

      // check win condition immediately
      if(popped >= TARGET) endGame(true);
    }

    el.addEventListener('click', onClick);

    // remove balloon when it finishes animation (reached top)
    el.addEventListener('animationend', ()=>{
      // if it's still in DOM and not popped/exploded, remove
      if(document.body.contains(el)) el.remove();
    });

    gameArea.appendChild(el);
  }

  // Create a small pop/explosion visual at (x,y). bomb flag changes color.
  function createPopEffect(x,y, bomb){
    const node = document.createElement('div');
    node.className = 'pop-effect' + (bomb ? ' bomb' : '');
    // position relative to viewport
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    document.body.appendChild(node);
    setTimeout(()=> node.remove(), 600);
  }

  // Create bomb slice pieces and particle shards. rect is the bounding rect of the balloon.
  function createBombSlice(rect, clickX, clickY){
    // container positioned at balloon center
    const container = document.createElement('div');
    container.className = 'slice-container';
    container.style.left = (rect.left + window.scrollX) + 'px';
    container.style.top = (rect.top + window.scrollY) + 'px';
    // size
    const w = rect.width; const h = rect.height;
    container.style.width = w + 'px';
    container.style.height = h + 'px';
    // left piece
    const left = document.createElement('div');
    left.className = 'slice-piece left bomb';
    left.style.width = (w/1.05) + 'px';
    left.style.height = (h/1.05) + 'px';
    left.style.left = '0px';
    left.style.top = '0px';
    left.style.animation = 'sliceFlyLeft 700ms cubic-bezier(.2,.7,.2,1) forwards';
    // right piece
    const right = document.createElement('div');
    right.className = 'slice-piece right bomb';
    right.style.width = (w/1.05) + 'px';
    right.style.height = (h/1.05) + 'px';
    right.style.left = '0px';
    right.style.top = '0px';
    right.style.animation = 'sliceFlyRight 820ms cubic-bezier(.2,.7,.2,1) forwards';

    container.appendChild(left);
    container.appendChild(right);
    document.body.appendChild(container);

    // small shards
    for(let i=0;i<6;i++){
      const s = document.createElement('div');
      s.className = 'shard';
      s.style.left = (rect.left + (Math.random()*rect.width)) + 'px';
      s.style.top = (rect.top + (Math.random()*rect.height)) + 'px';
      const dx = (Math.random()*200)-100;
      const dy = (Math.random()*200)-20;
      s.style.transition = `transform 700ms cubic-bezier(.2,.7,.2,1), opacity 700ms`;
      document.body.appendChild(s);
      // trigger move
      requestAnimationFrame(()=>{
        s.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random()*360)}deg) scale(${0.6+Math.random()})`;
        s.style.opacity = '0';
      });
      setTimeout(()=> s.remove(), 820);
    }

    // shake body briefly
    document.body.classList.add('shake');
    setTimeout(()=> document.body.classList.remove('shake'), 420);

    // cleanup container after animation
    setTimeout(()=> container.remove(), 900);
  }

  // simple generated tone using WebAudio
  // Create score feedback popup (+1/-1)
  function createScorePopup(x, y, isGood) {
    const popup = document.createElement('div');
    popup.className = 'score-popup ' + (isGood ? 'plus' : 'minus');
    popup.textContent = isGood ? '✨' : '💥';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
  }

  function playTone(freq, duration){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      o.stop(now + duration + 0.02);
    }catch(err){
      // ignore audio errors (some browsers require gesture to unlock audio)
    }
  }

  function startGame(){
    if(running) return;
    running = true;
  secondsLeft = TIME;
    popped = 0;
  hits = 0;
    score = 0;
    updateUI();
    overlay.classList.add('hidden');
    startBtn.style.display = 'none';
    restartBtn.style.display = 'none';

    // spawn faster at first, then random
    spawnTimer = setInterval(()=>{
      // spawn 1-2 balloons each tick
      const count = Math.random() < 0.6 ? 1 : 2;
      for(let i=0;i<count;i++) spawnBalloon();
    }, 700);

    // game countdown
    gameTimer = setInterval(()=>{
      secondsLeft -= 1;
      updateUI();
      if(secondsLeft <= 0){
        endGame(false);
      }
    },1000);
  }

  function stopSpawning(){
    if(spawnTimer) { clearInterval(spawnTimer); spawnTimer = null }
    if(gameTimer) { clearInterval(gameTimer); gameTimer = null }
  }

  function endGame(win){
    if(!running) return;
    running = false;
    stopSpawning();

    // clear remaining balloons pointer interactions
    document.querySelectorAll('.balloon').forEach(b=> b.style.pointerEvents = 'none');

    // show overlay
    overlay.classList.remove('hidden');
    if(win){
      overlayTitle.textContent = 'Congratulations you won'; // MODIFIED
      overlayMsg.textContent = `You popped ${popped} balloons in time. Score: ${score}`;
    } else {
      overlayTitle.textContent = 'Try again'; // MODIFIED
      overlayMsg.textContent = `You popped ${popped} balloons. Target was ${TARGET}. Score: ${score}`;
    }

    restartBtn.style.display = 'inline-block';
  }

  function updateUI(){
    timerEl.textContent = String(secondsLeft);
    scoreEl.textContent = String(score);
    targetEl.textContent = String(Math.max(0, TARGET - popped)); // Ensure target doesn't go negative
    // show total hits
    const hitsEl = document.getElementById('hits');
    if(hitsEl) hitsEl.textContent = String(hits);
  }

  // hook up controls
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', ()=>{
    // cleanup existing balloons
    document.querySelectorAll('.balloon').forEach(b=>b.remove());
    startBtn.style.display = 'none';
    overlay.classList.add('hidden');
    startGame();
  });
  overlayBtn.addEventListener('click', ()=>{
    document.querySelectorAll('.balloon').forEach(b=>b.remove());
    overlay.classList.add('hidden');
    startGame();
  });

  // small accessibility: allow space to start
  window.addEventListener('keydown', (e)=>{
    if(e.code === 'Space'){
      if(!running) startGame();
      e.preventDefault();
    }
  });

  // initial UI
  updateUI();
})();





//// Balloon Burst — simple shooting gallery game
// (() => {
//   const gameArea = document.getElementById('game-area');
//   const timerEl = document.getElementById('timer');
//   const scoreEl = document.getElementById('score');
//   const targetEl = document.getElementById('target');
//   const startBtn = document.getElementById('startBtn');
//   const restartBtn = document.getElementById('restartBtn');
//   const overlay = document.getElementById('overlay');
//   const overlayTitle = document.getElementById('overlay-title');
//   const overlayMsg = document.getElementById('overlay-msg');
//   const overlayBtn = document.getElementById('overlay-btn');

//   let spawnTimer = null;
//   let gameTimer = null;
//   // default mode values (can be overridden by URL params)
//   let TIME = 30; // seconds
//   let TARGET = 20; // balloons to pop
//   let secondsLeft = TIME;
//   let popped = 0;
//   let hits = 0; // total balloon clicks (including bombs)
//   let score = 0;
//   let running = false;

//   // audio context (lazy)
//   let audioCtx = null;

//   // allow mode override via query params, e.g. ?time=30&target=20
//   try{
//     const params = new URLSearchParams(window.location.search);
//     const t = parseInt(params.get('time'), 10);
//     const targ = parseInt(params.get('target'), 10);
//     if(!Number.isNaN(t) && t > 0) TIME = t;
//     if(!Number.isNaN(targ) && targ > 0) TARGET = targ;
//   }catch(e){/* ignore */}

//   secondsLeft = TIME;
//   targetEl.textContent = TARGET;

//   function rand(min, max){ return Math.random()*(max-min)+min }

//   function spawnBalloon(){
//     const el = document.createElement('div');
//     const left = rand(4, 94);
//     el.className = 'balloon';
//     // decide type: small chance to be bomb
//     const isBomb = Math.random() < 0.12; // 12% bombs
//     el.classList.add(isBomb ? 'bomb' : 'normal');
//     el.style.left = left + '%';

//     // random size
//     const scale = rand(0.8, 1.2);
//     el.style.width = `${60*scale}px`;
//     el.style.height = `${80*scale}px`;

//     // random float duration
//     const duration = rand(4.5, 9.5); // seconds
//     el.style.animation = `floatUp ${duration}s linear forwards`;

//     // hide bomb label (bombs are visually hidden per request)
//     if(!isBomb) {
//       // small chance to show a decorative symbol for normal balloons (optional)
//       // el.textContent = '';
//     }

//     el.dataset.type = isBomb ? 'bomb' : 'normal';

//     // click handler
//     function onClick(e){
//       if(!running) return;
//       // avoid double clicks
//       if(el.classList.contains('popped') || el.classList.contains('exploded')) return;
//       // count this as a hit (even if it's a bomb)
//       hits += 1;

//       const clickX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
//       const clickY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;

//       if(el.dataset.type === 'bomb'){
//         // bomb: penalize and show slice
//         score = Math.max(0, score - 1);
//         const rect = el.getBoundingClientRect();
//         createBombSlice(rect, clickX, clickY);
//         createScorePopup(clickX, clickY, false);
//         playTone(160, 0.28);
//         el.classList.add('exploded');
//       } else {
//         // normal balloon popped
//         el.classList.add('popped');
//         popped += 1;
//         score += 1;
//         createPopEffect(clickX, clickY, false);
//         createScorePopup(clickX, clickY, true);
//         playTone(900, 0.18);
//       }

//       // prevent further interaction
//       el.style.pointerEvents = 'none';
//       updateUI();

//       // remove after short delay to allow animations
//       setTimeout(()=>{ if(el && el.remove) el.remove(); }, 420);

//       // check win condition immediately
//       if(popped >= TARGET) endGame(true);
//     }

//     el.addEventListener('click', onClick);

//     // remove balloon when it finishes animation (reached top)
//     el.addEventListener('animationend', ()=>{
//       // if it's still in DOM and not popped/exploded, remove
//       if(document.body.contains(el)) el.remove();
//     });

//     gameArea.appendChild(el);
//   }

//   // Create a small pop/explosion visual at (x,y). bomb flag changes color.
//   function createPopEffect(x,y, bomb){
//     const node = document.createElement('div');
//     node.className = 'pop-effect' + (bomb ? ' bomb' : '');
//     // position relative to viewport
//     node.style.left = x + 'px';
//     node.style.top = y + 'px';
//     document.body.appendChild(node);
//     setTimeout(()=> node.remove(), 600);
//   }

//   // Create bomb slice pieces and particle shards. rect is the bounding rect of the balloon.
//   function createBombSlice(rect, clickX, clickY){
//     // container positioned at balloon center
//     const container = document.createElement('div');
//     container.className = 'slice-container';
//     container.style.left = (rect.left + window.scrollX) + 'px';
//     container.style.top = (rect.top + window.scrollY) + 'px';
//     // size
//     const w = rect.width; const h = rect.height;
//     container.style.width = w + 'px';
//     container.style.height = h + 'px';
//     // left piece
//     const left = document.createElement('div');
//     left.className = 'slice-piece left bomb';
//     left.style.width = (w/1.05) + 'px';
//     left.style.height = (h/1.05) + 'px';
//     left.style.left = '0px';
//     left.style.top = '0px';
//     left.style.animation = 'sliceFlyLeft 700ms cubic-bezier(.2,.7,.2,1) forwards';
//     // right piece
//     const right = document.createElement('div');
//     right.className = 'slice-piece right bomb';
//     right.style.width = (w/1.05) + 'px';
//     right.style.height = (h/1.05) + 'px';
//     right.style.left = '0px';
//     right.style.top = '0px';
//     right.style.animation = 'sliceFlyRight 820ms cubic-bezier(.2,.7,.2,1) forwards';

//     container.appendChild(left);
//     container.appendChild(right);
//     document.body.appendChild(container);

//     // small shards
//     for(let i=0;i<6;i++){
//       const s = document.createElement('div');
//       s.className = 'shard';
//       s.style.left = (rect.left + (Math.random()*rect.width)) + 'px';
//       s.style.top = (rect.top + (Math.random()*rect.height)) + 'px';
//       const dx = (Math.random()*200)-100;
//       const dy = (Math.random()*200)-20;
//       s.style.transition = `transform 700ms cubic-bezier(.2,.7,.2,1), opacity 700ms`;
//       document.body.appendChild(s);
//       // trigger move
//       requestAnimationFrame(()=>{
//         s.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random()*360)}deg) scale(${0.6+Math.random()})`;
//         s.style.opacity = '0';
//       });
//       setTimeout(()=> s.remove(), 820);
//     }

//     // shake body briefly
//     document.body.classList.add('shake');
//     setTimeout(()=> document.body.classList.remove('shake'), 420);

//     // cleanup container after animation
//     setTimeout(()=> container.remove(), 900);
//   }

//   // simple generated tone using WebAudio
//   // Create score feedback popup (+1/-1)
//   function createScorePopup(x, y, isGood) {
//     const popup = document.createElement('div');
//     popup.className = 'score-popup ' + (isGood ? 'plus' : 'minus');
//     popup.textContent = isGood ? '✨' : '💥';
//     popup.style.left = x + 'px';
//     popup.style.top = y + 'px';
//     document.body.appendChild(popup);
//     setTimeout(() => popup.remove(), 800);
//   }

//   function playTone(freq, duration){
//     try{
//       if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//       const ctx = audioCtx;
//       const o = ctx.createOscillator();
//       const g = ctx.createGain();
//       o.type = 'sine';
//       o.frequency.value = freq;
//       g.gain.value = 0.0001;
//       o.connect(g); g.connect(ctx.destination);
//       const now = ctx.currentTime;
//       g.gain.setValueAtTime(0.0001, now);
//       g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
//       o.start(now);
//       g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
//       o.stop(now + duration + 0.02);
//     }catch(err){
//       // ignore audio errors (some browsers require gesture to unlock audio)
//     }
//   }

//   function startGame(){
//     if(running) return;
//     running = true;
//   secondsLeft = TIME;
//     popped = 0;
//   hits = 0;
//     score = 0;
//     updateUI();
//     overlay.classList.add('hidden');
//     startBtn.style.display = 'none';
//     restartBtn.style.display = 'none';

//     // spawn faster at first, then random
//     spawnTimer = setInterval(()=>{
//       // spawn 1-2 balloons each tick
//       const count = Math.random() < 0.6 ? 1 : 2;
//       for(let i=0;i<count;i++) spawnBalloon();
//     }, 700);

//     // game countdown
//     gameTimer = setInterval(()=>{
//       secondsLeft -= 1;
//       updateUI();
//       if(secondsLeft <= 0){
//         endGame(false);
//       }
//     },1000);
//   }

//   function stopSpawning(){
//     if(spawnTimer) { clearInterval(spawnTimer); spawnTimer = null }
//     if(gameTimer) { clearInterval(gameTimer); gameTimer = null }
//   }

//   function endGame(win){
//     if(!running) return;
//     running = false;
//     stopSpawning();

//     // clear remaining balloons pointer interactions
//     document.querySelectorAll('.balloon').forEach(b=> b.style.pointerEvents = 'none');

//     // show overlay
//     overlay.classList.remove('hidden');
//     if(win){
//       overlayTitle.textContent = 'You Win!';
//       overlayMsg.textContent = `You popped ${popped} balloons in time. Score: ${score}`;
//     } else {
//       overlayTitle.textContent = 'Time Up';
//       overlayMsg.textContent = `You popped ${popped} balloons. Target was ${TARGET}. Score: ${score}`;
//     }

//     restartBtn.style.display = 'inline-block';
//   }

//   function updateUI(){
//     timerEl.textContent = String(secondsLeft);
//     scoreEl.textContent = String(score);
//     targetEl.textContent = String(TARGET - popped);
//     // show total hits
//     const hitsEl = document.getElementById('hits');
//     if(hitsEl) hitsEl.textContent = String(hits);
//   }

//   // hook up controls
//   startBtn.addEventListener('click', startGame);
//   restartBtn.addEventListener('click', ()=>{
//     // cleanup existing balloons
//     document.querySelectorAll('.balloon').forEach(b=>b.remove());
//     startBtn.style.display = 'none';
//     overlay.classList.add('hidden');
//     startGame();
//   });
//   overlayBtn.addEventListener('click', ()=>{
//     document.querySelectorAll('.balloon').forEach(b=>b.remove());
//     overlay.classList.add('hidden');
//     startGame();
//   });

//   // small accessibility: allow space to start
//   window.addEventListener('keydown', (e)=>{
//     if(e.code === 'Space'){
//       if(!running) startGame();
//       e.preventDefault();
//     }
//   });

//   // initial UI
//   updateUI();
// })();