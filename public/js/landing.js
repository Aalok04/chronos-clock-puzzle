/**
 * CHRONOS: Main Landing Page Interactive Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('⚡ Chronos Landing Engine initialized.');

  // DOM Elements
  const btnHeroGuest = document.getElementById('btn-hero-guest');
  const btnNavGuest = document.getElementById('btn-nav-guest');
  const btnNavSignin = document.getElementById('btn-nav-signin');
  const btnHeroSignin = document.getElementById('btn-hero-signin');
  const btnCtaGuest = document.getElementById('btn-cta-guest');
  const btnCtaSignin = document.getElementById('btn-cta-signin');

  // Auth Modal Elements
  const authOverlay = document.getElementById('landing-auth-overlay');
  const btnCloseAuth = document.getElementById('btn-landing-close-auth');
  const tabSignin = document.getElementById('landing-tab-signin');
  const tabSignup = document.getElementById('landing-tab-signup');
  const authForm = document.getElementById('landing-auth-form');
  const formHeading = document.getElementById('landing-form-heading');
  const formSubheading = document.getElementById('landing-form-subheading');
  const emailGroup = document.getElementById('landing-email-group');
  const submitLabel = document.getElementById('landing-auth-submit-label');
  const authError = document.getElementById('landing-auth-error');
  const btnAutofill = document.getElementById('btn-landing-autofill');
  const btnModalGuest = document.getElementById('btn-landing-modal-guest');

  // Header User Profile
  const navUserSection = document.getElementById('landing-user-section');
  const navUsername = document.getElementById('landing-username');
  const navRank = document.getElementById('landing-rank');
  const btnNavLogout = document.getElementById('btn-landing-logout');
  const btnLaunchGame = document.getElementById('btn-launch-game');

  let currentAuthMode = 'signin';

  // Check current session
  async function checkInitialAuth() {
    if (window.chronosAuth) {
      const user = await window.chronosAuth.checkSession();
      if (user) {
        if (navUserSection) navUserSection.classList.remove('hidden');
        if (btnNavSignin) btnNavSignin.classList.add('hidden');
        if (btnNavGuest) btnNavGuest.classList.add('hidden');
        if (navUsername) navUsername.textContent = user.username;
        if (navRank) navRank.textContent = user.rank_title || 'Scholar';
      } else {
        if (navUserSection) navUserSection.classList.add('hidden');
        if (btnNavSignin) btnNavSignin.classList.remove('hidden');
        if (btnNavGuest) btnNavGuest.classList.remove('hidden');
      }
    }
  }

  await checkInitialAuth();

  // Play as Guest Action
  function handlePlayAsGuest() {
    if (window.chronosAuth) {
      window.chronosAuth.enableGuestMode();
    }
    // Launch directly into the game chamber
    window.location.href = '/game';
  }

  // Open Auth Modal
  function openAuthModal(mode = 'signin') {
    currentAuthMode = mode;
    updateModalMode(mode);
    if (authOverlay) {
      authOverlay.classList.remove('hidden');
      if (authError) authError.classList.add('hidden');
    }
  }

  function closeAuthModal() {
    if (authOverlay) {
      authOverlay.classList.add('hidden');
      if (authError) authError.classList.add('hidden');
    }
  }

  function updateModalMode(mode) {
    currentAuthMode = mode;
    if (mode === 'signin') {
      tabSignin.className = "py-2 px-3 rounded-sm text-center transition-all bg-surface-container-highest text-primary border border-primary/40 font-semibold shadow-inner flex items-center justify-center gap-1.5";
      tabSignup.className = "py-2 px-3 rounded-sm text-center transition-all text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center gap-1.5";
      formHeading.textContent = "Enter Chronometer Chamber";
      formSubheading.textContent = "Sign in with your researcher credentials or student handle.";
      emailGroup.classList.add('hidden');
      submitLabel.textContent = "UNLOCK & ENTER CHAMBER";
    } else {
      tabSignup.className = "py-2 px-3 rounded-sm text-center transition-all bg-surface-container-highest text-primary border border-primary/40 font-semibold shadow-inner flex items-center justify-center gap-1.5";
      tabSignin.className = "py-2 px-3 rounded-sm text-center transition-all text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high flex items-center justify-center gap-1.5";
      formHeading.textContent = "Forge Chronomancer Profile";
      formSubheading.textContent = "Register a new profile to track trials, cloud progress and medals.";
      emailGroup.classList.remove('hidden');
      submitLabel.textContent = "CREATE PROFILE & ENTER";
    }
  }

  // Wire Button Events
  if (btnHeroGuest) btnHeroGuest.addEventListener('click', handlePlayAsGuest);
  if (btnNavGuest) btnNavGuest.addEventListener('click', handlePlayAsGuest);
  if (btnCtaGuest) btnCtaGuest.addEventListener('click', handlePlayAsGuest);
  if (btnModalGuest) btnModalGuest.addEventListener('click', handlePlayAsGuest);

  if (btnNavSignin) btnNavSignin.addEventListener('click', () => openAuthModal('signin'));
  if (btnHeroSignin) btnHeroSignin.addEventListener('click', () => openAuthModal('signin'));
  if (btnCtaSignin) btnCtaSignin.addEventListener('click', () => openAuthModal('signin'));

  if (btnCloseAuth) btnCloseAuth.addEventListener('click', closeAuthModal);
  if (tabSignin) tabSignin.addEventListener('click', () => updateModalMode('signin'));
  if (tabSignup) tabSignup.addEventListener('click', () => updateModalMode('signup'));

  if (authOverlay) {
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) closeAuthModal();
    });
  }

  // Autofill button
  if (btnAutofill) {
    btnAutofill.addEventListener('click', () => {
      document.getElementById('landing-handle-input').value = 'CHRONO-2024';
      document.getElementById('landing-passkey-input').value = 'Escapement99';
      updateModalMode('signin');
    });
  }

  // Logout
  if (btnNavLogout) {
    btnNavLogout.addEventListener('click', () => {
      if (window.chronosAuth) {
        window.chronosAuth.logout();
        checkInitialAuth();
      }
    });
  }

  // Form Submission
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.classList.add('hidden');

      const handle = document.getElementById('landing-handle-input').value.trim();
      const password = document.getElementById('landing-passkey-input').value;
      const email = document.getElementById('landing-email-input').value.trim();

      try {
        let result;
        if (currentAuthMode === 'signin') {
          result = await window.chronosAuth.login(handle, password);
        } else {
          result = await window.chronosAuth.signup(handle, email, password);
        }

        if (result && result.success) {
          // Redirect straight to game!
          window.location.href = '/game';
        } else {
          authError.textContent = (result && result.error) || 'Authentication failed. Please verify credentials.';
          authError.classList.remove('hidden');
        }
      } catch (err) {
        authError.textContent = 'Server connection error. Please try again.';
        authError.classList.remove('hidden');
      }
    });
  }

  // Smooth Scroll for in-page anchors
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
