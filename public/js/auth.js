/**
 * CHRONOS: Authentication & Researcher Session Manager
 */

class ChronosAuth {
  constructor() {
    this.token = localStorage.getItem('chronos_token');
    this.user = null;
    this.isGuest = false;
    this.onUserChangeCallbacks = [];
  }

  onUserChange(fn) {
    this.onUserChangeCallbacks.push(fn);
  }

  notifyUserChange() {
    this.onUserChangeCallbacks.forEach(fn => fn(this.user, this.isGuest));
  }

  async checkSession() {
    if (!this.token) {
      if (localStorage.getItem('chronos_guest') === 'true') {
        this.isGuest = true;
        this.user = {
          username: 'Guest_Calibrator',
          rank_title: 'Guest Scholar',
          puzzles_solved: 0,
          current_level: 1
        };
        this.notifyUserChange();
        return this.user;
      }
      this.user = null;
      this.notifyUserChange();
      return null;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.user = data.user;
        this.isGuest = false;
        this.notifyUserChange();
        return this.user;
      } else {
        this.logout();
        return null;
      }
    } catch (err) {
      console.warn('Session verification offline, retaining local profile.');
      return this.user;
    }
  }

  async login(handle, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, password })
    });
    const data = await res.json();
    if (data.success) {
      this.token = data.token;
      this.user = data.user;
      this.isGuest = false;
      localStorage.setItem('chronos_token', this.token);
      localStorage.removeItem('chronos_guest');
      this.notifyUserChange();
    }
    return data;
  }

  async signup(username, email, password) {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (data.success) {
      this.token = data.token;
      this.user = data.user;
      this.isGuest = false;
      localStorage.setItem('chronos_token', this.token);
      localStorage.removeItem('chronos_guest');
      this.notifyUserChange();
    }
    return data;
  }

  enableGuestMode() {
    this.token = null;
    this.isGuest = true;
    this.user = {
      username: 'Guest_Calibrator',
      rank_title: 'Guest Scholar',
      puzzles_solved: 0,
      current_level: 1
    };
    localStorage.setItem('chronos_guest', 'true');
    this.notifyUserChange();
  }

  logout() {
    this.token = null;
    this.user = null;
    this.isGuest = false;
    localStorage.removeItem('chronos_token');
    localStorage.removeItem('chronos_guest');
    this.notifyUserChange();
  }

  getAuthHeader() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }
}

window.chronosAuth = new ChronosAuth();
