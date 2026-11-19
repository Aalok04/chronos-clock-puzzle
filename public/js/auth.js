/**
 * CHRONOS: Authentication & Permanent Researcher Session Manager
 */

class ChronosAuth {
  constructor() {
    this.token = localStorage.getItem('chronos_token');
    this.user = null;
    try {
      const cached = localStorage.getItem('chronos_user');
      if (cached) this.user = JSON.parse(cached);
    } catch (e) {}
    this.isGuest = false;
    this.onUserChangeCallbacks = [];
  }

  onUserChange(fn) {
    this.onUserChangeCallbacks.push(fn);
  }

  notifyUserChange() {
    this.onUserChangeCallbacks.forEach(fn => fn(this.user, this.isGuest));
  }

  saveSession(token, user) {
    this.token = token;
    this.user = user;
    this.isGuest = false;
    if (token) {
      localStorage.setItem('chronos_token', token);
    }
    if (user) {
      localStorage.setItem('chronos_user', JSON.stringify(user));
      if (user.email) {
        localStorage.setItem('chronos_known_email', user.email);
      }
      if (user.username) {
        localStorage.setItem('chronos_known_username', user.username);
      }
      localStorage.setItem('chronos_returning_user', 'true');
    }
    localStorage.removeItem('chronos_guest');
  }

  async checkSession() {
    this.token = localStorage.getItem('chronos_token');
    if (!this.token) {
      this.user = null;
      this.isGuest = false;
      localStorage.removeItem('chronos_user');
      localStorage.removeItem('chronos_guest');
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
        this.saveSession(this.token, data.user);
        this.notifyUserChange();
        return this.user;
      } else if (res.status === 401 || res.status === 403 || res.status === 404) {
        this.logout();
        return null;
      }
      return this.user;
    } catch (err) {
      console.warn('Session verification offline, retaining saved local profile.');
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
      this.saveSession(data.token, data.user);
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
      this.saveSession(data.token, data.user);
      this.notifyUserChange();
    }
    return data;
  }

  enableGuestMode() {
    this.token = null;
    this.isGuest = false;
    this.user = null;
    localStorage.removeItem('chronos_guest');
    this.notifyUserChange();
  }

  logout() {
    this.token = null;
    this.user = null;
    this.isGuest = false;
    localStorage.removeItem('chronos_token');
    localStorage.removeItem('chronos_user');
    localStorage.removeItem('chronos_guest');
    this.notifyUserChange();
  }

  getAuthHeader() {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }
}

window.chronosAuth = new ChronosAuth();
