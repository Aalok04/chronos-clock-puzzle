const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isConnected = false;
let dbMode = 'uninitialized';

// Path to persistent disk storage for player reviews/feedback
const feedbackFilePath = path.join(__dirname, '..', 'data', 'player_feedback.json');

// In-memory fallback repository for graceful offline execution if MySQL is not reachable
const memoryStore = {
  users: [],
  user_profiles: [],
  puzzles: [
    { id: 1, level_number: 1, title: 'Epoch I: The First Escapement', start_time: '01:00', target_time: '02:35', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 02:15. You need an extra 20 minutes to reach 02:35.', difficulty: 'Novice' },
    { id: 2, level_number: 2, title: 'Epoch II: Equilibrium of Gears', start_time: '12:00', target_time: '01:20', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 01:15. A delicate balance (+20m and -15m) bridges the 5-minute offset to 01:20.', difficulty: 'Novice' },
    { id: 3, level_number: 3, title: 'Epoch III: The Temporal Paradox', start_time: '06:00', target_time: '08:00', running_duration_minutes: 75, max_pins: null, description: 'Coordinate concentric rings to bridge a 45-minute offset from 07:15 natural run end to 08:00.', difficulty: 'Apprentice' },
    { id: 4, level_number: 4, title: 'Epoch IV: Synchronized Arbors', start_time: '07:00', target_time: '08:15', running_duration_minutes: 75, max_pins: null, description: 'Natural 75m passage synchronizes directly with 08:15. Maintain balance across sweeps.', difficulty: 'Apprentice' },
    { id: 5, level_number: 5, title: 'Epoch V: Gear-Train Resonance', start_time: '03:35', target_time: '05:15', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 04:50. Advance the minute hand +25 minutes to strike 05:15.', difficulty: 'Adept' },
    { id: 6, level_number: 6, title: 'Epoch VI: Chrono Dilation', start_time: '07:10', target_time: '08:15', running_duration_minutes: 75, max_pins: null, description: 'Natural passage overshoots to 08:25! Slot negative fraction warps to decelerate the dial back to 08:15.', difficulty: 'Adept' },
    { id: 7, level_number: 7, title: 'Epoch VII: The Omnipresent Dial', start_time: '10:15', target_time: '12:00', running_duration_minutes: 75, max_pins: 3, description: 'Natural passage reaches 11:30. Bridge the 30-minute gap to 12:00 using no more than 3 fraction pins.', difficulty: 'Expert' },
    { id: 8, level_number: 8, title: 'Epoch VIII: The Brass Pendulum', start_time: '02:00', target_time: '04:30', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 03:15. Harness hour step advances and minute sweeps with a strict 4-pin budget.', difficulty: 'Expert' },
    { id: 9, level_number: 9, title: 'Epoch IX: Dual Escapement Cadence', start_time: '01:30', target_time: '03:15', running_duration_minutes: 75, max_pins: 2, description: 'Natural run reaches 02:45. Advance +30 minutes to reach 03:15 using at most 2 pins!', difficulty: 'Master' },
    { id: 10, level_number: 10, title: 'Epoch X: The Dual-Arbor Leap', start_time: '02:20', target_time: '04:30', running_duration_minutes: 75, max_pins: 5, description: 'Natural run reaches 03:35. Coordinate inner and outer triggers to bridge a 55-minute gap with max 5 pins.', difficulty: 'Master' },
    { id: 11, level_number: 11, title: 'Epoch XI: Harmonic Oscillations', start_time: '04:45', target_time: '06:45', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 06:00. Advance 45 minutes to synchronize with 06:45 using 4 pins max.', difficulty: 'Grandmaster' },
    { id: 12, level_number: 12, title: 'Epoch XII: The Monolithic Leap', start_time: '06:25', target_time: '08:00', running_duration_minutes: 75, max_pins: 1, description: 'Natural run reaches 07:40. You need exactly +20m to reach 08:00 — achieve this with ONLY 1 pin!', difficulty: 'Grandmaster' },
    { id: 13, level_number: 13, title: 'Epoch XIII: Chrono Convergence', start_time: '02:00', target_time: '04:10', running_duration_minutes: 75, max_pins: 5, description: 'Natural run reaches 03:15. Complex 55-minute coordination under a 5-pin budget.', difficulty: 'Chronos Supreme' },
    { id: 14, level_number: 14, title: 'Epoch XIV: Concentric Resonance', start_time: '05:20', target_time: '07:00', running_duration_minutes: 75, max_pins: 3, description: 'Natural run reaches 06:35. Bridge the 25-minute offset to 07:00 with at most 3 pins.', difficulty: 'Chronos Supreme' },
    { id: 15, level_number: 15, title: 'Epoch XV: Grand Chronomancer Apex', start_time: '03:25', target_time: '05:05', running_duration_minutes: 75, max_pins: 4, description: 'The pinnacle trial. Natural run reaches 04:40. Reach 05:05 within a strict 4-pin constraint!', difficulty: 'Chronos Supreme' }
  ],
  game_attempts: [],
  player_feedback: []
};

// Load persistent feedback from disk into memoryStore
try {
  if (fs.existsSync(feedbackFilePath)) {
    const data = JSON.parse(fs.readFileSync(feedbackFilePath, 'utf8') || '[]');
    memoryStore.player_feedback = Array.isArray(data) ? data : [];
  }
} catch (e) {}

async function initDB() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'chronos_clock_db';
  const useSSL = process.env.DB_SSL === 'true';

  console.log(`[Database] Attempting connection to MySQL at ${host}:${port} (${database})...`);

  try {
    // 1. Check/create database if local MySQL
    if (!useSSL && (host === '127.0.0.1' || host === 'localhost')) {
      try {
        const rootConn = await mysql.createConnection({ host, port, user, password });
        await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConn.end();
      } catch (err) {
        // Ignored if user lacks CREATE DATABASE privileges or remote host
      }
    }

    const poolConfig = {
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };

    if (useSSL) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    pool = mysql.createPool(poolConfig);

    // Test connection
    const testConn = await pool.getConnection();
    await testConn.ping();
    testConn.release();

    isConnected = true;
    dbMode = useSSL ? 'TiDB/Cloud-MySQL (SSL)' : 'Local-MySQL';
    console.log(`[Database] SUCCESS: Connected to MySQL [Mode: ${dbMode}]!`);

    // Run table migrations
    await runMigrations();
    return { success: true, mode: dbMode };
  } catch (err) {
    console.warn(`[Database] WARNING: Could not connect to MySQL server (${err.message}).`);
    console.warn(`[Database] Activating Resilient In-Memory Mode. All features & APIs will remain fully functional.`);
    console.warn(`[Database] Tip: To connect free TiDB Cloud MySQL, update .env with your TiDB credentials & set DB_SSL=true.`);
    isConnected = false;
    dbMode = 'In-Memory Simulation (Offline Fallback)';
    return { success: false, mode: dbMode, error: err.message };
  }
}

async function runMigrations() {
  if (!pool) return;
  try {
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const conn = await pool.getConnection();
      try {
        for (const statement of statements) {
          await conn.query(statement);
        }
        console.log('[Database] Migrations applied: Tables and seed levels are ready in MySQL.');
      } finally {
        conn.release();
      }
    }
  } catch (migrationErr) {
    console.error('[Database] Migration error:', migrationErr.message);
  }
}

// Unified query runner for MySQL with In-Memory fallback
async function query(sql, params = []) {
  if (pool && isConnected) {
    try {
      const [rows, fields] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      console.error('[Database Query Error]:', err.message);
      throw err;
    }
  }

  // Fallback handler for queries when offline
  return executeMemoryQuery(sql, params);
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

// Lightweight SQL-like emulator for offline/dev fallback
function executeMemoryQuery(sql, params) {
  const cleanSql = sql.trim();
  const lower = cleanSql.toLowerCase();

  // SELECT COUNT(*) from users
  if (lower.includes('count(*)') && lower.includes('from users')) {
    return [{ total_users: memoryStore.users.length, count: memoryStore.users.length }];
  }

  // SELECT joined users and user_profiles (User Roster)
  if (lower.includes('from users') && (lower.includes('join user_profiles') || lower.includes('order by'))) {
    return memoryStore.users.map(u => {
      const profile = memoryStore.user_profiles.find(p => Number(p.user_id) === Number(u.id)) || {
        rank_title: 'Apprentice Chronomancer',
        puzzles_solved: 0,
        current_level: 1
      };
      // Reconcile with actual successful game_attempts to guarantee 100% accurate metrics
      const solvedAttempts = memoryStore.game_attempts.filter(a => Number(a.user_id) === Number(u.id) && a.is_success).length;
      const actualSolved = Math.max(profile.puzzles_solved || 0, solvedAttempts);
      const actualLevel = Math.max(profile.current_level || 1, actualSolved > 0 ? actualSolved + 1 : 1);
      const actualRank = calculateRank(actualSolved);

      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        rank_title: actualRank,
        puzzles_solved: actualSolved,
        current_level: actualLevel
      };
    });
  }

  // SELECT users by username or email
  if (lower.startsWith('select') && lower.includes('from users')) {
    if (lower.includes('where username = ? or email = ?')) {
      const u = memoryStore.users.find(x => x.username.toLowerCase() === (params[0] || '').toLowerCase() || x.email.toLowerCase() === (params[1] || '').toLowerCase());
      return u ? [u] : [];
    }
    if (lower.includes('where username = ? or role = ?')) {
      const u = memoryStore.users.find(x => x.username === params[0] || x.role === params[1]);
      return u ? [u] : [];
    }
    if (lower.includes('where username = ?')) {
      const u = memoryStore.users.find(x => x.username.toLowerCase() === (params[0] || '').toLowerCase());
      return u ? [u] : [];
    }
    if (lower.includes('where email = ?')) {
      const u = memoryStore.users.find(x => x.email.toLowerCase() === (params[0] || '').toLowerCase());
      return u ? [u] : [];
    }
    if (lower.includes('where id = ?')) {
      const u = memoryStore.users.find(x => Number(x.id) === Number(params[0]));
      return u ? [u] : [];
    }
    return memoryStore.users;
  }

  // SELECT user_profiles
  if (lower.startsWith('select') && lower.includes('from user_profiles')) {
    if (lower.includes('where user_id = ?')) {
      const p = memoryStore.user_profiles.find(x => Number(x.user_id) === Number(params[0]));
      return p ? [p] : [];
    }
    return memoryStore.user_profiles;
  }

  // SELECT puzzles
  if (lower.startsWith('select') && lower.includes('from puzzles')) {
    if (lower.includes('where level_number = ?')) {
      const p = memoryStore.puzzles.find(x => x.level_number === params[0]);
      return p ? [p] : [];
    }
    if (lower.includes('where id = ?')) {
      const p = memoryStore.puzzles.find(x => x.id === params[0]);
      return p ? [p] : [];
    }
    return memoryStore.puzzles;
  }

  // SELECT game_attempts by user_id
  if (lower.includes('count(*)') && lower.includes('from game_attempts') && lower.includes('where user_id = ?')) {
    const isSuccessCheck = lower.includes('is_success = 1') || lower.includes('is_success = true');
    const matched = memoryStore.game_attempts.filter(a => {
      const matchesUser = Number(a.user_id) === Number(params[0]);
      return isSuccessCheck ? (matchesUser && a.is_success) : matchesUser;
    });
    return [{ total_solved: matched.length, count: matched.length }];
  }

  // SELECT game_attempts aggregate (Total attempts & success count)
  if (lower.includes('count(*)') && lower.includes('from game_attempts')) {
    const total = memoryStore.game_attempts.length;
    const successful = memoryStore.game_attempts.filter(a => a.is_success).length;
    return [{
      total_attempts: total,
      successful_attempts: successful
    }];
  }

  // SELECT player_feedback
  if (lower.startsWith('select') && lower.includes('from player_feedback')) {
    let result = [...memoryStore.player_feedback];
    // Sort descending by created_at
    result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return result;
  }

  // INSERT INTO users
  if (lower.startsWith('insert into users')) {
    const newId = memoryStore.users.length + 1;
    const user = {
      id: newId,
      username: params[0],
      email: params[1],
      password_hash: params[2],
      role: params[3] || 'student',
      created_at: new Date()
    };
    memoryStore.users.push(user);
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO user_profiles
  if (lower.startsWith('insert into user_profiles')) {
    const profile = {
      user_id: Number(params[0]),
      rank_title: params[1] || 'Apprentice Chronomancer',
      puzzles_solved: Number(params[2]) || 0,
      current_level: Number(params[3]) || 1,
      updated_at: new Date()
    };
    memoryStore.user_profiles.push(profile);
    return { insertId: profile.user_id, affectedRows: 1 };
  }

  // UPDATE user_profiles
  if (lower.startsWith('update user_profiles')) {
    const userId = Number(params[params.length - 1]);
    let profile = memoryStore.user_profiles.find(x => Number(x.user_id) === userId);
    if (!profile) {
      profile = {
        user_id: userId,
        rank_title: params[2] || 'Apprentice Chronomancer',
        puzzles_solved: Number(params[0]) || 0,
        current_level: Number(params[1]) || 1,
        updated_at: new Date()
      };
      memoryStore.user_profiles.push(profile);
      return { affectedRows: 1 };
    }
    if (params.length >= 4) {
      profile.puzzles_solved = Number(params[0]);
      profile.current_level = Number(params[1]);
      profile.rank_title = params[2];
    }
    profile.updated_at = new Date();
    return { affectedRows: 1 };
  }

  // UPDATE users SET role = ?
  if (lower.startsWith('update users set role = ?')) {
    const role = params[0];
    const userId = params[1];
    const user = memoryStore.users.find(u => u.id === userId);
    if (user) {
      user.role = role;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // INSERT INTO game_attempts
  if (lower.startsWith('insert into game_attempts')) {
    const newId = memoryStore.game_attempts.length + 1;
    memoryStore.game_attempts.push({
      id: newId,
      user_id: params[0],
      puzzle_id: params[1],
      pins_configuration: params[2],
      final_displayed_time: params[3],
      is_success: params[4],
      attempted_at: new Date()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO player_feedback
  if (lower.startsWith('insert into player_feedback')) {
    const newId = Date.now();
    const entry = {
      id: newId,
      user_id: params[0],
      username: params[1],
      level_number: params[2],
      rating: params[3],
      sentiment: params[4],
      comment: params[5],
      created_at: new Date()
    };
    memoryStore.player_feedback.unshift(entry);
    return { insertId: newId, affectedRows: 1 };
  }

  // DELETE FROM player_feedback
  if (lower.startsWith('delete from player_feedback')) {
    const id = params[0];
    const initialLen = memoryStore.player_feedback.length;
    memoryStore.player_feedback = memoryStore.player_feedback.filter(f => f.id !== id && f.id !== parseInt(id, 10));
    return { affectedRows: initialLen - memoryStore.player_feedback.length };
  }

  // Fallback empty
  return [];
}

module.exports = {
  initDB,
  query,
  getStatus: () => ({
    isConnected,
    dbMode,
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'chronos_clock_db'
  })
};
