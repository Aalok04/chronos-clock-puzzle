const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

// Path to persistent disk storage for player reviews/feedback
const feedbackFilePath = path.join(__dirname, '..', 'data', 'player_feedback.json');

function ensureFeedbackFile() {
  const dir = path.dirname(feedbackFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(feedbackFilePath)) {
    fs.writeFileSync(feedbackFilePath, JSON.stringify([], null, 2), 'utf8');
  }
}

function calculateRank(puzzlesSolved) {
  if (puzzlesSolved >= 10) return 'Chronos Master of Time';
  if (puzzlesSolved >= 8) return 'Arch-Chronomancer of Chronos';
  if (puzzlesSolved >= 6) return 'Temporal Paragon';
  if (puzzlesSolved >= 4) return 'Gear-Smith of the Void';
  if (puzzlesSolved >= 2) return 'Master Horologist';
  if (puzzlesSolved >= 1) return 'Escapement Adept';
  return 'Apprentice Chronomancer';
}

// GET /api/game/puzzles - Fetch all puzzle levels
router.get('/puzzles', async (req, res) => {
  try {
    const puzzles = await db.query(
      'SELECT id, level_number, title, start_time, target_time, running_duration_minutes, description, difficulty FROM puzzles ORDER BY level_number ASC'
    );
    return res.json({ success: true, puzzles });
  } catch (err) {
    console.error('[Get Puzzles Error]:', err);
    return res.status(500).json({ success: false, error: 'Could not fetch chronometer epochs.' });
  }
});

// POST /api/game/attempt - Record a solution attempt
router.post('/attempt', optionalAuth, async (req, res) => {
  try {
    const { puzzleId, levelNumber, pinsConfiguration, finalDisplayedTime, isSuccess } = req.body;

    const userId = req.user ? req.user.id : null;
    const configString = typeof pinsConfiguration === 'string'
      ? pinsConfiguration
      : JSON.stringify(pinsConfiguration || []);

    if (userId) {
      // Record attempt in database
      await db.query(
        'INSERT INTO game_attempts (user_id, puzzle_id, pins_configuration, final_displayed_time, is_success) VALUES (?, ?, ?, ?, ?)',
        [userId, puzzleId || null, configString, finalDisplayedTime || '00:00', !!isSuccess]
      );

      // If successful attempt, update user progress
      if (isSuccess) {
        // Fetch current profile
        const profiles = await db.query(
          'SELECT rank_title, puzzles_solved, current_level FROM user_profiles WHERE user_id = ?',
          [userId]
        );

        const currentSolved = profiles[0] ? profiles[0].puzzles_solved + 1 : 1;
        const nextLevel = Math.max((profiles[0] ? profiles[0].current_level : 1), (levelNumber || 1) + 1);
        const newRank = calculateRank(currentSolved);

        await db.query(
          'UPDATE user_profiles SET puzzles_solved = ?, current_level = ?, rank_title = ? WHERE user_id = ?',
          [currentSolved, nextLevel, newRank, userId]
        );

        return res.json({
          success: true,
          message: 'Temporal equation solved! Progress recorded to MySQL.',
          updatedProfile: {
            puzzles_solved: currentSolved,
            current_level: nextLevel,
            rank_title: newRank
          }
        });
      }
    }

    return res.json({
      success: true,
      message: isSuccess ? 'Puzzle solved in Guest Sandbox mode.' : 'Attempt recorded.'
    });
  } catch (err) {
    console.error('[Record Attempt Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to record attempt.' });
  }
});

// GET /api/game/stats - Telemetry and database status
router.get('/stats', async (req, res) => {
  try {
    const dbStatus = db.getStatus();
    return res.json({
      success: true,
      telemetry: {
        escapement_vph: 28800,
        flux_stability: '98.4%',
        boiler_pressure: '14.2 BAR',
        server_uptime: Math.floor(process.uptime()),
        database: dbStatus
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve telemetry.' });
  }
});

// POST /api/game/feedback - Store user rating, reaction & review
router.post('/feedback', optionalAuth, async (req, res) => {
  try {
    const { levelNumber, rating, sentiment, comment, username } = req.body;
    const userId = req.user ? req.user.id : null;
    const playerHandle = username || (req.user ? req.user.username : 'Guest Player');

    const feedbackEntry = {
      id: Date.now(),
      userId: userId,
      username: playerHandle,
      levelNumber: parseInt(levelNumber, 10) || 1,
      rating: parseInt(rating, 10) || 5,
      sentiment: sentiment || 'loved_it',
      comment: (comment || '').trim(),
      created_at: new Date().toISOString()
    };

    // 1. Save to JSON file on disk for persistent storage across restarts
    try {
      ensureFeedbackFile();
      const existingData = JSON.parse(fs.readFileSync(feedbackFilePath, 'utf8') || '[]');
      existingData.unshift(feedbackEntry);
      // Keep latest 200 feedback entries
      if (existingData.length > 200) existingData.length = 200;
      fs.writeFileSync(feedbackFilePath, JSON.stringify(existingData, null, 2), 'utf8');
    } catch (fsErr) {
      console.warn('[Feedback File Save Warning]:', fsErr.message);
    }

    // 2. Also save to MySQL database if table exists
    try {
      await db.query(
        'INSERT INTO player_feedback (user_id, username, level_number, rating, sentiment, comment) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, playerHandle, feedbackEntry.levelNumber, feedbackEntry.rating, feedbackEntry.sentiment, feedbackEntry.comment]
      );
    } catch (dbErr) {
      // Graceful fallback to file storage
    }

    return res.json({
      success: true,
      message: 'Feedback recorded successfully! Thank you.',
      feedback: feedbackEntry
    });
  } catch (err) {
    console.error('[Record Feedback Error]:', err);
    return res.status(500).json({ success: false, error: 'Could not record feedback.' });
  }
});

// GET /api/game/feedbacks - Retrieve recent player reviews and sentiments
router.get('/feedbacks', async (req, res) => {
  try {
    ensureFeedbackFile();
    let feedbacks = [];
    try {
      feedbacks = JSON.parse(fs.readFileSync(feedbackFilePath, 'utf8') || '[]');
    } catch (e) {}

    // If database connected, fetch from db if available
    try {
      const dbFeedbacks = await db.query(
        'SELECT id, username, level_number, rating, sentiment, comment, created_at FROM player_feedback ORDER BY created_at DESC LIMIT 50'
      );
      if (dbFeedbacks && dbFeedbacks.length > 0) {
        feedbacks = dbFeedbacks;
      }
    } catch (e) {}

    return res.json({
      success: true,
      feedbacks
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Could not fetch feedbacks.' });
  }
});

module.exports = router;
