/**
 * routes/auth.js - تسجيل الدخول والتسجيل
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const router   = express.Router();
const { db, getCfg, setCfg } = require('../db');
const { signToken, authLimiter, authMiddleware, cleanText, getIP, logActivity } = require('../middleware/security');

// ── Setup (أول تشغيل) ─────────────────────────────────────
router.get('/setup/status', (req, res) => {
  const done   = getCfg('setupDone') === '1';
  const count  = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  res.json({ needsSetup: !done && count === 0 });
});

router.post('/setup', async (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0 || getCfg('setupDone') === '1')
    return res.status(400).json({ error: 'الإعداد تم بالفعل' });

  const { username, email, password, siteName, siteDesc } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'بيانات ناقصة' });
  if (password.length < 8)
    return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });

  const hash = await bcrypt.hash(password, 12);
  const info = db.prepare(
    'INSERT INTO users (username,email,password,password_plain,role,points,subscription,rank_title,rank_color,is_verified,verified_badge) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(username, email, hash, password, 'owner', 999999, 'unlimited', '👑 صاحب الموقع', '#f59e0b', 1, '👑');

  if (siteName) {
    setCfg('siteName', siteName);
    setCfg('titleTag', siteName + ' | تواصل وتعارف');
  }
  if (siteDesc) setCfg('siteDesc', siteDesc);
  setCfg('setupDone', '1');

  const token = signToken({ id: info.lastInsertRowid, username, role: 'owner' });
  logActivity(info.lastInsertRowid, 'setup', 'أول تشغيل للموقع', getIP(req));

  res.json({ ok: true, token, user: { id: info.lastInsertRowid, username, role: 'owner', points: 999999 } });
});

// ── تسجيل ────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  if (getCfg('openRegister') === '0')
    return res.status(403).json({ error: 'التسجيل مغلق حالياً' });

  let { username, email, password } = req.body;
  username = cleanText(username, 30);
  email    = (email||'').toLowerCase().trim();

  if (!username || !email || !password)
    return res.status(400).json({ error: 'بيانات ناقصة' });

  const minLen = parseInt(getCfg('minNameLength') || '3');
  const maxLen = parseInt(getCfg('maxNameLength') || '30');
  if (username.length < minLen) return res.status(400).json({ error: `الاسم يجب أن يكون ${minLen} أحرف على الأقل` });
  if (username.length > maxLen) return res.status(400).json({ error: `الاسم يجب أن يكون ${maxLen} حرف كحد أقصى` });
  if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

  const exists = db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(username, email);
  if (exists) return res.status(400).json({ error: 'الاسم أو البريد الإلكتروني مستخدم بالفعل' });

  // Check fancy names
  const allowFancy = getCfg('allowFancyNames') !== '0';
  const fancyRegex = /[^\u0600-\u06FFa-zA-Z0-9_\-. ]/;
  if (!allowFancy && fancyRegex.test(username))
    return res.status(400).json({ error: 'الأسماء المزخرفة غير مسموح بها' });

  const hash = await bcrypt.hash(password, 10);
  const ip   = getIP(req);
  const deviceIds = JSON.stringify([ip]);
  const info = db.prepare(
    'INSERT INTO users (username,email,password,password_plain,last_ip,device_ids) VALUES (?,?,?,?,?,?)'
  ).run(username, email, hash, password, ip, deviceIds);

  const token = signToken({ id: info.lastInsertRowid, username, role: 'user' });
  logActivity(info.lastInsertRowid, 'register', `تسجيل جديد من ${ip}`, ip);

  res.json({ ok: true, token, user: { id: info.lastInsertRowid, username, role: 'user', points: 0 } });
});

// ── تسجيل دخول ────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

  const user = db.prepare('SELECT * FROM users WHERE username=? OR email=?').get(username, username);
  if (!user) return res.status(400).json({ error: 'المستخدم غير موجود' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    logActivity(user.id, 'login_fail', 'كلمة مرور خاطئة', getIP(req));
    return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
  }

  // Check ban
  const now = Math.floor(Date.now() / 1000);
  if (user.is_banned && (user.ban_until === 0 || user.ban_until > now)) {
    const until = user.ban_until === 0 ? 'دائم' : new Date(user.ban_until * 1000).toLocaleString('ar-EG');
    return res.status(403).json({ error: `حسابك محظور حتى: ${until} | السبب: ${user.ban_reason}` });
  }

  // Update IP and login count
  const ip = getIP(req);
  let deviceIds = [];
  try { deviceIds = JSON.parse(user.device_ids || '[]'); } catch {}
  if (!deviceIds.includes(ip)) { deviceIds.push(ip); if (deviceIds.length > 10) deviceIds.shift(); }

  db.prepare('UPDATE users SET last_ip=?,device_ids=?,login_count=login_count+1,last_seen=? WHERE id=?')
    .run(ip, JSON.stringify(deviceIds), now, user.id);

  const token = signToken({ id: user.id, username: user.username, role: user.role });
  logActivity(user.id, 'login', `دخول من ${ip}`, ip);

  const { password: _, password_plain: __, ...safe } = user;
  res.json({ ok: true, token, user: { ...safe, is_owner: user.role === 'owner' } });
});

// ── بيانات المستخدم الحالي ────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id,username,display_name,email,role,avatar,cover_photo,bio,points,level,rank_title,rank_color,rank_glow,name_color,name_gradient,name_effect,subscription,sub_expires,is_online,last_seen,created_at,settings,profile_theme,profile_layout,profile_bg_color,profile_bg_image,profile_bg_opacity,status_text,status_emoji,chat_bubble_color,is_verified,verified_badge,warn_count FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'not found' });
  res.json(user);
});

// ── تغيير كلمة المرور ──────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'بيانات ناقصة' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

  const user = db.prepare('SELECT password FROM users WHERE id=?').get(req.user.id);
  if (!await bcrypt.compare(currentPassword, user.password))
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password=?,password_plain=? WHERE id=?').run(hash, newPassword, req.user.id);
  logActivity(req.user.id, 'password_change', '', getIP(req));
  res.json({ ok: true });
});

// ── تسجيل خروج ────────────────────────────────────────────
router.post('/logout', authMiddleware, (req, res) => {
  db.prepare('UPDATE users SET is_online=0,last_seen=? WHERE id=?').run(Math.floor(Date.now()/1000), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
