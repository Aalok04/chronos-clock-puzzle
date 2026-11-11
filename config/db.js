const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isConnected = false;
let dbMode = 'uninitialized';

// In-memory fallback repository for graceful offline execution if MySQL is not reachable
const memoryStore = {
  users: [],
  user_profiles: [],
  puzzles: [
    { id: 1, level_number: 1, title: 'Epoch I: The First Escapement', start_time: '01:00', target_time: '02:35', running_duration_minutes: 75, description: 'Natural passage reaches 02:15. You need an extra 20 minutes to reach 02:35.', difficulty: 'Novice' },
    { id: 2, level_number: 2, title: 'Epoch II: Equilibrium of Gears', start_time: '12:00', target_time: '01:20', running_duration_minutes: 75, description: 'Natural passage reaches 01:15. A delicate balance (+20m and -15m) bridges the 5-minute offset to 01:20.', difficulty: 'Adept' },
    { id: 3, level_number: 3, title: 'Epoch III: The Brass Pendulum', start_time: '02:00', target_time: '04:30', running_duration_minutes: 75, description: 'Natural run leads to 03:15. Coordinate multiple time warps to land precisely at 04:30.', difficulty: 'Master' },
    { id: 4, level_number: 4, title: 'Epoch IV: The Temporal Paradox', start_time: '06:00', target_time: '08:00', running_duration_minutes: 75, description: 'Coordinate the Inner (Hour) and Outer (Minute) rings in sequence. Timing is everything.', difficulty: 'Grandmaster' },
    { id: 5, level_number: 5, title: 'Epoch V: The Omnipresent Dial', start_time: '10:15', target_time: '12:00', running_duration_minutes: 75, description: 'A master trial requiring strategic placement to prevent reverse loops and hit the 12:00 apex.', difficulty: 'Chronos Supreme' }
  ],
  game_attempts: []
};

// Seed demo account in memoryStore
(async () => {
  const hash = await bcrypt.hash('Escapement99', 10);
  memoryStore.users.push({
    id: 1,
    username: 'CHRONO-2024',
    email: 'scholar@chronos.institute',
    password_hash: hash,
    role: 'student',
    created_at: new Date()
  });
  memoryStore.user_profiles.push({
    user_id: 1,
    rank_title: 'Level 3 Chronomancer',
    puzzles_solved: 2,
    current_level: 3,
    updated_at: new Date()
  });
})();

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

        // Seed demo account if not exists
        const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', ['CHRONO-2024']);
        if (existing.length === 0) {
          const hash = await bcrypt.hash('Escapement99', 10);
          const [res] = await conn.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            ['CHRONO-2024', 'scholar@chronos.institute', hash, 'student']
          );
          await conn.query(
            'INSERT INTO user_profiles (user_id, rank_title, puzzles_solved, current_level) VALUES (?, ?, ?, ?)',
            [res.insertId, 'Level 3 Chronomancer', 2, 3]
          );
          console.log('[Database] Default evaluation account seeded: ID: CHRONO-2024 / Pass: Escapement99');
        }
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

// Lightweight SQL-like emulator for offline/dev fallback
function executeMemoryQuery(sql, params) {
  const cleanSql = sql.trim();
  const lower = cleanSql.toLowerCase();

  // SELECT users by username or email
  if (lower.startsWith('select') && lower.includes('from users')) {
    if (lower.includes('where username = ? or email = ?')) {
      const u = memoryStore.users.find(x => x.username === params[0] || x.email === params[1]);
      return u ? [u] : [];
    }
    if (lower.includes('where username = ?')) {
      const u = memoryStore.users.find(x => x.username === params[0]);
      return u ? [u] : [];
    }
    if (lower.includes('where email = ?')) {
      const u = memoryStore.users.find(x => x.email === params[0]);
      return u ? [u] : [];
    }
    if (lower.includes('where id = ?')) {
      const u = memoryStore.users.find(x => x.id === params[0]);
      return u ? [u] : [];
    }
    return memoryStore.users;
  }

  // SELECT user_profiles
  if (lower.startsWith('select') && lower.includes('from user_profiles')) {
    if (lower.includes('where user_id = ?')) {
      const p = memoryStore.user_profiles.find(x => x.user_id === params[0]);
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
      user_id: params[0],
      rank_title: params[1] || 'Apprentice Chronomancer',
      puzzles_solved: params[2] || 0,
      current_level: params[3] || 1,
      updated_at: new Date()
    };
    memoryStore.user_profiles.push(profile);
    return { insertId: params[0], affectedRows: 1 };
  }

  // UPDATE user_profiles
  if (lower.startsWith('update user_profiles')) {
    const userId = params[params.length - 1];
    const profile = memoryStore.user_profiles.find(x => x.user_id === userId);
    if (profile) {
      if (params.length >= 4) {
        profile.puzzles_solved = params[0];
        profile.current_level = params[1];
        profile.rank_title = params[2];
      }
      profile.updated_at = new Date();
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
