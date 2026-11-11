/**
 * CHRONOS: Universal Drag-and-Drop & Tap-to-Place Engine
 * Supports Mouse and Touch Pointer Events for 9 Inventory Pins & 24 Clock Sockets.
 * Provides both fluid drag-and-drop and intuitive tap-to-select & tap-to-place.
 */

class PinDragDropManager {
  constructor(clockEngine, options = {}) {
    this.engine = clockEngine;
    this.container = options.container || document.body;
    this.onInventoryChange = options.onInventoryChange || (() => {});

    // Initial 9-Pin Inventory Definition
    this.pins = [
      // 3x Forward High (+20m)
      { id: 'pin-fh-1', type: 'forward-high', deltaMinutes: 20, label: '+20m', symbol: '»', color: 'emerald', bgHex: '#10b981', borderHex: '#34d399', textHex: '#ffffff', location: 'inventory' },
      { id: 'pin-fh-2', type: 'forward-high', deltaMinutes: 20, label: '+20m', symbol: '»', color: 'emerald', bgHex: '#10b981', borderHex: '#34d399', textHex: '#ffffff', location: 'inventory' },
      { id: 'pin-fh-3', type: 'forward-high', deltaMinutes: 20, label: '+20m', symbol: '»', color: 'emerald', bgHex: '#10b981', borderHex: '#34d399', textHex: '#ffffff', location: 'inventory' },

      // 3x Backward (-15m)
      { id: 'pin-bw-1', type: 'backward', deltaMinutes: -15, label: '-15m', symbol: '«', color: 'ruby', bgHex: '#ef4444', borderHex: '#f87171', textHex: '#ffffff', location: 'inventory' },
      { id: 'pin-bw-2', type: 'backward', deltaMinutes: -15, label: '-15m', symbol: '«', color: 'ruby', bgHex: '#ef4444', borderHex: '#f87171', textHex: '#ffffff', location: 'inventory' },
      { id: 'pin-bw-3', type: 'backward', deltaMinutes: -15, label: '-15m', symbol: '«', color: 'ruby', bgHex: '#ef4444', borderHex: '#f87171', textHex: '#ffffff', location: 'inventory' },

      // 3x Forward Low (+10m)
      { id: 'pin-fl-1', type: 'forward-low', deltaMinutes: 10, label: '+10m', symbol: '>', color: 'sapphire', bgHex: '#2e82ff', borderHex: '#7ca8ff', textHex: '#ffffff', location: 'inventory' },
      { id: 'pin-fl-2', type: 'forward-low', deltaMinutes: 10, label: '+10m', symbol: '>', color: 'sapphire', bgHex: '#2e82ff', borderHex: '#7ca8ff', textHex: '#ffffff', location: 'inventory' },
      { id: 'pin-fl-3', type: 'forward-low', deltaMinutes: 10, label: '+10m', symbol: '>', color: 'sapphire', bgHex: '#2e82ff', borderHex: '#7ca8ff', textHex: '#ffffff', location: 'inventory' }
    ];

    this.pendingPointer = null; // Potential drag waiting for 8px movement threshold
    this.activeDrag = null;     // { pin, sourceEl, ghost, sourceCircle, sourceIndex, startX, startY }
    this.nearestSocket = null;
    this.selectedPinId = null;  // For Tap-to-Place mode

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));
    window.addEventListener('pointercancel', this.onPointerUp.bind(this));
  }

  // Register an inventory pin element
  attachInventoryPin(element, pinId) {
    element.dataset.pinId = pinId;

    element.addEventListener('pointerdown', (e) => {
      if (this.engine.state !== 'IDLE') return;
      const pin = this.pins.find(p => p.id === pinId);
      if (!pin) return;

      this.pendingPointer = {
        pin,
        sourceEl: element,
        sourceCircle: null,
        sourceIndex: null,
        startX: e.clientX,
        startY: e.clientY
      };
    });
  }

  // Register a clock socket element
  attachClockSocket(element, circle, index) {
    element.dataset.circle = circle;
    element.dataset.socketIndex = index;

    element.addEventListener('pointerdown', (e) => {
      if (this.engine.state !== 'IDLE') return;

      const placed = this.engine.sockets[circle][index];

      // If socket already has a pin, prepare potential drag or removal
      if (placed) {
        const pin = this.pins.find(p => p.id === placed.id);
        if (pin) {
          this.pendingPointer = {
            pin,
            sourceEl: element,
            sourceCircle: circle,
            sourceIndex: index,
            startX: e.clientX,
            startY: e.clientY
          };
        }
      } else {
        // Empty socket clicked while a pin is selected in Tap-to-Place mode
        if (this.selectedPinId) {
          e.preventDefault();
          this.placeSelectedPinInSocket(circle, index);
        }
      }
    });
  }

  // Tap-to-Place: place currently selected pin into specified socket
  placeSelectedPinInSocket(circle, index) {
    if (!this.selectedPinId || this.engine.state !== 'IDLE') return;
    const pin = this.pins.find(p => p.id === this.selectedPinId);
    if (!pin) return;

    // Check if target socket has another pin
    const existing = this.engine.sockets[circle][index];
    if (existing) {
      this.returnPinToInventory(existing.id);
    }

    this.engine.placePin(circle, index, pin);
    pin.location = `${circle}:${index}`;

    if (window.chronosAudio) window.chronosAudio.playPinSnap();

    // Hook for tutorial/walkthrough
    if (window.onPinSlottedHook) {
      window.onPinSlottedHook(circle, index, pin);
    }

    this.selectedPinId = null;
    this.updateSelectedVisuals();
    this.onInventoryChange();
  }

  // Toggle selection of an inventory pin
  toggleSelectPin(pinId) {
    if (this.selectedPinId === pinId) {
      this.selectedPinId = null;
    } else {
      this.selectedPinId = pinId;
      if (window.chronosAudio) window.chronosAudio.playTick();
    }

    this.updateSelectedVisuals();

    if (window.onPinSelectedHook) {
      window.onPinSelectedHook(this.selectedPinId);
    }
  }

  // Update visual glow indicators for Tap-to-Place mode
  updateSelectedVisuals() {
    // 1. Highlight selected inventory pin
    document.querySelectorAll('.pin-item').forEach(el => {
      if (el.dataset.pinId === this.selectedPinId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    // 2. Highlight empty sockets ready for placement
    document.querySelectorAll('.socket-hole').forEach(el => {
      if (this.selectedPinId && !el.classList.contains('has-pin')) {
        el.classList.add('ready-for-placement');
      } else {
        el.classList.remove('ready-for-placement');
      }
    });
  }

  onPointerMove(event) {
    // Check if pending pointer should be upgraded to active drag (8px threshold)
    if (this.pendingPointer && !this.activeDrag) {
      const dist = Math.hypot(event.clientX - this.pendingPointer.startX, event.clientY - this.pendingPointer.startY);
      if (dist > 8) {
        this.initiateActiveDrag(this.pendingPointer, event);
        this.pendingPointer = null;
      }
    }

    if (!this.activeDrag) return;

    const { ghost } = this.activeDrag;
    ghost.style.transform = `translate(${event.clientX - 14}px, ${event.clientY - 14}px) scale(1.15)`;

    // Detect nearest clock socket hole
    const targetSocket = this.findNearestSocket(event.clientX, event.clientY);

    document.querySelectorAll('.socket-hole').forEach(el => el.classList.remove('valid-hover'));
    if (targetSocket) {
      targetSocket.element.classList.add('valid-hover');
      this.nearestSocket = targetSocket;
    } else {
      this.nearestSocket = null;
    }
  }

  initiateActiveDrag(pending, event) {
    const { pin, sourceEl, sourceCircle, sourceIndex } = pending;

    const ghost = document.createElement('div');
    ghost.className = 'fixed pointer-events-none z-[9999] rounded-full shadow-2xl transition-transform';
    ghost.style.width = '28px';
    ghost.style.height = '28px';
    ghost.style.backgroundColor = pin.bgHex;
    ghost.style.border = `2px solid ${pin.borderHex}`;
    ghost.style.boxShadow = `0 0 16px ${pin.bgHex}, 0 4px 12px rgba(0,0,0,0.8)`;
    ghost.innerHTML = '';
    ghost.style.transform = `translate(${event.clientX - 14}px, ${event.clientY - 14}px) scale(1.15)`;

    document.body.appendChild(ghost);

    this.activeDrag = {
      pin,
      sourceEl,
      ghost,
      sourceCircle,
      sourceIndex,
      startX: event.clientX,
      startY: event.clientY
    };

    if (sourceEl) sourceEl.classList.add('opacity-40');
  }

  onPointerUp(event) {
    // Case 1: Was a tap/click without dragging
    if (this.pendingPointer && !this.activeDrag) {
      const { pin, sourceCircle, sourceIndex } = this.pendingPointer;

      if (sourceCircle === null) {
        // Tapped inventory pin -> Toggle select for tap-to-place
        this.toggleSelectPin(pin.id);
      } else {
        // Tapped a placed pin in a clock socket -> Return to inventory
        this.returnPinToInventory(pin.id);
        if (window.chronosAudio) window.chronosAudio.playPinSnap();
      }

      this.pendingPointer = null;
      return;
    }

    // Case 2: Dropped after active drag
    if (!this.activeDrag) return;

    const { pin, sourceEl, ghost, sourceCircle, sourceIndex } = this.activeDrag;

    if (ghost && ghost.parentNode) {
      ghost.parentNode.removeChild(ghost);
    }
    if (sourceEl) sourceEl.classList.remove('opacity-40');

    document.querySelectorAll('.socket-hole').forEach(el => el.classList.remove('valid-hover'));

    if (this.nearestSocket) {
      const { circle, index } = this.nearestSocket;

      if (sourceCircle !== null && sourceIndex !== null) {
        this.engine.removePin(sourceCircle, sourceIndex);
      }

      const existing = this.engine.sockets[circle][index];
      if (existing && existing.id !== pin.id) {
        this.returnPinToInventory(existing.id);
      }

      this.engine.placePin(circle, index, pin);
      pin.location = `${circle}:${index}`;

      if (window.chronosAudio) window.chronosAudio.playPinSnap();

      if (window.onPinSlottedHook) {
        window.onPinSlottedHook(circle, index, pin);
      }
    } else {
      // Dropped away from clock: return to inventory
      if (sourceCircle !== null && sourceIndex !== null) {
        this.engine.removePin(sourceCircle, sourceIndex);
        pin.location = 'inventory';
        if (window.chronosAudio) window.chronosAudio.playPinSnap();
      }
    }

    this.activeDrag = null;
    this.nearestSocket = null;
    this.selectedPinId = null;
    this.updateSelectedVisuals();
    this.onInventoryChange();
  }

  findNearestSocket(x, y) {
    const socketEls = document.querySelectorAll('.socket-hole');
    let closest = null;
    const isMobile = window.innerWidth < 640;
    let minDistance = isMobile ? 44 : 48; // Generous magnetic snap for touch & mouse

    socketEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(x - centerX, y - centerY);

      if (dist < minDistance) {
        minDistance = dist;
        closest = {
          element: el,
          circle: el.dataset.circle,
          index: parseInt(el.dataset.socketIndex, 10)
        };
      }
    });

    return closest;
  }

  returnPinToInventory(pinId) {
    const pin = this.pins.find(p => p.id === pinId);
    if (pin) {
      ['outer', 'inner'].forEach(circle => {
        this.engine.sockets[circle].forEach((p, idx) => {
          if (p && p.id === pinId) {
            this.engine.removePin(circle, idx);
          }
        });
      });
      pin.location = 'inventory';
      this.selectedPinId = null;
      this.updateSelectedVisuals();
      this.onInventoryChange();
    }
  }

  returnAllPinsToInventory() {
    this.engine.clearAllPins();
    this.pins.forEach(p => p.location = 'inventory');
    this.selectedPinId = null;
    this.updateSelectedVisuals();
    this.onInventoryChange();
  }
}

window.PinDragDropManager = PinDragDropManager;
