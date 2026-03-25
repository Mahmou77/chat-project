/**
 * routes/admin.js - لوحة الأدمن الكاملة - تحكم مطلق
 */
const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { db, getCfg, setCfg, setBulk, getAllCfg } = require('../db');
const { adminMiddleware, ownerMiddleware, logActivity, cleanText, getIP } = require('../middleware/security');
const { io: getIo } = require('../socket');

// Helper to emit config update
function emitConfig(req) {
  try { const io = getIo(); if (io) io.emit('config', getAllCfg()); } catch {}
}

// ── Stats ──────────────────────────────────────────────────
router.get('/stats', adminMiddleware, (req, res) => {
  const now = Math.floor(Date.now() / 1000);
  try {
    const { io } = require('../socket');
    res.json({
      totalUsers:   db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      onlineNow:    db.prepare('SELECT COUNT(*) as c FROM users WHERE is_online=1').get().c,
      totalMsgs:    db.prepare('SELECT COUNT(*) as c FROM messages WHERE is_deleted=0').get().c,
      totalPosts:   db.prepare('SELECT COUNT(*) as c FROM wall_posts WHERE is_deleted=0').get().c,
      bannedCount:  db.prepare('SELECT COUNT(*) as c FROM users WHERE is_banned=1').get().c,
      roomCount:    db.prepare('SELECT COUNT(*) as c FROM rooms WHERE is_active=1').get().c,
      todayMsgs:    db.prepare('SELECT COUNT(*) as c FROM messages WHERE created_at>?').get(now-86400).c,
      totalPoints:  db.prepare('SELECT SUM(points) as s FROM users').get().s || 0,
      totalRevenue: db.prepare('SELECT SUM(amount) as s FROM payments WHERE status=\'completed\'').get().s || 0,
      reportsCount: db.prepare("SELECT COUNT(*) as c FROM reports WHERE status='pending'").get().c,
      warningsCount:db.prepare('SELECT SUM(warn_count) as s FROM users').get().s || 0,
    });
  } catch { res.json({ totalUsers:0, onlineNow:0, totalMsgs:0 }); }
});

// ── Config ──────────────────────────────────────────────────
router.get('/config', adminMiddleware, (req, res) => res.json(getAllCfg()));
router.post('/config', adminMiddleware, (req, res) => {
  setBulk(req.body);
  emitConfig(req);
  res.json({ ok: true });
});

// ── Rooms ───────────────────────────────────────────────────
router.get('/rooms', adminMiddleware, (req, res) => res.json(db.prepare('SELECT * FROM rooms ORDER BY order_n,id').all()));
router.post('/rooms', adminMiddleware, (req, res) => {
  const { room_id, name, icon, icon_url, description, type, category, min_level, min_sub, max_users, voice_enabled, is_voice_only, slow_mode, slow_seconds, allow_images, allow_videos, allow_files, allow_links, welcome_msg, rules, color, order_n, password, topic, bg_color, bg_sound, bg_sound_vol } = req.body;
  if (!room_id || !name) return res.status(400).json({ error: 'معرف واسم مطلوبان' });
  const info = db.prepare(`INSERT OR IGNORE INTO rooms 
    (room_id,name,icon,icon_url,description,type,category,min_level,min_sub,max_users,voice_enabled,is_voice_only,slow_mode,slow_seconds,allow_images,allow_videos,allow_files,allow_links,welcome_msg,rules,color,order_n,password,topic,bg_color,bg_sound,bg_sound_vol)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(room_id,name,icon||'💬',icon_url||'',description||'',type||'public',category||'عام',min_level||1,min_sub||'free',max_users||0,voice_enabled?1:0,is_voice_only?1:0,slow_mode?1:0,slow_seconds||5,allow_images!==false?1:0,allow_videos!==false?1:0,allow_files!==false?1:0,allow_links!==false?1:0,welcome_msg||'',rules||'',color||'',order_n||0,password||'',topic||'',bg_color||'',bg_sound||'',parseFloat(bg_sound_vol)||0.5);
  emitConfig(req);
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/rooms/:id', adminMiddleware, (req, res) => {
  const fields = ['name','icon','icon_url','description','type','category','min_level','min_sub','max_users','voice_enabled','is_voice_only','slow_mode','slow_seconds','allow_images','allow_videos','allow_files','allow_links','welcome_msg','rules','color','order_n','is_active','password','topic','bg_color','bg_sound','bg_sound_vol','bg_image','bg_opacity','stream_url','stream_active'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (!Object.keys(updates).length) return res.json({ ok: true });
  const sets = Object.keys(updates).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE rooms SET ${sets} WHERE id=?`).run(...Object.values(updates), req.params.id);
  emitConfig(req);
  res.json({ ok: true });
});
router.delete('/rooms/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM rooms WHERE id=?').run(req.params.id);
  emitConfig(req);
  res.json({ ok: true });
});

// ── Upload room background ─────────────────────────────────
const roomBgStorage = multer.diskStorage({
  destination: (req,file,cb) => { const d=path.join(__dirname,'../public/uploads/room-bgs'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename: (req,file,cb) => cb(null,'rbg_'+Date.now()+path.extname(file.originalname))
});
const upRoomBg = multer({storage:roomBgStorage,limits:{fileSize:20*1024*1024}});
router.post('/rooms/:id/bg', adminMiddleware, upRoomBg.single('bg'), (req,res) => {
  if(!req.file) return res.status(400).json({error:'لم يتم رفع صورة'});
  const url = '/uploads/room-bgs/'+req.file.filename;
  db.prepare('UPDATE rooms SET bg_image=? WHERE id=?').run(url, req.params.id);
  emitConfig(req);
  res.json({ok:true,url});
});

// ── Users Management ────────────────────────────────────────
router.get('/users', adminMiddleware, (req, res) => {
  const { search, page=1, role, subscription, banned } = req.query;
  const offset = (page-1) * 50;
  let sql = 'SELECT id,username,display_name,email,password_plain,role,points,level,rank_title,subscription,sub_expires,is_banned,ban_until,ban_reason,created_at,is_online,last_seen,name_changes,warn_count,last_ip,device_ids,msg_count,is_verified FROM users WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  if (role) { sql += ' AND role=?'; params.push(role); }
  if (subscription) { sql += ' AND subscription=?'; params.push(subscription); }
  if (banned === '1') { sql += ' AND is_banned=1'; }
  const total = db.prepare('SELECT COUNT(*) as c FROM users WHERE 1=1' + (search?' AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)':'')).get(...(search?[`%${search}%`,`%${search}%`,`%${search}%`]:[])).c;
  sql += ' ORDER BY id DESC LIMIT 50 OFFSET ?';
  params.push(parseInt(offset));
  res.json({ users: db.prepare(sql).all(...params), total, pages: Math.ceil(total/50) });
});

router.post('/users/ban', adminMiddleware, (req, res) => {
  const { userId, reason, duration } = req.body;
  const until = parseInt(duration) === 0 ? 0 : Math.floor(Date.now()/1000) + parseInt(duration)*60;
  db.prepare('UPDATE users SET is_banned=1,ban_until=?,ban_reason=? WHERE id=?').run(until, reason||'مخالفة القواعد', userId);
  // Emit to socket
  try { const { kickUser } = require('../socket'); kickUser(userId, 'banned', { reason, until }); } catch {}
  logActivity(req.user.id, 'ban_user', `حظر المستخدم #${userId} لمدة ${duration} دقيقة: ${reason}`, getIP(req));
  res.json({ ok: true });
});
router.post('/users/unban', adminMiddleware, (req, res) => {
  db.prepare('UPDATE users SET is_banned=0,ban_until=0,ban_reason=\'\' WHERE id=?').run(req.body.userId);
  logActivity(req.user.id, 'unban_user', `رفع حظر #${req.body.userId}`, getIP(req));
  res.json({ ok: true });
});
router.post('/users/mute', adminMiddleware, (req, res) => {
  const { userId, duration } = req.body;
  const until = Math.floor(Date.now()/1000) + parseInt(duration)*60;
  db.prepare('UPDATE users SET is_muted=1,mute_until=? WHERE id=?').run(until, userId);
  res.json({ ok: true });
});
router.post('/users/kick', adminMiddleware, (req, res) => {
  try { const { kickUser } = require('../socket'); kickUser(req.body.userId, 'kicked'); } catch {}
  res.json({ ok: true });
});
router.post('/users/role', adminMiddleware, (req, res) => {
  db.prepare('UPDATE users SET role=? WHERE id=?').run(req.body.role, req.body.userId);
  logActivity(req.user.id, 'role_change', `تغيير دور #${req.body.userId} إلى ${req.body.role}`, getIP(req));
  res.json({ ok: true });
});
router.post('/users/points', adminMiddleware, (req, res) => {
  const { userId, amount, reason } = req.body;
  db.prepare('UPDATE users SET points=points+? WHERE id=?').run(parseInt(amount), userId);
  db.prepare('INSERT INTO point_log (user_id,amount,reason) VALUES (?,?,?)').run(userId, parseInt(amount), reason||'منحة أدمن');
  // Refresh rank
  const pts = db.prepare('SELECT points FROM users WHERE id=?').get(userId)?.points || 0;
  const rank = db.prepare('SELECT * FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(pts);
  if (rank) db.prepare('UPDATE users SET rank_title=?,rank_color=?,rank_glow=?,rank_id=?,level=? WHERE id=?').run(rank.title,rank.color,rank.glow_enabled,rank.id,rank.order_n,userId);
  res.json({ ok: true });
});
router.post('/users/subscription', adminMiddleware, (req, res) => {
  const { userId, type, days } = req.body;
  const exp = days && parseInt(days) > 0 ? Math.floor(Date.now()/1000) + parseInt(days)*86400 : 0;
  db.prepare('UPDATE users SET subscription=?,sub_expires=? WHERE id=?').run(type, exp, userId);
  logActivity(req.user.id, 'subscription_update', `اشتراك #${userId}: ${type} لمدة ${days} يوم`, getIP(req));
  res.json({ ok: true });
});
router.post('/users/verify', adminMiddleware, (req, res) => {
  const { userId, badge } = req.body;
  db.prepare('UPDATE users SET is_verified=1,verified_badge=? WHERE id=?').run(badge||'✔️', userId);
  res.json({ ok: true });
});
router.post('/users/warn', adminMiddleware, (req, res) => {
  const { userId, reason } = req.body;
  db.prepare('UPDATE users SET warn_count=warn_count+1 WHERE id=?').run(userId);
  db.prepare('INSERT INTO notifications (user_id,type,title,content,icon) VALUES (?,?,?,?,?)').run(userId,'warning','تحذير','تلقيت تحذيراً: '+(reason||'مخالفة القواعد'),'⚠️');
  res.json({ ok: true });
});
router.post('/users/reset-password', adminMiddleware, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'كلمة مرور فارغة' });
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password=?,password_plain=? WHERE id=?').run(hash, newPassword, userId);
  logActivity(req.user.id, 'password_reset', `إعادة تعيين كلمة مرور #${userId}`, getIP(req));
  res.json({ ok: true });
});
router.post('/users/set-namecolor', adminMiddleware, (req, res) => {
  const { userId, nameColor, nameGradient, nameEffect } = req.body;
  db.prepare('UPDATE users SET name_color=?,name_gradient=?,name_effect=? WHERE id=?').run(nameColor||'',nameGradient||'',nameEffect||'none',userId);
  res.json({ ok: true });
});
router.delete('/users/:id', ownerMiddleware, (req, res) => {
  db.prepare('DELETE FROM users WHERE id=? AND role!=\'owner\'').run(req.params.id);
  logActivity(req.user.id, 'delete_user', `حذف المستخدم #${req.params.id}`, getIP(req));
  res.json({ ok: true });
});

// ── Messages Admin ──────────────────────────────────────────
router.get('/messages', adminMiddleware, (req, res) => {
  const { room, search, limit=100, offset=0 } = req.query;
  let sql = 'SELECT m.* FROM messages m WHERE m.is_deleted=0';
  const params = [];
  if (room) { sql += ' AND m.room_id=?'; params.push(room); }
  if (search) { sql += ' AND (m.text LIKE ? OR m.username LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }
  sql += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  res.json(db.prepare(sql).all(...params));
});
router.delete('/messages/:id', adminMiddleware, (req, res) => {
  db.prepare('UPDATE messages SET is_deleted=1,deleted_by=? WHERE id=?').run(req.user.id, req.params.id);
  try { const io = getIo(); if(io) io.emit('message_deleted', parseInt(req.params.id)); } catch {}
  res.json({ ok: true });
});
router.post('/messages/clear', adminMiddleware, (req, res) => {
  const { room } = req.body;
  if (room) db.prepare('DELETE FROM messages WHERE room_id=?').run(room);
  else db.prepare('DELETE FROM messages').run();
  try { const io = getIo(); if(io) io.emit('messages_cleared', room||'all'); } catch {}
  res.json({ ok: true });
});
router.post('/messages/pin', adminMiddleware, (req, res) => {
  const { msgId, roomId } = req.body;
  db.prepare('UPDATE messages SET is_pinned=0 WHERE room_id=?').run(roomId);
  db.prepare('UPDATE messages SET is_pinned=1 WHERE id=?').run(msgId);
  res.json({ ok: true });
});

// ── Ads ─────────────────────────────────────────────────────
router.get('/ads', adminMiddleware, (req, res) => res.json(db.prepare('SELECT * FROM ads ORDER BY position,order_n').all()));
router.post('/ads', adminMiddleware, (req, res) => {
  const { name,position,html,image_url,link_url,type,order_n,start_date,end_date } = req.body;
  const info = db.prepare('INSERT INTO ads (name,position,html,image_url,link_url,type,order_n,start_date,end_date) VALUES (?,?,?,?,?,?,?,?,?)').run(name,position,html||'',image_url||'',link_url||'',type||'html',order_n||0,start_date||0,end_date||0);
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/ads/:id', adminMiddleware, (req, res) => {
  const { name,position,html,image_url,link_url,type,active,order_n } = req.body;
  db.prepare('UPDATE ads SET name=?,position=?,html=?,image_url=?,link_url=?,type=?,active=?,order_n=? WHERE id=?').run(name,position,html,image_url||'',link_url||'',type||'html',active?1:0,order_n||0,req.params.id);
  res.json({ ok: true });
});
router.delete('/ads/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM ads WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Ranks ───────────────────────────────────────────────────
router.get('/ranks', adminMiddleware, (req, res) => res.json(db.prepare('SELECT * FROM ranks ORDER BY min_points').all()));
router.post('/ranks', adminMiddleware, (req, res) => {
  const { title,icon,icon_url,min_points,color,bg_color,glow_color,glow_enabled,badge_url,can_send_points,can_embed_yt,can_voice,can_stream,can_upload_files,can_change_name,name_change_hours,can_colored_name,can_gradient_name,can_glow_name,can_profile_sound,can_profile_bg,can_chat_bubble,send_no_cost,send_discount,max_file_mb,max_image_mb,order_n } = req.body;
  const info = db.prepare(`INSERT INTO ranks (title,icon,icon_url,min_points,color,bg_color,glow_color,glow_enabled,badge_url,can_send_points,can_embed_yt,can_voice,can_stream,can_upload_files,can_change_name,name_change_hours,can_colored_name,can_gradient_name,can_glow_name,can_profile_sound,can_profile_bg,can_chat_bubble,send_no_cost,send_discount,max_file_mb,max_image_mb,order_n) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(title,icon||'⭐',icon_url||'',min_points||0,color||'#94a3b8',bg_color||'',glow_color||'',glow_enabled?1:0,badge_url||'',can_send_points?1:0,can_embed_yt?1:0,can_voice?1:0,can_stream?1:0,can_upload_files?1:0,can_change_name!==false?1:0,name_change_hours||168,can_colored_name?1:0,can_gradient_name?1:0,can_glow_name?1:0,can_profile_sound?1:0,can_profile_bg?1:0,can_chat_bubble?1:0,send_no_cost?1:0,parseFloat(send_discount)||0,max_file_mb||5,max_image_mb||2,order_n||0);
  // Refresh all users ranks
  refreshAllRanks();
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/ranks/:id', adminMiddleware, (req, res) => {
  const r = req.body;
  db.prepare(`UPDATE ranks SET title=?,icon=?,icon_url=?,min_points=?,color=?,bg_color=?,glow_color=?,glow_enabled=?,can_send_points=?,can_embed_yt=?,can_voice=?,can_stream=?,can_colored_name=?,can_gradient_name=?,can_glow_name=?,can_profile_sound=?,can_profile_bg=?,can_chat_bubble=?,send_no_cost=?,send_discount=?,max_file_mb=?,name_change_hours=?,order_n=? WHERE id=?`).run(r.title,r.icon||'⭐',r.icon_url||'',r.min_points||0,r.color||'#94a3b8',r.bg_color||'',r.glow_color||'',r.glow_enabled?1:0,r.can_send_points?1:0,r.can_embed_yt?1:0,r.can_voice?1:0,r.can_stream?1:0,r.can_colored_name?1:0,r.can_gradient_name?1:0,r.can_glow_name?1:0,r.can_profile_sound?1:0,r.can_profile_bg?1:0,r.can_chat_bubble?1:0,r.send_no_cost?1:0,parseFloat(r.send_discount)||0,r.max_file_mb||5,r.name_change_hours||168,r.order_n||0,req.params.id);
  refreshAllRanks();
  res.json({ ok: true });
});
router.delete('/ranks/:id', adminMiddleware, (req, res) => { db.prepare('DELETE FROM ranks WHERE id=?').run(req.params.id); res.json({ ok: true }); });

function refreshAllRanks() {
  const users = db.prepare('SELECT id,points FROM users').all();
  users.forEach(u => {
    const rank = db.prepare('SELECT * FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(u.points||0);
    if (rank) db.prepare('UPDATE users SET rank_title=?,rank_color=?,rank_glow=?,rank_id=?,level=? WHERE id=?').run(rank.title,rank.color,rank.glow_enabled,rank.id,rank.order_n,u.id);
  });
}

// ── Emojis ──────────────────────────────────────────────────
const emojiStorage = multer.diskStorage({
  destination:(req,file,cb)=>{const d=path.join(__dirname,'../public/emojis');fs.mkdirSync(d,{recursive:true});cb(null,d);},
  filename:(req,file,cb)=>cb(null,'em_'+Date.now()+path.extname(file.originalname))
});
const upEmoji = multer({storage:emojiStorage,limits:{fileSize:2*1024*1024}});
router.get('/emojis', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM custom_emojis ORDER BY category,id').all()));
router.post('/emojis', adminMiddleware, upEmoji.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'لم يتم رفع الملف'});
  const url='/emojis/'+req.file.filename;
  const info=db.prepare('INSERT INTO custom_emojis (name,url,animated,category,min_rank,min_sub) VALUES (?,?,?,?,?,?)').run(req.body.name,url,req.body.animated?1:0,req.body.category||'عام',parseInt(req.body.min_rank)||0,req.body.min_sub||'free');
  emitConfig(req);
  res.json({ok:true,id:info.lastInsertRowid,url});
});
router.delete('/emojis/:id', adminMiddleware, (req,res)=>{
  const em=db.prepare('SELECT url FROM custom_emojis WHERE id=?').get(req.params.id);
  if(em) try{fs.unlinkSync(path.join(__dirname,'../public',em.url));}catch{}
  db.prepare('DELETE FROM custom_emojis WHERE id=?').run(req.params.id);
  emitConfig(req);
  res.json({ok:true});
});

// ── Sounds ──────────────────────────────────────────────────
const soundStorage = multer.diskStorage({
  destination:(req,file,cb)=>{const d=path.join(__dirname,'../public/sounds');fs.mkdirSync(d,{recursive:true});cb(null,d);},
  filename:(req,file,cb)=>cb(null,'snd_'+Date.now()+path.extname(file.originalname))
});
const upSound = multer({storage:soundStorage,limits:{fileSize:5*1024*1024}});
router.get('/sounds', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM sounds').all()));
router.post('/sounds', adminMiddleware, upSound.single('file'), (req,res)=>{
  const url = req.file ? '/sounds/'+req.file.filename : req.body.url;
  if(!url) return res.status(400).json({error:'url أو ملف مطلوب'});
  const info=db.prepare('INSERT INTO sounds (name,url,type,category) VALUES (?,?,?,?)').run(req.body.name,url,req.body.type||'notification',req.body.category||'عام');
  emitConfig(req);
  res.json({ok:true,id:info.lastInsertRowid,url});
});
router.delete('/sounds/:id', adminMiddleware, (req,res)=>{
  db.prepare('DELETE FROM sounds WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

// ── Radio ────────────────────────────────────────────────────
router.get('/radio', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM radio_stations ORDER BY order_n').all()));
router.post('/radio', adminMiddleware, (req,res)=>{
  const{name,url,icon,icon_url,category,country,order_n}=req.body;
  const info=db.prepare('INSERT INTO radio_stations (name,url,icon,icon_url,category,country,order_n) VALUES (?,?,?,?,?,?,?)').run(name,url,icon||'📻',icon_url||'',category||'عام',country||'',order_n||0);
  emitConfig(req);
  res.json({ok:true,id:info.lastInsertRowid});
});
router.put('/radio/:id', adminMiddleware, (req,res)=>{
  const{name,url,icon,icon_url,category,country,active,order_n}=req.body;
  db.prepare('UPDATE radio_stations SET name=?,url=?,icon=?,icon_url=?,category=?,country=?,active=?,order_n=? WHERE id=?').run(name,url,icon,icon_url||'',category||'عام',country||'',active?1:0,order_n||0,req.params.id);
  emitConfig(req);
  res.json({ok:true});
});
router.delete('/radio/:id', adminMiddleware, (req,res)=>{
  db.prepare('DELETE FROM radio_stations WHERE id=?').run(req.params.id);
  emitConfig(req);
  res.json({ok:true});
});

// ── Features inject ─────────────────────────────────────────
router.get('/features', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM features_inject ORDER BY order_n').all()));
router.post('/features', adminMiddleware, (req,res)=>{
  const{name,type,position,code,pages,order_n}=req.body;
  const info=db.prepare('INSERT INTO features_inject (name,type,position,code,pages,order_n) VALUES (?,?,?,?,?,?)').run(name,type||'js',position||'body-bottom',code,JSON.stringify(pages||['chat']),order_n||0);
  emitConfig(req);
  res.json({ok:true,id:info.lastInsertRowid});
});
router.put('/features/:id', adminMiddleware, (req,res)=>{
  const{name,type,position,code,pages,active,order_n}=req.body;
  db.prepare('UPDATE features_inject SET name=?,type=?,position=?,code=?,pages=?,active=?,order_n=? WHERE id=?').run(name,type,position,code,JSON.stringify(pages||['chat']),active?1:0,order_n||0,req.params.id);
  emitConfig(req);
  res.json({ok:true});
});
router.delete('/features/:id', adminMiddleware, (req,res)=>{
  db.prepare('DELETE FROM features_inject WHERE id=?').run(req.params.id);
  emitConfig(req);
  res.json({ok:true});
});

// ── Plans ───────────────────────────────────────────────────
router.get('/plans', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM subscription_plans').all()));
router.post('/plans', adminMiddleware, (req,res)=>{
  const{name,code,description,price,currency,duration,points,rank_id,features,color,icon,is_featured}=req.body;
  const info=db.prepare('INSERT INTO subscription_plans (name,code,description,price,currency,duration,points,rank_id,features,color,icon,is_featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(name,code||name,description||'',parseFloat(price)||0,currency||'EGP',parseInt(duration)||30,parseInt(points)||0,rank_id||null,JSON.stringify(features||{}),color||'#7c3aed',icon||'💎',is_featured?1:0);
  res.json({ok:true,id:info.lastInsertRowid});
});
router.put('/plans/:id', adminMiddleware, (req,res)=>{
  const{name,price,duration,points,active,is_featured,color,icon,description}=req.body;
  db.prepare('UPDATE subscription_plans SET name=?,price=?,duration=?,points=?,active=?,is_featured=?,color=?,icon=?,description=? WHERE id=?').run(name,parseFloat(price)||0,parseInt(duration)||30,parseInt(points)||0,active?1:0,is_featured?1:0,color||'#7c3aed',icon||'💎',description||'',req.params.id);
  res.json({ok:true});
});
router.delete('/plans/:id', adminMiddleware, (req,res)=>{db.prepare('DELETE FROM subscription_plans WHERE id=?').run(req.params.id);res.json({ok:true});});

// ── UI Icons ────────────────────────────────────────────────
router.get('/ui-icons', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM ui_icons').all()));
router.put('/ui-icons/:key', adminMiddleware, (req,res)=>{
  const{label,icon_type,value,url,size,color,visible,position}=req.body;
  db.prepare('INSERT OR REPLACE INTO ui_icons (key,label,icon_type,value,url,size,color,visible,position) VALUES (?,?,?,?,?,?,?,?,?)').run(req.params.key,label||'',icon_type||'emoji',value||'',url||'',size||'md',color||'',visible!==false?1:0,position||'');
  emitConfig(req);
  res.json({ok:true});
});

const iconFileStorage = multer.diskStorage({
  destination:(req,file,cb)=>{const d=path.join(__dirname,'../public/uploads/icons');fs.mkdirSync(d,{recursive:true});cb(null,d);},
  filename:(req,file,cb)=>cb(null,'icon_'+Date.now()+path.extname(file.originalname))
});
const upIconFile = multer({storage:iconFileStorage,limits:{fileSize:1*1024*1024}});
router.post('/ui-icons/:key/upload', adminMiddleware, upIconFile.single('icon'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'لم يتم رفع ملف'});
  const url='/uploads/icons/'+req.file.filename;
  db.prepare('UPDATE ui_icons SET icon_type=\'file\',url=? WHERE key=?').run(url,req.params.key);
  emitConfig(req);
  res.json({ok:true,url});
});

// ── Layouts ─────────────────────────────────────────────────
router.get('/layouts', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM layouts').all()));
router.post('/layouts/activate', adminMiddleware, (req,res)=>{
  const{name}=req.body;
  db.prepare('UPDATE layouts SET is_active=0').run();
  db.prepare("UPDATE layouts SET is_active=1 WHERE name=?").run(name);
  setCfg('activeLayout',name);
  emitConfig(req);
  res.json({ok:true});
});
router.put('/layouts/:id', adminMiddleware, (req,res)=>{
  const{label,css,config}=req.body;
  db.prepare('UPDATE layouts SET label=?,css=?,config=? WHERE id=?').run(label,css||'',JSON.stringify(config||{}),req.params.id);
  emitConfig(req);
  res.json({ok:true});
});

// ── Profile Themes ──────────────────────────────────────────
router.get('/profile-themes', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM profile_themes').all()));
router.post('/profile-themes', adminMiddleware, (req,res)=>{
  const{name,label,css,config,min_sub}=req.body;
  const info=db.prepare('INSERT OR IGNORE INTO profile_themes (name,label,css,config,min_sub) VALUES (?,?,?,?,?)').run(name,label,css||'',JSON.stringify(config||{}),min_sub||'free');
  res.json({ok:true,id:info.lastInsertRowid});
});

// ── Languages ────────────────────────────────────────────────
router.get('/languages', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM languages').all()));
router.post('/languages', adminMiddleware, (req,res)=>{
  const{code,name,direction,strings}=req.body;
  db.prepare('INSERT OR REPLACE INTO languages (code,name,direction,strings) VALUES (?,?,?,?)').run(code,name,direction||'rtl',JSON.stringify(strings||{}));
  res.json({ok:true});
});

// ── Pages ────────────────────────────────────────────────────
router.get('/pages', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM pages').all()));
router.put('/pages/:slug', adminMiddleware, (req,res)=>{
  const{title,content,active}=req.body;
  db.prepare('INSERT OR REPLACE INTO pages (slug,title,content,active,updated_at) VALUES (?,?,?,?,strftime(\'%s\',\'now\'))').run(req.params.slug,title,content||'',active!==false?1:0);
  res.json({ok:true});
});

// ── Default Avatars ──────────────────────────────────────────
const defAvStorage = multer.diskStorage({
  destination:(req,file,cb)=>{const d=path.join(__dirname,'../public/uploads/default-avatars');fs.mkdirSync(d,{recursive:true});cb(null,d);},
  filename:(req,file,cb)=>cb(null,'dav_'+Date.now()+path.extname(file.originalname))
});
const upDefAv = multer({storage:defAvStorage,limits:{fileSize:2*1024*1024}});
router.get('/default-avatars', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM default_avatars').all()));
router.post('/default-avatars', adminMiddleware, upDefAv.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'لم يتم رفع الملف'});
  const url='/uploads/default-avatars/'+req.file.filename;
  const info=db.prepare('INSERT INTO default_avatars (url,category,gender) VALUES (?,?,?)').run(url,req.body.category||'عام',req.body.gender||'any');
  res.json({ok:true,id:info.lastInsertRowid,url});
});
router.delete('/default-avatars/:id', adminMiddleware, (req,res)=>{
  const av=db.prepare('SELECT url FROM default_avatars WHERE id=?').get(req.params.id);
  if(av) try{fs.unlinkSync(path.join(__dirname,'../public',av.url));}catch{}
  db.prepare('DELETE FROM default_avatars WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

// ── Bots ────────────────────────────────────────────────────
router.get('/bots', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT id,name,username,avatar,type,rooms,is_active,created_at FROM bots').all()));
router.post('/bots', adminMiddleware, (req,res)=>{
  const{name,username,type,commands,rooms}=req.body;
  const token=require('crypto').randomBytes(32).toString('hex');
  const info=db.prepare('INSERT INTO bots (name,username,token,type,commands,rooms) VALUES (?,?,?,?,?,?)').run(name,username,token,type||'custom',JSON.stringify(commands||{}),JSON.stringify(rooms||['all']));
  res.json({ok:true,id:info.lastInsertRowid,token});
});
router.delete('/bots/:id', adminMiddleware, (req,res)=>{db.prepare('DELETE FROM bots WHERE id=?').run(req.params.id);res.json({ok:true});});

// ── Broadcast ────────────────────────────────────────────────
router.post('/broadcast', adminMiddleware, (req, res) => {
  const { title, content, target } = req.body;
  if (!content) return res.status(400).json({ error: 'محتوى فارغ' });

  let users = [];
  if (target === 'all') users = db.prepare('SELECT id FROM users').all();
  else if (target === 'online') users = db.prepare('SELECT id FROM users WHERE is_online=1').all();
  else if (target === 'members') users = db.prepare("SELECT id FROM users WHERE role='user' OR role='moderator'").all();
  else if (target === 'vip') users = db.prepare("SELECT id FROM users WHERE subscription!='free'").all();

  const ins = db.prepare('INSERT INTO notifications (user_id,type,title,content,icon) VALUES (?,?,?,?,?)');
  const run = db.transaction(() => { users.forEach(u => ins.run(u.id,'broadcast',title||'إعلان من الأدمن',content,'📢')); });
  run();

  db.prepare('INSERT INTO broadcasts (title,content,target,sent_by,sent_count) VALUES (?,?,?,?,?)').run(title||'',content,target||'all',req.user.id,users.length);

  // Emit to sockets
  try {
    const io = getIo();
    if (io) io.emit('broadcast', { title: title||'إعلان', content, from: 'الأدمن' });
  } catch {}

  res.json({ ok: true, sent: users.length });
});

// ── Reports ─────────────────────────────────────────────────
router.get('/reports', adminMiddleware, (req,res)=>res.json(db.prepare("SELECT r.*,u.username as reporter_name FROM reports r LEFT JOIN users u ON r.reporter_id=u.id ORDER BY r.created_at DESC LIMIT 100").all()));
router.post('/reports/:id/resolve', adminMiddleware, (req,res)=>{
  db.prepare("UPDATE reports SET status='resolved',resolved_by=? WHERE id=?").run(req.user.id,req.params.id);
  res.json({ok:true});
});

// ── Payments & Earnings ──────────────────────────────────────
router.get('/payments', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT p.*,u.username FROM payments p LEFT JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC LIMIT 200').all()));
router.post('/payments', adminMiddleware, (req,res)=>{
  const{user_id,plan_id,amount,method,reference,notes}=req.body;
  const info=db.prepare("INSERT INTO payments (user_id,plan_id,amount,method,reference,notes,status,processed_by) VALUES (?,?,?,?,?,?,?,?)").run(user_id,plan_id||null,parseFloat(amount),method||'manual',reference||'',notes||'','completed',req.user.id);
  db.prepare('INSERT INTO earnings (source,amount,notes) VALUES (?,?,?)').run('subscription',parseFloat(amount),`اشتراك المستخدم #${user_id}`);
  res.json({ok:true,id:info.lastInsertRowid});
});
router.get('/earnings', adminMiddleware, (req,res)=>{
  const total=db.prepare('SELECT SUM(amount) as s FROM earnings').get().s||0;
  const monthly=db.prepare('SELECT SUM(amount) as s FROM earnings WHERE created_at>?').get(Math.floor(Date.now()/1000)-2592000).s||0;
  const list=db.prepare('SELECT * FROM earnings ORDER BY created_at DESC LIMIT 100').all();
  res.json({total,monthly,list});
});
router.get('/withdrawals', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM withdrawals ORDER BY created_at DESC').all()));
router.post('/withdrawals', ownerMiddleware, (req,res)=>{
  const{amount,method,account,notes}=req.body;
  const info=db.prepare("INSERT INTO withdrawals (amount,method,account,notes,status) VALUES (?,?,?,?,'completed')").run(parseFloat(amount),method,account||'',notes||'');
  res.json({ok:true,id:info.lastInsertRowid});
});

// ── Activity Log ─────────────────────────────────────────────
router.get('/activity', adminMiddleware, (req,res)=>{
  const{user_id,limit=100}=req.query;
  let sql='SELECT a.*,u.username FROM activity_log a LEFT JOIN users u ON a.user_id=u.id WHERE 1=1';
  const p=[];
  if(user_id){sql+=' AND a.user_id=?';p.push(user_id);}
  sql+=' ORDER BY a.created_at DESC LIMIT ?';p.push(parseInt(limit));
  res.json(db.prepare(sql).all(...p));
});

// ── Banned Words ─────────────────────────────────────────────
router.get('/banned-words', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM banned_words').all()));
router.post('/banned-words', adminMiddleware, (req,res)=>{
  const{word,replacement,severity}=req.body;
  try{const info=db.prepare('INSERT INTO banned_words (word,replacement,severity) VALUES (?,?,?)').run(word,replacement||'***',severity||1);res.json({ok:true,id:info.lastInsertRowid});}
  catch{res.status(400).json({error:'الكلمة موجودة بالفعل'});}
});
router.delete('/banned-words/:id', adminMiddleware, (req,res)=>{db.prepare('DELETE FROM banned_words WHERE id=?').run(req.params.id);res.json({ok:true});});

// ── Link Rules ───────────────────────────────────────────────
router.get('/link-rules', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM link_rules').all()));
router.post('/link-rules', adminMiddleware, (req,res)=>{
  const info=db.prepare('INSERT INTO link_rules (pattern,type) VALUES (?,?)').run(req.body.pattern,req.body.type||'allow');
  res.json({ok:true,id:info.lastInsertRowid});
});
router.delete('/link-rules/:id', adminMiddleware, (req,res)=>{db.prepare('DELETE FROM link_rules WHERE id=?').run(req.params.id);res.json({ok:true});});

// ── Games ────────────────────────────────────────────────────
router.get('/games', adminMiddleware, (req,res)=>res.json(db.prepare('SELECT * FROM games').all()));
router.put('/games/:id', adminMiddleware, (req,res)=>{
  const{active,min_rank}=req.body;
  db.prepare('UPDATE games SET active=?,min_rank=? WHERE id=?').run(active?1:0,min_rank||0,req.params.id);
  emitConfig(req);
  res.json({ok:true});
});

// ── Wall admin ───────────────────────────────────────────────
router.get('/wall-posts', adminMiddleware, (req,res)=>{
  const posts=db.prepare('SELECT wp.*,u.username as owner_name FROM wall_posts wp LEFT JOIN users u ON wp.owner_id=u.id WHERE wp.is_deleted=0 ORDER BY wp.created_at DESC LIMIT 100').all();
  res.json(posts);
});
router.delete('/wall-posts/:id', adminMiddleware, (req,res)=>{
  db.prepare('UPDATE wall_posts SET is_deleted=1 WHERE id=?').run(req.params.id);
  res.json({ok:true});
});

// ── Bulk actions ─────────────────────────────────────────────
router.post('/bulk/users', adminMiddleware, (req,res)=>{
  const{action,userIds}=req.body;
  if(!userIds?.length) return res.status(400).json({error:'لا مستخدمين محددين'});
  if(action==='ban') userIds.forEach(id=>db.prepare('UPDATE users SET is_banned=1,ban_reason=\'حظر جماعي\',ban_until=0 WHERE id=?').run(id));
  else if(action==='unban') userIds.forEach(id=>db.prepare('UPDATE users SET is_banned=0 WHERE id=?').run(id));
  else if(action==='delete') userIds.forEach(id=>db.prepare("DELETE FROM users WHERE id=? AND role!='owner'").run(id));
  logActivity(req.user.id,'bulk_action',`${action} على ${userIds.length} مستخدم`,getIP(req));
  res.json({ok:true,count:userIds.length});
});

module.exports = router;
