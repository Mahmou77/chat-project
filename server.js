/**
 * server.js - السيرفر الرئيسي
 * شات عربي v3 - Node.js + Express + Socket.IO + SQLite
 */

require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const path         = require('path');
const fs           = require('fs');
const compression  = require('compression');
const morgan       = require('morgan');
const cors         = require('cors');
const multer       = require('multer');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  maxHttpBufferSize: 50e6,
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3000;

// ── Ensure directories ────────────────────────────────────
const dirs = [
  'public', 'public/uploads', 'public/uploads/avatars', 'public/uploads/covers',
  'public/uploads/chat', 'public/uploads/posts', 'public/uploads/profile-bgs',
  'public/uploads/icons', 'public/uploads/room-bgs', 'public/uploads/default-avatars',
  'public/emojis', 'public/sounds', 'data', 'logs'
];
dirs.forEach(d => { const p = path.join(__dirname, d); if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); });

// ── Copy public HTML files if not present ─────────────────
// (they should be placed in public/ by the user)

// ── Middleware ────────────────────────────────────────────
const { securityHeaders, apiLimiter } = require('./middleware/security');
app.use(securityHeaders);
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/emojis',  express.static(path.join(__dirname, 'public/emojis')));
app.use('/sounds',  express.static(path.join(__dirname, 'public/sounds')));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  const logStream = fs.createWriteStream(path.join(__dirname, 'logs/access.log'), { flags: 'a' });
  app.use(morgan('combined', { stream: logStream }));
}

app.use('/api', apiLimiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/wall',  require('./routes/wall'));
app.use('/api/chat',  require('./routes/chat'));
app.use('/api/games', require('./routes/games'));

// ── Public config endpoint ────────────────────────────────
const { getAllCfg, getCfg } = require('./db');
app.get('/api/config', (req, res) => res.json(getAllCfg()));

// ── Public pages ──────────────────────────────────────────
const { db } = require('./db');
app.get('/api/page/:slug', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE slug=? AND active=1').get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'not found' });
  res.json(page);
});

// ── Socket.IO ─────────────────────────────────────────────
const { initSocket } = require('./socket');
initSocket(io);

// ── HTML Pages (SPA style) ────────────────────────────────
const sendPage = (file) => (req, res) => {
  const p = path.join(__dirname, 'public', file);
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send('صفحة غير موجودة - تأكد من وضع ملفات HTML في مجلد public/');
};

app.get('/',        sendPage('index.html'));
app.get('/admin',   sendPage('admin.html'));
app.get('/setup',   sendPage('setup.html'));
app.get('/profile', sendPage('index.html'));
app.get('/wall',    sendPage('index.html'));

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'خطأ داخلي في السيرفر' });
});

// ── Cron jobs ─────────────────────────────────────────────
try {
  const cron = require('node-cron');
  // Unban expired users every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE users SET is_banned=0,ban_until=0,ban_reason=\'\' WHERE is_banned=1 AND ban_until>0 AND ban_until<=?').run(now);
    db.prepare('UPDATE users SET is_muted=0,mute_until=0 WHERE is_muted=1 AND mute_until>0 AND mute_until<=?').run(now);
  });
  // Reset spam warnings every hour
  cron.schedule('0 * * * *', () => {
    db.prepare('UPDATE users SET spam_warnings=0').run();
  });
  // Clean old notifications (keep 30 days)
  cron.schedule('0 2 * * *', () => {
    const cutoff = Math.floor(Date.now()/1000) - 30*86400;
    db.prepare('DELETE FROM notifications WHERE created_at<?').run(cutoff);
    db.prepare('DELETE FROM activity_log WHERE created_at<?').run(cutoff);
  });
} catch (e) { console.log('Cron jobs not available'); }

// ── Start ─────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     🚀 شات عربي v3 يعمل الآن!           ║');
  console.log(`  ║     http://localhost:${PORT}                 ║`);
  console.log('  ║                                          ║');
  console.log('  ║  أول تشغيل؟ → /setup                    ║');
  console.log('  ║  الشات      → /                         ║');
  console.log('  ║  الأدمن     → /admin                    ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('\n');
});

module.exports = { app, server, io };
