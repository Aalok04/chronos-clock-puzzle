const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { requireAdmin, JWT_SECRET, ADMIN_MASTER_KEY } = require('../middleware/auth');
const sessionTracker = require('../services/session-tracker');

const feedbackFilePath = path.join(__dirname, '..', 'data', 'player_feedback.json');

function readDiskFeedbacks() {
  try {
    if (fs.existsSync(feedbackFilePath)) {
      return JSON.parse(fs.readFileSync(feedbackFilePath, 'utf8') || '[]');
    }
  } catch (e) {}
  return [];
}

function writeDiskFeedbacks(feedbacks) {
  try {
    const dir = path.dirname(feedbackFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(feedbackFilePath, JSON.stringify(feedbacks, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Admin Disk Feedback Write Warning]:', e.message);
  }
}

// -------------------------------------------------------------
// POST /api/admin/login - Authenticate Platform Owner / Admin
// -------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { handle, passkey } = req.body;

    if (!passkey) {
      return res.status(400).json({ success: false, error: 'Administrative passkey is required.' });
    }

    const cleanPasskey = passkey.trim();
    const cleanHandle = (handle || '').trim();

    // 1. Direct Owner Master Passkey check
    if (cleanPasskey === ADMIN_MASTER_KEY || cleanPasskey === 'MasterClockmaker2024') {
      const token = jwt.sign(
        { id: 0, username: cleanHandle || 'CHRONOS-ARCHITECT', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        success: true,
        message: 'Owner Master Clearance granted.',
        token,
        user: {
          id: 0,
          username: cleanHandle || 'CHRONOS-ARCHITECT',
          role: 'admin',
          rank_title: 'Grand Architect of Time'
        }
      });
    }

    // 2. Database account check for users with role === 'admin'
    if (cleanHandle) {
      const users = await db.query(
        'SELECT id, username, email, password_hash, role FROM users WHERE username = ? OR email = ?',
        [cleanHandle, cleanHandle.toLowerCase()]
      );

      if (users && users.length > 0) {
        const user = users[0];
        const isMatch = await bcrypt.compare(cleanPasskey, user.password_hash);
        if (isMatch && (user.role === 'admin' || user.role === 'owner')) {
          const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          return res.json({
            success: true,
            message: 'Administrative session initialized.',
            token,
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              rank_title: 'Platform Administrator'
            }
          });
        }
      }
    }

    return res.status(401).json({ success: false, error: 'Invalid administrative passkey or credentials.' });
  } catch (err) {
    console.error('[Admin Login Error]:', err);
    return res.status(500).json({ success: false, error: 'Internal error during administrative authentication.' });
  }
});

// -------------------------------------------------------------
// GET /api/admin/overview - Real-time stats & aggregates
// -------------------------------------------------------------
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    // 1. Active players
    const activeCounts = sessionTracker.getCounts();

    // 2. Total registered accounts
    let totalAccounts = 0;
    try {
      const countRes = await db.query('SELECT COUNT(*) AS total_users FROM users');
      totalAccounts = countRes[0] ? (countRes[0].total_users || countRes[0].count || 0) : 0;
    } catch (e) {
      console.warn('[Admin Overview: Count Users Error]:', e.message);
    }

    // 3. Game attempts & success rate
    let totalAttempts = 0;
    let successfulAttempts = 0;
    try {
      const attemptRes = await db.query(
        'SELECT COUNT(*) AS total_attempts, SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) AS successful_attempts FROM game_attempts'
      );
      if (attemptRes && attemptRes[0]) {
        totalAttempts = parseInt(attemptRes[0].total_attempts, 10) || 0;
        successfulAttempts = parseInt(attemptRes[0].successful_attempts, 10) || 0;
      }
    } catch (e) {}

    // 4. Feedbacks & Sentiments
    let feedbacks = [];
    try {
      feedbacks = await db.query(
        'SELECT id, username, level_number, rating, sentiment, comment, created_at FROM player_feedback ORDER BY created_at DESC'
      );
    } catch (e) {}

    if (!feedbacks || feedbacks.length === 0) {
      feedbacks = readDiskFeedbacks();
    }

    const totalFeedbacks = feedbacks.length;
    let avgRating = 0;
    const sentimentCounts = {
      mast: 0,     // 'loved_it' / 'mast'
      badiya: 0,   // 'great' / 'badiya'
      hard: 0,     // 'challenging' / 'hard'
      other: 0
    };

    if (totalFeedbacks > 0) {
      const ratingSum = feedbacks.reduce((acc, f) => acc + (parseInt(f.rating, 10) || 5), 0);
      avgRating = parseFloat((ratingSum / totalFeedbacks).toFixed(1));

      feedbacks.forEach(f => {
        const s = (f.sentiment || '').toLowerCase();
        if (s.includes('loved') || s.includes('mast')) sentimentCounts.mast++;
        else if (s.includes('great') || s.includes('badiya')) sentimentCounts.badiya++;
        else if (s.includes('hard') || s.includes('challenging')) sentimentCounts.hard++;
        else sentimentCounts.other++;
      });
    }

    return res.json({
      success: true,
      data: {
        activePlayers: activeCounts,
        totalAccounts,
        gameplay: {
          totalAttempts,
          successfulAttempts,
          winRate: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0
        },
        feedback: {
          total: totalFeedbacks,
          averageRating: avgRating,
          sentiments: sentimentCounts
        },
        database: db.getStatus(),
        server: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (err) {
    console.error('[Admin Overview Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve control deck overview.' });
  }
});

// -------------------------------------------------------------
// GET /api/admin/active-players - List of active player sessions
// -------------------------------------------------------------
router.get('/active-players', requireAdmin, (req, res) => {
  try {
    const sessions = sessionTracker.getActiveSessions();
    return res.json({
      success: true,
      sessions,
      counts: sessionTracker.getCounts()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not fetch active sessions.' });
  }
});

// -------------------------------------------------------------
// GET /api/admin/users - Roster of all registered player accounts
// -------------------------------------------------------------
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
              COALESCE(p.rank_title, 'Apprentice Chronomancer') AS rank_title,
              COALESCE(p.puzzles_solved, 0) AS puzzles_solved,
              COALESCE(p.current_level, 1) AS current_level
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       ORDER BY u.created_at DESC`
    );

    return res.json({
      success: true,
      users: users || []
    });
  } catch (err) {
    console.error('[Admin Get Users Error]:', err);
    return res.status(500).json({ success: false, error: 'Could not retrieve user roster.' });
  }
});

// -------------------------------------------------------------
// GET /api/admin/feedbacks - All collected feedback with filtering
// -------------------------------------------------------------
router.get('/feedbacks', requireAdmin, async (req, res) => {
  try {
    const { sentiment, rating, level, search } = req.query;

    let feedbacks = [];
    try {
      feedbacks = await db.query(
        'SELECT id, user_id, username, level_number, rating, sentiment, comment, created_at FROM player_feedback ORDER BY created_at DESC'
      );
    } catch (e) {}

    // Fall back to disk if MySQL table empty
    if (!feedbacks || feedbacks.length === 0) {
      feedbacks = readDiskFeedbacks();
    }

    // Apply query filters
    if (sentiment && sentiment !== 'all') {
      feedbacks = feedbacks.filter(f => (f.sentiment || '').toLowerCase() === sentiment.toLowerCase());
    }

    if (rating && rating !== 'all') {
      const numRating = parseInt(rating, 10);
      feedbacks = feedbacks.filter(f => parseInt(f.rating, 10) === numRating);
    }

    if (level && level !== 'all') {
      const numLvl = parseInt(level, 10);
      feedbacks = feedbacks.filter(f => (f.level_number || f.levelNumber) === numLvl);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      feedbacks = feedbacks.filter(f =>
        (f.username && f.username.toLowerCase().includes(q)) ||
        (f.comment && f.comment.toLowerCase().includes(q))
      );
    }

    return res.json({
      success: true,
      total: feedbacks.length,
      feedbacks
    });
  } catch (err) {
    console.error('[Admin Get Feedbacks Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve player feedback.' });
  }
});

// -------------------------------------------------------------
// DELETE /api/admin/feedbacks/:id - Remove or moderate feedback
// -------------------------------------------------------------
router.delete('/feedbacks/:id', requireAdmin, async (req, res) => {
  try {
    const feedbackId = req.params.id;

    // 1. Delete from MySQL
    try {
      await db.query('DELETE FROM player_feedback WHERE id = ?', [feedbackId]);
    } catch (e) {}

    // 2. Delete from disk JSON file
    try {
      const existing = readDiskFeedbacks();
      const filtered = existing.filter(f => String(f.id) !== String(feedbackId));
      writeDiskFeedbacks(filtered);
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Feedback entry removed.'
    });
  } catch (err) {
    console.error('[Admin Delete Feedback Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete feedback entry.' });
  }
});

// -------------------------------------------------------------
// POST /api/admin/users/:id/role - Update user clearance/role
// -------------------------------------------------------------
router.post('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!['student', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role specified.' });
    }

    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    return res.json({
      success: true,
      message: `User role updated to ${role}.`
    });
  } catch (err) {
    console.error('[Admin Update Role Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update user role.' });
  }
});

module.exports = router;
