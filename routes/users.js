/**
 * routes/users.js - إدارة المستخدمين الكاملة
 */
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { db, getCfg } = require('../db');
const { authMiddleware, adminMiddleware, cleanText, logActivity } = require('../middleware/security');

// ── Storage setup ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `av_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const uploadAv = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  cb(null, /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype));
}});

// ── GET profile ───────────────────────────────────────────
router.get('/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = db.prepare(`
    SELECT id,username,display_name,avatar,cover_photo,bio,website,location,gender,birthday,
           role,points,level,rank_title,rank_color,rank_glow,rank_id,
           name_color,name_gradient,name_effect,profile_theme,profile_layout,
           profile_bg_color,profile_bg_image,profile_bg_opacity,
           profile_sound,chat_bubble_color,subscription,sub_expires,
           is_online,last_seen,created_at,status_text,status_emoji,
           is_verified,verified_badge,msg_count
    FROM users WHERE id=?`).get(userId);
  if (!user) return res.status(404).json({ error: 'not found' });

  // Friends count
  user.friends_count = db.prepare(
    "SELECT COUNT(*) as c FROM friendships WHERE (user_id=? OR friend_id=?) AND status='accepted'"
  ).get(userId, userId).c;

  // Posts count
  user.posts_count = db.prepare('SELECT COUNT(*) as c FROM wall_posts WHERE owner_id=? AND is_deleted=0').get(userId).c;

  // Recent wall posts
  user.wall_posts = db.prepare(
    'SELECT * FROM wall_posts WHERE owner_id=? AND is_deleted=0 ORDER BY created_at DESC LIMIT 10'
  ).all(userId).map(p => ({
    ...p,
    comments: db.prepare('SELECT * FROM wall_comments WHERE post_id=? AND is_deleted=0 ORDER BY created_at LIMIT 5').all(p.id),
    reactions: db.prepare('SELECT type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY type').all(p.id),
    user_reaction: null
  }));

  res.json(user);
});

// ── UPDATE profile ─────────────────────────────────────────
router.post('/update', authMiddleware, (req, res) => {
  const { bio, display_name, website, location, gender, birthday, status_text, status_emoji, profile_theme, profile_layout, profile_bg_color, profile_bg_opacity, chat_bubble_color, settings, privacy } = req.body;
  const updates = {};
  if (bio          !== undefined) updates.bio          = cleanText(bio, 500);
  if (display_name !== undefined) updates.display_name = cleanText(display_name, 50);
  if (website      !== undefined) updates.website      = cleanText(website, 200);
  if (location     !== undefined) updates.location     = cleanText(location, 100);
  if (gender       !== undefined) updates.gender       = gender;
  if (birthday     !== undefined) updates.birthday     = birthday;
  if (status_text  !== undefined) updates.status_text  = cleanText(status_text, 100);
  if (status_emoji !== undefined) updates.status_emoji = status_emoji;
  if (profile_theme !== undefined) updates.profile_theme = profile_theme;
  if (profile_layout !== undefined) updates.profile_layout = profile_layout;
  if (profile_bg_color !== undefined) updates.profile_bg_color = profile_bg_color;
  if (profile_bg_opacity !== undefined) updates.profile_bg_opacity = parseFloat(profile_bg_opacity) || 1;
  if (chat_bubble_color !== undefined) updates.chat_bubble_color = chat_bubble_color;
  if (settings !== undefined) updates.settings = JSON.stringify(settings);
  if (privacy  !== undefined) updates.privacy  = JSON.stringify(privacy);

  if (!Object.keys(updates).length) return res.json({ ok: true });
  const sets = Object.keys(updates).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE users SET ${sets},updated_at=strftime('%s','now') WHERE id=?`).run(...Object.values(updates), req.user.id);
  res.json({ ok: true });
});

// ── Upload avatar ─────────────────────────────────────────
router.post('/avatar', authMiddleware, uploadAv.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع صورة' });
  // Delete old avatar
  const old = db.prepare('SELECT avatar FROM users WHERE id=?').get(req.user.id);
  if (old?.avatar && old.avatar.startsWith('/uploads/')) {
    try { fs.unlinkSync(path.join(__dirname, '../public', old.avatar)); } catch {}
  }
  const url = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(url, req.user.id);
  logActivity(req.user.id, 'avatar_change', '');
  res.json({ ok: true, url });
});

// ── Upload cover ───────────────────────────────────────────
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/covers');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `cover_${Date.now()}${path.extname(file.originalname)}`)
});
const uploadCover = multer({ storage: coverStorage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/cover', authMiddleware, uploadCover.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع صورة' });
  const url = '/uploads/covers/' + req.file.filename;
  db.prepare('UPDATE users SET cover_photo=? WHERE id=?').run(url, req.user.id);
  res.json({ ok: true, url });
});

// ── Upload profile background ──────────────────────────────
const bgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads/profile-bgs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `bg_${Date.now()}${path.extname(file.originalname)}`)
});
const uploadBg = multer({ storage: bgStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/profile-bg', authMiddleware, uploadBg.single('bg'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'لم يتم رفع الصورة' });
  // Check rank permission
  const user = db.prepare('SELECT points FROM users WHERE id=?').get(req.user.id);
  const rank = db.prepare('SELECT can_profile_bg FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(user?.points || 0);
  if (!rank?.can_profile_bg) return res.status(403).json({ error: 'رتبتك لا تسمح بخلفية ملف شخصي' });

  const url = '/uploads/profile-bgs/' + req.file.filename;
  db.prepare('UPDATE users SET profile_bg_image=? WHERE id=?').run(url, req.user.id);
  res.json({ ok: true, url });
});

// ── Change username ────────────────────────────────────────
router.post('/changename', authMiddleware, (req, res) => {
  if (getCfg('allowNameChange') === '0') return res.status(403).json({ error: 'تغيير الاسم مغلق' });
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'اسم فارغ' });

  const clean = cleanText(newName, parseInt(getCfg('maxNameLength') || '30'));
  const min   = parseInt(getCfg('minNameLength') || '3');
  if (clean.length < min) return res.status(400).json({ error: `الاسم يجب أن يكون ${min} أحرف على الأقل` });

  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);

  // Check rank-based name change hours
  const rank = db.prepare('SELECT * FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(user.points || 0);
  const hoursRequired = rank?.name_change_hours || 168;
  const now = Math.floor(Date.now() / 1000);
  const lastChange = user.name_change_last || 0;
  const hoursSince = (now - lastChange) / 3600;

  if (lastChange && hoursSince < hoursRequired) {
    const remaining = Math.ceil(hoursRequired - hoursSince);
    return res.status(400).json({ error: `يمكنك تغيير اسمك بعد ${remaining} ساعة` });
  }

  const maxChanges = parseInt(getCfg('maxNameChanges') || '3');
  if (user.role !== 'owner' && user.name_changes >= maxChanges)
    return res.status(400).json({ error: `وصلت للحد الأقصى (${maxChanges} مرات)` });

  if (db.prepare('SELECT id FROM users WHERE username=? AND id!=?').get(clean, req.user.id))
    return res.status(400).json({ error: 'هذا الاسم مستخدم' });

  db.prepare('UPDATE users SET username=?,name_changes=name_changes+1,name_change_last=? WHERE id=?').run(clean, now, req.user.id);
  logActivity(req.user.id, 'name_change', `${user.username} → ${clean}`);
  res.json({ ok: true, username: clean });
});

// ── Send points ────────────────────────────────────────────
router.post('/sendpoints', authMiddleware, (req, res) => {
  const { toUsername, amount } = req.body;
  const sender = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  const rank   = db.prepare('SELECT * FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(sender.points || 0);

  if (!rank?.can_send_points) return res.status(403).json({ error: 'رتبتك لا تسمح بإرسال النقاط' });

  const amt = parseInt(amount);
  const minSend = parseInt(getCfg('pointSendMin') || '100');
  if (amt < minSend) return res.status(400).json({ error: `الحد الأدنى ${minSend} نقطة` });

  // Calc cost
  let cost = amt;
  if (!rank.send_no_cost) {
    const base = parseInt(getCfg('pointSendCost') || '150');
    const discount = rank.send_discount || 0;
    cost = Math.floor(base * (1 - discount / 100));
  }

  if (sender.points < cost) return res.status(400).json({ error: `نقاطك غير كافية (التكلفة: ${cost} نقطة)` });

  const target = db.prepare('SELECT id,username FROM users WHERE username=?').get(toUsername);
  if (!target) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'لا يمكنك إرسال نقاط لنفسك' });

  db.prepare('UPDATE users SET points=points-? WHERE id=?').run(cost, sender.id);
  db.prepare('UPDATE users SET points=points+? WHERE id=?').run(amt, target.id);
  db.prepare('INSERT INTO point_log (user_id,amount,reason,from_user) VALUES (?,?,?,?)').run(sender.id, -cost, `أرسل ${amt} نقطة لـ ${toUsername}`, target.id);
  db.prepare('INSERT INTO point_log (user_id,amount,reason,from_user) VALUES (?,?,?,?)').run(target.id, amt, `استقبل نقاط من ${sender.username}`, sender.id);

  // Notify target
  db.prepare('INSERT INTO notifications (user_id,type,title,content,from_user,from_id,icon) VALUES (?,?,?,?,?,?,?)').run(target.id, 'points', 'نقاط جديدة!', `${sender.username} أرسل لك ${amt} نقطة 🎁`, sender.username, sender.id, '🎁');

  res.json({ ok: true });
});

// ── Friends ────────────────────────────────────────────────
router.post('/friend/request', authMiddleware, (req, res) => {
  const { targetId } = req.body;
  if (targetId == req.user.id) return res.status(400).json({ error: 'لا يمكنك إضافة نفسك' });
  try {
    db.prepare('INSERT OR IGNORE INTO friendships (user_id,friend_id,status) VALUES (?,?,?)').run(req.user.id, targetId, 'pending');
    db.prepare('INSERT INTO notifications (user_id,type,title,content,from_user,from_id,icon) VALUES (?,?,?,?,?,?,?)').run(targetId, 'friend_request', 'طلب صداقة', `${req.user.username} أرسل لك طلب صداقة`, req.user.username, req.user.id, '👋');
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'طلب مرسل بالفعل' }); }
});

router.post('/friend/accept', authMiddleware, (req, res) => {
  const { requesterId } = req.body;
  db.prepare("UPDATE friendships SET status='accepted' WHERE user_id=? AND friend_id=?").run(requesterId, req.user.id);
  db.prepare('INSERT INTO notifications (user_id,type,title,content,from_user,from_id,icon) VALUES (?,?,?,?,?,?,?)').run(requesterId, 'friend_accepted', 'قبول طلب صداقة', `${req.user.username} قبل طلب صداقتك ❤️`, req.user.username, req.user.id, '❤️');
  res.json({ ok: true });
});

router.post('/friend/reject', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM friendships WHERE user_id=? AND friend_id=?').run(req.body.requesterId, req.user.id);
  res.json({ ok: true });
});

router.post('/friend/remove', authMiddleware, (req, res) => {
  const { targetId } = req.body;
  db.prepare('DELETE FROM friendships WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)').run(req.user.id, targetId, targetId, req.user.id);
  res.json({ ok: true });
});

router.get('/friends/requests', authMiddleware, (req, res) => {
  const reqs = db.prepare("SELECT u.id,u.username,u.avatar,u.rank_title,u.rank_color FROM friendships f JOIN users u ON f.user_id=u.id WHERE f.friend_id=? AND f.status='pending'").all(req.user.id);
  res.json(reqs);
});

router.get('/:id/friends', (req, res) => {
  const friends = db.prepare(`
    SELECT u.id,u.username,u.display_name,u.avatar,u.is_online,u.rank_title,u.rank_color,u.subscription
    FROM friendships f
    JOIN users u ON (CASE WHEN f.user_id=? THEN f.friend_id ELSE f.user_id END)=u.id
    WHERE (f.user_id=? OR f.friend_id=?) AND f.status='accepted'
  `).all(req.params.id, req.params.id, req.params.id);
  res.json(friends);
});

// ── Ignore ─────────────────────────────────────────────────
router.post('/ignore', authMiddleware, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO ignored_users (user_id,ignored_id) VALUES (?,?)').run(req.user.id, req.body.targetId);
  res.json({ ok: true });
});
router.post('/unignore', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM ignored_users WHERE user_id=? AND ignored_id=?').run(req.user.id, req.body.targetId);
  res.json({ ok: true });
});
router.get('/ignored/list', authMiddleware, (req, res) => {
  const list = db.prepare('SELECT u.id,u.username,u.avatar FROM ignored_users i JOIN users u ON i.ignored_id=u.id WHERE i.user_id=?').all(req.user.id);
  res.json(list);
});

// ── Notifications ──────────────────────────────────────────
router.get('/notifications/list', authMiddleware, (req, res) => {
  const notes = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  const unread = notes.filter(n => !n.is_read).length;
  res.json({ notifications: notes, unread });
});
router.post('/notifications/read', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});
router.delete('/notifications/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── Report user ────────────────────────────────────────────
router.post('/report', authMiddleware, (req, res) => {
  const { reportedId, reason, details } = req.body;
  db.prepare('INSERT INTO reports (reporter_id,reported_id,type,reason,details) VALUES (?,?,?,?,?)').run(req.user.id, reportedId, 'user', reason || '', details || '');
  res.json({ ok: true });
});

// ── Search users ───────────────────────────────────────────
router.get('/search/:q', (req, res) => {
  const q = '%' + req.params.q + '%';
  const users = db.prepare('SELECT id,username,display_name,avatar,rank_title,rank_color,is_online FROM users WHERE username LIKE ? OR display_name LIKE ? LIMIT 20').all(q, q);
  res.json(users);
});

module.exports = router;
