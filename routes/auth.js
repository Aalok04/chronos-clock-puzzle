const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/signup - Create archive account
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields (handle, email, passkey) are required.' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 40) {
      return res.status(400).json({ success: false, error: 'Handle must be between 3 and 40 characters.' });
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({ success: false, error: 'Please enter a valid scholar email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Passkey must be at least 6 characters long.' });
    }

    // Check existing
    const existingUsers = await db.query(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    );

    if (existingUsers && existingUsers.length > 0) {
      const match = existingUsers[0];
      if (match.username.toLowerCase() === cleanUsername.toLowerCase()) {
        return res.status(409).json({ success: false, error: 'This researcher handle is already registered.' });
      }
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const userResult = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [cleanUsername, cleanEmail, passwordHash, 'student']
    );

    const userId = userResult.insertId;

    // Insert default profile
    await db.query(
      'INSERT INTO user_profiles (user_id, rank_title, puzzles_solved, current_level) VALUES (?, ?, ?, ?)',
      [userId, 'Apprentice Chronomancer', 0, 1]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, username: cleanUsername, email: cleanEmail, role: 'student' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Archive account forged successfully.',
      token,
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        role: 'student',
        rank_title: 'Apprentice Chronomancer',
        puzzles_solved: 0,
        current_level: 1
      }
    });
  } catch (err) {
    console.error('[Auth Signup Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during account creation.' });
  }
});

// POST /api/auth/login - Authenticate with handle/email and passkey
router.post('/login', async (req, res) => {
  try {
    const { handle, password } = req.body;

    if (!handle || !password) {
      return res.status(400).json({ success: false, error: 'Handle and passkey are required.' });
    }

    const cleanHandle = handle.trim();

    // Query user by handle (username) or email
    const users = await db.query(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = ? OR email = ?',
      [cleanHandle, cleanHandle.toLowerCase()]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid researcher handle or passkey.' });
    }

    const user = users[0];

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid researcher handle or passkey.' });
    }

    // Get user profile
    const profiles = await db.query(
      'SELECT rank_title, puzzles_solved, current_level FROM user_profiles WHERE user_id = ?',
      [user.id]
    );

    const profile = profiles[0] || {
      rank_title: 'Apprentice Chronomancer',
      puzzles_solved: 0,
      current_level: 1
    };

    // Issue token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Temporal Chamber unlocked successfully.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        rank_title: profile.rank_title,
        puzzles_solved: profile.puzzles_solved,
        current_level: profile.current_level
      }
    });
  } catch (err) {
    console.error('[Auth Login Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during authentication.' });
  }
});

// GET /api/auth/me - Verify current session
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const users = await db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, error: 'Researcher record not found.' });
    }

    const user = users[0];
    const profiles = await db.query(
      'SELECT rank_title, puzzles_solved, current_level FROM user_profiles WHERE user_id = ?',
      [user.id]
    );

    const profile = profiles[0] || {
      rank_title: 'Apprentice Chronomancer',
      puzzles_solved: 0,
      current_level: 1
    };

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        rank_title: profile.rank_title,
        puzzles_solved: profile.puzzles_solved,
        current_level: profile.current_level,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error('[Auth Me Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve researcher profile.' });
  }
});

module.exports = router;
