/**
 * routes/chat.js - Chat REST endpoints
 */
const express = require('express');
const router  = express.Router();
const { db, getCfg } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/security');

// GET rooms (public)
router.get('/rooms', (req, res) => {
  const rooms = db.prepare('SELECT id,room_id,name,icon,icon_url,description,type,category,bg_color,bg_image,bg_opacity,voice_enabled,is_voice_only,min_level,min_sub,max_users,topic,color,order_n FROM rooms WHERE is_active=1 ORDER BY order_n,id').all();
  // Add online count per room
  try {
    const { onlineMap } = require('../socket');
    rooms.forEach(r => {
      r.online_count = [...onlineMap.values()].filter(u => u.room === r.room_id).length;
    });
  } catch {}
  res.json(rooms);
});

// GET room info
router.get('/rooms/:roomId', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE room_id=?').get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'not found' });
  res.json(room);
});

// GET messages
router.get('/messages/:roomId', optionalAuth, (req, res) => {
  const { limit=50, before } = req.query;
  let sql = 'SELECT m.*, u.avatar as uavatar, u.display_name as udisplay FROM messages m LEFT JOIN users u ON m.user_id=u.id WHERE m.room_id=? AND m.is_deleted=0';
  const params = [req.params.roomId];
  if (before) { sql += ' AND m.id<?'; params.push(parseInt(before)); }
  sql += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const msgs = db.prepare(sql).all(...params).reverse();
  res.json(msgs);
});

// GET pinned message
router.get('/rooms/:roomId/pinned', (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE room_id=? AND is_pinned=1 AND is_deleted=0 LIMIT 1').get(req.params.roomId);
  res.json(msg || null);
});

// GET online users in room
router.get('/rooms/:roomId/users', (req, res) => {
  try {
    const { onlineMap } = require('../socket');
    const users = [...onlineMap.values()].filter(u => u.room === req.params.roomId);
    res.json(users);
  } catch { res.json([]); }
});

// GET voice users in room
router.get('/rooms/:roomId/voice', (req, res) => {
  try {
    const { onlineMap } = require('../socket');
    const roomData = db.prepare('SELECT voice_enabled FROM rooms WHERE room_id=?').get(req.params.roomId);
    if (!roomData?.voice_enabled) return res.json([]);
    res.json([]);
  } catch { res.json([]); }
});

// Search messages
router.get('/search', optionalAuth, (req, res) => {
  const { q, room } = req.query;
  if (!q) return res.json([]);
  let sql = 'SELECT m.*,u.avatar as uavatar FROM messages m LEFT JOIN users u ON m.user_id=u.id WHERE m.is_deleted=0 AND m.text LIKE ?';
  const params = [`%${q}%`];
  if (room) { sql += ' AND m.room_id=?'; params.push(room); }
  sql += ' ORDER BY m.created_at DESC LIMIT 30';
  res.json(db.prepare(sql).all(...params));
});

// GET user's message history
router.get('/user-messages/:userId', authMiddleware, (req, res) => {
  if (req.user.id != req.params.userId && !['admin','owner'].includes(req.user.role))
    return res.status(403).json({ error: 'غير مصرح' });
  const msgs = db.prepare('SELECT * FROM messages WHERE user_id=? AND is_deleted=0 ORDER BY created_at DESC LIMIT 50').all(req.params.userId);
  res.json(msgs);
});

module.exports = router;
