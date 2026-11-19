const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isConnected = false;
let dbMode = 'Permanent Local Database (Disk-Persisted)';
let initPromise = null;

// Paths to permanent disk storage for users, profiles, game progress, and feedback
const dataDir = path.join(__dirname, '..', 'data');
const permanentDbFilePath = path.join(dataDir, 'permanent_database.json');
const feedbackFilePath = path.join(dataDir, 'player_feedback.json');

const DEFAULT_PUZZLES = [
  { id: 1, level_number: 1, title: 'Epoch I: The First Escapement', start_time: '01:00', target_time: '02:35', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 02:15. You need an extra 20 minutes to reach 02:35.', difficulty: 'Novice' },
  { id: 2, level_number: 2, title: 'Epoch II: Equilibrium of Gears', start_time: '12:00', target_time: '01:20', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 01:15. A delicate balance (+20m and -15m) bridges the 5-minute offset to 01:20.', difficulty: 'Novice' },
  { id: 3, level_number: 3, title: 'Epoch III: The Temporal Paradox', start_time: '06:00', target_time: '08:00', running_duration_minutes: 75, max_pins: null, description: 'Coordinate concentric rings to bridge a 45-minute offset from 07:15 natural run end to 08:00.', difficulty: 'Apprentice' },
  { id: 4, level_number: 4, title: 'Epoch IV: Synchronized Arbors', start_time: '07:00', target_time: '08:15', running_duration_minutes: 75, max_pins: null, description: 'Natural 75m passage synchronizes directly with 08:15. Maintain balance across sweeps.', difficulty: 'Apprentice' },
  { id: 5, level_number: 5, title: 'Epoch V: Gear-Train Resonance', start_time: '03:35', target_time: '05:15', running_duration_minutes: 75, max_pins: null, description: 'Natural passage reaches 04:50. Advance the minute hand +25 minutes to strike 05:15.', difficulty: 'Adept' },
  { id: 6, level_number: 6, title: 'Epoch VI: Dual-Ring Harmony', start_time: '02:00', target_time: '05:00', running_duration_minutes: 75, max_pins: 2, description: 'Natural passage reaches 03:15. Coordinate both concentric rings (+2h Hour Hand, -15m Minute Hand) with a 2-pin budget to strike 05:00.', difficulty: 'Adept' },
  { id: 7, level_number: 7, title: 'Epoch VII: Concentric Cross-Sweep', start_time: '08:00', target_time: '01:00', running_duration_minutes: 75, max_pins: 2, description: 'Natural passage reaches 09:15. Advance the hour step (+4h) and calibrate the minute sweep (-15m) within 2 pins to synchronize with 01:00.', difficulty: 'Expert' },
  { id: 8, level_number: 8, title: 'Epoch VIII: Counter-Clock Cadence', start_time: '11:00', target_time: '09:35', running_duration_minutes: 75, max_pins: 2, description: 'Natural run reaches 12:15. Apply hour deceleration (-3h) and advance minute travel (+20m) using max 2 pins to strike 09:35.', difficulty: 'Expert' },
  { id: 9, level_number: 9, title: 'Epoch IX: Triad Escapement', start_time: '10:00', target_time: '02:45', running_duration_minutes: 75, max_pins: 3, description: 'Natural run reaches 11:15. Coordinate an hour warp (+4h) with dual decelerations (-30m) across both rings using at most 3 pins to lock at 02:45.', difficulty: 'Master' },
  { id: 10, level_number: 10, title: 'Epoch X: Dual-Arbor Leap', start_time: '05:00', target_time: '02:35', running_duration_minutes: 75, max_pins: 3, description: 'Natural run reaches 06:15. Double up inner ring advances (+8h) and coordinate the minute sweep (+20m) within a strict 3-pin limit to reach 02:35.', difficulty: 'Master' },
  { id: 11, level_number: 11, title: 'Epoch XI: Harmonic Bifurcation', start_time: '09:00', target_time: '04:55', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 10:15. Multiple paths exist! Advance minutes (+40m) and coordinate hour shifts to achieve 04:55 using at most 4 pins.', difficulty: 'Grandmaster' },
  { id: 12, level_number: 12, title: 'Epoch XII: Quadrant Equilibrium', start_time: '07:00', target_time: '03:45', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 08:15. Coordinate dual inner advances (+8h) with dual minute decelerations (-30m) under a 4-pin constraint to strike 03:45.', difficulty: 'Grandmaster' },
  { id: 13, level_number: 13, title: 'Epoch XIII: Chrono Resonance Convergence', start_time: '04:00', target_time: '08:35', running_duration_minutes: 75, max_pins: 4, description: 'Natural run reaches 05:15. Multi-pin concentration on the inner ring paired with minute pacing to bridge the temporal gap to 08:35 with 4 pins.', difficulty: 'Chronos Supreme' },
  { id: 14, level_number: 14, title: 'Epoch XIV: Multi-Phase Dial Synchrony', start_time: '10:00', target_time: '04:10', running_duration_minutes: 75, max_pins: 5, description: 'Natural run reaches 11:15. Complex 5-pin coordination across mixed colors and directions on both rings to align the dial at 04:10.', difficulty: 'Chronos Supreme' },
  { id: 15, level_number: 15, title: 'Epoch XV: Grand Chronomancer Apex', start_time: '06:00', target_time: '06:05', running_duration_minutes: 75, max_pins: 5, description: 'The pinnacle trial. Natural run reaches 07:15. Master mixed color fractions and counter-sweeps on both rings within 5 pins to strike 06:05.', difficulty: 'Chronos Supreme' }
];

const memoryStore = {
  nextUserId: 1,
  nextAttemptId: 1,
  users: [],
  user_profiles: [],
  puzzles: [...DEFAULT_PUZZLES],
  game_attempts: [],
  player_feedback: []
};

function calculateRank(puzzlesSolved) {
  if (puzzlesSolved >= 15) return 'Grand Chronomancer Apex';
  if (puzzlesSolved >= 10) return 'Chronos Master of Time';
  if (puzzlesSolved >= 8) return 'Arch-Chronomancer of Chronos';
  if (puzzlesSolved >= 6) return 'Temporal Paragon';
  if (puzzlesSolved >= 4) return 'Gear-Smith of the Void';
  if (puzzlesSolved >= 2) return 'Master Horologist';
  if (puzzlesSolved >= 1) return 'Escapement Adept';
  return 'Apprentice Chronomancer';
}

function calculateAchievements(completedLevels = []) {
  const list = [];
  const count = completedLevels.length;
  if (count >= 1) list.push('First Escapement');
  if (count >= 3) list.push('Paradox Solver');
  if (count >= 5) list.push('Outer Ring Adept');
  if (completedLevels.some(lvl => lvl >= 6)) list.push('Dual-Ring Harmonizer');
  if (count >= 10) list.push('Master of Chronos');
  if (count >= 15) list.push('Grand Chronomancer Apex');
  return list;
}

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

function ensureDataDirectory() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load permanent data from disk at startup so registered accounts never disappear
function loadPermanentStoreFromDisk() {
  try {
    ensureDataDirectory();

    if (fs.existsSync(permanentDbFilePath)) {
      const raw = fs.readFileSync(permanentDbFilePath, 'utf8');
      const parsed = JSON.parse(raw || '{}');

      if (Array.isArray(parsed.users)) {
        memoryStore.users = parsed.users.map(u => ({
          id: Number(u.id),
          username: String(u.username || '').trim(),
          email: String(u.email || '').trim().toLowerCase(),
          password_hash: u.password_hash || '',
          role: u.role || 'student',
          status: u.status || 'Active',
          created_at: u.created_at || new Date().toISOString(),
          last_login_at: u.last_login_at || u.created_at || new Date().toISOString()
        }));
      }

      if (Array.isArray(parsed.user_profiles)) {
        memoryStore.user_profiles = parsed.user_profiles.map(p => {
          const completed = parseJsonArray(p.completed_levels);
          const solved = Math.max(Number(p.puzzles_solved) || 0, completed.length);
          const curLvl = Math.max(Number(p.current_level) || 1, 1);
          const maxCompleted = completed.length > 0 ? Math.max(...completed) : 0;
          const unlockedLvl = Math.min(15, Math.max(Number(p.unlocked_level) || 1, curLvl, maxCompleted + 1, solved + 1));
          return {
            user_id: Number(p.user_id),
            rank_title: p.rank_title || calculateRank(solved),
            puzzles_solved: solved,
            current_level: curLvl,
            unlocked_level: unlockedLvl,
            completed_levels: completed,
            achievements: parseJsonArray(p.achievements).length > 0 ? parseJsonArray(p.achievements) : calculateAchievements(completed),
            updated_at: p.updated_at || new Date().toISOString()
          };
        });
      }

      if (Array.isArray(parsed.game_attempts)) {
        memoryStore.game_attempts = parsed.game_attempts;
      }

      if (Array.isArray(parsed.player_feedback)) {
        memoryStore.player_feedback = parsed.player_feedback;
      }

      const maxUserId = memoryStore.users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0);
      memoryStore.nextUserId = Math.max(Number(parsed.nextUserId) || 1, maxUserId + 1);

      const maxAttemptId = memoryStore.game_attempts.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0);
      memoryStore.nextAttemptId = Math.max(Number(parsed.nextAttemptId) || 1, maxAttemptId + 1);
    }

    // Also merge any feedback entries from player_feedback.json
    if (fs.existsSync(feedbackFilePath)) {
      const fbData = JSON.parse(fs.readFileSync(feedbackFilePath, 'utf8') || '[]');
      if (Array.isArray(fbData) && fbData.length > memoryStore.player_feedback.length) {
        memoryStore.player_feedback = fbData;
      }
    }
  } catch (err) {
    console.warn('[Database] Warning loading permanent disk database:', err.message);
  }
}

// Atomically save permanent store to disk on every mutation
function savePermanentStoreToDisk() {
  try {
    ensureDataDirectory();
    const payload = JSON.stringify(
      {
        nextUserId: memoryStore.nextUserId,
        nextAttemptId: memoryStore.nextAttemptId,
        users: memoryStore.users,
        user_profiles: memoryStore.user_profiles,
        game_attempts: memoryStore.game_attempts,
        player_feedback: memoryStore.player_feedback,
        lastSavedAt: new Date().toISOString()
      },
      null,
      2
    );
    const tmpPath = `${permanentDbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, permanentDbFilePath);
  } catch (err) {
    try {
      fs.writeFileSync(
        permanentDbFilePath,
        JSON.stringify(
          {
            nextUserId: memoryStore.nextUserId,
            nextAttemptId: memoryStore.nextAttemptId,
            users: memoryStore.users,
            user_profiles: memoryStore.user_profiles,
            game_attempts: memoryStore.game_attempts,
            player_feedback: memoryStore.player_feedback,
            lastSavedAt: new Date().toISOString()
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (fallbackErr) {
      console.error('[Database] Failed to save permanent database to disk:', fallbackErr.message);
    }
  }
}

// Initialize permanent disk data immediately when module is loaded
loadPermanentStoreFromDisk();

async function initDB() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'chronos_clock_db';
    const useSSL = process.env.DB_SSL === 'true';

    console.log(`[Database] Attempting connection to MySQL at ${host}:${port} (${database})...`);

    try {
      if (!useSSL && (host === '127.0.0.1' || host === 'localhost')) {
        try {
          const rootConn = await mysql.createConnection({ host, port, user, password, connectTimeout: 3000 });
          await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
          await rootConn.end();
        } catch (err) {}
      }

      const poolConfig = {
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 4000
      };

      if (useSSL) {
        poolConfig.ssl = { rejectUnauthorized: false };
      }

      pool = mysql.createPool(poolConfig);

      const testConn = await pool.getConnection();
      await testConn.ping();
      testConn.release();

      isConnected = true;
      dbMode = useSSL ? 'TiDB/Cloud-MySQL (SSL + Disk Replica)' : 'Local-MySQL (Disk Replica)';
      console.log(`[Database] SUCCESS: Connected to MySQL [Mode: ${dbMode}]!`);

      await runMigrations();
      await syncPermanentStoreWithMySQL();
      return { success: true, mode: dbMode };
    } catch (err) {
      console.warn(`[Database] MySQL unreachable (${err.message}).`);
      console.log(`[Database] Using Permanent Local Disk Database (${permanentDbFilePath}). All accounts and game progress are permanently persisted.`);
      isConnected = false;
      dbMode = 'Permanent Local Database (Disk-Persisted)';
      savePermanentStoreToDisk();
      return { success: true, mode: dbMode, persistent: true };
    }
  })();

  return initPromise;
}

async function runMigrations() {
  if (!pool || !isConnected) return;
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
        // Safe column migrations for existing MySQL tables without losing data
        const alterStatements = [
          "ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'Active'",
          "ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
          "ALTER TABLE user_profiles ADD COLUMN unlocked_level INT DEFAULT 1",
          "ALTER TABLE user_profiles ADD COLUMN completed_levels JSON NULL",
          "ALTER TABLE user_profiles ADD COLUMN achievements JSON NULL"
        ];
        for (const alterSql of alterStatements) {
          try {
            await conn.query(alterSql);
          } catch (alterErr) {
            // Ignore duplicate column error (ER_DUP_FIELDNAME)
          }
        }
        console.log('[Database] Migrations applied: Tables and permanent columns are ready in MySQL.');
      } finally {
        conn.release();
      }
    }
  } catch (migrationErr) {
    console.error('[Database] Migration error:', migrationErr.message);
  }
}

// Synchronize permanent local disk store and MySQL so zero accounts are ever lost
async function syncPermanentStoreWithMySQL() {
  if (!pool || !isConnected) return;
  try {
    // 1. Push any local disk users not yet in MySQL
    for (const localUser of memoryStore.users) {
      const [existing] = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
        [localUser.email, localUser.username]
      );
      if (!existing || existing.length === 0) {
        const [ins] = await pool.query(
          'INSERT INTO users (username, email, password_hash, role, status, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            localUser.username,
            localUser.email,
            localUser.password_hash,
            localUser.role || 'student',
            localUser.status || 'Active',
            new Date(localUser.created_at || Date.now()),
            new Date(localUser.last_login_at || localUser.created_at || Date.now())
          ]
        );
        const profile = memoryStore.user_profiles.find(p => Number(p.user_id) === Number(localUser.id));
        if (profile && ins.insertId) {
          await pool.query(
            'INSERT INTO user_profiles (user_id, rank_title, puzzles_solved, current_level, unlocked_level, completed_levels, achievements) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              ins.insertId,
              profile.rank_title || 'Apprentice Chronomancer',
              profile.puzzles_solved || 0,
              profile.current_level || 1,
              profile.unlocked_level || 1,
              JSON.stringify(profile.completed_levels || []),
              JSON.stringify(profile.achievements || [])
            ]
          );
        }
      }
    }

    // 2. Pull all MySQL users & profiles into local permanent disk replica
    const [dbUsers] = await pool.query('SELECT * FROM users ORDER BY id ASC');
    const [dbProfiles] = await pool.query('SELECT * FROM user_profiles');
    if (Array.isArray(dbUsers) && dbUsers.length > 0) {
      memoryStore.users = dbUsers.map(u => ({
        id: Number(u.id),
        username: u.username,
        email: String(u.email || '').toLowerCase(),
        password_hash: u.password_hash,
        role: u.role || 'student',
        status: u.status || 'Active',
        created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
        last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : (u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString())
      }));
      memoryStore.user_profiles = (dbProfiles || []).map(p => {
        const completed = parseJsonArray(p.completed_levels);
        const solved = Math.max(Number(p.puzzles_solved) || 0, completed.length);
        return {
          user_id: Number(p.user_id),
          rank_title: p.rank_title || calculateRank(solved),
          puzzles_solved: solved,
          current_level: Number(p.current_level) || 1,
          unlocked_level: Math.max(Number(p.unlocked_level) || 1, Number(p.current_level) || 1, solved + 1),
          completed_levels: completed,
          achievements: parseJsonArray(p.achievements),
          updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString()
        };
      });
      const maxId = memoryStore.users.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0);
      memoryStore.nextUserId = Math.max(memoryStore.nextUserId, maxId + 1);
      savePermanentStoreToDisk();
    }
  } catch (err) {
    console.warn('[Database] Sync warning:', err.message);
  }
}

// Unified query runner for MySQL with permanent disk-backed storage
async function query(sql, params = []) {
  if (pool && isConnected) {
    try {
      const [rows] = await pool.query(sql, params);
      // Mirror write operations to permanent disk replica as well
      const lower = sql.trim().toLowerCase();
      if (lower.startsWith('insert') || lower.startsWith('update') || lower.startsWith('delete')) {
        try {
          executeMemoryQuery(sql, params);
        } catch (e) {}
      }
      return rows;
    } catch (err) {
      console.warn('[Database] MySQL query failed, falling back to permanent disk store:', err.message);
      isConnected = false;
      dbMode = 'Permanent Local Database (Disk-Persisted)';
    }
  }

  return executeMemoryQuery(sql, params);
}

// Helper to build a reconciled profile with completed levels, unlocked level, and achievements
function getReconciledUserProfile(userId) {
  const numId = Number(userId);
  let profile = memoryStore.user_profiles.find(p => Number(p.user_id) === numId);

  // Gather all solved level numbers from game_attempts for this user
  const solvedFromAttempts = new Set();
  memoryStore.game_attempts.forEach(a => {
    if (Number(a.user_id) === numId && a.is_success) {
      const lvl = Number(a.level_number || a.puzzle_id);
      if (lvl >= 1 && lvl <= 15) solvedFromAttempts.add(lvl);
    }
  });

  const existingCompleted = profile ? parseJsonArray(profile.completed_levels) : [];
  existingCompleted.forEach(lvl => {
    const n = Number(lvl);
    if (n >= 1 && n <= 15) solvedFromAttempts.add(n);
  });

  // If puzzles_solved was recorded before completed_levels array existed, backfill 1..puzzles_solved
  const prevSolvedCount = profile ? (Number(profile.puzzles_solved) || 0) : 0;
  if (solvedFromAttempts.size === 0 && prevSolvedCount > 0) {
    for (let i = 1; i <= Math.min(15, prevSolvedCount); i++) {
      solvedFromAttempts.add(i);
    }
  }

  const completedLevels = Array.from(solvedFromAttempts).sort((a, b) => a - b);
  const actualSolved = Math.max(prevSolvedCount, completedLevels.length);
  const maxCompleted = completedLevels.length > 0 ? Math.max(...completedLevels) : 0;
  const savedCurrent = profile ? (Number(profile.current_level) || 1) : 1;
  const savedUnlocked = profile ? (Number(profile.unlocked_level) || 1) : 1;

  const unlockedLevel = Math.min(15, Math.max(1, savedUnlocked, savedCurrent, maxCompleted + 1, actualSolved + 1));
  const currentLevel = Math.min(15, Math.max(1, savedCurrent, maxCompleted + 1 > 15 ? 15 : maxCompleted + 1));
  const rankTitle = calculateRank(actualSolved);
  const achievements = calculateAchievements(completedLevels);

  if (!profile) {
    profile = {
      user_id: numId,
      rank_title: rankTitle,
      puzzles_solved: actualSolved,
      current_level: currentLevel,
      unlocked_level: unlockedLevel,
      completed_levels: completedLevels,
      achievements,
      updated_at: new Date().toISOString()
    };
    memoryStore.user_profiles.push(profile);
  } else {
    profile.rank_title = rankTitle;
    profile.puzzles_solved = actualSolved;
    profile.current_level = currentLevel;
    profile.unlocked_level = unlockedLevel;
    profile.completed_levels = completedLevels;
    profile.achievements = achievements;
  }

  return profile;
}

// Self-heal user account if a valid signed JWT arrives after a container migration/redeploy
function ensureUserFromToken(tokenUser) {
  if (!tokenUser || !tokenUser.id || !tokenUser.username || !tokenUser.email) return null;
  const numId = Number(tokenUser.id);
  if (numId <= 0) return null;

  let existing = memoryStore.users.find(
    u => Number(u.id) === numId ||
         u.email.toLowerCase() === String(tokenUser.email).toLowerCase() ||
         u.username.toLowerCase() === String(tokenUser.username).toLowerCase()
  );

  if (!existing && tokenUser.password_hash) {
    existing = {
      id: numId,
      username: tokenUser.username,
      email: String(tokenUser.email).toLowerCase(),
      password_hash: tokenUser.password_hash,
      role: tokenUser.role || 'student',
      status: tokenUser.status || 'Active',
      created_at: tokenUser.created_at || new Date().toISOString(),
      last_login_at: new Date().toISOString()
    };
    memoryStore.users.push(existing);
    memoryStore.nextUserId = Math.max(memoryStore.nextUserId, numId + 1);
    getReconciledUserProfile(numId);
    savePermanentStoreToDisk();
  }

  return existing;
}

// SQL emulator for Permanent Local Disk Store
function executeMemoryQuery(sql, params) {
  const cleanSql = sql.trim();
  const lower = cleanSql.toLowerCase();

  // SELECT COUNT(*) from users
  if (lower.includes('count(*)') && lower.includes('from users')) {
    return [{ total_users: memoryStore.users.length, count: memoryStore.users.length }];
  }

  // SELECT joined users and user_profiles (User Roster)
  if (lower.includes('from users') && (lower.includes('join user_profiles') || lower.includes('order by'))) {
    const list = memoryStore.users.map(u => {
      const profile = getReconciledUserProfile(u.id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role || 'student',
        status: u.status || 'Active',
        created_at: u.created_at,
        last_login_at: u.last_login_at || u.created_at,
        rank_title: profile.rank_title,
        puzzles_solved: profile.puzzles_solved,
        current_level: profile.current_level,
        unlocked_level: profile.unlocked_level,
        completed_levels: profile.completed_levels,
        achievements: profile.achievements,
        updated_at: profile.updated_at
      };
    });
    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  // SELECT users by username, email, or id
  if (lower.startsWith('select') && lower.includes('from users')) {
    if (lower.includes('where username = ? or email = ?') || lower.includes('where lower(username) = lower(?) or lower(email) = lower(?)')) {
      const p0 = String(params[0] || '').trim().toLowerCase();
      const p1 = String(params[1] || '').trim().toLowerCase();
      const u = memoryStore.users.find(
        x => x.username.toLowerCase() === p0 || x.email.toLowerCase() === p1 || x.email.toLowerCase() === p0
      );
      return u ? [u] : [];
    }
    if (lower.includes('where username = ? or role = ?')) {
      const u = memoryStore.users.find(x => x.username === params[0] || x.role === params[1]);
      return u ? [u] : [];
    }
    if (lower.includes('where username = ?')) {
      const p0 = String(params[0] || '').trim().toLowerCase();
      const u = memoryStore.users.find(x => x.username.toLowerCase() === p0);
      return u ? [u] : [];
    }
    if (lower.includes('where email = ?')) {
      const p0 = String(params[0] || '').trim().toLowerCase();
      const u = memoryStore.users.find(x => x.email.toLowerCase() === p0);
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
      const profile = getReconciledUserProfile(params[0]);
      return profile ? [profile] : [];
    }
    return memoryStore.user_profiles;
  }

  // SELECT puzzles
  if (lower.startsWith('select') && lower.includes('from puzzles')) {
    if (lower.includes('where level_number = ?')) {
      const p = memoryStore.puzzles.find(x => Number(x.level_number) === Number(params[0]));
      return p ? [p] : [];
    }
    if (lower.includes('where id = ?')) {
      const p = memoryStore.puzzles.find(x => Number(x.id) === Number(params[0]));
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

  // SELECT game_attempts aggregate
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
    const result = [...memoryStore.player_feedback];
    result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return result;
  }

  // INSERT INTO users
  if (lower.startsWith('insert into users')) {
    const newId = memoryStore.nextUserId++;
    const nowIso = new Date().toISOString();
    const user = {
      id: newId,
      username: String(params[0] || '').trim(),
      email: String(params[1] || '').trim().toLowerCase(),
      password_hash: params[2],
      role: params[3] || 'student',
      status: params[4] || 'Active',
      created_at: nowIso,
      last_login_at: nowIso
    };
    memoryStore.users.push(user);
    savePermanentStoreToDisk();
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO user_profiles
  if (lower.startsWith('insert into user_profiles')) {
    const userId = Number(params[0]);
    const existingIdx = memoryStore.user_profiles.findIndex(p => Number(p.user_id) === userId);
    const solved = Number(params[2]) || 0;
    const curLvl = Number(params[3]) || 1;
    const unlockedLvl = Number(params[4]) || curLvl;
    const completed = parseJsonArray(params[5]);
    const achievements = parseJsonArray(params[6]);

    const profile = {
      user_id: userId,
      rank_title: params[1] || calculateRank(solved),
      puzzles_solved: solved,
      current_level: curLvl,
      unlocked_level: unlockedLvl,
      completed_levels: completed,
      achievements: achievements.length > 0 ? achievements : calculateAchievements(completed),
      updated_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      memoryStore.user_profiles[existingIdx] = profile;
    } else {
      memoryStore.user_profiles.push(profile);
    }
    savePermanentStoreToDisk();
    return { insertId: profile.user_id, affectedRows: 1 };
  }

  // UPDATE user_profiles
  if (lower.startsWith('update user_profiles')) {
    const userId = Number(params[params.length - 1]);
    let profile = memoryStore.user_profiles.find(x => Number(x.user_id) === userId);
    if (!profile) {
      profile = getReconciledUserProfile(userId);
    }
    if (params.length >= 4) {
      profile.puzzles_solved = Number(params[0]) || 0;
      profile.current_level = Number(params[1]) || 1;
      profile.rank_title = params[2] || calculateRank(profile.puzzles_solved);
    }
    if (params.length >= 7) {
      profile.unlocked_level = Number(params[3]) || profile.current_level;
      profile.completed_levels = parseJsonArray(params[4]);
      profile.achievements = parseJsonArray(params[5]);
    }
    profile.updated_at = new Date().toISOString();
    savePermanentStoreToDisk();
    return { affectedRows: 1 };
  }

  // UPDATE users SET last_login_at
  if (lower.startsWith('update users') && lower.includes('last_login_at')) {
    const userId = Number(params[params.length - 1]);
    const user = memoryStore.users.find(u => Number(u.id) === userId);
    if (user) {
      user.last_login_at = new Date().toISOString();
      savePermanentStoreToDisk();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE users SET status = ?
  if (lower.startsWith('update users') && lower.includes('status = ?')) {
    const status = params[0];
    const userId = Number(params[1]);
    const user = memoryStore.users.find(u => Number(u.id) === userId);
    if (user) {
      user.status = status;
      savePermanentStoreToDisk();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // UPDATE users SET role = ?
  if (lower.startsWith('update users set role = ?')) {
    const role = params[0];
    const userId = Number(params[1]);
    const user = memoryStore.users.find(u => Number(u.id) === userId);
    if (user) {
      user.role = role;
      savePermanentStoreToDisk();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // DELETE FROM users WHERE id = ?
  if (lower.startsWith('delete from users')) {
    const userId = Number(params[0]);
    const beforeLen = memoryStore.users.length;
    memoryStore.users = memoryStore.users.filter(u => Number(u.id) !== userId);
    memoryStore.user_profiles = memoryStore.user_profiles.filter(p => Number(p.user_id) !== userId);
    memoryStore.game_attempts = memoryStore.game_attempts.filter(a => Number(a.user_id) !== userId);
    savePermanentStoreToDisk();
    return { affectedRows: beforeLen - memoryStore.users.length };
  }

  // INSERT INTO game_attempts
  if (lower.startsWith('insert into game_attempts')) {
    const newId = memoryStore.nextAttemptId++;
    const userId = Number(params[0]);
    const puzzleId = Number(params[1]) || 1;
    const isSuccess = !!params[4];

    memoryStore.game_attempts.push({
      id: newId,
      user_id: userId,
      puzzle_id: puzzleId,
      level_number: puzzleId,
      pins_configuration: params[2],
      final_displayed_time: params[3],
      is_success: isSuccess,
      attempted_at: new Date().toISOString()
    });
    savePermanentStoreToDisk();
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
      created_at: new Date().toISOString()
    };
    memoryStore.player_feedback.unshift(entry);
    savePermanentStoreToDisk();
    return { insertId: newId, affectedRows: 1 };
  }

  // DELETE FROM player_feedback
  if (lower.startsWith('delete from player_feedback')) {
    const id = params[0];
    const initialLen = memoryStore.player_feedback.length;
    memoryStore.player_feedback = memoryStore.player_feedback.filter(f => String(f.id) !== String(id));
    savePermanentStoreToDisk();
    return { affectedRows: initialLen - memoryStore.player_feedback.length };
  }

  return [];
}

// High-level permanent progress updater when a user completes a level
async function recordLevelCompletion(userId, levelNumber) {
  const numUserId = Number(userId);
  const numLevel = Math.max(1, Math.min(15, Number(levelNumber) || 1));

  const profile = getReconciledUserProfile(numUserId);
  const completedSet = new Set(parseJsonArray(profile.completed_levels).map(Number));
  completedSet.add(numLevel);

  const completedLevels = Array.from(completedSet).filter(n => n >= 1 && n <= 15).sort((a, b) => a - b);
  const puzzlesSolved = Math.max(Number(profile.puzzles_solved) || 0, completedLevels.length);
  const maxCompleted = completedLevels.length > 0 ? Math.max(...completedLevels) : numLevel;
  const nextCurrentLevel = Math.min(15, Math.max(Number(profile.current_level) || 1, numLevel + 1));
  const unlockedLevel = Math.min(15, Math.max(Number(profile.unlocked_level) || 1, nextCurrentLevel, maxCompleted + 1, puzzlesSolved + 1));
  const rankTitle = calculateRank(puzzlesSolved);
  const achievements = calculateAchievements(completedLevels);

  profile.puzzles_solved = puzzlesSolved;
  profile.current_level = nextCurrentLevel;
  profile.unlocked_level = unlockedLevel;
  profile.completed_levels = completedLevels;
  profile.rank_title = rankTitle;
  profile.achievements = achievements;
  profile.updated_at = new Date().toISOString();

  savePermanentStoreToDisk();

  if (pool && isConnected) {
    try {
      await pool.query(
        `INSERT INTO user_profiles (user_id, rank_title, puzzles_solved, current_level, unlocked_level, completed_levels, achievements)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           rank_title = VALUES(rank_title),
           puzzles_solved = VALUES(puzzles_solved),
           current_level = VALUES(current_level),
           unlocked_level = VALUES(unlocked_level),
           completed_levels = VALUES(completed_levels),
           achievements = VALUES(achievements)`,
        [
          numUserId,
          rankTitle,
          puzzlesSolved,
          nextCurrentLevel,
          unlockedLevel,
          JSON.stringify(completedLevels),
          JSON.stringify(achievements)
        ]
      );
    } catch (err) {
      console.warn('[Database] MySQL profile update fallback:', err.message);
    }
  }

  return {
    puzzles_solved: puzzlesSolved,
    current_level: nextCurrentLevel,
    unlocked_level: unlockedLevel,
    completed_levels: completedLevels,
    rank_title: rankTitle,
    achievements
  };
}

module.exports = {
  initDB,
  query,
  calculateRank,
  calculateAchievements,
  getReconciledUserProfile,
  recordLevelCompletion,
  ensureUserFromToken,
  savePermanentStoreToDisk,
  getStatus: () => ({
    isConnected: true,
    mysqlConnected: isConnected,
    dbMode,
    host: isConnected ? (process.env.DB_HOST || '127.0.0.1') : 'Local Disk Storage (data/permanent_database.json)',
    database: process.env.DB_NAME || 'chronos_clock_db',
    totalRegisteredUsers: memoryStore.users.length
  })
};
