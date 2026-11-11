const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { optionalAuth } = require('../middleware/auth');

function calculateRank(puzzlesSolved) {
  if (puzzlesSolved >= 5) return 'Arch-Chronomancer of Chronos';
  if (puzzlesSolved >= 4) return 'Temporal Paragon';
  if (puzzlesSolved >= 3) return 'Gear-Smith of the Void';
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

module.exports = router;
