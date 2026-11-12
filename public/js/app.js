/**
 * CHRONOS: Master Application Controller
 * Coordinates UI rendering, SVG clockwork, auth workflows, and game lifecycle.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const minuteHandEl = document.getElementById('minute-hand');
  const hourHandEl = document.getElementById('hour-hand');
  const dialReadoutEl = document.getElementById('dial-readout');
  const hudStartTimeEl = document.getElementById('hud-start-time');
  const hudTargetTimeEl = document.getElementById('hud-target-time');
  const durationProgressEl = document.getElementById('duration-progress');
  const durationTextEl = document.getElementById('duration-text');
  const durationRemainingEl = document.getElementById('duration-remaining');

  const btnStart = document.getElementById('btn-start-clock');
  const btnReset = document.getElementById('btn-reset-clock');
  const speedBtn1x = document.getElementById('speed-1x');
  const speedBtn2x = document.getElementById('speed-2x');
  const speedBtn5x = document.getElementById('speed-5x');

  const authOverlay = document.getElementById('auth-modal-overlay');
  const settingsOverlay = document.getElementById('settings-modal-overlay');
  const victoryOverlay = document.getElementById('victory-modal-overlay');

  const userProfileBar = document.getElementById('user-profile-bar');
  const usernameDisplay = document.getElementById('player-username');
  const rankDisplay = document.getElementById('player-rank');
  const btnLogout = document.getElementById('btn-logout');
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  // Curated Puzzles Cache & Challenge Duel State
  let currentLevelNumber = 1;
  let puzzlesList = [];
  let currentChallenge = null; // { isCustom: true, fromFriend: boolean, challenger: string, start: string, target: string, duration: number }

  // Level hints database (Exclusively Fractions)
  const levelHints = {
    1: {
      formula: '01:00 (Start) + 75m (Natural) = 02:15 ➔ <span class="text-primary font-bold">+1/3 hr Needed for 02:35</span>',
      hint: 'Place one <strong>Green (+1/3) Forward Pin</strong> into <strong>Outer Socket "15m"</strong> (at 3 o\'clock). Then press <strong>START CLOCK</strong>!'
    },
    2: {
      formula: '12:00 (Start) + 75m (Natural) = 01:15 ➔ <span class="text-primary font-bold">+5m Needed for 01:20</span>',
      hint: 'Net warp needed is <strong>+5 minutes</strong> (+1/3 hr - 1/4 hr). Place one <strong>Green (+1/3)</strong> pin and one <strong>Red (-1/4)</strong> pin!'
    },
    3: {
      formula: '02:00 (Start) + 75m (Natural) = 03:15 ➔ <span class="text-primary font-bold">+1h 15m Needed for 04:30</span>',
      hint: 'Bridge the large 1-hour gap by slotting a pin into the <strong>Inner (Hour) Ring</strong> (e.g. at 3h), and minute pins on the Outer Ring to hit 04:30!'
    },
    4: {
      formula: '06:00 (Start) + 75m (Natural) = 07:15 ➔ <span class="text-primary font-bold">+45m Needed for 08:00</span>',
      hint: 'Coordinate both Hour Ring (Inner) and Minute Ring (Outer) fraction pins in sequence!'
    },
    5: {
      formula: '10:15 (Start) + 75m (Natural) = 11:30 ➔ <span class="text-primary font-bold">+30m Needed for 12:00</span>',
      hint: 'Combine fraction pins along the path: e.g. one <strong>Green (+1/3)</strong> and one <strong>Blue (+1/6)</strong> pin!'
    },
    6: {
      hint: 'Natural run from 03:35 reaches 04:50. Advance the minute hand +25 minutes using fraction warps to synchronize with 05:15.'
    },
    7: {
      hint: 'Natural run overshoots to 08:25! Slot negative fraction pins (-1/4 hr = -15m) to decelerate back to 08:15.'
    },
    8: {
      hint: 'Harness the Inner Hour Ring to trigger an hour leap at Hour 3, then fine-tune minute pins to strike 04:30.'
    },
    9: {
      hint: 'Bridge the 1 hour 50 minute gap between 10:00 and 11:50 by harmonizing both hour-ring advances and minute warps.'
    },
    10: {
      hint: 'Coordinate concentric hour advances and fraction cascades to reach 04:50 before duration expires.'
    }
  };

  // Check Database & Telemetry Health
  async function checkDbHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const dbPill = document.getElementById('db-status-pill');
      if (dbPill && data.database) {
        dbPill.textContent = data.database.dbMode || 'MySQL Connected';
        if (data.database.isConnected) {
          dbPill.className = 'text-emerald-400 font-medium';
        }
      }
    } catch (e) {}
  }
  checkDbHealth();

  // 1. Initialize Clock Engine
  const engine = new ClockEngine({
    startTime: '02:00',
    targetTime: '04:30',
    runningDuration: 75,
    onTick: (data) => updateUIOnTick(data),
    onPinActivate: (data) => handlePinActivationVisuals(data),
    onComplete: (data) => handleGameCompletion(data),
    onReset: () => handleGameReset()
  });

  // 2. Initialize Drag & Drop Manager
  const dragManager = new PinDragDropManager(engine, {
    onInventoryChange: () => renderPinsAndSockets()
  });

  // 3. Render Clock Sockets in SVG
  renderClockSockets();
  renderPinsAndSockets();

  // 4. Load Puzzles from API (or fallback)
  await loadPuzzles();

  // 5. Check Active User Session
  await window.chronosAuth.checkSession();
  setupAuthListeners();

  // 6. Check if incoming URL has a custom friend challenge duel
  checkURLChallenge();

  // -------------------------------------------------------------
  // UI Tick Updater
  // -------------------------------------------------------------
  function updateUIOnTick(data) {
    const { displayedTime, minuteAngle, hourAngle, elapsedDuration, totalDuration, progressPercent, smooth, rewind } = data;

    // Apply hand angles (SVG elements rotate around 300px 300px)
    if (minuteHandEl) {
      minuteHandEl.setAttribute('class', `clock-hand ${rewind ? 'rewind-transition' : (smooth ? 'smooth-transition' : '')}`);
      minuteHandEl.style.transform = `rotate(${minuteAngle}deg)`;
    }
    if (hourHandEl) {
      hourHandEl.setAttribute('class', `clock-hand ${rewind ? 'rewind-transition' : (smooth ? 'smooth-transition' : '')}`);
      hourHandEl.style.transform = `rotate(${hourAngle}deg)`;
    }

    // Digital Dial Readout & Time Locked Glow
    if (dialReadoutEl) {
      dialReadoutEl.textContent = `${displayedTime}:00`;
      const readoutBox = dialReadoutEl.closest('.border-secondary-container');
      if (readoutBox) {
        if (data.state === 'TIME_LOCKED') {
          readoutBox.classList.add('time-locked-glow');
        } else {
          readoutBox.classList.remove('time-locked-glow');
        }
      }
    }

    // Duration Progress Bar
    if (durationProgressEl) {
      durationProgressEl.style.width = `${progressPercent}%`;
    }
    if (durationTextEl) {
      durationTextEl.textContent = `${elapsedDuration} min / ${totalDuration} min elapsed`;
    }
    if (durationRemainingEl) {
      const remaining = Math.max(0, totalDuration - elapsedDuration);
      durationRemainingEl.textContent = `-${remaining}m REMAINING`;
    }

    // Audio Escapement Tick during running
    if (data.state === 'RUNNING' && Math.floor(elapsedDuration) !== Math.floor(updateUIOnTick.lastElapsed || 0)) {
      if (window.chronosAudio) window.chronosAudio.playTick();
    }
    updateUIOnTick.lastElapsed = elapsedDuration;
  }

  // -------------------------------------------------------------
  // Pin Activation Visuals (Mechanical Pause & Glow)
  // -------------------------------------------------------------
  function handlePinActivationVisuals(data) {
    const { phase, pin, circle, index } = data;
    const socketEl = document.querySelector(`.socket-hole[data-circle="${circle}"][data-socket-index="${index}"]`);

    if (socketEl) {
      if (phase === 'PRE_PAUSE') {
        socketEl.classList.add('pin-activating');
        let triggerMsg = pin.label;
        if (circle === 'inner') {
          if (pin.label === '+1/3' || pin.type === 'forward-high') triggerMsg = '+1/3 (Hour Hand +4h [12/3])';
          else if (pin.label === '-1/4' || pin.type === 'backward') triggerMsg = '-1/4 (Hour Hand -3h [12/4])';
          else if (pin.label === '+1/6' || pin.type === 'forward-low') triggerMsg = '+1/6 (Hour Hand +2h [12/6])';
        } else {
          if (pin.label === '+1/3') triggerMsg = '+1/3 (Minute Hand +20m [60/3])';
          else if (pin.label === '-1/4') triggerMsg = '-1/4 (Minute Hand -15m [60/4])';
          else if (pin.label === '+1/6') triggerMsg = '+1/6 (Minute Hand +10m [60/6])';
        }
        showFloatingNotification(`⚡ Pin Engaged: ${triggerMsg}`, pin.bgHex);
      } else if (phase === 'POST_RESUME') {
        socketEl.classList.remove('pin-activating');
      }
    }
  }

  // -------------------------------------------------------------
  // Completion & Victory Handler
  // -------------------------------------------------------------
  async function handleGameCompletion(result) {
    const { isSuccess, finalTime, targetTime } = result;

    if (isSuccess) {
      // Show Victory Modal
      document.getElementById('victory-final-time').textContent = finalTime;
      document.getElementById('victory-target-time').textContent = targetTime;

      const victoryTitle = document.querySelector('#victory-modal-overlay h2');
      const victoryDesc = document.querySelector('#victory-modal-overlay p');
      const btnNextLevel = document.getElementById('btn-next-level');
      const btnShareVictory = document.getElementById('btn-share-victory');

      if (currentChallenge && currentChallenge.isCustom) {
        if (currentChallenge.fromFriend) {
          if (victoryTitle) victoryTitle.textContent = '⚔️ DUEL WON!';
          if (victoryDesc) victoryDesc.textContent = `You conquered ${currentChallenge.challenger}'s custom challenge! Dial synchronized perfectly at ${targetTime}.`;
        } else {
          if (victoryTitle) victoryTitle.textContent = '🏆 CHALLENGE SOLVED!';
          if (victoryDesc) victoryDesc.textContent = `You solved your custom challenge! Dial synchronized from ${currentChallenge.start} to ${targetTime}.`;
        }
        if (btnNextLevel) btnNextLevel.textContent = 'New Challenge ➔';
        if (btnShareVictory) btnShareVictory.classList.remove('hidden');
      } else {
        if (victoryTitle) victoryTitle.textContent = 'TIME MASTER!';
        if (victoryDesc) victoryDesc.textContent = 'You solved the horological equation! The hands came to rest exactly at the target time.';
        if (btnNextLevel) btnNextLevel.textContent = 'Next Epoch »';
        if (btnShareVictory) btnShareVictory.classList.add('hidden');
      }

      victoryOverlay.classList.remove('hidden');

      // Record to MySQL backend
      try {
        const curPuzzle = puzzlesList.find(p => p.level_number === currentLevelNumber);
        const res = await fetch('/api/game/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...window.chronosAuth.getAuthHeader()
          },
          body: JSON.stringify({
            puzzleId: curPuzzle ? curPuzzle.id : null,
            levelNumber: currentLevelNumber,
            pinsConfiguration: engine.getAllPlacedPins(),
            finalDisplayedTime: finalTime,
            isSuccess: true
          })
        });
        const resData = await res.json();
        if (resData.updatedProfile && window.chronosAuth.user) {
          window.chronosAuth.user.puzzles_solved = resData.updatedProfile.puzzles_solved;
          window.chronosAuth.user.current_level = resData.updatedProfile.current_level;
          window.chronosAuth.user.rank_title = resData.updatedProfile.rank_title;
          updateProfileUI();
        }
      } catch (err) {
        console.warn('Could not sync victory with cloud database:', err);
      }
    } else {
      // Show Paradox notification
      showFloatingNotification(`Paradox: Reached ${finalTime} instead of ${targetTime}. Rewinding...`, '#ef4444');
    }
  }

  function handleGameReset() {
    dragManager.returnAllPinsToInventory();
    renderPinsAndSockets();
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  // -------------------------------------------------------------
  // Clock Sockets SVG & HTML Construction (Responsive Percentage Coordinates)
  // -------------------------------------------------------------
  function renderClockSockets() {
    const outerContainer = document.getElementById('outer-sockets-layer');
    const innerContainer = document.getElementById('inner-sockets-layer');

    if (!outerContainer || !innerContainer) return;
    outerContainer.innerHTML = '';
    innerContainer.innerHTML = '';

    // Outer Sockets: 12 holes at 5-minute intervals (R = 26.0% of clock chassis)
    const outerRadiusPercent = 26.0;
    for (let i = 0; i < 12; i++) {
      const angleDeg = (i * 30) - 90; // 0m at top (-90deg in standard cartesian)
      const rad = (angleDeg * Math.PI) / 180;
      const xPercent = 50 + outerRadiusPercent * Math.cos(rad);
      const yPercent = 50 + outerRadiusPercent * Math.sin(rad);

      const socket = document.createElement('div');
      socket.className = 'socket-hole absolute rounded-full border border-sky-400/60 bg-surface-container-lowest/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] flex items-center justify-center transition-all cursor-pointer w-5 h-5 sm:w-6 sm:h-6 z-20';
      socket.style.left = `${xPercent.toFixed(3)}%`;
      socket.style.top = `${yPercent.toFixed(3)}%`;
      socket.style.transform = 'translate(-50%, -50%)';
      socket.innerHTML = '';
      socket.title = `Outer Socket: ${i * 5}m (Triggered by Minute Hand)`;

      dragManager.attachClockSocket(socket, 'outer', i);
      outerContainer.appendChild(socket);
    }

    // Inner Sockets: 12 holes at hour positions (R = 17.33% of clock chassis)
    const innerRadiusPercent = 17.333;
    for (let i = 0; i < 12; i++) {
      const hourVal = i + 1;
      const angleDeg = (hourVal * 30) - 90;
      const rad = (angleDeg * Math.PI) / 180;
      const xPercent = 50 + innerRadiusPercent * Math.cos(rad);
      const yPercent = 50 + innerRadiusPercent * Math.sin(rad);

      const socket = document.createElement('div');
      socket.className = 'socket-hole absolute rounded-full border border-amber-400/60 bg-surface-container-lowest/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] flex items-center justify-center transition-all cursor-pointer w-4 h-4 sm:w-5 sm:h-5 z-20';
      socket.style.left = `${xPercent.toFixed(3)}%`;
      socket.style.top = `${yPercent.toFixed(3)}%`;
      socket.style.transform = 'translate(-50%, -50%)';
      socket.innerHTML = '';
      socket.title = `Inner Socket: Hour ${hourVal} (Triggered by Hour Hand)`;

      dragManager.attachClockSocket(socket, 'inner', i);
      innerContainer.appendChild(socket);
    }
  }

  // -------------------------------------------------------------
  // Render Pins in Inventory Tray & Placed Clock Sockets
  // -------------------------------------------------------------
  function renderPinsAndSockets() {
    const trayFh = document.getElementById('tray-pins-fh');
    const trayBw = document.getElementById('tray-pins-bw');
    const trayFl = document.getElementById('tray-pins-fl');

    if (!trayFh || !trayBw || !trayFl) return;
    trayFh.innerHTML = '';
    trayBw.innerHTML = '';
    trayFl.innerHTML = '';

    // Render Tray Pins
    dragManager.pins.forEach(pin => {
      if (pin.location === 'inventory') {
        const pinEl = document.createElement('div');
        pinEl.className = 'pin-item w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-md border-2 relative cursor-grab active:cursor-grabbing hover:scale-110 flex items-center justify-center shrink-0';
        pinEl.style.backgroundColor = pin.bgHex;
        pinEl.style.borderColor = pin.borderHex;
        pinEl.style.boxShadow = `0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.4)`;
        pinEl.innerHTML = '';
        pinEl.title = `Time Pin: ${pin.label} (${pin.type})`;

        dragManager.attachInventoryPin(pinEl, pin.id);

        if (pin.type === 'forward-high') trayFh.appendChild(pinEl);
        else if (pin.type === 'backward') trayBw.appendChild(pinEl);
        else if (pin.type === 'forward-low') trayFl.appendChild(pinEl);
      }
    });

    // Update Sockets on Clock
    ['outer', 'inner'].forEach(circle => {
      for (let i = 0; i < 12; i++) {
        const socketEl = document.querySelector(`.socket-hole[data-circle="${circle}"][data-socket-index="${i}"]`);
        if (!socketEl) continue;

        const pin = engine.sockets[circle][i];
        if (pin) {
          socketEl.classList.add('has-pin');
          socketEl.style.backgroundColor = pin.bgHex;
          socketEl.style.borderColor = pin.borderHex;
          socketEl.style.boxShadow = `0 0 12px ${pin.bgHex}, inset 0 1px 0 rgba(255,255,255,0.4)`;
          socketEl.innerHTML = '';
          const effectDesc = circle === 'outer'
            ? `${pin.label === '+1/3' ? '+20m' : (pin.label === '-1/4' ? '-15m' : '+10m')} on minute sweep`
            : `${pin.label === '+1/3' ? '+4h (12/3)' : (pin.label === '-1/4' ? '-3h (12/4)' : '+2h (12/6)')} on hour sweep`;
          socketEl.title = `Slotted: ${pin.label} (${circle === 'outer' ? (i * 5) + 'm' : (i + 1) + 'h'} socket ➔ ${effectDesc}) — Click to remove`;
        } else {
          socketEl.classList.remove('has-pin');
          socketEl.style.backgroundColor = '';
          socketEl.style.borderColor = '';
          socketEl.style.boxShadow = '';
          socketEl.innerHTML = '';
          if (circle === 'outer') {
            socketEl.title = `Outer Socket: ${i * 5}m (Triggered by Minute Hand)`;
          } else {
            socketEl.title = `Inner Socket: Hour ${i + 1} (Triggered by Hour Hand)`;
          }
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Controls: Start, Reset, Speed
  // -------------------------------------------------------------
  btnStart.addEventListener('click', () => {
    if (engine.state === 'IDLE') {
      engine.start();
      btnStart.disabled = true;
      btnStart.classList.add('opacity-50', 'cursor-not-allowed');
      if (window.chronosAudio) window.chronosAudio.playTick();
    }
  });

  btnReset.addEventListener('click', () => {
    const puzzle = puzzlesList.find(p => p.level_number === currentLevelNumber);
    if (puzzle) {
      engine.resetLevel(puzzle.start_time, puzzle.target_time, puzzle.running_duration_minutes);
    } else {
      engine.manualReset();
    }
    dragManager.returnAllPinsToInventory();
    renderPinsAndSockets();
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
    showFloatingNotification(`Reset to ${puzzle ? puzzle.start_time : 'start'}`, '#eec06a');
  });

  function setSpeedActive(activeBtn, speed) {
    [speedBtn1x, speedBtn2x, speedBtn5x].forEach(b => {
      if (b) {
        b.classList.remove('bg-primary-container', 'text-surface-container-lowest');
        b.classList.add('bg-surface-container-high', 'text-on-surface-variant');
      }
    });
    if (activeBtn) {
      activeBtn.classList.add('bg-primary-container', 'text-surface-container-lowest');
      activeBtn.classList.remove('bg-surface-container-high', 'text-on-surface-variant');
    }
    engine.setSpeed(speed);
  }

  if (speedBtn1x) speedBtn1x.addEventListener('click', () => setSpeedActive(speedBtn1x, 1));
  if (speedBtn2x) speedBtn2x.addEventListener('click', () => setSpeedActive(speedBtn2x, 2));
  if (speedBtn5x) speedBtn5x.addEventListener('click', () => setSpeedActive(speedBtn5x, 5));

  // Audio Toggle
  document.querySelectorAll('[data-action="toggle-audio"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const muted = window.chronosAudio.toggleMute();
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">${muted ? 'volume_off' : 'volume_up'}</span>`;
      showFloatingNotification(muted ? 'Resonance Audio Muted' : 'Resonance Audio Active', '#eec06a');
    });
  });

  // -------------------------------------------------------------
  // Level Management & Puzzles Loader
  // -------------------------------------------------------------
  async function loadPuzzles() {
    try {
      const res = await fetch('/api/game/puzzles');
      const data = await res.json();
      if (data.success && data.puzzles && data.puzzles.length > 0) {
        puzzlesList = data.puzzles;
      }
    } catch (e) {
      console.warn('Using local puzzles list.');
      puzzlesList = [
        { level_number: 1, title: 'Epoch I: The First Escapement', start_time: '01:00', target_time: '02:35', running_duration_minutes: 75, description: 'Natural passage reaches 02:15. You need an extra 20 minutes to reach 02:35.' },
        { level_number: 2, title: 'Epoch II: Equilibrium of Gears', start_time: '12:00', target_time: '01:20', running_duration_minutes: 75, description: 'Natural passage reaches 01:15. A delicate balance (+20m and -15m) bridges the 5-minute offset to 01:20.' },
        { level_number: 3, title: 'Epoch III: The Brass Pendulum', start_time: '02:00', target_time: '04:30', running_duration_minutes: 75, description: 'Natural run leads to 03:15. Coordinate multiple time warps to land precisely at 04:30.' },
        { level_number: 4, title: 'Epoch IV: The Temporal Paradox', start_time: '06:00', target_time: '08:00', running_duration_minutes: 75, description: 'Coordinate the Inner (Hour) and Outer (Minute) rings in sequence. Timing is everything.' },
        { level_number: 5, title: 'Epoch V: The Omnipresent Dial', start_time: '10:15', target_time: '12:00', running_duration_minutes: 75, description: 'A master trial requiring strategic placement to prevent reverse loops and hit the 12:00 apex.' },
        { level_number: 6, title: 'Epoch VI: Gear-Train Resonance', start_time: '03:35', target_time: '05:15', running_duration_minutes: 75, description: 'Natural passage from 03:35 reaches 04:50. Advance the minute hand +25 minutes using fraction warps to synchronize with 05:15.' },
        { level_number: 7, title: 'Epoch VII: Chrono Dilation', start_time: '07:10', target_time: '08:15', running_duration_minutes: 75, description: 'Natural run overshoots to 08:25! Slot negative fraction pins (-1/4 hr = -15m) to decelerate the dial back to 08:15.' },
        { level_number: 8, title: 'Epoch VIII: The Dual-Arbor Leap', start_time: '02:20', target_time: '04:30', running_duration_minutes: 75, description: 'Natural run reaches 03:35. Harness the Inner Hour Ring to trigger an hour leap at Hour 3, then fine-tune minute pins to strike 04:30.' },
        { level_number: 9, title: 'Epoch IX: Celestial Escapement', start_time: '08:45', target_time: '11:50', running_duration_minutes: 75, description: 'Bridge the 1 hour 50 minute gap between 10:00 (natural run end) and 11:50 by harmonizing both hour-ring advances and minute warps.' },
        { level_number: 10, title: 'Epoch X: Grand Chronomancer Trial', start_time: '01:00', target_time: '04:50', running_duration_minutes: 75, description: 'The master challenge. Natural run reaches 02:15. Coordinate concentric hour advances and fraction cascades to reach 04:50 before duration expires.' }
      ];
    }
    renderLevelList();
    selectLevel(currentLevelNumber);
  }

  function renderLevelList() {
    const listContainer = document.getElementById('level-selector-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const isCustomActive = currentChallenge && currentChallenge.isCustom;

    puzzlesList.forEach(p => {
      const btn = document.createElement('button');
      const isCurrent = !isCustomActive && (p.level_number === currentLevelNumber);
      btn.className = `w-full flex items-center justify-between px-3 py-2 transition-all text-label-sm font-label-sm ${isCurrent ? 'bg-surface-container-highest border-l-2 border-primary text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`;
      btn.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-sm ${isCurrent ? 'text-primary' : 'text-primary/70'}">lock_open</span>
          <span>Epoch ${p.level_number}</span>
        </div>
        <span class="text-[9px] ${isCurrent ? 'px-1.5 py-0.5 bg-primary/20 rounded text-primary border border-primary/30' : 'text-outline'}">
          ${isCurrent ? 'ACTIVE' : p.target_time}
        </span>
      `;
      btn.addEventListener('click', () => {
        selectLevel(p.level_number);
      });
      listContainer.appendChild(btn);
    });

    // Custom Challenge & Friend Duel Option
    const duelBtn = document.createElement('button');
    duelBtn.className = `w-full flex items-center justify-between px-3 py-2 transition-all text-label-sm font-label-sm mt-2 pt-2 border-t border-outline-variant/30 font-semibold ${isCustomActive ? 'bg-surface-container-highest border-l-2 border-primary text-primary' : 'text-primary hover:text-primary-fixed hover:bg-surface-container-high'}`;
    duelBtn.innerHTML = `
      <div class="flex items-center gap-2.5">
        <span class="material-symbols-outlined text-sm text-primary">swords</span>
        <span>${isCustomActive ? (currentChallenge.fromFriend ? `Duel: ${currentChallenge.challenger}` : 'Custom Challenge') : 'Challenge & Duel'}</span>
      </div>
      <span class="text-[9px] px-1.5 py-0.5 rounded ${isCustomActive ? 'bg-primary text-surface-container-lowest font-bold' : 'bg-primary/20 text-primary border border-primary/30'}">
        ${isCustomActive ? 'ACTIVE' : 'CUSTOM'}
      </span>
    `;
    duelBtn.addEventListener('click', () => {
      settingsOverlay.classList.remove('hidden');
    });
    listContainer.appendChild(duelBtn);
  }

  function selectLevel(lvlNum) {
    currentChallenge = null;
    const challengeBanner = document.getElementById('friend-challenge-banner');
    if (challengeBanner) challengeBanner.classList.add('hidden');

    currentLevelNumber = lvlNum;
    const puzzle = puzzlesList.find(p => p.level_number === lvlNum);
    if (!puzzle) return;

    // Reset clock state and set time cleanly to new level's exact starting time
    engine.resetLevel(puzzle.start_time, puzzle.target_time, puzzle.running_duration_minutes);
    hudStartTimeEl.textContent = puzzle.start_time;
    hudTargetTimeEl.textContent = puzzle.target_time;
    if (dialReadoutEl) dialReadoutEl.textContent = `${puzzle.start_time}:00`;

    // Update Mechanics Codex Card
    const codexTitle = document.getElementById('codex-title');
    const codexDesc = document.getElementById('codex-description');
    if (codexTitle) codexTitle.textContent = puzzle.title;
    if (codexDesc) codexDesc.textContent = puzzle.description;

    // Mission Formula Banner: Only visible as an introductory tutorial for Epoch 1; removed/hidden for later epochs!
    const formulaCard = document.getElementById('mission-formula-card');
    const formulaBadge = document.getElementById('formula-epoch-badge');
    const formulaText = document.getElementById('formula-text');
    const hintText = document.getElementById('hint-box-text');

    if (formulaCard) {
      if (lvlNum === 1) {
        formulaCard.classList.remove('hidden');
        if (formulaBadge) formulaBadge.textContent = 'Epoch 1 (Tutorial)';
        if (formulaText) {
          formulaText.innerHTML = `<strong>Introductory Tutorial:</strong> Clock runs naturally from ${puzzle.start_time} for 75m to reach 02:15. Slot a <span class="text-primary font-bold">+1/3 pin</span> into Outer Socket 15m to synchronize with Target ${puzzle.target_time}!`;
        }
      } else {
        // Remove / hide mission formula on later epochs as requested
        formulaCard.classList.add('hidden');
      }
    }

    if (hintText) {
      const hintObj = levelHints[lvlNum];
      hintText.innerHTML = `<strong>Hint for Epoch ${lvlNum}:</strong> ${hintObj ? hintObj.hint : 'Arrange your fraction pins along the sweeps to bridge the time offset!'}`;
    }

    renderLevelList();
    dragManager.returnAllPinsToInventory();
    renderPinsAndSockets();

    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');

    // Reset feedback form in victory modal
    const feedbackStatusMsg = document.getElementById('feedback-status-msg');
    if (feedbackStatusMsg) feedbackStatusMsg.classList.add('hidden');
    const feedbackInput = document.getElementById('feedback-input-text');
    if (feedbackInput) feedbackInput.value = '';
  }

  // Next Level from Victory Modal
  document.getElementById('btn-next-level').addEventListener('click', () => {
    victoryOverlay.classList.add('hidden');
    if (currentChallenge && currentChallenge.isCustom) {
      settingsOverlay.classList.remove('hidden');
    } else {
      const nextLvl = currentLevelNumber < puzzlesList.length ? currentLevelNumber + 1 : 1;
      selectLevel(nextLvl);
      showFloatingNotification(`Advancing to Epoch ${nextLvl}! Start: ${puzzlesList.find(p=>p.level_number===nextLvl)?.start_time || ''}`, '#10b981');
    }
  });

  document.getElementById('btn-play-again').addEventListener('click', () => {
    victoryOverlay.classList.add('hidden');
    if (currentChallenge && currentChallenge.isCustom) {
      activateCustomChallenge(currentChallenge.start, currentChallenge.target, currentChallenge.duration, currentChallenge.challenger, currentChallenge.fromFriend);
    } else {
      selectLevel(currentLevelNumber);
      showFloatingNotification(`Epoch ${currentLevelNumber} reset to ${puzzlesList.find(p=>p.level_number===currentLevelNumber)?.start_time || 'start'}!`, '#10b981');
    }
  });

  // Setup Feedback & Reaction Submission (Issue 10)
  let selectedSentiment = 'loved_it';
  let selectedRating = 5;

  document.querySelectorAll('.feedback-reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feedback-reaction-btn').forEach(b => {
        b.classList.remove('bg-primary/20', 'border-primary', 'text-primary');
        b.classList.add('bg-surface-container', 'border-outline-variant');
      });
      btn.classList.add('bg-primary/20', 'border-primary', 'text-primary');
      btn.classList.remove('bg-surface-container', 'border-outline-variant');
      selectedRating = parseInt(btn.dataset.rating, 10) || 5;
      selectedSentiment = btn.dataset.sentiment || 'loved_it';
    });
  });

  const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
  const feedbackInput = document.getElementById('feedback-input-text');
  const feedbackStatusMsg = document.getElementById('feedback-status-msg');

  if (btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener('click', async () => {
      const comment = feedbackInput ? feedbackInput.value.trim() : '';
      try {
        btnSubmitFeedback.disabled = true;
        btnSubmitFeedback.textContent = '...';
        const res = await fetch('/api/game/feedback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...window.chronosAuth.getAuthHeader()
          },
          body: JSON.stringify({
            levelNumber: currentLevelNumber,
            rating: selectedRating,
            sentiment: selectedSentiment,
            comment: comment,
            username: window.chronosAuth.user ? window.chronosAuth.user.username : 'Guest Player'
          })
        });
        const data = await res.json();
        if (data.success) {
          if (feedbackStatusMsg) feedbackStatusMsg.classList.remove('hidden');
          if (feedbackInput) feedbackInput.value = '';
          showFloatingNotification('Feedback saved! Shukriya!', '#10b981');
        }
      } catch (e) {
        showFloatingNotification('Feedback saved locally!', '#10b981');
      } finally {
        btnSubmitFeedback.disabled = false;
        btnSubmitFeedback.textContent = 'Bhejo';
      }
    });
  }

  // -------------------------------------------------------------
  // Custom Challenge & Friend Duel Modal Controls
  // -------------------------------------------------------------
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      document.getElementById('setting-start-time').value = engine.startTimeStr;
      document.getElementById('setting-target-time').value = engine.targetTimeStr;
      document.getElementById('setting-duration').value = engine.runningDurationMins;
      settingsOverlay.classList.remove('hidden');
    });
  }

  const btnCloseSettings = document.getElementById('btn-close-settings');
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      settingsOverlay.classList.add('hidden');
    });
  }

  // Quick Preset Buttons in Duel Modal
  document.querySelectorAll('.preset-duel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.start;
      const t = btn.dataset.target;
      if (s) document.getElementById('setting-start-time').value = s;
      if (t) document.getElementById('setting-target-time').value = t;
    });
  });

  // Play Solo Custom Challenge
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newStart = document.getElementById('setting-start-time').value || '03:35';
    const newTarget = document.getElementById('setting-target-time').value || '05:15';
    const newDuration = parseInt(document.getElementById('setting-duration').value, 10) || 75;
    const challenger = document.getElementById('setting-challenger-name').value.trim() || 'Solo Player';

    activateCustomChallenge(newStart, newTarget, newDuration, challenger, false);
    settingsOverlay.classList.add('hidden');
  });

  // Share Friend Challenge (Copy Link to Clipboard)
  const btnShareFriendChallenge = document.getElementById('btn-share-friend-challenge');
  if (btnShareFriendChallenge) {
    btnShareFriendChallenge.addEventListener('click', () => {
      const start = document.getElementById('setting-start-time').value || '03:35';
      const target = document.getElementById('setting-target-time').value || '05:15';
      const duration = document.getElementById('setting-duration').value || '75';
      const challenger = document.getElementById('setting-challenger-name').value.trim() || 'A Chronomancer Friend';

      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const shareURL = `${origin}${pathname}?start=${encodeURIComponent(start)}&target=${encodeURIComponent(target)}&duration=${encodeURIComponent(duration)}&challenger=${encodeURIComponent(challenger)}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareURL).then(() => {
          showFloatingNotification('🔗 Duel link copied! Share with your friend!', '#10b981');
        }).catch(() => {
          prompt('Copy this Challenge Link to send to your friend:', shareURL);
        });
      } else {
        prompt('Copy this Challenge Link to send to your friend:', shareURL);
      }
    });
  }

  // Activate Custom Challenge State
  function activateCustomChallenge(start, target, duration, challenger, fromFriend = false) {
    currentChallenge = { isCustom: true, fromFriend, challenger, start, target, duration };

    engine.resetLevel(start, target, duration);
    hudStartTimeEl.textContent = start;
    hudTargetTimeEl.textContent = target;
    if (dialReadoutEl) dialReadoutEl.textContent = `${start}:00`;

    // Render prominent challenge banner above clock
    const banner = document.getElementById('friend-challenge-banner');
    if (banner) {
      banner.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <span class="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">swords</span>
            <div>
              <div class="text-primary font-bold uppercase tracking-wider text-[11px] mb-0.5">
                ${fromFriend ? '⚔️ FRIEND CHALLENGE ACCEPTED!' : '⚔️ CUSTOM SOLO CHALLENGE ACTIVE'}
              </div>
              <div class="text-on-surface text-[11px] leading-relaxed">
                ${fromFriend ? `Challenged by <strong class="text-secondary font-bold">${challenger}</strong>: ` : ''}
                Align dial from <strong>${start}</strong> to <strong class="text-primary font-bold">${target}</strong> within ${duration} minutes!
              </div>
            </div>
          </div>
          <button id="btn-dismiss-challenge" class="brass-actuator px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">
            Dismiss ✕
          </button>
        </div>
      `;
      banner.classList.remove('hidden');

      const btnDismiss = document.getElementById('btn-dismiss-challenge');
      if (btnDismiss) {
        btnDismiss.addEventListener('click', () => {
          banner.classList.add('hidden');
        });
      }
    }

    // Update Mechanics Codex Card
    const codexTitle = document.getElementById('codex-title');
    const codexDesc = document.getElementById('codex-description');
    if (codexTitle) codexTitle.textContent = fromFriend ? `Duel: ${challenger}'s Challenge` : 'Custom Parameter Trial';
    if (codexDesc) codexDesc.textContent = `Align the dial from ${start} to ${target} within ${duration}m using your 9 fraction pins!`;

    // Hide tutorial/formula banners during custom challenge
    const formulaCard = document.getElementById('mission-formula-card');
    if (formulaCard) formulaCard.classList.add('hidden');
    const walkthroughBanner = document.getElementById('walkthrough-banner');
    if (walkthroughBanner) walkthroughBanner.classList.add('hidden');

    renderLevelList();
    dragManager.returnAllPinsToInventory();
    renderPinsAndSockets();

    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');

    showFloatingNotification(`⚔️ ${fromFriend ? 'Duel from ' + challenger : 'Custom Challenge'} Loaded! Target: ${target}`, '#10b981');
  }

  // URL Challenge Detection on Page Load
  function checkURLChallenge() {
    try {
      const params = new URLSearchParams(window.location.search);
      const startParam = params.get('start');
      const targetParam = params.get('target');
      const durationParam = parseInt(params.get('duration'), 10) || 75;
      const challengerParam = params.get('challenger') || 'A Friend';

      if (startParam && targetParam) {
        activateCustomChallenge(startParam, targetParam, durationParam, challengerParam, true);
      }
    } catch (err) {
      console.warn('URL Challenge parsing error:', err);
    }
  }

  // Share Victory from Victory Modal
  const btnShareVictory = document.getElementById('btn-share-victory');
  if (btnShareVictory) {
    btnShareVictory.addEventListener('click', () => {
      if (!currentChallenge) return;
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const shareURL = `${origin}${pathname}?start=${encodeURIComponent(currentChallenge.start)}&target=${encodeURIComponent(currentChallenge.target)}&duration=${encodeURIComponent(currentChallenge.duration)}&challenger=${encodeURIComponent(currentChallenge.challenger)}`;

      const victoryText = `🏆 I just solved ${currentChallenge.fromFriend ? currentChallenge.challenger + "'s" : 'the'} Chronos Clock Challenge!\n🕒 Start: ${currentChallenge.start} ➔ 🎯 Target: ${currentChallenge.target}\nCan you beat my solution? Try it here:\n${shareURL}`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(victoryText).then(() => {
          showFloatingNotification('🏆 Victory message copied to clipboard! Send to your challenger!', '#10b981');
        }).catch(() => {
          prompt('Copy victory message to send to your friend:', victoryText);
        });
      } else {
        prompt('Copy victory message to send to your friend:', victoryText);
      }
    });
  }

  // -------------------------------------------------------------
  // Authentication & Session Listeners
  // -------------------------------------------------------------
  function setupAuthListeners() {
    window.chronosAuth.onUserChange(() => updateProfileUI());

    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => {
        authOverlay.classList.remove('hidden');
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        window.chronosAuth.logout();
        showFloatingNotification('Signed out of Chronos Chamber.', '#eec06a');
      });
    }

    // Tab Switcher inside Auth Modal
    const tabSignIn = document.getElementById('modal-tab-signin');
    const tabSignUp = document.getElementById('modal-tab-signup');
    const authFormHeading = document.getElementById('modal-form-heading');
    const authSubmitLabel = document.getElementById('modal-auth-submit-label');
    const emailGroup = document.getElementById('modal-email-group');

    let isSignUpMode = false;

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => {
        isSignUpMode = false;
        tabSignIn.className = 'py-2.5 px-3 rounded-sm font-label-md text-center transition-all bg-surface-container-highest text-primary border border-primary/40 font-semibold shadow-inner flex items-center justify-center gap-2';
        tabSignUp.className = 'py-2.5 px-3 rounded-sm font-label-md text-center transition-all text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center gap-2';
        authFormHeading.textContent = 'Enter Time Chamber';
        authSubmitLabel.textContent = 'UNLOCK CHRONOMETER CHAMBER';
        emailGroup.classList.add('hidden');
      });

      tabSignUp.addEventListener('click', () => {
        isSignUpMode = true;
        tabSignUp.className = 'py-2.5 px-3 rounded-sm font-label-md text-center transition-all bg-surface-container-highest text-primary border border-primary/40 font-semibold shadow-inner flex items-center justify-center gap-2';
        tabSignIn.className = 'py-2.5 px-3 rounded-sm font-label-md text-center transition-all text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center gap-2';
        authFormHeading.textContent = 'Enroll in Archive Registry';
        authSubmitLabel.textContent = 'FORGE TEMPORAL SEAL';
        emailGroup.classList.remove('hidden');
      });
    }

    // Modal Form Submission
    const authForm = document.getElementById('modal-auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const handle = document.getElementById('modal-handle-input').value;
        const passkey = document.getElementById('modal-passkey-input').value;
        const email = document.getElementById('modal-email-input').value;
        const authErrorEl = document.getElementById('modal-auth-error');

        authErrorEl.textContent = '';
        authErrorEl.classList.add('hidden');

        try {
          let res;
          if (isSignUpMode) {
            res = await window.chronosAuth.signup(handle, email, passkey);
          } else {
            res = await window.chronosAuth.login(handle, passkey);
          }

          if (res.success) {
            authOverlay.classList.add('hidden');
            showFloatingNotification(`Welcome, ${res.user.username}!`, '#10b981');
          } else {
            authErrorEl.textContent = res.error || 'Authentication failed.';
            authErrorEl.classList.remove('hidden');
          }
        } catch (err) {
          authErrorEl.textContent = 'Network or server error.';
          authErrorEl.classList.remove('hidden');
        }
      });
    }

    // Guest Mode Button
    const btnGuest = document.getElementById('btn-modal-guest');
    if (btnGuest) {
      btnGuest.addEventListener('click', () => {
        window.chronosAuth.enableGuestMode();
        authOverlay.classList.add('hidden');
        showFloatingNotification('Entered as Guest Calibrator.', '#ffb692');
      });
    }

    // Close Auth Modal
    const btnCloseAuth = document.getElementById('btn-close-auth');
    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', () => {
        authOverlay.classList.add('hidden');
      });
    }

    updateProfileUI();
  }

  function updateProfileUI() {
    const user = window.chronosAuth.user;
    if (user) {
      usernameDisplay.textContent = user.username;
      rankDisplay.textContent = user.rank_title || 'Level 1 Chronomancer';
      userProfileBar.classList.remove('hidden');
      btnOpenAuth.classList.add('hidden');
    } else {
      userProfileBar.classList.add('hidden');
      btnOpenAuth.classList.remove('hidden');
    }
  }

  // Floating notification pill
  function showFloatingNotification(msg, color = '#cda250') {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 z-[99999] px-4 py-2.5 rounded border shadow-2xl font-label-sm text-[12px] flex items-center gap-2 animate-bounce';
    toast.style.backgroundColor = '#111319';
    toast.style.borderColor = color;
    toast.style.color = '#e2e2eb';
    toast.style.boxShadow = `0 4px 20px ${color}40`;
    toast.innerHTML = `
      <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
      <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  // -------------------------------------------------------------
  // Tutorial, Hints & Interactive Walkthrough Engine
  // -------------------------------------------------------------
  const tutorialOverlay = document.getElementById('tutorial-modal-overlay');
  const btnOpenTutorial = document.getElementById('btn-open-tutorial');
  const btnSectionTutorial = document.getElementById('btn-section-tutorial');
  const btnCloseTutorial = document.getElementById('btn-close-tutorial');
  const btnGotIt = document.getElementById('btn-got-it');

  const btnToggleHint = document.getElementById('btn-toggle-hint');
  const hintBox = document.getElementById('hint-box');

  const walkthroughBanner = document.getElementById('walkthrough-banner');
  const walkthroughTitle = document.getElementById('walkthrough-step-title');
  const walkthroughDesc = document.getElementById('walkthrough-step-desc');
  const btnWalkthroughNext = document.getElementById('btn-walkthrough-next');
  const btnStartWalkthrough = document.getElementById('btn-start-walkthrough');

  let walkthroughStep = 0;

  // Toggle Hint Box
  if (btnToggleHint && hintBox) {
    btnToggleHint.addEventListener('click', () => {
      hintBox.classList.toggle('hidden');
    });
  }

  // Tutorial Modal Open / Close
  function openTutorialModal() {
    if (tutorialOverlay) tutorialOverlay.classList.remove('hidden');
  }

  function closeTutorialModal() {
    if (tutorialOverlay) tutorialOverlay.classList.add('hidden');
  }

  if (btnOpenTutorial) btnOpenTutorial.addEventListener('click', openTutorialModal);
  if (btnSectionTutorial) btnSectionTutorial.addEventListener('click', openTutorialModal);
  if (btnCloseTutorial) btnCloseTutorial.addEventListener('click', closeTutorialModal);
  if (btnGotIt) btnGotIt.addEventListener('click', closeTutorialModal);

  // Interactive Guided Walkthrough Controller
  function startInteractiveWalkthrough() {
    closeTutorialModal();
    selectLevel(1);
    walkthroughStep = 1;
    if (walkthroughBanner) walkthroughBanner.classList.remove('hidden');
    renderWalkthroughStep();
  }

  function clearWalkthroughHighlights() {
    document.querySelectorAll('.hint-target, .ring-4, .ring-primary, .ring-2').forEach(el => {
      el.classList.remove('hint-target', 'ring-4', 'ring-primary', 'ring-2');
    });
    const formulaCard = document.getElementById('mission-formula-card');
    if (formulaCard) formulaCard.classList.remove('border-primary', 'ring-2', 'ring-primary');
  }

  function renderWalkthroughStep() {
    clearWalkthroughHighlights();

    if (walkthroughStep === 1) {
      walkthroughTitle.textContent = 'Walkthrough: Step 1 of 4 (The Math)';
      walkthroughDesc.textContent = 'Start is 01:00. In 75 min natural duration, it reaches 02:15. Target is 02:35. We need +1/3 hr (+20m)!';
      btnWalkthroughNext.textContent = 'Next: Pick Pin ➔';
      btnWalkthroughNext.classList.remove('hidden');

      const formulaCard = document.getElementById('mission-formula-card');
      if (formulaCard) formulaCard.classList.add('ring-2', 'ring-primary');
    } else if (walkthroughStep === 2) {
      walkthroughTitle.textContent = 'Walkthrough: Step 2 of 4 (Choose Pin)';
      walkthroughDesc.textContent = 'Tap or drag a Green (+1/3) Pin from the Time Pin Matrix on the right side panel.';
      btnWalkthroughNext.textContent = 'Next: Choose Socket ➔';

      const trayFh = document.getElementById('tray-pins-fh');
      if (trayFh) trayFh.classList.add('ring-4', 'ring-primary', 'rounded-lg');
    } else if (walkthroughStep === 3) {
      walkthroughTitle.textContent = 'Walkthrough: Step 3 of 4 (Slot Pin)';
      walkthroughDesc.textContent = 'Tap or drop the pin into Outer Socket "15m". At 02:15, the minute hand hits it and warps +1/3 hr (+20m) to reach 02:35!';
      btnWalkthroughNext.textContent = 'Next: Start Clock ➔';

      const socket15m = document.querySelector('.socket-hole[data-circle="outer"][data-socket-index="3"]');
      if (socket15m) socket15m.classList.add('hint-target');
    } else if (walkthroughStep === 4) {
      walkthroughTitle.textContent = 'Walkthrough: Step 4 of 4 (Execute Run)';
      walkthroughDesc.textContent = '🎉 Perfect! The pin is slotted. Now press START CLOCK to watch time warp and solve the puzzle!';
      btnWalkthroughNext.textContent = 'Dismiss Guide ✓';

      if (btnStart) btnStart.classList.add('ring-4', 'ring-primary');
    }
  }

  if (btnWalkthroughNext) {
    btnWalkthroughNext.addEventListener('click', () => {
      if (walkthroughStep < 4) {
        walkthroughStep++;
        renderWalkthroughStep();
      } else {
        clearWalkthroughHighlights();
        if (walkthroughBanner) walkthroughBanner.classList.add('hidden');
        walkthroughStep = 0;
      }
    });
  }

  if (btnStartWalkthrough) {
    btnStartWalkthrough.addEventListener('click', startInteractiveWalkthrough);
  }

  // Walkthrough automatic advance hooks
  window.onPinSelectedHook = function(pinId) {
    if (walkthroughStep === 2) {
      walkthroughStep = 3;
      renderWalkthroughStep();
    }
  };

  window.onPinSlottedHook = function(circle, index, pin) {
    if (walkthroughStep === 3 && circle === 'inner' && index === 1) {
      walkthroughStep = 4;
      renderWalkthroughStep();
    }
  };

  // When clock starts, clear walkthrough highlights
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      clearWalkthroughHighlights();
      if (walkthroughBanner) walkthroughBanner.classList.add('hidden');
      walkthroughStep = 0;
    });
  }

});
