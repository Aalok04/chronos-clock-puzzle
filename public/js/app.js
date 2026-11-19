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
  const tutorialOverlay = document.getElementById('tutorial-modal-overlay');

  const userProfileBar = document.getElementById('user-profile-bar');
  const usernameDisplay = document.getElementById('player-username');
  const rankDisplay = document.getElementById('player-rank');
  const btnLogout = document.getElementById('btn-logout');
  const btnOpenAuth = document.getElementById('btn-open-auth');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const hintBox = document.getElementById('hint-box');

  // Curated Puzzles Cache & Challenge Duel State
  let currentLevelNumber = 1;
  let puzzlesList = [];
  let currentChallenge = null; // { isCustom: true, fromFriend: boolean, challenger: string, start: string, target: string, duration: number }
  let isCompulsoryAuth = false;
  let pendingLevelAfterAuth = null;

  // Level hints database (Exclusively Fractions) for all 15 Epochs
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
      hint: 'Natural run from 06:00 reaches 07:15. You need +45 minutes to reach 08:00. Coordinate multiple fraction pins along the minute sweep!'
    },
    4: {
      hint: 'Natural run from 07:00 reaches exactly 08:15! If needed, let time run or balance opposing warps.'
    },
    5: {
      hint: 'Natural run from 03:35 reaches 04:50. Advance the minute hand +25 minutes using fraction warps to synchronize with 05:15.'
    },
    6: {
      hint: 'Natural run from 02:00 reaches 03:15. Target is 05:00. Net shift needed: +1h 45m. Coordinate both rings: place 1 Blue (+1/6 = +2h) into Inner Ring and 1 Red (-1/4 = -15m) into Outer Ring! <strong>Constraint: Max 2 pins. Both rings required.</strong>'
    },
    7: {
      hint: 'Natural run from 08:00 reaches 09:15. Target is 01:00 (crosses 12 to 13:00). Net shift needed: +3h 45m. Place 1 Green (+1/3 = +4h) into Inner Ring and 1 Red (-1/4 = -15m) into Outer Ring! <strong>Constraint: Max 2 pins. Both rings required.</strong>'
    },
    8: {
      hint: 'Natural run from 11:00 reaches 12:15. Target is 09:35. Net shift needed: -3h + 20m. Place 1 Red (-1/4 = -3h) into Inner Ring and 1 Green (+1/3 = +20m) into Outer Ring! <strong>Constraint: Max 2 pins. Both rings required.</strong>'
    },
    9: {
      hint: 'Natural run from 10:00 reaches 11:15. Target is 02:45. Net shift needed: +4h - 30m. Place 1 Green (+1/3 = +4h) into Inner Ring and 2 Red (-1/4 each = -30m) into Outer Ring! <strong>Constraint: Max 3 pins. Both rings required.</strong>'
    },
    10: {
      hint: 'Natural run from 05:00 reaches 06:15. Target is 02:35. Net shift needed: +8h + 20m. Place 2 Green (+1/3 each = +8h) into Inner Ring and 1 Green (+1/3 = +20m) into Outer Ring! <strong>Constraint: Max 3 pins. Both rings required.</strong>'
    },
    11: {
      hint: 'Natural run from 09:00 reaches 10:15. Target is 04:55. Net shift needed: 6h shift + 40m. Outer Ring: 2 Green (+40m). Inner Ring: 2 Red (-6h) OR 1 Green + 1 Blue (+6h). Both solutions are accepted! <strong>Constraint: Max 4 pins. Both rings required.</strong>'
    },
    12: {
      hint: 'Natural run from 07:00 reaches 08:15. Target is 03:45. Net shift needed: +8h - 30m. Place 2 Green (+1/3 each = +8h) into Inner Ring and 2 Red (-1/4 each = -30m) into Outer Ring! <strong>Constraint: Max 4 pins. Both rings required.</strong>'
    },
    13: {
      hint: 'Natural run from 04:00 reaches 05:15. Target is 08:35. Net shift needed: 3h net hour shift + 20m. Outer Ring: 1 Green (+20m). Inner Ring: 3 Red (-9h = +3h mod 12) OR 1 Green + 1 Red + 1 Blue (+3h). Both solutions accepted! <strong>Constraint: Max 4 pins. Both rings required.</strong>'
    },
    14: {
      hint: 'Natural run from 10:00 reaches 11:15. Target is 04:10. Net shift needed: +5h - 5m. Inner Ring: 2 Green (+8h) + 1 Red (-3h) = +5h. Outer Ring: 1 Red (-15m) + 1 Blue (+10m) = -5m. <strong>Constraint: Max 5 pins. Both rings required.</strong>'
    },
    15: {
      hint: 'Pinnacle Trial: Natural run from 06:00 reaches 07:15. Target is 06:05. Net shift needed: -1h - 10m. Inner Ring: 1 Red (-3h) + 1 Blue (+2h) = -1h. Outer Ring: 1 Green (+20m) + 2 Red (-30m) = -10m. <strong>Constraint: Max 5 pins. Both rings required.</strong>'
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

  // -------------------------------------------------------------
  // UI Tick Updater with Continuous Direction-Aware Hand Angles
  // -------------------------------------------------------------
  let currentMinuteRotation = null;
  let currentHourRotation = null;

  function calculateContinuousAngle(currentRotation, targetAngleMod, direction) {
    if (currentRotation === null || direction === 'reset') {
      return targetAngleMod;
    }

    const currentBase = ((currentRotation % 360) + 360) % 360;
    const targetBase = ((targetAngleMod % 360) + 360) % 360;

    if (direction === 'rewind') {
      // Step backwards to target starting angle
      let diff = currentBase - targetBase;
      if (diff < 0) diff += 360;
      if (Math.abs(diff) < 1e-4 || Math.abs(diff - 360) < 1e-4) diff = 0;
      return currentRotation - diff;
    }

    if (direction === 'backward') {
      // Pin warped backwards: rotate strictly counter-clockwise
      let diff = currentBase - targetBase;
      if (diff < 0) diff += 360;
      if (Math.abs(diff) < 1e-4 || Math.abs(diff - 360) < 1e-4) diff = 0;
      return currentRotation - diff;
    }

    // Default / forward: normal tick or forward pin warp: rotate strictly clockwise
    let diff = targetBase - currentBase;
    if (diff < 0) diff += 360;
    if (Math.abs(diff) < 1e-4 || Math.abs(diff - 360) < 1e-4) diff = 0;
    return currentRotation + diff;
  }

  function updateUIOnTick(data) {
    const { displayedTime, minuteAngle, hourAngle, elapsedDuration, totalDuration, progressPercent, smooth, rewind, direction = 'forward' } = data;

    // Calculate direction-aware continuous hand rotations to eliminate reverse movement bugs
    currentMinuteRotation = calculateContinuousAngle(currentMinuteRotation, minuteAngle, direction);
    currentHourRotation = calculateContinuousAngle(currentHourRotation, hourAngle, direction);

    // Apply hand angles (SVG elements rotate around 300px 300px)
    if (minuteHandEl) {
      if (smooth || rewind) {
        void minuteHandEl.offsetWidth;
      }
      minuteHandEl.setAttribute('class', `clock-hand ${rewind ? 'rewind-transition' : (smooth ? 'smooth-transition' : '')}`);
      minuteHandEl.style.transform = `rotate(${currentMinuteRotation}deg)`;
      if (!smooth && !rewind) {
        void minuteHandEl.offsetWidth;
      }
    }
    if (hourHandEl) {
      if (smooth || rewind) {
        void hourHandEl.offsetWidth;
      }
      hourHandEl.setAttribute('class', `clock-hand ${rewind ? 'rewind-transition' : (smooth ? 'smooth-transition' : '')}`);
      hourHandEl.style.transform = `rotate(${currentHourRotation}deg)`;
      if (!smooth && !rewind) {
        void hourHandEl.offsetWidth;
      }
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

  // 4. Check Active User Session - Compulsory Authentication Enforced
  await window.chronosAuth.checkSession();
  setupAuthListeners();

  // 5. Load Puzzles from API (or fallback)
  await loadPuzzles();

  if (!window.chronosAuth.user) {
    openCompulsoryAuthModal(1);
  } else {
    await syncGuestProgress();
  }

  // 6. Check if incoming URL has a custom friend challenge duel
  checkURLChallenge();

  // 7. Real-Time Player Presence Heartbeat Tracker (For Owner Control Deck)
  let chronosSessionId = sessionStorage.getItem('chronos_session_id');
  if (!chronosSessionId) {
    chronosSessionId = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    sessionStorage.setItem('chronos_session_id', chronosSessionId);
  }

  function sendPresenceHeartbeat(state = 'idle') {
    try {
      const token = localStorage.getItem('chronos_token');
      const userStr = localStorage.getItem('chronos_user');
      const user = userStr ? JSON.parse(userStr) : null;

      fetch('/api/game/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sessionId: chronosSessionId,
          level: currentLevelNumber || 1,
          state: state,
          username: user ? user.username : 'Guest Chronomancer'
        })
      }).catch(() => {});
    } catch (e) {}
  }

  // Initial presence ping and 40s heartbeat loop
  sendPresenceHeartbeat('idle');
  setInterval(() => sendPresenceHeartbeat(engine && engine.state === 'RUNNING' ? 'running' : 'idle'), 40000);

  // -------------------------------------------------------------
  // Pin Activation Visuals (Mechanical Pause & Glow)
  // -------------------------------------------------------------
  function handlePinActivationVisuals(data) {
    const { phase, pin, circle, index } = data;
    const socketEl = document.querySelector(`.socket-hole[data-circle="${circle}"][data-socket-index="${index}"]`);

    if (socketEl) {
      if (phase === 'APPLYING') {
        socketEl.classList.add('pin-activating', 'pin-triggered');
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
      } else if (phase === 'SETTLING_PAUSE' || phase === 'POST_RESUME') {
        socketEl.classList.remove('pin-activating');
        socketEl.classList.add('pin-triggered');
      }
    }
  }

  // -------------------------------------------------------------
  // Completion & Victory Handler
  // -------------------------------------------------------------
  async function handleGameCompletion(result) {
    const { isSuccess, finalTime, targetTime } = result;

    const outerCount = engine.sockets.outer.filter(Boolean).length;
    const innerCount = engine.sockets.inner.filter(Boolean).length;
    const bothRingsUsed = (currentLevelNumber < 6 || (currentChallenge && currentChallenge.isCustom) || (outerCount > 0 && innerCount > 0));

    if (isSuccess && bothRingsUsed) {
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
        if (btnNextLevel) {
          if (currentLevelNumber === 2 && !window.chronosAuth.user) {
            btnNextLevel.textContent = 'Unlock Epoch 3 (Sign In) »';
          } else {
            btnNextLevel.textContent = 'Next Epoch »';
          }
        }
        if (btnShareVictory) btnShareVictory.classList.add('hidden');
      }

      victoryOverlay.classList.remove('hidden');

      // Record to backend (or queue locally if playing in guest mode)
      try {
        const curPuzzle = puzzlesList.find(p => p.level_number === currentLevelNumber);
        const res = await fetch('/api/game/attempt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...window.chronosAuth.getAuthHeader()
          },
          body: JSON.stringify({
            puzzleId: curPuzzle ? curPuzzle.id : currentLevelNumber,
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
          window.chronosAuth.user.unlocked_level = resData.updatedProfile.unlocked_level;
          window.chronosAuth.user.completed_levels = resData.updatedProfile.completed_levels;
          window.chronosAuth.user.rank_title = resData.updatedProfile.rank_title;
          window.chronosAuth.user.achievements = resData.updatedProfile.achievements;
          if (typeof window.chronosAuth.saveSession === 'function') {
            window.chronosAuth.saveSession(window.chronosAuth.token, window.chronosAuth.user);
          }
          updateProfileUI();
        } else if (!window.chronosAuth.user) {
          // Track guest-solved levels so they sync immediately upon signing up or logging in!
          try {
            const guestSolved = JSON.parse(localStorage.getItem('chronos_guest_solved') || '[]');
            if (!guestSolved.includes(currentLevelNumber)) {
              guestSolved.push(currentLevelNumber);
              localStorage.setItem('chronos_guest_solved', JSON.stringify(guestSolved));
            }
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Could not sync victory with cloud database:', err);
      }
    } else {
      if (isSuccess && !bothRingsUsed) {
        showFloatingNotification(`Epoch ${currentLevelNumber} requires pins in BOTH rings (Inner & Outer)! Rewinding...`, '#f59e0b');
        setTimeout(() => {
          engine.autoRewindReset();
        }, 1500);
        return;
      }
      // Show Paradox notification
      showFloatingNotification(`Paradox: Reached ${finalTime} instead of ${targetTime}. Rewinding...`, '#ef4444');
    }
  }

  function handleGameReset() {
    document.querySelectorAll('.socket-hole.pin-triggered').forEach(el => {
      el.classList.remove('pin-triggered');
    });
    dragManager.returnAllPinsToInventory();
    renderPinsAndSockets();
    btnStart.disabled = false;
    btnStart.classList.remove('opacity-50', 'cursor-not-allowed');
    if (hintBox) hintBox.classList.add('hidden');
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
          if (pin.hasTriggered) {
            socketEl.classList.add('pin-triggered');
          } else {
            socketEl.classList.remove('pin-triggered');
            socketEl.style.backgroundColor = pin.bgHex;
            socketEl.style.borderColor = pin.borderHex;
            socketEl.style.boxShadow = `0 0 12px ${pin.bgHex}, inset 0 1px 0 rgba(255,255,255,0.4)`;
          }
          socketEl.innerHTML = '';
          const effectDesc = circle === 'outer'
            ? `${pin.label === '+1/3' ? '+20m' : (pin.label === '-1/4' ? '-15m' : '+10m')} on minute sweep`
            : `${pin.label === '+1/3' ? '+4h (12/3)' : (pin.label === '-1/4' ? '-3h (12/4)' : '+2h (12/6)')} on hour sweep`;
          socketEl.title = `Slotted: ${pin.label} (${circle === 'outer' ? (i * 5) + 'm' : (i + 1) + 'h'} socket ➔ ${effectDesc}) — Click to remove`;
        } else {
          socketEl.classList.remove('has-pin', 'pin-triggered');
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

    updatePinBudgetDisplay();
  }

  function updatePinBudgetDisplay() {
    const badge = document.getElementById('pin-budget-badge');
    if (!badge) return;
    const count = dragManager.getPlacedPinsCount();
    const max = dragManager.maxPins;

    if (max === null) {
      badge.textContent = count > 0 ? `Unlimited (${count} Placed)` : 'Unlimited';
      badge.className = 'px-2 py-0.5 rounded font-bold text-[10px] bg-primary/20 text-primary border border-primary/40 transition-colors';
    } else {
      badge.textContent = `Placed: ${count} / ${max} Max`;
      if (count >= max) {
        badge.className = 'px-2 py-0.5 rounded font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm';
      } else {
        badge.className = 'px-2 py-0.5 rounded font-bold text-[10px] bg-primary/20 text-primary border border-primary/40 transition-colors';
      }
    }
  }

  // -------------------------------------------------------------
  // Controls: Start, Reset, Speed
  // -------------------------------------------------------------
  btnStart.addEventListener('click', () => {
    if (!window.chronosAuth.user) {
      showFloatingNotification('Sign in or create an account to start the clock!', '#f59e0b');
      openCompulsoryAuthModal(currentLevelNumber || 1);
      return;
    }
    if (engine.state === 'IDLE') {
      const outerCount = engine.sockets.outer.filter(Boolean).length;
      const innerCount = engine.sockets.inner.filter(Boolean).length;
      if (currentLevelNumber >= 6 && (!currentChallenge || !currentChallenge.isCustom)) {
        if (outerCount === 0 || innerCount === 0) {
          showFloatingNotification(`Epoch ${currentLevelNumber} requires pins in BOTH the Inner Ring (Hour Hand) and Outer Ring (Minute Hand)!`, '#f59e0b');
          return;
        }
      }
      if (hintBox) hintBox.classList.add('hidden');
      sendPresenceHeartbeat('running');
      engine.start();
      btnStart.disabled = true;
      btnStart.classList.add('opacity-50', 'cursor-not-allowed');
      if (window.chronosAudio) window.chronosAudio.playTick();
    }
  });

  btnReset.addEventListener('click', () => {
    sendPresenceHeartbeat('idle');
    document.querySelectorAll('.socket-hole.pin-triggered').forEach(el => {
      el.classList.remove('pin-triggered');
    });
    if (hintBox) hintBox.classList.add('hidden');
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
        { id: 1, level_number: 1, title: 'Epoch I: The First Escapement', start_time: '01:00', target_time: '02:35', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 02:15. You need an extra 20 minutes to reach 02:35.' },
        { id: 2, level_number: 2, title: 'Epoch II: Equilibrium of Gears', start_time: '12:00', target_time: '01:20', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 01:15. A delicate balance (+20m and -15m) bridges the 5-minute offset to 01:20.' },
        { id: 3, level_number: 3, title: 'Epoch III: The Temporal Paradox', start_time: '06:00', target_time: '08:00', running_duration_minutes: 75, max_pins: null, description: 'Coordinate concentric rings to bridge a 45-minute offset from 07:15 natural run end to 08:00.' },
        { id: 4, level_number: 4, title: 'Epoch IV: Synchronized Arbors', start_time: '07:00', target_time: '08:15', running_duration_minutes: 75, max_pins: null, description: 'Natural 75m passage synchronizes directly with 08:15. Maintain balance across sweeps.' },
        { id: 5, level_number: 5, title: 'Epoch V: Gear-Train Resonance', start_time: '03:35', target_time: '05:15', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 04:50. Advance the minute hand +25 minutes to strike 05:15.' },
        { id: 6, level_number: 6, title: 'Epoch VI: Dual-Ring Harmony', start_time: '02:00', target_time: '05:00', running_duration_minutes: 75, max_pins: 2, description: 'Natural passage reaches 03:15. Coordinate both concentric rings (+2h Hour Hand, -15m Minute Hand) with a 2-pin budget to strike 05:00.' },
        { id: 7, level_number: 7, title: 'Epoch VII: Concentric Cross-Sweep', start_time: '08:00', target_time: '01:00', running_duration_minutes: 75, max_pins: 2, description: 'Natural passage reaches 09:15. Advance the hour step (+4h) and calibrate the minute sweep (-15m) within 2 pins to synchronize with 01:00.' },
        { id: 8, level_number: 8, title: 'Epoch VIII: Counter-Clock Cadence', start_time: '11:00', target_time: '09:35', running_duration_minutes: 75, max_pins: 2, description: 'Natural run reaches 12:15. Apply hour deceleration (-3h) and advance minute travel (+20m) using max 2 pins to strike 09:35.' },
        { id: 9, level_number: 9, title: 'Epoch IX: Triad Escapement', start_time: '10:00', target_time: '02:45', running_duration_minutes: 75, max_pins: 3, description: 'Natural run reaches 11:15. Coordinate an hour warp (+4h) with dual decelerations (-30m) across both rings using at most 3 pins to lock at 02:45.' },
        { id: 10, level_number: 10, title: 'Epoch X: Dual-Arbor Leap', start_time: '05:00', target_time: '02:35', running_duration_minutes: 75, max_pins: 3, description: 'Natural run reaches 06:15. Double up inner ring advances (+8h) and coordinate the minute sweep (+20m) within a strict 3-pin limit to reach 02:35.' },
        { id: 11, level_number: 11, title: 'Epoch XI: Harmonic Bifurcation', start_time: '09:00', target_time: '04:55', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 10:15. Multiple paths exist! Advance minutes (+40m) and coordinate hour shifts to achieve 04:55 using at most 4 pins.' },
        { id: 12, level_number: 12, title: 'Epoch XII: Quadrant Equilibrium', start_time: '07:00', target_time: '03:45', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 08:15. Coordinate dual inner advances (+8h) with dual minute decelerations (-30m) under a 4-pin constraint to strike 03:45.' },
        { id: 13, level_number: 13, title: 'Epoch XIII: Chrono Resonance Convergence', start_time: '04:00', target_time: '08:35', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 05:15. Multi-pin concentration on the inner ring paired with minute pacing to bridge the temporal gap to 08:35 with 4 pins.' },
        { id: 14, level_number: 14, title: 'Epoch XIV: Multi-Phase Dial Synchrony', start_time: '10:00', target_time: '04:10', running_duration_minutes: 75, max_pins: 5, description: 'Natural run reaches 11:15. Complex 5-pin coordination across mixed colors and directions on both rings to align the dial at 04:10.' },
        { id: 15, level_number: 15, title: 'Epoch XV: Grand Chronomancer Apex', start_time: '06:00', target_time: '06:05', running_duration_minutes: 75, max_pins: 5, description: 'The pinnacle trial. Natural run reaches 07:15. Master mixed color fractions and counter-sweeps on both rings within 5 pins to strike 06:05.' }
      ];
    }
    renderLevelList();
    if (window.chronosAuth.user) {
      selectLevel(window.chronosAuth.user.current_level || currentLevelNumber);
    }
  }

  function openCompulsoryAuthModal(targetLvl = null) {
    isCompulsoryAuth = true;
    pendingLevelAfterAuth = targetLvl;

    const compulsoryBanner = document.getElementById('modal-compulsory-banner');
    if (compulsoryBanner) compulsoryBanner.classList.remove('hidden');

    const btnGuest = document.getElementById('btn-modal-guest');
    if (btnGuest) btnGuest.classList.add('hidden');

    const btnCloseAuth = document.getElementById('btn-close-auth');
    if (btnCloseAuth) btnCloseAuth.classList.add('hidden');

    const knownEmail = localStorage.getItem('chronos_known_email') || '';
    const isReturningUser = localStorage.getItem('chronos_returning_user') === 'true' || !!knownEmail;
    const tabSignIn = document.getElementById('modal-tab-signin');
    const tabSignUp = document.getElementById('modal-tab-signup');
    const handleInput = document.getElementById('modal-handle-input');

    if (isReturningUser && tabSignIn) {
      tabSignIn.click();
      if (handleInput && !handleInput.value && knownEmail) {
        handleInput.value = knownEmail;
      }
    } else if (tabSignUp) {
      tabSignUp.click();
    }

    authOverlay.classList.remove('hidden');
  }

  function renderLevelList() {
    const listContainer = document.getElementById('level-selector-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const isCustomActive = currentChallenge && currentChallenge.isCustom;
    const isAuthed = !!window.chronosAuth.user;
    const completedLevels = (window.chronosAuth.user && Array.isArray(window.chronosAuth.user.completed_levels))
      ? window.chronosAuth.user.completed_levels.map(Number)
      : [];

    puzzlesList.forEach(p => {
      const btn = document.createElement('button');
      const isCurrent = !isCustomActive && (p.level_number === currentLevelNumber);
      const isLocked = !isAuthed;
      const isCompleted = isAuthed && completedLevels.includes(Number(p.level_number));

      btn.className = `w-full flex items-center justify-between px-3 py-2 transition-all text-label-sm font-label-sm ${
        isCurrent
          ? 'bg-surface-container-highest border-l-2 border-primary text-primary font-semibold'
          : isLocked
            ? 'text-outline hover:text-on-surface-variant hover:bg-surface-container-high/60 opacity-80'
            : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
      }`;
      btn.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-sm ${
            isCompleted ? 'text-emerald-400' : (isCurrent ? 'text-primary' : (isLocked ? 'text-outline' : 'text-primary/70'))
          }">${isLocked ? 'lock' : (isCompleted ? 'check_circle' : 'lock_open')}</span>
          <span>Epoch ${p.level_number}</span>
        </div>
        <div class="flex items-center gap-1.5">
          ${!isAuthed ? `<span class="text-[9px] px-1.5 py-0.2 bg-outline-variant/30 text-outline border border-outline-variant/50 rounded font-mono">Sign In</span>` : ''}
          ${isCompleted ? `<span class="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded font-mono font-bold">SOLVED</span>` : ''}
          ${p.max_pins ? `<span class="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono font-bold">${p.max_pins} max</span>` : ''}
          <span class="text-[9px] ${isCurrent ? 'px-1.5 py-0.5 bg-primary/20 rounded text-primary border border-primary/30' : 'text-outline'}">
            ${isCurrent ? 'ACTIVE' : p.target_time}
          </span>
        </div>
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
      if (!window.chronosAuth.user) {
        showFloatingNotification('Sign in or create an account to challenge or duel!', '#f59e0b');
        openCompulsoryAuthModal(1);
        return;
      }
      settingsOverlay.classList.remove('hidden');
    });
    listContainer.appendChild(duelBtn);
  }

  function selectLevel(lvlNum) {
    if (!window.chronosAuth.user) {
      showFloatingNotification('Authentication required to play Chronos!', '#f59e0b');
      openCompulsoryAuthModal(lvlNum || 1);
      return;
    }

    currentChallenge = null;
    const challengeBanner = document.getElementById('friend-challenge-banner');
    if (challengeBanner) challengeBanner.classList.add('hidden');

    currentLevelNumber = lvlNum;
    const puzzle = puzzlesList.find(p => p.level_number === lvlNum);
    if (!puzzle) return;

    // Set pin constraint for this level
    dragManager.setMaxPins(puzzle.max_pins || null);

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

    // Ensure hint box is hidden when transitioning or loading epochs
    if (hintBox) {
      hintBox.classList.add('hidden');
    }
    document.querySelectorAll('.socket-hole.pin-triggered').forEach(el => {
      el.classList.remove('pin-triggered');
    });

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

    // Compulsory Level 1 Tutorial Window Check
    if (lvlNum === 1 && !sessionStorage.getItem('chronos_level1_tutorial_seen')) {
      openTutorialModal();
    }
  }

  // Next Level from Victory Modal
  document.getElementById('btn-next-level').addEventListener('click', () => {
    victoryOverlay.classList.add('hidden');
    if (currentChallenge && currentChallenge.isCustom) {
      settingsOverlay.classList.remove('hidden');
    } else {
      if (!window.chronosAuth.user) {
        showFloatingNotification('Sign in or create an account to advance!', '#f59e0b');
        openCompulsoryAuthModal(currentLevelNumber + 1);
        return;
      }
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

    // Ensure hint box is hidden when transitioning or loading epochs
    if (hintBox) {
      hintBox.classList.add('hidden');
    }
    document.querySelectorAll('.socket-hole.pin-triggered').forEach(el => {
      el.classList.remove('pin-triggered');
    });

    renderLevelList();
    dragManager.setMaxPins(null);
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
    window.chronosAuth.onUserChange(() => {
      updateProfileUI();
      syncGuestProgress();
    });

    const btnGuest = document.getElementById('btn-modal-guest');
    const compulsoryBanner = document.getElementById('modal-compulsory-banner');
    const handleLabel = document.getElementById('modal-handle-label');
    const handleInput = document.getElementById('modal-handle-input');
    const emailLabel = document.getElementById('modal-email-label');
    const emailInput = document.getElementById('modal-email-input');

    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => {
        openCompulsoryAuthModal(currentLevelNumber || 1);
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        window.chronosAuth.logout();
        showFloatingNotification('Signed out of Chronos Chamber.', '#eec06a');
        updateProfileUI();
        openCompulsoryAuthModal(1);
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
        authFormHeading.textContent = 'Sign In';
        authSubmitLabel.textContent = 'SIGN IN & ENTER CHAMBER';
        if (handleLabel) handleLabel.textContent = 'Username or Email';
        if (handleInput) handleInput.placeholder = 'Enter your username or email';
        emailGroup.classList.add('hidden');
      });

      tabSignUp.addEventListener('click', () => {
        isSignUpMode = true;
        tabSignUp.className = 'py-2.5 px-3 rounded-sm font-label-md text-center transition-all bg-surface-container-highest text-primary border border-primary/40 font-semibold shadow-inner flex items-center justify-center gap-2';
        tabSignIn.className = 'py-2.5 px-3 rounded-sm font-label-md text-center transition-all text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center gap-2';
        authFormHeading.textContent = 'Create Account';
        authSubmitLabel.textContent = 'CREATE ACCOUNT & CONTINUE';
        if (handleLabel) handleLabel.textContent = 'Username';
        if (handleInput) handleInput.placeholder = 'Enter your username';
        if (emailLabel) emailLabel.textContent = 'Email';
        if (emailInput) emailInput.placeholder = 'Enter your email';
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
            const requestedLvl = pendingLevelAfterAuth;
            isCompulsoryAuth = false;
            pendingLevelAfterAuth = null;

            if (compulsoryBanner) compulsoryBanner.classList.add('hidden');
            if (btnGuest) btnGuest.classList.add('hidden');
            const btnCloseAuth = document.getElementById('btn-close-auth');
            if (btnCloseAuth) btnCloseAuth.classList.remove('hidden');

            showFloatingNotification(`Welcome, ${res.user.username}!`, '#10b981');
            updateProfileUI();

            // Sync any completed levels if present
            await syncGuestProgress(requestedLvl);

            // Restore returning user's saved current_level from the permanent database
            const savedLevel = (window.chronosAuth.user && window.chronosAuth.user.current_level)
              ? Number(window.chronosAuth.user.current_level)
              : 1;
            const resumeLvl = (requestedLvl && requestedLvl > 1)
              ? requestedLvl
              : savedLevel;

            setTimeout(() => {
              selectLevel(resumeLvl);
              showFloatingNotification(`Epoch ${resumeLvl} Ready! Saved progress restored.`, '#10b981');
            }, 300);
          } else {
            if (isSignUpMode && res.code === 'ACCOUNT_EXISTS' && tabSignIn) {
              tabSignIn.click();
              if (handleInput && email) {
                handleInput.value = email;
              }
              authErrorEl.textContent = 'An account with this email already exists! Switched to Sign In — please enter your password.';
            } else {
              authErrorEl.textContent = res.error || 'Authentication failed.';
            }
            authErrorEl.classList.remove('hidden');
          }
        } catch (err) {
          authErrorEl.textContent = 'Network or server error.';
          authErrorEl.classList.remove('hidden');
        }
      });
    }

    // Guest Mode Button - Strictly Disabled
    if (btnGuest) {
      btnGuest.addEventListener('click', () => {
        showFloatingNotification('Sign in or account creation is required to play Chronos!', '#f59e0b');
      });
    }

    // Close Auth Modal
    function closeAuthModal() {
      if (!window.chronosAuth.user) {
        showFloatingNotification('Sign in or account creation is required to play Chronos!', '#f59e0b');
        return;
      }
      authOverlay.classList.add('hidden');
      if (compulsoryBanner) compulsoryBanner.classList.add('hidden');
      if (btnGuest) btnGuest.classList.add('hidden');
      const btnCloseAuth = document.getElementById('btn-close-auth');
      if (btnCloseAuth) btnCloseAuth.classList.remove('hidden');
    }

    const btnCloseAuth = document.getElementById('btn-close-auth');
    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', closeAuthModal);
    }

    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) {
        if (!window.chronosAuth.user) {
          showFloatingNotification('Sign in or account creation is required to play Chronos!', '#f59e0b');
          return;
        }
        closeAuthModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !window.chronosAuth.user) {
        e.preventDefault();
        showFloatingNotification('Sign in or account creation is required to play Chronos!', '#f59e0b');
      }
    });

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
    renderLevelList();
  }

  // Sync any levels solved in guest mode when account is authenticated
  async function syncGuestProgress(forcedTargetLvl = null) {
    if (!window.chronosAuth.user || !window.chronosAuth.token) return;
    try {
      let guestSolved = JSON.parse(localStorage.getItem('chronos_guest_solved') || '[]');
      if (!Array.isArray(guestSolved)) guestSolved = [];
      if (forcedTargetLvl && forcedTargetLvl > 2 && !guestSolved.includes(2)) {
        if (!guestSolved.includes(1)) guestSolved.push(1);
        guestSolved.push(2);
      }
      if (guestSolved.length > 0) {
        guestSolved.sort((a, b) => a - b);
        for (const lvl of guestSolved) {
          const curP = puzzlesList.find(p => p.level_number === lvl);
          await fetch('/api/game/attempt', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...window.chronosAuth.getAuthHeader()
            },
            body: JSON.stringify({
              puzzleId: curP ? curP.id : lvl,
              levelNumber: lvl,
              pinsConfiguration: [],
              finalDisplayedTime: curP ? curP.target_time : '00:00',
              isSuccess: true
            })
          });
        }
        localStorage.removeItem('chronos_guest_solved');
        const meRes = await fetch('/api/auth/me', {
          headers: window.chronosAuth.getAuthHeader()
        });
        const meData = await meRes.json();
        if (meData.success && meData.user) {
          window.chronosAuth.user = meData.user;
          updateProfileUI();
        }
      }
    } catch (e) {
      console.warn('Could not sync guest progress:', e);
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
  window.showFloatingNotification = showFloatingNotification;

  // -------------------------------------------------------------
  // Tutorial, Hints & Interactive Walkthrough Engine
  // -------------------------------------------------------------
  const btnOpenTutorial = document.getElementById('btn-open-tutorial');
  const btnSectionTutorial = document.getElementById('btn-section-tutorial');
  const btnCloseTutorial = document.getElementById('btn-close-tutorial');
  const btnGotIt = document.getElementById('btn-got-it');

  const btnToggleHint = document.getElementById('btn-toggle-hint');

  const walkthroughBanner = document.getElementById('walkthrough-banner');
  const walkthroughTitle = document.getElementById('walkthrough-step-title');
  const walkthroughDesc = document.getElementById('walkthrough-step-desc');
  const btnWalkthroughNext = document.getElementById('btn-walkthrough-next');
  const btnStartWalkthrough = document.getElementById('btn-start-walkthrough');

  let walkthroughStep = 0;

  // Toggle & Close Hint Box
  if (btnToggleHint && hintBox) {
    btnToggleHint.addEventListener('click', () => {
      hintBox.classList.toggle('hidden');
    });
  }

  const btnCloseHint = document.getElementById('btn-close-hint');
  if (btnCloseHint && hintBox) {
    btnCloseHint.addEventListener('click', () => {
      hintBox.classList.add('hidden');
    });
  }

  // Tutorial Modal Open / Close (Compulsory on Level 1)
  function openTutorialModal() {
    if (tutorialOverlay) tutorialOverlay.classList.remove('hidden');
  }

  function closeTutorialModal() {
    sessionStorage.setItem('chronos_level1_tutorial_seen', 'true');
    if (tutorialOverlay) tutorialOverlay.classList.add('hidden');
  }

  if (btnOpenTutorial) btnOpenTutorial.addEventListener('click', openTutorialModal);
  if (btnSectionTutorial) btnSectionTutorial.addEventListener('click', openTutorialModal);
  if (btnCloseTutorial) btnCloseTutorial.addEventListener('click', closeTutorialModal);
  if (btnGotIt) btnGotIt.addEventListener('click', closeTutorialModal);

  // Interactive Guided Walkthrough Controller
  function startInteractiveWalkthrough() {
    sessionStorage.setItem('chronos_level1_tutorial_seen', 'true');
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
    if (walkthroughStep === 3 && circle === 'outer' && index === 3) {
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
