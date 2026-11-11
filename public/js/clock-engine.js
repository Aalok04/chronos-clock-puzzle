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
    if (this.state !== 'IDLE') return false;
    this.startTimeStr = startTime || this.startTimeStr;
    this.targetTimeStr = targetTime || this.targetTimeStr;
    this.runningDurationMins = durationMins || this.runningDurationMins;

    this.startTimeMins = this.parseTimeToMinutes(this.startTimeStr);
    this.targetTimeMins = this.parseTimeToMinutes(this.targetTimeStr);

    this.displayedTimeMins = this.startTimeMins;
    this.elapsedDurationMins = 0;
    this.notifyTick();
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

    const deltaMs = Math.min(timestamp - this.lastFrameTimestamp, 100);
    this.lastFrameTimestamp = timestamp;

    // Rate: 1 second real time = 5 minutes game time at 1x
    const gameMinutesPerMs = (5 / 1000) * this.speedMultiplier;
    const advanceMinutes = deltaMs * gameMinutesPerMs;

    // Ensure we do not overshoot the remaining duration
    const remainingDuration = this.runningDurationMins - this.elapsedDurationMins;
    const actualAdvance = Math.min(advanceMinutes, remainingDuration);

    const prevDisplayedTime = this.displayedTimeMins;
    const prevElapsedDuration = this.elapsedDurationMins;

    // Advance accumulators
    this.displayedTimeMins += actualAdvance;
    this.elapsedDurationMins += actualAdvance;

    // Check collisions across the swept interval
    const hitPin = this.detectPinCollision(prevDisplayedTime, this.displayedTimeMins);

    if (hitPin) {
      // Reached a pin: pause normal movement and trigger activation pipeline
      this.state = 'PIN_PAUSED';
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.executePinActivation(hitPin);
      return;
    }

    this.notifyTick();

    // Check if running duration is complete
    if (this.elapsedDurationMins >= this.runningDurationMins) {
      this.finishRun();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  // Sweep collision detector
  detectPinCollision(prevTime, currTime) {
    // Check Outer Ring Sockets: Minute Hand triggers them
    // Outer socket i is at (i * 5) minutes (i = 0..11)
    for (let i = 0; i < 12; i++) {
      const pin = this.sockets.outer[i];
      if (pin && !pin.hasTriggered) {
        const socketMinute = i * 5; // e.g. 0, 5, 10, ... 55
        if (this.isMinuteMarkerCrossed(prevTime, currTime, socketMinute)) {
          return { pin, circle: 'outer', index: i };
        }
      }
    }

    // Check Inner Ring Sockets: Hour Hand triggers them
    // Inner socket i is at hour (i === 11 ? 12 : i + 1), i.e. 1..12 hours
    for (let i = 0; i < 12; i++) {
      const pin = this.sockets.inner[i];
      if (pin && !pin.hasTriggered) {
        const socketHour = (i + 1); // 1, 2, ..., 12
        const socketMinutesFromMidnight = (socketHour % 12) * 60;
        if (this.isHourMarkerCrossed(prevTime, currTime, socketMinutesFromMidnight)) {
          return { pin, circle: 'inner', index: i };
        }
      }
    }

    return null;
  }

  isMinuteMarkerCrossed(t1, t2, targetMinute) {
    const m1 = t1 % 60;
    const m2 = t2 % 60;
    if (t2 - t1 >= 60) return true; // full revolution swept
    if (m1 <= m2) {
      return (m1 <= targetMinute && targetMinute <= m2);
    } else {
      // Wrapped around 60 (e.g. 58 -> 02)
      return (targetMinute >= m1 || targetMinute <= m2);
    }
  }

  isHourMarkerCrossed(t1, t2, targetMins) {
    const normT1 = ((t1 % 720) + 720) % 720;
    const normT2 = ((t2 % 720) + 720) % 720;
    if (t2 - t1 >= 720) return true;
    if (normT1 <= normT2) {
      return (normT1 <= targetMins && targetMins <= normT2);
    } else {
      return (targetMins >= normT1 || targetMins <= normT2);
    }
  }

  // Pin Activation Sequence (Pause -> Delay -> Apply Delta -> Delay -> Resume)
  async executePinActivation(collision) {
    const { pin, circle, index } = collision;
    pin.hasTriggered = true;

    // 1. Mechanical pre-activation delay (250ms)
    this.onPinActivate({
      phase: 'PRE_PAUSE',
      pin,
      circle,
      index,
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins)
    });

    if (window.chronosAudio) {
      window.chronosAudio.playPinActivation(pin.deltaMinutes);
    }

    await this.delay(300);

    // 2. Apply Time Delta (+20m, -15m, or +10m)
    const targetAdjustedTime = this.displayedTimeMins + pin.deltaMinutes;
    this.displayedTimeMins = targetAdjustedTime;

    this.onPinActivate({
      phase: 'APPLYING',
      pin,
      circle,
      index,
      deltaMinutes: pin.deltaMinutes,
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins)
    });

    this.notifyTick(true); // Smooth transition flag

    // 3. Post-activation mechanical settling delay (350ms)
    await this.delay(400);

    this.onPinActivate({
      phase: 'POST_RESUME',
      pin,
      circle,
      index,
      displayedTime: this.formatMinutesToTime(this.displayedTimeMins)
    });

    // 4. Resume Normal Movement
    this.state = 'RUNNING';
    this.lastFrameTimestamp = performance.now();
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  // Phase 3: Completion & Victory Check
  finishRun() {
    this.state = 'COMPLETED';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    const finalFormatted = this.formatMinutesToTime(this.displayedTimeMins);
    const targetFormatted = this.formatMinutesToTime(this.targetTimeMins);

    // Exact match check (modulo 12 hours)
    const normalizedFinal = ((Math.round(this.displayedTimeMins) % 720) + 720) % 720;
    const normalizedTarget = ((Math.round(this.targetTimeMins) % 720) + 720) % 720;

    const isSuccess = (normalizedFinal === normalizedTarget);

    this.onComplete({
      isSuccess,
      finalTime: finalFormatted,
      targetTime: targetFormatted,
      elapsedDuration: this.elapsedDurationMins
    });

    if (isSuccess) {
      if (window.chronosAudio) window.chronosAudio.playVictory();
    } else {
      if (window.chronosAudio) window.chronosAudio.playParadox();
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
    this.notifyTick(true, true); // smooth + rewind flag

    // Reset pin states and return pins to inventory
    await this.delay(1600);

    this.clearAllPins();
    this.state = 'IDLE';

    this.onReset({
      startTime: this.startTimeStr,
      targetTime: this.targetTimeStr
    });

    this.notifyTick();
  }

  manualReset() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.autoRewindReset();
  }

  notifyTick(smooth = false, rewind = false) {
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
      rewind
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.ClockEngine = ClockEngine;
