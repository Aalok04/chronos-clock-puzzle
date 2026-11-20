const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Utility Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent aggressive caching of HTML, CSS, and JS assets to ensure UI updates apply immediately
app.use((req, res, next) => {
  if (
    req.path.endsWith('.html') ||
    req.path.endsWith('.css') ||
    req.path.endsWith('.js') ||
    req.path === '/game' ||
    req.path === '/play' ||
    req.path === '/' ||
    req.path === '/admin'
  ) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'CHRONOS: Time Manipulation Clock Puzzle',
    timestamp: new Date().toISOString(),
    database: db.getStatus()
  });
});

// Admin Chamber route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Game chamber routes
app.get(['/game', '/play'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

// Single Page Application routing - fallback to landing page (index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const HOST = '0.0.0.0';

// Start Server when run directly and not in serverless mode
if (process.env.VERCEL !== '1' && require.main === module) {
  app.listen(PORT, HOST, async () => {
    console.log(`=======================================================`);
    console.log(`  CHRONOS: Time Manipulation Clock Puzzle Engine`);
    console.log(`  Local Access:   http://localhost:${PORT}`);
    console.log(`  Network Access: http://192.168.1.9:${PORT}`);
    console.log(`  Environment:    ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);

    // Initialize DB connection & migrations
    await db.initDB();
  });
} else {
  // Serverless / imported initialization
  db.initDB();
}

module.exports = app;
