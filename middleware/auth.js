const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'chronos_horology_super_secret_jwt_passkey_2024';
const ADMIN_MASTER_KEY = process.env.ADMIN_MASTER_KEY || 'CHRONOS_MASTER_ARCHITECT_2024';

function authenticateToken(req, res, next) {
  // Check direct owner master passkey header
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === ADMIN_MASTER_KEY) {
    req.user = { id: 0, username: 'CHRONOS-ARCHITECT', role: 'admin' };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access token required. Please authenticate.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired passkey session.' });
    }
    req.user = user;
    next();
  });
}

// Optional auth: attaches req.user if valid token provided, otherwise proceeds as guest
function optionalAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === ADMIN_MASTER_KEY) {
    req.user = { id: 0, username: 'CHRONOS-ARCHITECT', role: 'admin' };
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
}

// Strict Admin Gate: Only users with role === 'admin' or valid master admin key
function requireAdmin(req, res, next) {
  // 1. Check direct owner master key
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === ADMIN_MASTER_KEY) {
    req.user = { id: 0, username: 'CHRONOS-ARCHITECT', role: 'admin' };
    return next();
  }

  // 2. Fall back to JWT validation
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Administrative clearance required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired administrative token.' });
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Forbidden: Administrative clearance not assigned to this account.' });
    }
    req.user = user;
    next();
  });
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  JWT_SECRET,
  ADMIN_MASTER_KEY
};
