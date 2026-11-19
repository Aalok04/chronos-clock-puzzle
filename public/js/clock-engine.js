/**
 * CHRONOS: Mathematical Horological Simulation Engine
 * Handles dual-time tracking, continuous hand trigonometry,
 * sweep-collision detection, pin activations, and automated rewind reset.
 */

class ClockEngine {
  constructor(options = {}) {
    // Configurable time settings
    this.startTimeStr = options.startTime || '02:00';
    this.targetTimeStr = options.targetTime || '04:30';
    this.runningDurationMins = options.runningDuration || 75; // 1h 15m default

    // Time representation in minutes from 00:00 (12-hour face: 0 to 719.999)
    this.startTimeMins = this.parseTimeToMinutes(this.startTimeStr);
    this.targetTimeMins = this.parseTimeToMinutes(this.targetTimeStr);

    // State Accumulators
    this.displayedTimeMins = this.startTimeMins;
    this.elapsedDurationMins = 0;

    // Simulation states: 'IDLE', 'RUNNING', 'PIN_PAUSED', 'COMPLETED', 'REWINDING'
    this.state = 'IDLE';
    this.speedMultiplier = 1; // 1x, 2x, 5x
    this.lastFrameTimestamp = 0;
    this.animationFrameId = null;

    // Sockets Map:
    // Outer sockets: indices 0..11 corresponding to minute positions (0m, 5m, 10m, ... 55m) -> triggered by Minute Hand
    // Inner sockets: indices 0..11 corresponding to hour positions (1h, 2h, ... 12h) -> triggered by Hour Hand
    this.sockets = {
      outer: new Array(12).fill(null), // { pinId, type, deltaMinutes, hasTriggered }
      inner: new Array(12).fill(null)
    };

    // Callbacks for UI updates
    this.onTick = options.onTick || (() => {});
    this.onPinActivate = options.onPinActivate || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onReset = options.onReset || (() => {});
  }

  parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(v => parseInt(v, 10) || 0);
    return ((h % 12) * 60 + (m % 60));
  }

  formatMinutesToTime(mins) {
    const totalMins = Math.round(mins);
    let normalized = ((totalMins % 720) + 720) % 720;
    let h = Math.floor(normalized / 60);
    if (h === 0) h = 12;
    const m = Math.floor(normalized % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  setTimeSettings(startTime, targetTime, durationMins) {
    return this.resetLevel(startTime, targetTime, durationMins);
  }

  resetLevel(startTime, targetTime, durationMins) {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.state = 'IDLE';
    this.startTimeStr = startTime || this.startTimeStr;
    this.targetTimeStr = targetTime || this.targetTimeStr;
    this.runningDurationMins = durationMins || this.runningDurationMins;

    this.startTimeMins = this.parseTimeToMinutes(this.startTimeStr);
    this.targetTimeMins = this.parseTimeToMinutes(this.targetTimeStr);

    this.displayedTimeMins = this.startTimeMins;
    this.elapsedDurationMins = 0;

    // Reset runtime flags on all placed pins
    ['outer', 'inner'].forEach(circle => {
      this.sockets[circle].forEach(pin => {
        if (pin) pin.hasTriggered = false;
      });
    });

    this.notifyTick(false, false, 'reset');
    return true;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(1, multiplier || 1);
  }

  // Socket management
  placePin(circle, socketIndex, pinData) {
    if (this.state !== 'IDLE') return false;
    if (circle !== 'outer' && circle !== 'inner') return false;
    if (socketIndex < 0 || socketIndex > 11) return false;

    this.sockets[circle][socketIndex] = {
      ...pinData,
      circle,
      socketIndex,
      hasTriggered: false
    };
    return true;
  }

  removePin(circle, socketIndex) {
    if (this.state !== 'IDLE') return null;
    const removed = this.sockets[circle][socketIndex];
    this.sockets[circle][socketIndex] = null;
    return removed;
  }

  clearAllPins() {
    this.sockets.outer.fill(null);
    this.sockets.inner.fill(null);
  }

  getAllPlacedPins() {
    const list = [];
    ['outer', 'inner'].forEach(circle => {
      this.sockets[circle].forEach((slot, idx) => {
        if (slot) list.push({ ...slot, circle, socketIndex: idx });
      });
    });
    return list;
  }

  // Calculate angles in degrees
  getAngles(timeMins = this.displayedTimeMins) {
    const normalized = ((timeMins % 720) + 720) % 720;
    const minute = normalized % 60;
    const minuteAngle = minute * 6; // 360 / 60 = 6 deg/min
    const hourAngle = (normalized / 60) * 30; // 360 / 12 = 30 deg/hour
    return { minuteAngle, hourAngle };
  }

  // START RUN
  start() {
    if (this.state !== 'IDLE') return;

    // Reset runtime flags on all placed pins
    ['outer', 'inner'].forEach(circle => {
      this.sockets[circle].forEach(pin => {
        if (pin) pin.hasTriggered = false;
      });
    });

    this.state = 'RUNNING';
    this.lastFrameTimestamp = performance.now();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  pause() {
    if (this.state === 'RUNNING') {
      this.state = 'PAUSED';
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }
  }

  resume() {
    if (this.state === 'PAUSED') {
      this.state = 'RUNNING';
      this.lastFrameTimestamp = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  }

  // Main simulation tick loop
  loop(timestamp) {
    if (this.state !== 'RUNNING') return;

    const deltaMs = Math.max(0, Math.min(timestamp - this.lastFrameTimestamp, 100));
    this.lastFrameTimestamp = timestamp;

    // Rate: 1 second real time = 5 minutes game time at 1x
    const gameMinutesPerMs = (5 / 1000) * this.speedMultiplier;
    const advanceMinutes = deltaMs * gameMinutesPerMs;

    // Ensure we do not overshoot the remaining duration
    const remainingDuration = Math.max(0, this.runningDurationMins - this.elapsedDurationMins);
    const actualAdvance = Math.min(advanceMinutes, remainingDuration);

    const prevDisplayedTime = this.displayedTimeMins;
    const prevElapsedDuration = this.elapsedDurationMins;
    const nextDisplayedTime = prevDisplayedTime + actualAdvance;

    // Check collisions across the swept interval (prevDisplayedTime, nextDisplayedTime]
    const hitPin = actualAdvance > 0
      ? this.detectPinCollision(prevDisplayedTime, nextDisplayedTime)
      : null;

    if (hitPin) {
      // Snap hand and elapsed duration to the exact moment the hand reaches the socket
      const timeToPin = Math.max(0, hitPin.triggerTime - prevDisplayedTime);
      this.displayedTimeMins = hitPin.triggerTime;
      this.elapsedDurationMins = Math.min(this.runningDurationMins, prevElapsedDuration + timeToPin);

      // Pause normal movement and trigger activation at this exact socket position
      this.state = 'PIN_PAUSED';
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      // Render hand at the exact socket angular position before applying warp transition
      this.notifyTick(false, false, 'forward');

      this.executePinActivation(hitPin);
      return;
    }

    // Advance accumulators
    this.displayedTimeMins = nextDisplayedTime;
    this.elapsedDurationMins = prevElapsedDuration + actualAdvance;

    this.notifyTick(false, false, 'forward');

    // Check if running duration is complete
    if (this.elapsedDurationMins >= this.runningDurationMins - 1e-7) {
      this.finishRun();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  // Sweep collision detector: finds the chronologically first pin reached in (prevTime, currTime]
  detectPinCollision(prevTime, currTime) {
    if (currTime <= prevTime) return null;

    const EPS = 1e-7;
    const candidates = [];

    // Check Outer Ring Sockets: Minute Hand triggers them
    // Outer socket i is at (i * 5) minutes (i = 0..11) -> exact angle i * 30 deg
    for (let i = 0; i < 12; i++) {
      const pin = this.sockets.outer[i];
      if (pin && !pin.hasTriggered) {
        const socketMinute = i * 5; // 0, 5, 10, ... 55
        const triggerTime = this.getFirstCrossingTime(prevTime, currTime, socketMinute, 60, EPS);
        if (triggerTime !== null) {
          candidates.push({ pin, circle: 'outer', index: i, triggerTime });
        }
      }
    }

    // Check Inner Ring Sockets: Hour Hand triggers them
    // Inner socket i is at hour (i + 1), i.e. 1..12 hours -> ((i + 1) % 12) * 60 minutes
    for (let i = 0; i < 12; i++) {
      const pin = this.sockets.inner[i];
      if (pin && !pin.hasTriggered) {
        const socketHour = i + 1; // 1, 2, ..., 12
        const socketMinutesFromMidnight = (socketHour % 12) * 60;
        const triggerTime = this.getFirstCrossingTime(prevTime, currTime, socketMinutesFromMidnight, 720, EPS);
        if (triggerTime !== null) {
          candidates.push({ pin, circle: 'inner', index: i, triggerTime });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort chronologically by the exact moment the hand reaches each socket.
    // On an exact tie (both hands hitting :00 simultaneously), trigger inner first
    // so the hour jump preserves the :00 minute alignment for the outer pin.
    candidates.sort((a, b) => {
      const timeDiff = a.triggerTime - b.triggerTime;
      if (Math.abs(timeDiff) > EPS) return timeDiff;
      if (a.circle !== b.circle) return a.circle === 'inner' ? -1 : 1;
      return a.index - b.index;
    });

    return candidates[0];
  }

  // Returns the earliest time t in (prevTime, currTime] where ((t % period) + period) % period === targetOffset
  getFirstCrossingTime(prevTime, currTime, targetOffset, period, eps = 1e-7) {
    const k = Math.floor(((prevTime + eps) - targetOffset) / period) + 1;
    const triggerTime = period * k + targetOffset;
    if (triggerTime <= currTime + eps) {
      return triggerTime;
    }
    return null;
  }

  // Checks if a hand has physically arrived at the exact angular position of an untriggered pin
  detectPinAtExactTime(timeMins) {
    const EPS = 1e-6;
    const normHourMins = ((timeMins % 720) + 720) % 720;
    const normMin = ((timeMins % 60) + 60) % 60;

    for (let i = 0; i < 12; i++) {
      const pin = this.sockets.inner[i];
      if (pin && !pin.hasTriggered) {
        const socketMinutes = ((i + 1) % 12) * 60;
        const diff = Math.abs(normHourMins - socketMinutes);
        if (diff < EPS || Math.abs(diff - 720) < EPS) {
          return { pin, circle: 'inner', index: i, triggerTime: timeMins };
        }
      }
    }

    for (let i = 0; i < 12; i++) {
      const pin = this.sockets.outer[i];
      if (pin && !pin.hasTriggered) {
        const socketMinute = i * 5;
        const diff = Math.abs(normMin - socketMinute);
        if (diff < EPS || Math.abs(diff - 60) < EPS) {
          return { pin, circle: 'outer', index: i, triggerTime: timeMins };
        }
      }
    }

    return null;
  }

  isMinuteMarkerCrossed(t1, t2, targetMinute) {
    return this.getFirstCrossingTime(t1, t2, targetMinute, 60) !== null;
  }

  isHourMarkerCrossed(t1, t2, targetMins) {
    return this.getFirstCrossingTime(t1, t2, targetMins, 720) !== null;
  }

  // Pin Activation Sequence: Visually activates at the exact moment its effect is applied
  async executePinActivation(collision) {
    const { pin, circle, index } = collision;
    pin.hasTriggered = true;

    // Apply Time Delta at the exact moment the pin activates:
    // If Outer Ring (Minute Hand): applies fraction of 60 minutes
    //   +1/3 -> 60 / 3 = +20 minutes
    //   -1/4 -> -60 / 4 = -15 minutes
    //   +1/6 -> 60 / 6 = +10 minutes
    // If Inner Ring (Hour Hand): applies fraction of 12 hours (Minute hand stays still, Hour hand steps)
    //   +1/3 -> 12 / 3 = +4 hours (+240 minutes)
    //   -1/4 -> -12 / 4 = -3 hours (-180 minutes)
    //   +1/6 -> 12 / 6 = +2 hours (+120 minutes)
    let timeAdjustment = pin.deltaMinutes;
    if (circle === 'inner') {
      if (pin.label === '+1/3' || pin.type === 'forward-high' || pin.deltaMinutes === 20) {
        timeAdjustment = 4 * 60; // 12 / 3 = +4 hours
      } else if (pin.label === '-1/4' || pin.type === 'backward' || pin.deltaMinutes === -15) {
        timeAdjustment = -3 * 60; // -12 / 4 = -3 hours
      } else if (pin.label === '+1/6' || pin.type === 'forward-low' || pin.deltaMinutes === 10) {
        timeAdjustment = 2 * 60; // 12 / 6 = +2 hours
      } else {
        timeAdjustment = pin.deltaMinutes < 0 ? -3 * 60 : 4 * 60;
      }
    }
    this.displayedTimeMins += timeAdjustment;

    this.onPinActivate({
      phase: 'APPLYING',
      pin,
      circle,
      index,
      deltaMinutes: timeAdjustment,
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins)
    });

    if (window.chronosAudio) {
      window.chronosAudio.playPinActivation(pin.deltaMinutes);
    }

    this.notifyTick(true, false, timeAdjustment < 0 ? 'backward' : 'forward'); // Smooth transition flag (0.6s CSS transition)

    // Wait for the hands to smoothly travel and reach their target positions
    await this.delay(600);
    if (this.state !== 'PIN_PAUSED') return;

    // Post-activation mechanical settling pause (Hands hold still at new position)
    this.onPinActivate({
      phase: 'SETTLING_PAUSE',
      pin,
      circle,
      index,
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins)
    });

    if (window.chronosAudio) {
      window.chronosAudio.playTick();
    }

    // Delay after reaching trigger time before resuming normal ticking
    await this.delay(350);
    if (this.state !== 'PIN_PAUSED') return;

    this.onPinActivate({
      phase: 'POST_RESUME',
      pin,
      circle,
      index,
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins)
    });

    // If the warped hand has physically arrived at another untriggered pin's exact socket, activate it
    const landedPin = this.detectPinAtExactTime(this.displayedTimeMins);
    if (landedPin) {
      this.notifyTick(false, false, 'forward');
      this.executePinActivation(landedPin);
      return;
    }

    // Check if running duration is already complete
    if (this.elapsedDurationMins >= this.runningDurationMins - 1e-7) {
      this.finishRun();
      return;
    }

    // Resume Normal Movement
    this.state = 'RUNNING';
    this.lastFrameTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  // Phase 3: Completion & Victory Check with Locked Time Delay
  async finishRun() {
    this.state = 'COMPLETED';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    const finalFormatted = this.formatMinutesToTime(this.displayedTimeMins);
    const targetFormatted = this.formatMinutesToTime(this.targetTimeMins);

    // Exact match check (modulo 12 hours)
    const normalizedFinal = ((Math.round(this.displayedTimeMins) % 720) + 720) % 720;
    const normalizedTarget = ((Math.round(this.targetTimeMins) % 720) + 720) % 720;

    const isSuccess = (normalizedFinal === normalizedTarget);

    if (isSuccess) {
      // Announce time set / locked state
      this.onTick({
        displayedTime: finalFormatted,
        ...this.getAngles(),
        elapsedDuration: this.runningDurationMins,
        totalDuration: this.runningDurationMins,
        progressPercent: 100,
        state: 'TIME_LOCKED',
        smooth: true,
        rewind: false,
        direction: 'forward'
      });

      if (window.chronosAudio) window.chronosAudio.playVictory();

      // Brief settling delay so user sees time is locked on target before modal appears
      await this.delay(1400);

      this.onComplete({
        isSuccess: true,
        finalTime: finalFormatted,
        targetTime: targetFormatted,
        elapsedDuration: this.elapsedDurationMins
      });
    } else {
      if (window.chronosAudio) window.chronosAudio.playParadox();

      this.onComplete({
        isSuccess: false,
        finalTime: finalFormatted,
        targetTime: targetFormatted,
        elapsedDuration: this.elapsedDurationMins
      });

      // Unsuccessful attempt: show final time briefly (1400ms), then auto-initiate rewind
      setTimeout(() => {
        this.autoRewindReset();
      }, 1500);
    }
  }

  // Phase 5: Automatic Rewind Reset Mechanism
  async autoRewindReset() {
    this.state = 'REWINDING';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    if (window.chronosAudio) {
      window.chronosAudio.playRewind();
    }

    // Smoothly rewind hands back to starting time
    this.displayedTimeMins = this.startTimeMins;
    this.elapsedDurationMins = 0;
    this.notifyTick(true, true, 'rewind'); // smooth + rewind flag

    // Reset pin states and return pins to inventory
    await this.delay(1600);

    this.clearAllPins();
    this.state = 'IDLE';

    this.onReset({
      startTime: this.startTimeStr,
      targetTime: this.targetTimeStr
    });

    this.notifyTick(false, false, 'reset');
  }

  manualReset() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.autoRewindReset();
  }

  notifyTick(smooth = false, rewind = false, direction = 'forward') {
    const { minuteAngle, hourAngle } = this.getAngles();
    const progressPercent = Math.min(100, (this.elapsedDurationMins / this.runningDurationMins) * 100);

    this.onTick({
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins),
      minuteAngle,
      hourAngle,
      elapsedDuration: Math.round(this.elapsedDurationMins),
      totalDuration: this.runningDurationMins,
      progressPercent,
      state: this.state,
      smooth,
      rewind,
      direction
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

if (typeof window !== 'undefined') {
  window.ClockEngine = ClockEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClockEngine;
}
