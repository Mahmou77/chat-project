/**
 * middleware/security.js
 * الحماية الكاملة من جميع الثغرات
 */

const rateLimit     = require('express-rate-limit');
const helmet        = require('helmet');
const jwt           = require('jsonwebtoken');
const xss           = require('xss');
const { db, getCfg } = require('../db');

const JWT_KEY = process.env.JWT_SECRET || 'arabic_chat_secret_CHANGE_THIS';

// ── Rate Limiters ───────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
  standardHeaders: true, legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'محاولات تسجيل دخول كثيرة، حاول بعد 15 دقيقة' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'رفع ملفات كثيرة جداً' },
});

// ── Helmet Security Headers ──────────────────────────────────
const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

// ── JWT Auth ──────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') ||
                req.query.token || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'غير مصرح' });
  try {
    req.user = jwt.verify(token, JWT_KEY);
    next();
  } catch(e) {
    return res.status(401).json({ error: 'جلسة منتهية، سجل دخولك مجدداً' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (token) {
    try { req.user = jwt.verify(token, JWT_KEY); } catch {}
  }
  next();
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (!['admin','owner'].includes(req.user?.role))
      return res.status(403).json({ error: 'غير مصرح - الأدمن فقط' });
    next();
  });
}

function ownerMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user?.role !== 'owner')
      return res.status(403).json({ error: 'صاحب الموقع فقط' });
    next();
  });
}

// ── Verify Socket JWT ─────────────────────────────────────────
function verifySocketToken(token) {
  try { return jwt.verify(token, JWT_KEY); }
  catch { return null; }
}

// ── Sign Token ────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_KEY, { expiresIn: process.env.JWT_EXPIRE || '30d' });
}

// ── XSS Clean ─────────────────────────────────────────────────
function cleanText(text, maxLen = 2000) {
  if (!text) return '';
  return xss(String(text).substring(0, maxLen), {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script','style','iframe'],
  });
}

// ── Ban Check ─────────────────────────────────────────────────
function checkBan(req, res, next) {
  if (!req.user) return next();
  const user = db.prepare('SELECT is_banned,ban_until,ban_reason FROM users WHERE id=?').get(req.user.id);
  if (!user) return next();
  if (user.is_banned) {
    const now = Math.floor(Date.now()/1000);
    if (user.ban_until === 0 || user.ban_until > now) {
      const until = user.ban_until === 0 ? 'دائم' : new Date(user.ban_until*1000).toLocaleString('ar-EG');
      return res.status(403).json({ error: `حسابك محظور حتى: ${until} | السبب: ${user.ban_reason}` });
    }
    // Ban expired, unban
    db.prepare('UPDATE users SET is_banned=0,ban_until=0 WHERE id=?').run(req.user.id);
  }
  next();
}

// ── IP Logger ─────────────────────────────────────────────────
function getIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.connection?.remoteAddress ||
         req.ip || '';
}

// ── Spam Detection (in-memory per socket) ────────────────────
const spamMap = new Map();
function checkSpam(userId) {
  if (!userId) return false;
  const now = Date.now();
  const window = 3000; // 3 seconds
  const maxMsgs = 3;
  if (!spamMap.has(userId)) { spamMap.set(userId, []); }
  const times = spamMap.get(userId).filter(t => now - t < window);
  times.push(now);
  spamMap.set(userId, times);
  return times.length > maxMsgs;
}

// ── Validate file type ─────────────────────────────────────────
function isAllowedFile(mimetype, filename) {
  const allowed = (getCfg('allowedExtensions') || 'jpg,jpeg,png,gif,webp,mp4,webm,pdf,zip').split(',');
  const ext = filename.split('.').pop().toLowerCase();
  return allowed.includes(ext);
}

// ── Log Activity ──────────────────────────────────────────────
function logActivity(userId, action, details = '', ip = '') {
  try {
    db.prepare('INSERT INTO activity_log (user_id,action,details,ip) VALUES (?,?,?,?)').run(userId, action, details, ip);
  } catch {}
}

module.exports = {
  apiLimiter, authLimiter, uploadLimiter,
  securityHeaders,
  authMiddleware, optionalAuth, adminMiddleware, ownerMiddleware,
  verifySocketToken, signToken,
  cleanText, checkBan, getIP, checkSpam, isAllowedFile, logActivity,
};
