const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

function parseJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function buildUserResponse(user, profile) {
  const completedLevels = parseJsonArray(profile.completed_levels);
  const puzzlesSolved = Math.max(Number(profile.puzzles_solved) || 0, completedLevels.length);
  const maxCompleted = completedLevels.length > 0 ? Math.max(...completedLevels) : 0;
  const currentLevel = Math.min(15, Math.max(1, Number(profile.current_level) || 1));
  const unlockedLevel = Math.min(15, Math.max(1, Number(profile.unlocked_level) || 1, currentLevel, maxCompleted + 1, puzzlesSolved + 1));
  const rankTitle = profile.rank_title || db.calculateRank(puzzlesSolved);
  const achievements = parseJsonArray(profile.achievements).length > 0
    ? parseJsonArray(profile.achievements)
    : db.calculateAchievements(completedLevels);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'student',
    status: user.status || 'Active',
    created_at: user.created_at,
    last_login_at: user.last_login_at || user.created_at,
    rank_title: rankTitle,
    puzzles_solved: puzzlesSolved,
    current_level: currentLevel,
    unlocked_level: unlockedLevel,
    completed_levels: completedLevels,
    achievements
  };
}

// POST /api/auth/signup - Create permanent player account
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields (username, email, password) are required.' });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 40) {
      return res.status(400).json({ success: false, error: 'Username must be between 3 and 40 characters.' });
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // Check existing by username or email (case-insensitive)
    const existingUsers = await db.query(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    );

    if (existingUsers && existingUsers.length > 0) {
      const match = existingUsers[0];
      if (String(match.email || '').toLowerCase() === cleanEmail) {
        return res.status(409).json({
          success: false,
          code: 'ACCOUNT_EXISTS',
          error: 'An account with this email already exists. Please switch to Sign In to access your account.'
        });
      }
      if (String(match.username || '').toLowerCase() === cleanUsername.toLowerCase()) {
        return res.status(409).json({
          success: false,
          code: 'USERNAME_EXISTS',
          error: 'This username is already registered. Please sign in if this is your account, or choose another username.'
        });
      }
    }

    // Securely hash password with bcrypt
    const passwordHash = await bcrypt.hash(String(password), 10);

    // Permanently insert user record
    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [cleanUsername, cleanEmail, passwordHash, 'student']
    );

    const userId = userResult.insertId;
    const nowIso = new Date().toISOString();

    // Permanently insert initial user profile
    await db.query(
      'INSERT INTO user_profiles (user_id, rank_title, puzzles_solved, current_level) VALUES (?, ?, ?, ?)',
      [userId, 'Apprentice Chronomancer', 0, 1]
    );

    const profile = db.getReconciledUserProfile(userId);
    const userObj = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      role: 'student',
      status: 'Active',
      created_at: nowIso,
      last_login_at: nowIso
    };

    // Generate long-lived JWT token (30 days)
    const token = jwt.sign(
      {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        role: 'student',
        status: 'Active',
        created_at: nowIso,
        password_hash: passwordHash
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account registered and saved permanently.',
      token,
      user: buildUserResponse(userObj, profile)
    });
  } catch (err) {
    console.error('[Auth Signup Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during account creation.' });
  }
});

// POST /api/auth/login - Authenticate returning user with email/username and password
router.post('/login', async (req, res) => {
  try {
    const rawIdentifier = req.body.handle || req.body.email || req.body.username || '';
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, error: 'Email (or username) and password are required.' });
    }

    const cleanHandle = String(rawIdentifier).trim();

    // Query user by username or email
    const users = await db.query(
      'SELECT id, username, email, password_hash, role, status, created_at, last_login_at FROM users WHERE username = ? OR email = ?',
      [cleanHandle, cleanHandle.toLowerCase()]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email/username or password.' });
    }

    const user = users[0];

    if (String(user.status || 'Active').toLowerCase() === 'disabled') {
      return res.status(403).json({
        success: false,
        error: 'This account has been disabled by an administrator. Please contact support.'
      });
    }

    // Verify bcrypt password hash
    const isMatch = await bcrypt.compare(String(password), user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email/username or password.' });
    }

    // Update last login date in permanent storage
    const nowIso = new Date().toISOString();
    try {
      await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      user.last_login_at = nowIso;
    } catch (e) {}

    // Retrieve & reconcile saved game progress
    const profiles = await db.query(
      'SELECT rank_title, puzzles_solved, current_level FROM user_profiles WHERE user_id = ?',
      [user.id]
    );
    const reconciledProfile = db.getReconciledUserProfile(user.id);
    const profile = {
      ...reconciledProfile,
      ...(profiles && profiles[0] ? {
        puzzles_solved: Math.max(Number(profiles[0].puzzles_solved) || 0, reconciledProfile.puzzles_solved || 0),
        current_level: Math.max(Number(profiles[0].current_level) || 1, reconciledProfile.current_level || 1)
      } : {})
    };

    // Issue 30-day token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'student',
        status: user.status || 'Active',
        created_at: user.created_at,
        password_hash: user.password_hash
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({
      success: true,
      message: 'Welcome back! Your saved progress has been restored.',
      token,
      user: buildUserResponse(user, profile)
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
});

// GET /api/auth/me - Verify current session and restore saved game progress
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Ensure account exists in permanent store if valid signed token arrives
    db.ensureUserFromToken(req.user);

    let users = await db.query(
      'SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if ((!users || users.length === 0) && req.user.email) {
      users = await db.query(
        'SELECT id, username, email, role, status, created_at, last_login_at FROM users WHERE email = ?',
        [String(req.user.email).toLowerCase()]
      );
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', error: 'Account record not found.' });
    }

    const user = users[0];

    if (String(user.status || 'Active').toLowerCase() === 'disabled') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        error: 'This account has been disabled by an administrator.'
      });
    }

    const reconciledProfile = db.getReconciledUserProfile(user.id);

    return res.json({
      success: true,
      user: buildUserResponse(user, reconciledProfile)
    });
  } catch (err) {
    console.error('[Auth Me Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve researcher profile.' });
  }
});

module.exports = router;
