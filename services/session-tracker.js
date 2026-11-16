/**
 * CHRONOS: Real-time Player Session & Heartbeat Tracker
 * Keeps track of active chronomancers currently exploring epochs or interacting with the chamber.
 */

class ActiveSessionTracker {
  constructor(timeoutMs = 120000) { // 2 minutes inactivity timeout
    this.timeoutMs = timeoutMs;
    this.sessions = new Map(); // sessionId -> { sessionId, userId, username, level, state, ip, lastSeen, userAgent }

    // Automatic pruning every 30 seconds
    this.pruneInterval = setInterval(() => {
      this.pruneExpired();
    }, 30000);
    if (this.pruneInterval.unref) {
      this.pruneInterval.unref(); // Don't hold node process open
    }
  }

  /**
   * Record or update a heartbeat from a client
   */
  recordHeartbeat(sessionId, data = {}) {
    if (!sessionId) return null;

    const now = Date.now();
    const existing = this.sessions.get(sessionId);

    const session = {
      sessionId,
      userId: data.userId || (existing ? existing.userId : null),
      username: data.username || (existing ? existing.username : 'Guest Chronomancer'),
      level: data.level !== undefined ? data.level : (existing ? existing.level : 1),
      state: data.state || (existing ? existing.state : 'idle'), // 'idle' | 'running' | 'solved' | 'exploring'
      ip: data.ip || (existing ? existing.ip : '127.0.0.1'),
      lastSeen: now,
      firstSeen: existing ? existing.firstSeen : now
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Remove inactive sessions older than timeoutMs
   */
  pruneExpired() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastSeen > this.timeoutMs) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Get all currently active sessions (sorted with most recently active first)
   */
  getActiveSessions() {
    this.pruneExpired();
    return Array.from(this.sessions.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Get counts of active sessions
   */
  getCounts() {
    this.pruneExpired();
    let authenticated = 0;
    let guests = 0;

    for (const s of this.sessions.values()) {
      if (s.userId) {
        authenticated++;
      } else {
        guests++;
      }
    }

    return {
      total: this.sessions.size,
      authenticated,
      guests
    };
  }
}

// Singleton instance
const sessionTracker = new ActiveSessionTracker();

module.exports = sessionTracker;
