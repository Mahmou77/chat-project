/**
 * ══════════════════════════════════════════════════════
 *  db.js - قاعدة البيانات الكاملة
 *  SQLite مع كل الجداول المطلوبة
 * ══════════════════════════════════════════════════════
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = process.env.DB_PATH || './data/chat.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 10000');

// ══════════════════════════════════════════════════════
//  CREATE ALL TABLES
// ══════════════════════════════════════════════════════
db.exec(`

-- ── المستخدمون ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  username          TEXT    UNIQUE NOT NULL COLLATE NOCASE,
  display_name      TEXT    DEFAULT '',
  email             TEXT    UNIQUE NOT NULL,
  password          TEXT    NOT NULL,
  password_plain    TEXT    DEFAULT '',
  role              TEXT    DEFAULT 'user',
  avatar            TEXT    DEFAULT '',
  cover_photo       TEXT    DEFAULT '',
  bio               TEXT    DEFAULT '',
  website           TEXT    DEFAULT '',
  location          TEXT    DEFAULT '',
  birthday          TEXT    DEFAULT '',
  gender            TEXT    DEFAULT '',
  points            INTEGER DEFAULT 0,
  level             INTEGER DEFAULT 1,
  rank_id           INTEGER DEFAULT 1,
  rank_title        TEXT    DEFAULT 'مبتدئ',
  rank_color        TEXT    DEFAULT '#94a3b8',
  rank_glow         INTEGER DEFAULT 0,
  name_color        TEXT    DEFAULT '',
  name_gradient     TEXT    DEFAULT '',
  name_effect       TEXT    DEFAULT 'none',
  profile_bg_color  TEXT    DEFAULT '',
  profile_bg_image  TEXT    DEFAULT '',
  profile_bg_opacity REAL   DEFAULT 1.0,
  profile_theme     TEXT    DEFAULT 'default',
  profile_layout    TEXT    DEFAULT 'classic',
  chat_bubble_color TEXT    DEFAULT '',
  subscription      TEXT    DEFAULT 'free',
  sub_expires       INTEGER DEFAULT 0,
  sub_features      TEXT    DEFAULT '{}',
  name_changes      INTEGER DEFAULT 0,
  name_change_last  INTEGER DEFAULT 0,
  is_banned         INTEGER DEFAULT 0,
  ban_until         INTEGER DEFAULT 0,
  ban_reason        TEXT    DEFAULT '',
  is_muted          INTEGER DEFAULT 0,
  mute_until        INTEGER DEFAULT 0,
  is_online         INTEGER DEFAULT 0,
  last_seen         INTEGER DEFAULT 0,
  last_ip           TEXT    DEFAULT '',
  device_ids        TEXT    DEFAULT '[]',
  login_count       INTEGER DEFAULT 0,
  msg_count         INTEGER DEFAULT 0,
  warn_count        INTEGER DEFAULT 0,
  spam_warnings     INTEGER DEFAULT 0,
  last_msg_time     INTEGER DEFAULT 0,
  profile_sound     TEXT    DEFAULT '',
  status_text       TEXT    DEFAULT '',
  status_emoji      TEXT    DEFAULT '',
  two_fa_enabled    INTEGER DEFAULT 0,
  is_verified       INTEGER DEFAULT 0,
  verified_badge    TEXT    DEFAULT '',
  total_earnings    REAL    DEFAULT 0,
  settings          TEXT    DEFAULT '{}',
  privacy           TEXT    DEFAULT '{}',
  created_at        INTEGER DEFAULT (strftime('%s','now')),
  updated_at        INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الجلسات ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT    UNIQUE NOT NULL,
  device     TEXT    DEFAULT '',
  ip         TEXT    DEFAULT '',
  created_at INTEGER DEFAULT (strftime('%s','now')),
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── الغرف ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id         TEXT    UNIQUE NOT NULL,
  name            TEXT    NOT NULL,
  icon            TEXT    DEFAULT '💬',
  icon_url        TEXT    DEFAULT '',
  description     TEXT    DEFAULT '',
  type            TEXT    DEFAULT 'public',
  category        TEXT    DEFAULT 'عام',
  bg_color        TEXT    DEFAULT '',
  bg_image        TEXT    DEFAULT '',
  bg_opacity      REAL    DEFAULT 1.0,
  bg_sound        TEXT    DEFAULT '',
  bg_sound_vol    REAL    DEFAULT 0.5,
  min_level       INTEGER DEFAULT 1,
  min_sub         TEXT    DEFAULT 'free',
  max_users       INTEGER DEFAULT 0,
  voice_enabled   INTEGER DEFAULT 0,
  voice_host_rank INTEGER DEFAULT 0,
  is_voice_only   INTEGER DEFAULT 0,
  stream_url      TEXT    DEFAULT '',
  stream_active   INTEGER DEFAULT 0,
  slow_mode       INTEGER DEFAULT 0,
  slow_seconds    INTEGER DEFAULT 5,
  allow_images    INTEGER DEFAULT 1,
  allow_videos    INTEGER DEFAULT 1,
  allow_files     INTEGER DEFAULT 1,
  allow_links     INTEGER DEFAULT 1,
  welcome_msg     TEXT    DEFAULT '',
  rules           TEXT    DEFAULT '',
  pinned_msg      TEXT    DEFAULT '',
  order_n         INTEGER DEFAULT 0,
  is_active       INTEGER DEFAULT 1,
  password        TEXT    DEFAULT '',
  topic           TEXT    DEFAULT '',
  color           TEXT    DEFAULT '',
  created_at      INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الرسائل ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id      TEXT    NOT NULL,
  user_id      INTEGER,
  username     TEXT    NOT NULL,
  display_name TEXT    DEFAULT '',
  avatar       TEXT    DEFAULT '',
  rank_title   TEXT    DEFAULT '',
  rank_color   TEXT    DEFAULT '',
  name_color   TEXT    DEFAULT '',
  name_effect  TEXT    DEFAULT 'none',
  text         TEXT    DEFAULT '',
  type         TEXT    DEFAULT 'text',
  media_url    TEXT    DEFAULT '',
  media_type   TEXT    DEFAULT '',
  media_size   INTEGER DEFAULT 0,
  media_name   TEXT    DEFAULT '',
  youtube_id   TEXT    DEFAULT '',
  reply_to     INTEGER DEFAULT NULL,
  reply_data   TEXT    DEFAULT '',
  is_pinned    INTEGER DEFAULT 0,
  is_deleted   INTEGER DEFAULT 0,
  deleted_by   INTEGER DEFAULT NULL,
  is_edited    INTEGER DEFAULT 0,
  edited_at    INTEGER DEFAULT NULL,
  reactions    TEXT    DEFAULT '{}',
  ip           TEXT    DEFAULT '',
  created_at   INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(reply_to) REFERENCES messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

-- ── رسائل خاصة ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS private_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id       TEXT    NOT NULL,
  from_id       INTEGER NOT NULL,
  to_id         INTEGER NOT NULL,
  text          TEXT    DEFAULT '',
  type          TEXT    DEFAULT 'text',
  media_url     TEXT    DEFAULT '',
  is_read       INTEGER DEFAULT 0,
  is_deleted_by TEXT    DEFAULT '[]',
  is_edited     INTEGER DEFAULT 0,
  reply_to      INTEGER DEFAULT NULL,
  created_at    INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(from_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(to_id)   REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pm_conv ON private_messages(conv_id, created_at);

-- ── المحادثات الخاصة ─────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_id         TEXT    UNIQUE NOT NULL,
  user1_id        INTEGER NOT NULL,
  user2_id        INTEGER NOT NULL,
  last_msg        TEXT    DEFAULT '',
  last_msg_time   INTEGER DEFAULT 0,
  unread_1        INTEGER DEFAULT 0,
  unread_2        INTEGER DEFAULT 0,
  is_blocked      INTEGER DEFAULT 0,
  blocked_by      INTEGER DEFAULT NULL,
  created_at      INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الصداقات ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  friend_id  INTEGER NOT NULL,
  status     TEXT    DEFAULT 'pending',
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(user_id, friend_id),
  FOREIGN KEY(user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── التجاهل ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ignored_users (
  user_id    INTEGER NOT NULL,
  ignored_id INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY(user_id, ignored_id)
);

-- ── منشورات الحائط ──────────────────────────────────
CREATE TABLE IF NOT EXISTS wall_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id     INTEGER NOT NULL,
  author_id    INTEGER NOT NULL,
  author       TEXT    NOT NULL,
  author_avatar TEXT   DEFAULT '',
  content      TEXT    DEFAULT '',
  media_url    TEXT    DEFAULT '',
  media_type   TEXT    DEFAULT '',
  media_thumb  TEXT    DEFAULT '',
  video_url    TEXT    DEFAULT '',
  youtube_id   TEXT    DEFAULT '',
  likes_count  INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count  INTEGER DEFAULT 0,
  is_pinned    INTEGER DEFAULT 0,
  is_deleted   INTEGER DEFAULT 0,
  visibility   TEXT    DEFAULT 'public',
  created_at   INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(owner_id)  REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wall_owner ON wall_posts(owner_id, created_at);

-- ── تعليقات الحائط ──────────────────────────────────
CREATE TABLE IF NOT EXISTS wall_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  author_id  INTEGER NOT NULL,
  author     TEXT    NOT NULL,
  avatar     TEXT    DEFAULT '',
  content    TEXT    NOT NULL,
  reply_to   INTEGER DEFAULT NULL,
  likes      INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(post_id)   REFERENCES wall_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── تفاعلات المنشورات ────────────────────────────────
CREATE TABLE IF NOT EXISTS post_reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  type       TEXT    DEFAULT 'like',
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(post_id, user_id),
  FOREIGN KEY(post_id)  REFERENCES wall_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id)  REFERENCES users(id) ON DELETE CASCADE
);

-- ── الإعلانات ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  position    TEXT    NOT NULL,
  html        TEXT    DEFAULT '',
  image_url   TEXT    DEFAULT '',
  link_url    TEXT    DEFAULT '',
  type        TEXT    DEFAULT 'html',
  active      INTEGER DEFAULT 1,
  order_n     INTEGER DEFAULT 0,
  views       INTEGER DEFAULT 0,
  clicks      INTEGER DEFAULT 0,
  start_date  INTEGER DEFAULT 0,
  end_date    INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الإشعارات ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT    NOT NULL,
  title      TEXT    DEFAULT '',
  content    TEXT    DEFAULT '',
  from_user  TEXT    DEFAULT '',
  from_id    INTEGER DEFAULT NULL,
  link       TEXT    DEFAULT '',
  icon       TEXT    DEFAULT '',
  is_read    INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ── الإعلانات العامة (broadcast) ─────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  target      TEXT    DEFAULT 'all',
  sent_by     INTEGER,
  sent_count  INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الرتب ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ranks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  icon              TEXT    DEFAULT '⭐',
  icon_url          TEXT    DEFAULT '',
  min_points        INTEGER DEFAULT 0,
  color             TEXT    DEFAULT '#94a3b8',
  bg_color          TEXT    DEFAULT '',
  glow_color        TEXT    DEFAULT '',
  glow_enabled      INTEGER DEFAULT 0,
  badge_url         TEXT    DEFAULT '',
  can_send_points   INTEGER DEFAULT 0,
  can_embed_yt      INTEGER DEFAULT 0,
  can_voice         INTEGER DEFAULT 0,
  can_stream        INTEGER DEFAULT 0,
  can_upload_files  INTEGER DEFAULT 0,
  can_change_name   INTEGER DEFAULT 1,
  name_change_hours INTEGER DEFAULT 168,
  can_colored_name  INTEGER DEFAULT 0,
  can_gradient_name INTEGER DEFAULT 0,
  can_glow_name     INTEGER DEFAULT 0,
  can_profile_sound INTEGER DEFAULT 0,
  can_profile_bg    INTEGER DEFAULT 0,
  can_chat_bubble   INTEGER DEFAULT 0,
  send_no_cost      INTEGER DEFAULT 0,
  send_discount     REAL    DEFAULT 0,
  max_file_mb       INTEGER DEFAULT 5,
  max_image_mb      INTEGER DEFAULT 2,
  perks_json        TEXT    DEFAULT '{}',
  order_n           INTEGER DEFAULT 0,
  created_at        INTEGER DEFAULT (strftime('%s','now'))
);

-- ── باقات الاشتراك ───────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE,
  description TEXT    DEFAULT '',
  price       REAL    DEFAULT 0,
  currency    TEXT    DEFAULT 'EGP',
  duration    INTEGER DEFAULT 30,
  points      INTEGER DEFAULT 0,
  rank_id     INTEGER DEFAULT NULL,
  features    TEXT    DEFAULT '{}',
  color       TEXT    DEFAULT '#7c3aed',
  icon        TEXT    DEFAULT '💎',
  is_featured INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── المدفوعات ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  plan_id      INTEGER,
  amount       REAL    NOT NULL,
  currency     TEXT    DEFAULT 'EGP',
  method       TEXT    DEFAULT 'manual',
  status       TEXT    DEFAULT 'pending',
  reference    TEXT    DEFAULT '',
  notes        TEXT    DEFAULT '',
  processed_by INTEGER DEFAULT NULL,
  created_at   INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── سجل النقاط ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  amount     INTEGER NOT NULL,
  reason     TEXT    DEFAULT '',
  from_user  INTEGER DEFAULT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── الإيموجي المخصص ─────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_emojis (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    UNIQUE NOT NULL,
  url        TEXT    NOT NULL,
  animated   INTEGER DEFAULT 0,
  category   TEXT    DEFAULT 'عام',
  min_rank   INTEGER DEFAULT 0,
  min_sub    TEXT    DEFAULT 'free',
  active     INTEGER DEFAULT 1,
  uses       INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الأصوات ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sounds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  url        TEXT    NOT NULL,
  type       TEXT    DEFAULT 'notification',
  category   TEXT    DEFAULT 'عام',
  active     INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── محطات الراديو ────────────────────────────────────
CREATE TABLE IF NOT EXISTS radio_stations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  url        TEXT    NOT NULL,
  icon       TEXT    DEFAULT '📻',
  icon_url   TEXT    DEFAULT '',
  category   TEXT    DEFAULT 'عام',
  country    TEXT    DEFAULT '',
  active     INTEGER DEFAULT 1,
  order_n    INTEGER DEFAULT 0,
  listeners  INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الألعاب ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    UNIQUE NOT NULL,
  icon        TEXT    DEFAULT '🎮',
  description TEXT    DEFAULT '',
  active      INTEGER DEFAULT 1,
  min_rank    INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── جلسات الألعاب ────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_code   TEXT    NOT NULL,
  room_id     TEXT,
  player1_id  INTEGER,
  player2_id  INTEGER,
  state       TEXT    DEFAULT '{}',
  status      TEXT    DEFAULT 'waiting',
  winner_id   INTEGER DEFAULT NULL,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الميزات المضافة بالكود ───────────────────────────
CREATE TABLE IF NOT EXISTS features_inject (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  type       TEXT    DEFAULT 'js',
  position   TEXT    DEFAULT 'body-bottom',
  code       TEXT    NOT NULL,
  pages      TEXT    DEFAULT '["chat"]',
  active     INTEGER DEFAULT 1,
  order_n    INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── أيقونات الواجهة ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ui_icons (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  key      TEXT    UNIQUE NOT NULL,
  label    TEXT    DEFAULT '',
  icon_type TEXT   DEFAULT 'emoji',
  value    TEXT    DEFAULT '',
  url      TEXT    DEFAULT '',
  position TEXT    DEFAULT '',
  size     TEXT    DEFAULT 'md',
  color    TEXT    DEFAULT '',
  visible  INTEGER DEFAULT 1
);

-- ── أشكال الواجهة (Layouts) ─────────────────────────
CREATE TABLE IF NOT EXISTS layouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    UNIQUE NOT NULL,
  label       TEXT    NOT NULL,
  preview_url TEXT    DEFAULT '',
  css         TEXT    DEFAULT '',
  config      TEXT    DEFAULT '{}',
  is_active   INTEGER DEFAULT 0,
  is_default  INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── أشكال الملف الشخصي ──────────────────────────────
CREATE TABLE IF NOT EXISTS profile_themes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    UNIQUE NOT NULL,
  label       TEXT    NOT NULL,
  preview_url TEXT    DEFAULT '',
  css         TEXT    DEFAULT '',
  config      TEXT    DEFAULT '{}',
  min_sub     TEXT    DEFAULT 'free',
  active      INTEGER DEFAULT 1,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── لغات الواجهة ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS languages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    UNIQUE NOT NULL,
  name        TEXT    NOT NULL,
  direction   TEXT    DEFAULT 'rtl',
  strings     TEXT    DEFAULT '{}',
  is_default  INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1
);

-- ── السياسات والصفحات ────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    UNIQUE NOT NULL,
  title      TEXT    NOT NULL,
  content    TEXT    DEFAULT '',
  active     INTEGER DEFAULT 1,
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── البوتات ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  username    TEXT    UNIQUE NOT NULL,
  avatar      TEXT    DEFAULT '',
  token       TEXT    UNIQUE NOT NULL,
  type        TEXT    DEFAULT 'custom',
  commands    TEXT    DEFAULT '{}',
  rooms       TEXT    DEFAULT '["all"]',
  is_active   INTEGER DEFAULT 1,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الإعدادات العامة ─────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── سجل النشاط (Security Log) ───────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  action     TEXT    NOT NULL,
  details    TEXT    DEFAULT '',
  ip         TEXT    DEFAULT '',
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_activity ON activity_log(user_id, created_at);

-- ── الصور الافتراضية للأفاتار ────────────────────────
CREATE TABLE IF NOT EXISTS default_avatars (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT    NOT NULL,
  category   TEXT    DEFAULT 'عام',
  gender     TEXT    DEFAULT 'any',
  active     INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الكلمات المحظورة ─────────────────────────────────
CREATE TABLE IF NOT EXISTS banned_words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT    UNIQUE NOT NULL,
  replacement TEXT    DEFAULT '***',
  severity    INTEGER DEFAULT 1,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── روابط مسموحة/محظورة ──────────────────────────────
CREATE TABLE IF NOT EXISTS link_rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern    TEXT    NOT NULL,
  type       TEXT    DEFAULT 'allow',
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الدخل والسحوبات ──────────────────────────────────
CREATE TABLE IF NOT EXISTS earnings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT    NOT NULL,
  amount     REAL    NOT NULL,
  currency   TEXT    DEFAULT 'EGP',
  notes      TEXT    DEFAULT '',
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  amount     REAL    NOT NULL,
  method     TEXT    NOT NULL,
  account    TEXT    DEFAULT '',
  status     TEXT    DEFAULT 'pending',
  notes      TEXT    DEFAULT '',
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- ── الشكاوى والبلاغات ────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  reported_id INTEGER,
  type        TEXT    DEFAULT 'user',
  reason      TEXT    DEFAULT '',
  details     TEXT    DEFAULT '',
  status      TEXT    DEFAULT 'pending',
  resolved_by INTEGER DEFAULT NULL,
  created_at  INTEGER DEFAULT (strftime('%s','now'))
);

-- ── التحديات داخل الشات ──────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger   INTEGER NOT NULL,
  challenged   INTEGER NOT NULL,
  game_code    TEXT    NOT NULL,
  room_id      TEXT    DEFAULT '',
  status       TEXT    DEFAULT 'pending',
  result       TEXT    DEFAULT '',
  wager_points INTEGER DEFAULT 0,
  created_at   INTEGER DEFAULT (strftime('%s','now'))
);

`);

// ══════════════════════════════════════════════════════
//  DEFAULT DATA
// ══════════════════════════════════════════════════════
function initDefaults() {

  // Default rooms
  if (!db.prepare('SELECT COUNT(*) as c FROM rooms').get().c) {
    const ins = db.prepare('INSERT OR IGNORE INTO rooms (room_id,name,icon,description,category,order_n) VALUES (?,?,?,?,?,?)');
    ins.run('general','الغرفة الرئيسية','💬','مرحباً بالجميع 👋','عام',1);
    ins.run('sports','الرياضة','⚽','كرة وتنس ورياضة','رياضة',2);
    ins.run('fun','الترفيه','🎉','نكت وضحك وسهر','ترفيه',3);
    ins.run('tech','التقنية','💻','تقنية وبرمجة ومستقبل','تقنية',4);
    ins.run('music','الموسيقى','🎵','غناء وموسيقى','ترفيه',5);
    ins.run('vip','VIP Lounge','👑','غرفة خاصة للأعضاء المميزين','VIP',6);
  }

  // Default ranks
  if (!db.prepare('SELECT COUNT(*) as c FROM ranks').get().c) {
    const ins = db.prepare(`INSERT INTO ranks 
      (title,icon,min_points,color,glow_enabled,can_send_points,can_embed_yt,can_voice,can_colored_name,can_gradient_name,can_glow_name,can_profile_sound,can_profile_bg,can_chat_bubble,order_n)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    ins.run('زائر','🌱',0,'#94a3b8',0,0,0,0,0,0,0,0,0,0,1);
    ins.run('عضو','⭐',500,'#60a5fa',0,0,0,0,0,0,0,0,0,0,2);
    ins.run('نشيط','🔥',2000,'#34d399',0,0,1,0,1,0,0,0,0,0,3);
    ins.run('متميز','💎',5000,'#a78bfa',1,1,1,0,1,1,0,0,1,0,4);
    ins.run('نجم','🌟',15000,'#fbbf24',1,1,1,1,1,1,1,1,1,1,5);
    ins.run('أسطورة','👑',50000,'#f87171',1,1,1,1,1,1,1,1,1,1,6);
  }

  // Default subscription plans
  if (!db.prepare('SELECT COUNT(*) as c FROM subscription_plans').get().c) {
    const ins = db.prepare('INSERT INTO subscription_plans (name,code,description,price,duration,points,color,icon,is_featured) VALUES (?,?,?,?,?,?,?,?,?)');
    ins.run('مجاني','free','الباقة المجانية',0,0,0,'#94a3b8','🆓',0);
    ins.run('فضي','silver','باقة الفضي الشهرية',29,30,2000,'#94a3b8','🥈',0);
    ins.run('ذهبي','gold','باقة الذهبي الشهرية',59,30,5000,'#fbbf24','🥇',1);
    ins.run('VIP','vip','باقة VIP الكاملة',99,30,15000,'#a78bfa','💎',1);
  }

  // Default games
  if (!db.prepare('SELECT COUNT(*) as c FROM games').get().c) {
    const ins = db.prepare('INSERT INTO games (name,code,icon,description) VALUES (?,?,?,?)');
    ins.run('إكس أو','xo','⭕','لعبة إكس أو الكلاسيكية');
    ins.run('شطرنج','chess','♟️','لعبة الشطرنج');
    ins.run('الأفعى','snake','🐍','لعبة الأفعى');
    ins.run('الذاكرة','memory','🃏','لعبة تحدي الذاكرة');
  }

  // Default UI icons
  const uiIcons = [
    ['nav_rooms','الغرف','emoji','🏠',''],
    ['nav_online','المتصلون','emoji','👥',''],
    ['nav_radio','الراديو','emoji','📻',''],
    ['nav_games','الألعاب','emoji','🎮',''],
    ['nav_profile','الملف الشخصي','emoji','👤',''],
    ['nav_notifications','الإشعارات','emoji','🔔',''],
    ['nav_friends','الأصدقاء','emoji','❤️',''],
    ['nav_settings','الإعدادات','emoji','⚙️',''],
    ['btn_send','إرسال','emoji','➤',''],
    ['btn_emoji','إيموجي','emoji','😊',''],
    ['btn_attach','مرفق','emoji','📎',''],
    ['btn_voice','صوت','emoji','🎤',''],
  ];
  const insIcon = db.prepare('INSERT OR IGNORE INTO ui_icons (key,label,icon_type,value,url) VALUES (?,?,?,?,?)');
  uiIcons.forEach(r => insIcon.run(...r));

  // Default layouts
  if (!db.prepare('SELECT COUNT(*) as c FROM layouts').get().c) {
    const ins = db.prepare('INSERT INTO layouts (name,label,is_default,is_active) VALUES (?,?,?,?)');
    ins.run('classic','كلاسيك (arabic.chat)',1,1);
    ins.run('modern','عصري');
    ins.run('minimal','بسيط');
    ins.run('dark-pro','داكن احترافي');
    ins.run('bubble','فقاعات');
  }

  // Default profile themes
  if (!db.prepare('SELECT COUNT(*) as c FROM profile_themes').get().c) {
    const ins = db.prepare('INSERT INTO profile_themes (name,label,min_sub,active) VALUES (?,?,?,?)');
    ins.run('classic','كلاسيك','free',1);
    ins.run('modern','عصري','free',1);
    ins.run('dark','داكن','free',1);
    ins.run('vip-gold','ذهبي VIP','gold',1);
    ins.run('vip-purple','بنفسجي مميز','silver',1);
    ins.run('neon','نيون','vip',1);
  }

  // Default language
  if (!db.prepare('SELECT COUNT(*) as c FROM languages').get().c) {
    const ins = db.prepare('INSERT INTO languages (code,name,direction,is_default,active) VALUES (?,?,?,?,?)');
    ins.run('ar','العربية','rtl',1,1);
    ins.run('en','English','ltr',0,1);
  }

  // Default pages
  if (!db.prepare('SELECT COUNT(*) as c FROM pages').get().c) {
    const ins = db.prepare('INSERT OR IGNORE INTO pages (slug,title,content) VALUES (?,?,?)');
    ins.run('privacy','سياسة الخصوصية','<h2>سياسة الخصوصية</h2><p>نحترم خصوصيتك...</p>');
    ins.run('terms','الشروط والأحكام','<h2>الشروط والأحكام</h2><p>بالتسجيل في موقعنا...</p>');
    ins.run('about','من نحن','<h2>من نحن</h2><p>موقع شات عربي...</p>');
  }

  // Default link rules
  if (!db.prepare('SELECT COUNT(*) as c FROM link_rules').get().c) {
    const ins = db.prepare('INSERT INTO link_rules (pattern,type) VALUES (?,?)');
    ins.run('youtube.com','allow');
    ins.run('youtu.be','allow');
    ins.run('twitter.com','allow');
  }

  // Default config
  const defaults = {
    siteName: 'شات عربي', siteDesc: 'أفضل شات عربي', titleTag: 'شات عربي | تواصل وتعارف',
    logoUrl: '', logoPosition: 'left', logoSize: '38', favicon: '',
    primaryColor: '#7c3aed', primaryLight: '#a78bfa', accentColor: '#f59e0b',
    bgColor: '#0f0f1a', surfaceColor: '#1a1a2e', borderColor: '#2a2a4a',
    msgBg: '#1e1e3a', msgOwnBg: '#3b1d8a', textColor: '#e2e8f0',
    chatFont: 'Tajawal', chatFontSize: '15', nameFontSize: '13',
    customCss: '', fontUrl: '',
    announcementActive: '0', announcementText: 'مرحباً بكم!',
    annBg: '#1e0a3c', annColor: '#e2e8f0', annSpeed: '20',
    guestWrite: '1', openRegister: '1', showOnline: '1',
    allowImages: '1', allowVideos: '1', allowFiles: '1', allowYouTube: '1',
    allowLinks: '1', allowFancyNames: '1',
    maxNameLength: '30', minNameLength: '3',
    maintenance: '0', maintenanceMsg: 'الموقع تحت الصيانة، نعود قريباً',
    msgLimit: '30', msgLimitWindow: '60',
    msgMaxLen: '1000', historyLimit: '200',
    spamWarnings: '3', spamMuteMins: '5',
    allowPrivateMsg: '1', pmDeleteOwn: '1', pmDeleteBoth: '0',
    allowWall: '1', wallAllowImages: '1', wallAllowVideos: '1',
    wallImageMaxMb: '10', wallVideoMaxMb: '100',
    radioActive: '0', voiceActive: '0', gamesActive: '1',
    allowNameChange: '1', maxNameChanges: '3',
    pointPerMsg: '2', pointPerLike: '5', pointPerPost: '10',
    pointSendCost: '150', pointSendMin: '100',
    maxImageMb: '5', maxVideoMb: '50', maxFileMb: '20',
    allowedExtensions: 'jpg,jpeg,png,gif,webp,mp4,webm,pdf,zip',
    bannedWords: '', wordFilter: '0',
    emojiSoundUrl: '', msgSoundUrl: '', mentionSoundUrl: '', joinSoundUrl: '',
    activeLayout: 'classic',
    siteWallName: 'الحائط', siteWallIcon: '🧱',
    showPrivacyLink: '1', showTermsLink: '1',
    copyrightText: '', copyrightLink: '',
    metaKeywords: 'شات عربي, دردشة, تعارف',
    googleAnalytics: '', facebookPixel: '',
    allowedPayments: 'vodafone_cash,instapay,manual',
    currencySymbol: 'ج.م', currencyCode: 'EGP',
    withdrawMinAmount: '100',
    setupDone: '0',
  };
  const ins = db.prepare('INSERT OR IGNORE INTO config (key,value) VALUES (?,?)');
  Object.entries(defaults).forEach(([k,v]) => ins.run(k,String(v)));
}
initDefaults();

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════
const getCfg  = k => db.prepare('SELECT value FROM config WHERE key=?').get(k)?.value ?? null;
const setCfg  = (k,v) => db.prepare('INSERT OR REPLACE INTO config (key,value,updated_at) VALUES (?,?,strftime(\'%s\',\'now\'))').run(k, String(v ?? ''));
const setBulk = obj => { const st = db.prepare('INSERT OR REPLACE INTO config (key,value) VALUES (?,?)'); const run = db.transaction(o => { Object.entries(o).forEach(([k,v]) => st.run(k,String(v??''))); }); run(obj); };

function getAllCfg() {
  const rows = db.prepare('SELECT key,value FROM config').all();
  const c = {};
  rows.forEach(r => c[r.key] = r.value);
  c.rooms          = db.prepare('SELECT * FROM rooms WHERE is_active=1 ORDER BY order_n,id').all();
  c.ranks          = db.prepare('SELECT * FROM ranks ORDER BY min_points').all();
  c.customEmojis   = db.prepare('SELECT * FROM custom_emojis WHERE active=1').all();
  c.radioStations  = db.prepare('SELECT * FROM radio_stations WHERE active=1 ORDER BY order_n').all();
  c.subPlans       = db.prepare('SELECT * FROM subscription_plans WHERE active=1').all();
  c.ads            = db.prepare('SELECT * FROM ads WHERE active=1 ORDER BY position,order_n').all();
  c.features       = db.prepare('SELECT * FROM features_inject WHERE active=1 ORDER BY order_n').all();
  c.uiIcons        = db.prepare('SELECT * FROM ui_icons').all();
  c.layouts        = db.prepare('SELECT * FROM layouts').all();
  c.games          = db.prepare('SELECT * FROM games WHERE active=1').all();
  c.languages      = db.prepare('SELECT * FROM languages WHERE active=1').all();
  c.sounds         = db.prepare('SELECT * FROM sounds WHERE active=1').all();
  c.activeLayout   = getCfg('activeLayout') || 'classic';
  return c;
}

module.exports = { db, getCfg, setCfg, setBulk, getAllCfg };
