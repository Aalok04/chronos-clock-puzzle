/**
 * CHRONOS: Owner & Administrator Control Deck Controller
 * Provides real-time active player monitoring, account roster management,
 * feedback sentiment analytics, and horological platform diagnostics.
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------
  // State & Cache
  // -------------------------------------------------------------
  let adminToken = localStorage.getItem('chronos_admin_token') || '';
  let adminUser = null;
  try {
    adminUser = JSON.parse(localStorage.getItem('chronos_admin_user') || 'null');
  } catch (e) {}

  let autoRefreshEnabled = true;
  let autoRefreshTimer = null;
  let activeTab = 'live';

  // Cached datasets for local instant filtering
  let cachedUsers = [];
  let cachedFeedbacks = [];
  let cachedSessions = [];

  // -------------------------------------------------------------
  // DOM References
  // -------------------------------------------------------------
  const loginOverlay = document.getElementById('admin-login-overlay');
  const loginForm = document.getElementById('admin-login-form');
  const inputHandle = document.getElementById('admin-input-handle');
  const inputPasskey = document.getElementById('admin-input-passkey');
  const loginError = document.getElementById('admin-login-error');
  const btnSubmitLogin = document.getElementById('btn-submit-admin-login');

  const adminUserPill = document.getElementById('admin-user-pill');
  const adminUsernameDisplay = document.getElementById('admin-username-display');
  const btnAdminLogout = document.getElementById('btn-admin-logout');

  const lastSyncTime = document.getElementById('last-sync-time');
  const btnToggleAutoRefresh = document.getElementById('btn-toggle-auto-refresh');
  const autoRefreshLabel = document.getElementById('auto-refresh-label');
  const btnManualSync = document.getElementById('btn-manual-sync');

  // Stat Metrics
  const metricActiveTotal = document.getElementById('metric-active-total');
  const metricActiveUsers = document.getElementById('metric-active-users');
  const metricActiveGuests = document.getElementById('metric-active-guests');
  const metricTotalUsers = document.getElementById('metric-total-users');
  const metricAvgRating = document.getElementById('metric-avg-rating');
  const metricTotalFeedbacks = document.getElementById('metric-total-feedbacks');
  const metricWinRate = document.getElementById('metric-win-rate');
  const metricTotalAttempts = document.getElementById('metric-total-attempts');
  const metricDbMode = document.getElementById('metric-db-mode');

  // Quick navigation
  const btnQuickViewRoster = document.getElementById('btn-quick-view-roster');
  const btnQuickViewFeedback = document.getElementById('btn-quick-view-feedback');

  // Tabs & Action Bar
  const tabButtons = document.querySelectorAll('.admin-tab-btn');
  const tabPanes = document.querySelectorAll('.admin-tab-pane');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('admin-search-input');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // Table & Containers
  const livePlayersTbody = document.getElementById('live-players-tbody');
  const usersTbody = document.getElementById('users-tbody');
  const userRoleFilter = document.getElementById('user-role-filter');
  const feedbacksContainer = document.getElementById('feedbacks-container');
  const sentimentMastCount = document.getElementById('sentiment-mast-count');
  const sentimentBadiyaCount = document.getElementById('sentiment-badiya-count');
  const sentimentHardCount = document.getElementById('sentiment-hard-count');
  const feedbackHubTotal = document.getElementById('feedback-hub-total');
  const filterSentiment = document.getElementById('filter-feedback-sentiment');
  const filterRating = document.getElementById('filter-feedback-rating');
  const filterLevel = document.getElementById('filter-feedback-level');

  // Telemetry DOM
  const telNodeVer = document.getElementById('tel-node-ver');
  const telUptime = document.getElementById('tel-uptime');
  const telMemory = document.getElementById('tel-memory');
  const telTimestamp = document.getElementById('tel-timestamp');
  const telDbMode = document.getElementById('tel-db-mode');
  const telDbHost = document.getElementById('tel-db-host');
  const telDbName = document.getElementById('tel-db-name');

  const toastEl = document.getElementById('admin-toast');

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function showToast(message, isError = false) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `fixed bottom-6 right-6 z-50 transform transition-all duration-300 font-mono text-xs px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 border ${
      isError
        ? 'bg-rose-950/90 text-rose-300 border-rose-500/40 translate-y-0 opacity-100'
        : 'bg-surface-container-high text-primary border-primary/40 translate-y-0 opacity-100'
    }`;
    setTimeout(() => {
      toastEl.classList.add('translate-y-20', 'opacity-0');
      toastEl.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };
  }

  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  function formatUptime(totalSeconds) {
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  // -------------------------------------------------------------
  // Authentication & Clearance Management
  // -------------------------------------------------------------
  function showLoginGate() {
    loginOverlay.classList.remove('hidden');
    if (adminUserPill) adminUserPill.classList.add('hidden');
    stopAutoRefresh();
  }

  function unlockDeck(token, user) {
    adminToken = token;
    adminUser = user;
    localStorage.setItem('chronos_admin_token', token);
    localStorage.setItem('chronos_admin_user', JSON.stringify(user));

    loginOverlay.classList.add('hidden');
    if (adminUserPill) {
      adminUserPill.classList.remove('hidden');
      adminUserPill.classList.add('flex');
    }
    if (adminUsernameDisplay) {
      adminUsernameDisplay.textContent = user.username || 'ARCHITECT';
    }

    startAutoRefresh();
    refreshAllData();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    btnSubmitLogin.disabled = true;
    btnSubmitLogin.classList.add('opacity-50', 'cursor-not-allowed');

    const handle = inputHandle.value.trim();
    const passkey = inputPasskey.value.trim();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, passkey })
      });
      const data = await res.json();

      if (data.success && data.token) {
        unlockDeck(data.token, data.user);
        showToast('Administrative clearance granted. Welcome, Architect!');
      } else {
        loginError.textContent = data.error || 'Access denied: Invalid passkey.';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Server connection error. Check if node server is running.';
      loginError.classList.remove('hidden');
    } finally {
      btnSubmitLogin.disabled = false;
      btnSubmitLogin.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      localStorage.removeItem('chronos_admin_token');
      localStorage.removeItem('chronos_admin_user');
      adminToken = '';
      adminUser = null;
      showLoginGate();
      showToast('Deck locked. Session signed out.');
    });
  }

  // -------------------------------------------------------------
  // Data Fetching: Overview & Metrics
  // -------------------------------------------------------------
  async function fetchOverview() {
    if (!adminToken) return;

    try {
      const res = await fetch('/api/admin/overview', {
        headers: getAuthHeaders()
      });

      if (res.status === 401 || res.status === 403) {
        showLoginGate();
        return;
      }

      const result = await res.json();
      if (!result.success || !result.data) return;

      const d = result.data;

      // 1. Active Players
      if (metricActiveTotal) metricActiveTotal.textContent = d.activePlayers.total || 0;
      if (metricActiveUsers) metricActiveUsers.textContent = d.activePlayers.authenticated || 0;
      if (metricActiveGuests) metricActiveGuests.textContent = d.activePlayers.guests || 0;

      // 2. Total Accounts
      if (metricTotalUsers) metricTotalUsers.textContent = d.totalAccounts || 0;

      // 3. Feedback & Rating
      if (metricAvgRating) metricAvgRating.textContent = d.feedback.averageRating ? d.feedback.averageRating.toFixed(1) : '0.0';
      if (metricTotalFeedbacks) metricTotalFeedbacks.textContent = d.feedback.total || 0;

      // Sentiment counts
      if (sentimentMastCount) sentimentMastCount.textContent = d.feedback.sentiments.mast || 0;
      if (sentimentBadiyaCount) sentimentBadiyaCount.textContent = d.feedback.sentiments.badiya || 0;
      if (sentimentHardCount) sentimentHardCount.textContent = d.feedback.sentiments.hard || 0;
      if (feedbackHubTotal) feedbackHubTotal.textContent = d.feedback.total || 0;

      // 4. Resonance & Engine
      if (metricWinRate) metricWinRate.textContent = `${d.gameplay.winRate || 0}%`;
      if (metricTotalAttempts) metricTotalAttempts.textContent = d.gameplay.totalAttempts || 0;
      if (metricDbMode) {
        metricDbMode.textContent = d.database.dbMode.includes('SSL') ? 'Cloud (SSL)' : (d.database.isConnected ? 'MySQL Local' : 'In-Memory');
        metricDbMode.className = `text-[10px] px-1.5 py-0.5 rounded border truncate max-w-[100px] ${
          d.database.isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        }`;
      }

      // Telemetry pane
      if (telNodeVer) telNodeVer.textContent = d.server.nodeVersion || 'Node.js';
      if (telUptime) telUptime.textContent = formatUptime(d.server.uptimeSeconds || 0);
      if (telMemory) telMemory.textContent = `${d.server.memoryUsageMb || 0} MB`;
      if (telTimestamp) telTimestamp.textContent = new Date(d.server.timestamp).toLocaleTimeString();
      if (telDbMode) telDbMode.textContent = d.database.dbMode;
      if (telDbHost) telDbHost.textContent = d.database.host;
      if (telDbName) telDbName.textContent = d.database.database;

      // Update sync time
      if (lastSyncTime) lastSyncTime.textContent = new Date().toLocaleTimeString();
    } catch (err) {
      console.warn('[Admin Overview Fetch Warning]:', err.message);
    }
  }

  // -------------------------------------------------------------
  // Data Fetching: Active Players Tab
  // -------------------------------------------------------------
  async function fetchActivePlayers() {
    if (!adminToken) return;

    try {
      const res = await fetch('/api/admin/active-players', {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (!data.success) return;
      cachedSessions = data.sessions || [];
      renderActivePlayersTable(cachedSessions);
    } catch (err) {
      console.warn('[Admin Active Players Fetch Warning]:', err.message);
    }
  }

  function renderActivePlayersTable(sessions) {
    if (!livePlayersTbody) return;

    if (!sessions || sessions.length === 0) {
      livePlayersTbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-outline font-mono text-xs">
            <div class="flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-3xl text-outline-variant">sensors_off</span>
              <span class="text-on-surface-variant font-semibold">No active Chronomancers currently connected.</span>
              <span class="text-[11px] text-outline">Open the game in another tab to observe real-time heartbeats.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    livePlayersTbody.innerHTML = sessions.map(s => {
      const isAuth = !!s.userId;
      const stateBadge = getStateBadge(s.state);
      const levelLabel = s.level > 0 ? `Epoch ${s.level}` : 'Landing Hub';

      return `
        <tr class="hover:bg-surface-container/60 transition-colors">
          <td class="py-3.5 px-4 font-bold text-on-surface flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isAuth ? 'bg-primary' : 'bg-secondary'}"></span>
            <span>${escapeHtml(s.username)}</span>
          </td>
          <td class="py-3.5 px-4">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              isAuth
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/50'
            }">
              ${isAuth ? 'Scholar' : 'Guest'}
            </span>
          </td>
          <td class="py-3.5 px-4 text-on-surface">
            <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/40 font-semibold">
              ${levelLabel}
            </span>
          </td>
          <td class="py-3.5 px-4">${stateBadge}</td>
          <td class="py-3.5 px-4 text-outline text-[11px] font-mono">${escapeHtml(s.ip || '127.0.0.1')}</td>
          <td class="py-3.5 px-4 text-right text-outline text-[11px]">${formatTimeAgo(s.lastSeen)}</td>
        </tr>
      `;
    }).join('');
  }

  function getStateBadge(state) {
    switch (state) {
      case 'running':
        return '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px] flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>Clock Running</span>';
      case 'solved':
        return '<span class="px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 font-bold uppercase text-[10px] flex items-center gap-1 w-max">★ Mastered</span>';
      case 'exploring':
        return '<span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30 uppercase text-[10px] flex items-center gap-1 w-max">Exploring</span>';
      default:
        return '<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/40 uppercase text-[10px] flex items-center gap-1 w-max">Idle Dial</span>';
    }
  }

  // -------------------------------------------------------------
  // Data Fetching: Registered Users Tab
  // -------------------------------------------------------------
  async function fetchUsers() {
    if (!adminToken) return;

    try {
      const res = await fetch('/api/admin/users', {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (!data.success) return;
      cachedUsers = data.users || [];
      renderUsersTable();
    } catch (err) {
      console.warn('[Admin Fetch Users Warning]:', err.message);
    }
  }

  function renderUsersTable() {
    if (!usersTbody) return;

    let users = [...cachedUsers];

    // Filter by role
    if (userRoleFilter && userRoleFilter.value !== 'all') {
      users = users.filter(u => u.role === userRoleFilter.value);
    }

    // Filter by search query
    const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
    if (q) {
      users = users.filter(u =>
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.rank_title && u.rank_title.toLowerCase().includes(q))
      );
    }

    if (users.length === 0) {
      usersTbody.innerHTML = `
        <tr>
          <td colspan="8" class="py-10 text-center text-outline">
            No registered scholars match the current filter.
          </td>
        </tr>
      `;
      return;
    }

    usersTbody.innerHTML = users.map(u => {
      const isAdmin = u.role === 'admin' || u.role === 'owner';
      const roleBadge = isAdmin
        ? '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase text-[10px]">Architect (Admin)</span>'
        : '<span class="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/30 uppercase text-[10px]">Scholar (Student)</span>';

      const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString() : '--';

      return `
        <tr class="hover:bg-surface-container/60 transition-colors">
          <td class="py-3 px-4 text-outline font-mono">#${u.id}</td>
          <td class="py-3 px-4 font-bold text-primary">${escapeHtml(u.username)}</td>
          <td class="py-3 px-4 text-on-surface-variant font-mono text-[11px]">${escapeHtml(u.email)}</td>
          <td class="py-3 px-4">${roleBadge}</td>
          <td class="py-3 px-4 text-on-surface font-semibold">${escapeHtml(u.rank_title || 'Apprentice')}</td>
          <td class="py-3 px-4 text-on-surface font-mono">Epoch ${u.current_level || 1}</td>
          <td class="py-3 px-4 text-on-surface font-mono"><strong class="text-emerald-400">${u.puzzles_solved || 0}</strong> Solved</td>
          <td class="py-3 px-4 text-right text-outline text-[11px]">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }

  if (userRoleFilter) {
    userRoleFilter.addEventListener('change', renderUsersTable);
  }

  // -------------------------------------------------------------
  // Data Fetching: Feedback Hub Tab
  // -------------------------------------------------------------
  async function fetchFeedbacks() {
    if (!adminToken) return;

    try {
      const params = new URLSearchParams();
      if (filterSentiment && filterSentiment.value !== 'all') params.append('sentiment', filterSentiment.value);
      if (filterRating && filterRating.value !== 'all') params.append('rating', filterRating.value);
      if (filterLevel && filterLevel.value !== 'all') params.append('level', filterLevel.value);
      if (searchInput && searchInput.value.trim() && activeTab === 'feedback') params.append('search', searchInput.value.trim());

      const res = await fetch(`/api/admin/feedbacks?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (!data.success) return;
      cachedFeedbacks = data.feedbacks || [];
      renderFeedbacksList(cachedFeedbacks);
    } catch (err) {
      console.warn('[Admin Fetch Feedbacks Warning]:', err.message);
    }
  }

  function renderFeedbacksList(feedbacks) {
    if (!feedbacksContainer) return;

    if (!feedbacks || feedbacks.length === 0) {
      feedbacksContainer.innerHTML = `
        <div class="text-center py-12 text-outline font-mono text-xs flex flex-col items-center gap-2">
          <span class="material-symbols-outlined text-3xl text-outline-variant">reviews</span>
          <span class="text-on-surface-variant font-semibold">No feedback records found.</span>
          <span class="text-[11px] text-outline">Player reviews submitted at level completion will appear here.</span>
        </div>
      `;
      return;
    }

    feedbacksContainer.innerHTML = feedbacks.map(f => {
      const ratingStars = '★'.repeat(f.rating || 5) + '☆'.repeat(Math.max(0, 5 - (f.rating || 5)));
      const sentimentBadge = getSentimentChip(f.sentiment);
      const dateStr = f.created_at ? new Date(f.created_at).toLocaleString() : 'Recent';

      return `
        <div class="pt-4 first:pt-0 pb-2 flex flex-col sm:flex-row items-start justify-between gap-4 font-mono">
          <div class="space-y-1.5 flex-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <span class="text-amber-400 font-bold text-sm tracking-wider">${ratingStars}</span>
              ${sentimentBadge}
              <span class="px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/40 text-[11px] text-on-surface">
                Epoch ${f.level_number || f.levelNumber || 1}
              </span>
              <span class="text-primary font-bold text-xs">
                ${escapeHtml(f.username || 'Guest Chronomancer')}
              </span>
              <span class="text-outline text-[10px] hidden md:inline">● ${dateStr}</span>
            </div>

            <p class="font-sans text-xs text-on-surface-variant bg-surface-container/40 p-3 rounded-lg border border-outline-variant/30 italic">
              "${escapeHtml(f.comment || 'No written comment provided.')}"
            </p>
          </div>

          <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button class="btn-delete-feedback px-2.5 py-1.5 rounded bg-surface-container-high hover:bg-rose-500/20 text-on-surface-variant hover:text-rose-400 border border-outline-variant/50 transition-colors text-[11px] flex items-center gap-1 cursor-pointer" data-id="${f.id}">
              <span class="material-symbols-outlined text-[15px]">delete</span>
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach delete listeners
    document.querySelectorAll('.btn-delete-feedback').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        if (confirm('Are you sure you want to remove this player feedback record?')) {
          await deleteFeedback(id);
        }
      });
    });
  }

  function getSentimentChip(sentiment) {
    const s = (sentiment || '').toLowerCase();
    if (s.includes('loved') || s.includes('mast')) {
      return '<span class="px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold">🤯 Mast</span>';
    }
    if (s.includes('great') || s.includes('badiya')) {
      return '<span class="px-2 py-0.5 rounded bg-secondary/20 text-secondary border border-secondary/30 text-[10px] font-bold">⏱️ Badiya</span>';
    }
    if (s.includes('hard') || s.includes('challenging')) {
      return '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">🧩 Hard</span>';
    }
    return `<span class="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/50 text-[10px]">${escapeHtml(sentiment || 'Feedback')}</span>`;
  }

  async function deleteFeedback(id) {
    try {
      const res = await fetch(`/api/admin/feedbacks/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showToast('Feedback record removed.');
        fetchFeedbacks();
        fetchOverview();
      } else {
        showToast(data.error || 'Failed to remove feedback.', true);
      }
    } catch (err) {
      showToast('Error removing feedback record.', true);
    }
  }

  [filterSentiment, filterRating, filterLevel].forEach(el => {
    if (el) el.addEventListener('change', fetchFeedbacks);
  });

  // -------------------------------------------------------------
  // Export CSV Helper
  // -------------------------------------------------------------
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (activeTab === 'users') {
        exportUsersCsv(cachedUsers);
      } else {
        exportFeedbackCsv(cachedFeedbacks);
      }
    });
  }

  function exportFeedbackCsv(feedbacks) {
    if (!feedbacks || feedbacks.length === 0) {
      showToast('No feedback data to export.', true);
      return;
    }

    const headers = ['ID', 'Username', 'Epoch Level', 'Rating', 'Sentiment', 'Comment', 'Timestamp'];
    const rows = feedbacks.map(f => [
      f.id,
      `"${(f.username || '').replace(/"/g, '""')}"`,
      f.level_number || f.levelNumber || 1,
      f.rating || 5,
      f.sentiment || '',
      `"${(f.comment || '').replace(/"/g, '""')}"`,
      f.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    downloadUri(csvContent, `chronos_feedback_export_${Date.now()}.csv`);
    showToast('Feedback records exported as CSV.');
  }

  function exportUsersCsv(users) {
    if (!users || users.length === 0) {
      showToast('No user data to export.', true);
      return;
    }

    const headers = ['ID', 'Username', 'Email', 'Role', 'Rank Title', 'Current Level', 'Puzzles Solved', 'Registered Date'];
    const rows = users.map(u => [
      u.id,
      `"${(u.username || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      u.role || 'student',
      `"${(u.rank_title || '').replace(/"/g, '""')}"`,
      u.current_level || 1,
      u.puzzles_solved || 0,
      u.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    downloadUri(csvContent, `chronos_scholars_export_${Date.now()}.csv`);
    showToast('Scholar registry exported as CSV.');
  }

  function downloadUri(uri, filename) {
    const encodedUri = encodeURI(uri);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // -------------------------------------------------------------
  // Tab Navigation Handling
  // -------------------------------------------------------------
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      setActiveTab(tabName);
    });
  });

  function setActiveTab(tabName) {
    activeTab = tabName;

    tabButtons.forEach(b => {
      if (b.dataset.tab === tabName) {
        b.className = 'admin-tab-btn active px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all';
      } else {
        b.className = 'admin-tab-btn px-4 py-2 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant/40 hover:text-on-surface font-mono text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-all';
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `pane-${tabName}`) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    });

    // Toggle search bar / export button for tab
    if (tabName === 'users' || tabName === 'feedback') {
      if (searchContainer) searchContainer.classList.remove('hidden');
      if (btnExportCsv) btnExportCsv.classList.remove('hidden');
      if (searchInput) searchInput.placeholder = tabName === 'users' ? 'Search scholars...' : 'Search reviews...';
    } else {
      if (searchContainer) searchContainer.classList.add('hidden');
      if (btnExportCsv) btnExportCsv.classList.add('hidden');
    }

    // Load tab-specific data
    if (tabName === 'live') fetchActivePlayers();
    if (tabName === 'users') fetchUsers();
    if (tabName === 'feedback') fetchFeedbacks();
    if (tabName === 'telemetry') fetchOverview();
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (activeTab === 'users') renderUsersTable();
      if (activeTab === 'feedback') fetchFeedbacks();
    });
  }

  // Quick stat card links
  if (btnQuickViewRoster) {
    btnQuickViewRoster.addEventListener('click', () => setActiveTab('users'));
  }
  if (btnQuickViewFeedback) {
    btnQuickViewFeedback.addEventListener('click', () => setActiveTab('feedback'));
  }

  // -------------------------------------------------------------
  // Live Auto-Refresh & Manual Sync
  // -------------------------------------------------------------
  function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(() => {
      fetchOverview();
      if (activeTab === 'live') fetchActivePlayers();
    }, 10000);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  if (btnToggleAutoRefresh) {
    btnToggleAutoRefresh.addEventListener('click', () => {
      autoRefreshEnabled = !autoRefreshEnabled;
      if (autoRefreshEnabled) {
        startAutoRefresh();
        autoRefreshLabel.textContent = 'Auto (10s): ON';
        btnToggleAutoRefresh.classList.add('text-primary');
        showToast('Live 10-second auto-refresh enabled.');
      } else {
        stopAutoRefresh();
        autoRefreshLabel.textContent = 'Auto (10s): OFF';
        btnToggleAutoRefresh.classList.remove('text-primary');
        showToast('Live auto-refresh paused.');
      }
    });
  }

  if (btnManualSync) {
    btnManualSync.addEventListener('click', async () => {
      const syncIcon = btnManualSync.querySelector('.material-symbols-outlined');
      if (syncIcon) syncIcon.classList.add('animate-spin');
      await refreshAllData();
      setTimeout(() => {
        if (syncIcon) syncIcon.classList.remove('animate-spin');
      }, 500);
      showToast('Deck synchronized with live chamber telemetry.');
    });
  }

  async function refreshAllData() {
    await fetchOverview();
    if (activeTab === 'live') await fetchActivePlayers();
    if (activeTab === 'users') await fetchUsers();
    if (activeTab === 'feedback') await fetchFeedbacks();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // -------------------------------------------------------------
  // Initialization Check
  // -------------------------------------------------------------
  if (adminToken) {
    unlockDeck(adminToken, adminUser || { username: 'CHRONOS-ARCHITECT', role: 'admin' });
  } else {
    showLoginGate();
  }
});
