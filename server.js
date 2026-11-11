const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Utility Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'CHRONOS: Time Manipulation Clock Puzzle',
    timestamp: new Date().toISOString(),
    database: db.getStatus()
  });
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

// Start Server and Initialize Database Connection
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
