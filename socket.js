/**
 * socket.js - Socket.IO الكامل مع كل الميزات
 */

const { db, getCfg, getAllCfg } = require('./db');
const { verifySocketToken, checkSpam, cleanText, logActivity } = require('./middleware/security');
const path = require('path');
const fs   = require('fs');

let _io = null;
const onlineMap = new Map(); // socketId → userInfo
const typingMap = new Map(); // roomId → Set<username>
const voiceRooms = new Map(); // roomId → Set<socketId>

function getIo() { return _io; }

function kickUser(userId, event='kicked', data={}) {
  for (const [sid, u] of onlineMap.entries()) {
    if (u.userId == userId) {
      _io?.to(sid).emit(event, data);
    }
  }
}

function initSocket(io) {
  _io = io;

  io.on('connection', socket => {
    // Send full config immediately
    socket.emit('config', getAllCfg());

    // ── AUTH ──────────────────────────────────────────────
    socket.on('auth', ({ token }) => {
      const decoded = verifySocketToken(token);
      if (!decoded) { socket.emit('auth_error', { message: 'جلسة غير صالحة' }); return; }

      const user = db.prepare(`
        SELECT id,username,display_name,role,avatar,points,rank_title,rank_color,rank_glow,
               name_color,name_gradient,name_effect,subscription,sub_expires,
               chat_bubble_color,is_banned,ban_until,ban_reason,is_muted,mute_until,
               profile_sound,status_text,status_emoji,is_verified,verified_badge
        FROM users WHERE id=?`).get(decoded.id);

      if (!user) { socket.emit('auth_error', { message: 'المستخدم غير موجود' }); return; }

      // Check ban
      const now = Math.floor(Date.now() / 1000);
      if (user.is_banned && (user.ban_until === 0 || user.ban_until > now)) {
        socket.emit('banned', { reason: user.ban_reason, until: user.ban_until });
        return;
      }
      // Auto unban
      if (user.is_banned && user.ban_until > 0 && user.ban_until <= now) {
        db.prepare('UPDATE users SET is_banned=0,ban_until=0 WHERE id=?').run(user.id);
      }

      socket.userId   = user.id;
      socket.username = user.username;
      socket.role     = user.role;
      socket.userData = user;

      db.prepare('UPDATE users SET is_online=1,last_seen=? WHERE id=?').run(now, user.id);

      socket.emit('auth_ok', user);

      // Send unread notifications count
      const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0').get(user.id).c;
      if (unread > 0) socket.emit('notif_count', unread);
    });

    // ── JOIN ROOM ─────────────────────────────────────────
    socket.on('join_room', ({ roomId, password }) => {
      if (!socket.username) return;

      const room = db.prepare('SELECT * FROM rooms WHERE room_id=? AND is_active=1').get(roomId);
      if (!room) return;

      // Check room password
      if (room.password && room.password !== password) {
        socket.emit('room_error', { message: 'كلمة مرور الغرفة خاطئة' });
        return;
      }

      // Check min level/subscription
      const user = db.prepare('SELECT points,subscription FROM users WHERE id=?').get(socket.userId);
      const rank = db.prepare('SELECT id FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(user?.points || 0);
      if (rank && rank.id < (room.min_level || 1)) {
        socket.emit('room_error', { message: `يجب الوصول للمستوى ${room.min_level} للدخول` });
        return;
      }

      // Check max users
      if (room.max_users > 0) {
        const roomUsers = [...onlineMap.values()].filter(u => u.room === roomId).length;
        if (roomUsers >= room.max_users) {
          socket.emit('room_error', { message: 'الغرفة ممتلئة' });
          return;
        }
      }

      // Leave old room
      if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        const oldInfo = onlineMap.get(socket.id);
        if (oldInfo) {
          io.to(socket.currentRoom).emit('system', `${socket.username} غادر الغرفة`);
          onlineMap.delete(socket.id);
          broadcastRoomUsers(socket.currentRoom);
        }
      }

      socket.join(roomId);
      socket.currentRoom = roomId;

      onlineMap.set(socket.id, {
        socketId: socket.id, userId: socket.userId, username: socket.username,
        displayName: socket.userData?.display_name || socket.username,
        role: socket.role, avatar: socket.userData?.avatar || '',
        rank: socket.userData?.rank_title || '',
        rankColor: socket.userData?.rank_color || '#94a3b8',
        rankGlow: socket.userData?.rank_glow || 0,
        nameColor: socket.userData?.name_color || '',
        nameGradient: socket.userData?.name_gradient || '',
        nameEffect: socket.userData?.name_effect || 'none',
        subscription: socket.userData?.subscription || 'free',
        isVerified: socket.userData?.is_verified || 0,
        verifiedBadge: socket.userData?.verified_badge || '',
        statusEmoji: socket.userData?.status_emoji || '',
        profileSound: socket.userData?.profile_sound || '',
        room: roomId,
      });

      // Send message history
      const histLimit = parseInt(getCfg('historyLimit') || '200');
      const history = db.prepare(`
        SELECT m.*, u.avatar as uavatar, u.display_name as udisplay
        FROM messages m
        LEFT JOIN users u ON m.user_id=u.id
        WHERE m.room_id=? AND m.is_deleted=0
        ORDER BY m.created_at DESC LIMIT ?
      `).all(roomId, histLimit).reverse();
      socket.emit('history', history);

      // Send pinned message
      const pinned = db.prepare('SELECT * FROM messages WHERE room_id=? AND is_pinned=1 AND is_deleted=0 LIMIT 1').get(roomId);
      if (pinned) socket.emit('pinned_msg', pinned);

      // Welcome message
      if (room.welcome_msg) socket.emit('room_welcome', { message: room.welcome_msg, room: roomId });

      // Room sound
      if (room.bg_sound && getCfg('voiceActive') === '1') socket.emit('room_sound', { url: room.bg_sound, volume: room.bg_sound_vol || 0.5 });

      io.to(roomId).emit('system', `${socket.username} انضم للغرفة`);
      broadcastRoomUsers(roomId);
      io.emit('room_counts', getRoomCounts());

      // Join sound
      const joinSound = getCfg('joinSoundUrl');
      if (joinSound) io.to(roomId).emit('play_sound', { url: joinSound, type: 'join' });
    });

    // ── MESSAGE ───────────────────────────────────────────
    socket.on('message', ({ text, roomId, replyTo, type: msgType }) => {
      if (!socket.username) return;
      if (getCfg('maintenance') === '1' && !['admin','owner'].includes(socket.role)) {
        socket.emit('system', getCfg('maintenanceMsg') || 'الموقع تحت الصيانة');
        return;
      }

      const room = roomId || socket.currentRoom;
      if (!room) return;

      const roomData = db.prepare('SELECT * FROM rooms WHERE room_id=?').get(room);

      // Guest write check
      if (getCfg('guestWrite') === '0' && socket.role === 'guest') {
        socket.emit('system', 'يجب التسجيل للكتابة');
        return;
      }

      // Mute check
      const userDb = db.prepare('SELECT is_muted,mute_until,spam_warnings FROM users WHERE id=?').get(socket.userId);
      if (userDb?.is_muted) {
        const now = Math.floor(Date.now() / 1000);
        if (userDb.mute_until === 0 || userDb.mute_until > now) {
          socket.emit('system', `أنت مكتوم حتى ${userDb.mute_until ? new Date(userDb.mute_until*1000).toLocaleString('ar-EG') : 'إشعار آخر'}`);
          return;
        }
        db.prepare('UPDATE users SET is_muted=0 WHERE id=?').run(socket.userId);
      }

      // Spam check
      if (checkSpam(socket.userId)) {
        let warns = (userDb?.spam_warnings || 0) + 1;
        db.prepare('UPDATE users SET spam_warnings=? WHERE id=?').run(warns, socket.userId);
        const maxWarns = parseInt(getCfg('spamWarnings') || '3');
        if (warns >= maxWarns) {
          const muteMins = parseInt(getCfg('spamMuteMins') || '5');
          const muteUntil = Math.floor(Date.now()/1000) + muteMins * 60;
          db.prepare('UPDATE users SET is_muted=1,mute_until=?,spam_warnings=0 WHERE id=?').run(muteUntil, socket.userId);
          socket.emit('system', `⚠️ تم كتمك لمدة ${muteMins} دقيقة بسبب الإرسال السريع`);
          return;
        }
        socket.emit('system', `⚠️ تحذير: أرسلت رسائل كثيرة جداً. تحذير ${warns}/${maxWarns}`);
        return;
      }

      // Slow mode
      if (roomData?.slow_mode) {
        const key = `slow_${socket.userId}_${room}`;
        const last = socket[key] || 0;
        const diff = Date.now() - last;
        if (diff < (roomData.slow_seconds || 5) * 1000) {
          socket.emit('system', `الوضع البطيء: انتظر ${Math.ceil(((roomData.slow_seconds || 5) * 1000 - diff) / 1000)} ثانية`);
          return;
        }
        socket[key] = Date.now();
      }

      let clean = cleanText(text || '', parseInt(getCfg('msgMaxLen') || '1000'));

      // Filter banned words
      const bannedWords = db.prepare('SELECT * FROM banned_words').all();
      bannedWords.forEach(bw => {
        const re = new RegExp(bw.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
        clean = clean.replace(re, bw.replacement || '***');
      });

      // Link filter
      if (getCfg('allowLinks') === '0' && !['admin','owner','moderator'].includes(socket.role)) {
        const linkRegex = /https?:\/\/[^\s]+/gi;
        if (linkRegex.test(clean)) {
          // Check allowed patterns
          const allowedRules = db.prepare("SELECT pattern FROM link_rules WHERE type='allow'").all();
          const isAllowed = allowedRules.some(r => clean.includes(r.pattern));
          if (!isAllowed) { clean = clean.replace(/https?:\/\/[^\s]+/gi, '[رابط محظور]'); }
        }
      }

      // YouTube embed
      let detectedType = 'text';
      let ytId = null;
      const ytMatch = clean.match(/https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytMatch && getCfg('allowYouTube') === '1') {
        const u = db.prepare('SELECT points FROM users WHERE id=?').get(socket.userId);
        const rk = db.prepare('SELECT can_embed_yt FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(u?.points || 0);
        if (rk?.can_embed_yt) { detectedType = 'youtube'; ytId = ytMatch[3]; }
      }

      const userData = socket.userData || {};
      const replyData = replyTo ? JSON.stringify(db.prepare('SELECT id,username,text FROM messages WHERE id=?').get(replyTo) || {}) : '';

      const info = db.prepare(`
        INSERT INTO messages (room_id,user_id,username,display_name,avatar,rank_title,rank_color,name_color,name_effect,text,type,youtube_id,reply_to,reply_data)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
          room, socket.userId, socket.username,
          userData.display_name || socket.username,
          userData.avatar || '', userData.rank_title || '', userData.rank_color || '',
          userData.name_color || '', userData.name_effect || 'none',
          clean, detectedType, ytId || '', replyTo || null, replyData
        );

      db.prepare('UPDATE users SET msg_count=msg_count+1,last_msg_time=? WHERE id=?').run(Math.floor(Date.now()/1000), socket.userId);

      const msg = {
        id: info.lastInsertRowid, room_id: room,
        username: socket.username, display_name: userData.display_name || socket.username,
        userId: socket.userId, avatar: userData.avatar || '',
        rank: userData.rank_title || '', rankColor: userData.rank_color || '',
        rankGlow: userData.rank_glow || 0,
        nameColor: userData.name_color || '', nameGradient: userData.name_gradient || '',
        nameEffect: userData.name_effect || 'none',
        chatBubbleColor: userData.chat_bubble_color || '',
        isVerified: userData.is_verified || 0, verifiedBadge: userData.verified_badge || '',
        role: socket.role, subscription: userData.subscription || 'free',
        text: clean, type: detectedType, ytId,
        replyTo, replyData: replyData ? JSON.parse(replyData) : null,
        reactions: {}, created_at: Math.floor(Date.now() / 1000)
      };

      io.to(room).emit('message', msg);

      // Give points
      if (socket.userId) addPoints(socket.userId, parseInt(getCfg('pointPerMsg') || '2'), 'رسالة في الشات');

      // Message sound
      const msgSound = getCfg('msgSoundUrl');
      if (msgSound) io.to(room).emit('play_sound', { url: msgSound, type: 'message' });

      // Handle mentions
      const mentions = [...(clean.matchAll(/@([\w\u0600-\u06FF]+)/g))].map(m => m[1]);
      mentions.forEach(mn => {
        const mu = db.prepare('SELECT id FROM users WHERE username=?').get(mn);
        if (mu && mu.id !== socket.userId) {
          addNotification(mu.id, 'mention', 'تم ذكرك', `${socket.username} ذكرك في ${room}`, socket.username, socket.userId, '💬');
          const mentionSound = getCfg('mentionSoundUrl');
          if (mentionSound) {
            const sid = [...onlineMap.entries()].find(([,u]) => u.userId === mu.id)?.[0];
            if (sid) io.to(sid).emit('play_sound', { url: mentionSound, type: 'mention' });
          }
        }
      });
    });

    // ── UPLOAD (image/video in chat) ──────────────────────
    socket.on('chat_upload', ({ roomId, dataUrl, fileName, fileType, fileSize }) => {
      if (!socket.username) return;
      const room = roomId || socket.currentRoom;

      // Check permissions
      const userData = socket.userData || {};
      const rank = db.prepare('SELECT * FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(userData.points || 0);
      const maxMb = rank?.max_image_mb || 2;
      if (fileSize && fileSize > maxMb * 1024 * 1024) {
        socket.emit('system', `حجم الملف كبير. الحد الأقصى ${maxMb}MB`);
        return;
      }

      const isImage = /^image\//.test(fileType || '');
      const isVideo = /^video\//.test(fileType || '');
      if (isImage && getCfg('allowImages') === '0') { socket.emit('system', 'الصور غير مسموح بها'); return; }
      if (isVideo && getCfg('allowVideos') === '0') { socket.emit('system', 'الفيديو غير مسموح به'); return; }

      try {
        const ext  = path.extname(fileName || 'file.jpg').toLowerCase() || '.jpg';
        const name = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const dir  = path.join(__dirname, 'public/uploads/chat');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const buf  = Buffer.from(dataUrl.split(',')[1], 'base64');
        fs.writeFileSync(path.join(dir, name), buf);
        const url  = '/uploads/chat/' + name;
        const mtype = isVideo ? 'video' : 'image';

        const info = db.prepare('INSERT INTO messages (room_id,user_id,username,text,type,media_url) VALUES (?,?,?,?,?,?)').run(room, socket.userId, socket.username, '', mtype, url);
        io.to(room).emit('message', {
          id: info.lastInsertRowid, room_id: room, username: socket.username,
          userId: socket.userId, avatar: socket.userData?.avatar || '',
          rank: socket.userData?.rank_title || '', rankColor: socket.userData?.rank_color || '',
          text: '', type: mtype, media_url: url, created_at: Math.floor(Date.now()/1000)
        });
      } catch (e) { socket.emit('system', 'فشل رفع الملف'); }
    });

    // ── REACT to message ──────────────────────────────────
    socket.on('react', ({ msgId, reaction }) => {
      if (!socket.userId) return;
      const msg = db.prepare('SELECT reactions FROM messages WHERE id=?').get(msgId);
      if (!msg) return;
      let reactions = {};
      try { reactions = JSON.parse(msg.reactions || '{}'); } catch {}
      if (!reactions[reaction]) reactions[reaction] = [];
      const idx = reactions[reaction].indexOf(socket.userId);
      if (idx === -1) reactions[reaction].push(socket.userId);
      else reactions[reaction].splice(idx, 1);
      db.prepare('UPDATE messages SET reactions=? WHERE id=?').run(JSON.stringify(reactions), msgId);
      const roomMsg = db.prepare('SELECT room_id FROM messages WHERE id=?').get(msgId);
      if (roomMsg) io.to(roomMsg.room_id).emit('message_reaction', { msgId, reactions });
    });

    // ── TYPING ────────────────────────────────────────────
    socket.on('typing', ({ roomId }) => {
      const room = roomId || socket.currentRoom;
      if (!room || !socket.username) return;
      socket.to(room).emit('typing', { username: socket.username, room });
    });

    // ── PRIVATE MESSAGE ───────────────────────────────────
    socket.on('private_message', ({ toUserId, text, type, mediaUrl }) => {
      if (!socket.userId) return;
      if (getCfg('allowPrivateMsg') === '0') { socket.emit('system', 'الرسائل الخاصة معطلة'); return; }

      const target = db.prepare('SELECT id,username FROM users WHERE id=?').get(toUserId);
      if (!target) return;

      // Check ignore
      const ignored = db.prepare('SELECT 1 FROM ignored_users WHERE user_id=? AND ignored_id=?').get(toUserId, socket.userId);
      if (ignored) { socket.emit('system', 'هذا المستخدم لا يريد استقبال رسائلك'); return; }

      const convId = [socket.userId, toUserId].sort().join('_');
      const clean  = cleanText(text || '', 2000);

      const info = db.prepare('INSERT INTO private_messages (conv_id,from_id,to_id,text,type,media_url) VALUES (?,?,?,?,?,?)').run(convId, socket.userId, toUserId, clean, type || 'text', mediaUrl || '');

      // Update conversation
      db.prepare('INSERT OR IGNORE INTO conversations (conv_id,user1_id,user2_id) VALUES (?,?,?)').run(convId, socket.userId, toUserId);
      db.prepare('UPDATE conversations SET last_msg=?,last_msg_time=strftime(\'%s\',\'now\') WHERE conv_id=?').run(clean.substring(0,100), convId);

      const pmData = {
        id: info.lastInsertRowid, conv_id: convId,
        from_id: socket.userId, from_username: socket.username,
        from_avatar: socket.userData?.avatar || '',
        to_id: toUserId, text: clean, type: type || 'text',
        media_url: mediaUrl || '', created_at: Math.floor(Date.now()/1000)
      };

      socket.emit('private_message', pmData);

      const targetSid = [...onlineMap.entries()].find(([,u]) => u.userId === toUserId)?.[0];
      if (targetSid) {
        io.to(targetSid).emit('private_message', pmData);
      } else {
        addNotification(toUserId, 'private_message', 'رسالة خاصة جديدة', `${socket.username}: ${clean.substring(0,50)}`, socket.username, socket.userId, '💬');
      }
    });

    // ── GET conversations ──────────────────────────────────
    socket.on('get_conversations', () => {
      if (!socket.userId) return;
      const convs = db.prepare(`
        SELECT c.*, 
          CASE WHEN c.user1_id=? THEN u2.username ELSE u1.username END as other_username,
          CASE WHEN c.user1_id=? THEN u2.avatar ELSE u1.avatar END as other_avatar,
          CASE WHEN c.user1_id=? THEN u2.is_online ELSE u1.is_online END as other_online,
          CASE WHEN c.user1_id=? THEN c.unread_2 ELSE c.unread_1 END as my_unread
        FROM conversations c
        JOIN users u1 ON c.user1_id=u1.id
        JOIN users u2 ON c.user2_id=u2.id
        WHERE c.user1_id=? OR c.user2_id=?
        ORDER BY c.last_msg_time DESC
      `).all(socket.userId,socket.userId,socket.userId,socket.userId,socket.userId,socket.userId);
      socket.emit('conversations', convs);
    });

    // ── GET private messages ───────────────────────────────
    socket.on('get_private_messages', ({ convId }) => {
      if (!socket.userId) return;
      const msgs = db.prepare(`
        SELECT pm.*, u.avatar as from_avatar, u.display_name as from_display
        FROM private_messages pm
        JOIN users u ON pm.from_id=u.id
        WHERE pm.conv_id=? AND NOT JSON_VALID(pm.is_deleted_by) IS FALSE
        ORDER BY pm.created_at ASC LIMIT 100
      `).all(convId);
      db.prepare('UPDATE conversations SET unread_1=CASE WHEN user1_id=? THEN 0 ELSE unread_1 END, unread_2=CASE WHEN user2_id=? THEN 0 ELSE unread_2 END WHERE conv_id=?').run(socket.userId,socket.userId,convId);
      socket.emit('private_messages', { convId, messages: msgs });
    });

    // ── DELETE private message ─────────────────────────────
    socket.on('delete_pm', ({ msgId, deleteFor }) => {
      if (!socket.userId) return;
      if (deleteFor === 'both' && getCfg('pmDeleteBoth') === '0') {
        socket.emit('system', 'حذف الرسائل للطرفين غير مسموح');
        return;
      }
      const msg = db.prepare('SELECT * FROM private_messages WHERE id=? AND from_id=?').get(msgId, socket.userId);
      if (!msg) return;
      if (deleteFor === 'both') {
        db.prepare('UPDATE private_messages SET is_deleted_by=\'["both"]\' WHERE id=?').run(msgId);
      } else {
        db.prepare('UPDATE private_messages SET is_deleted_by=? WHERE id=?').run(JSON.stringify([socket.userId.toString()]), msgId);
      }
      socket.emit('pm_deleted', { msgId, deleteFor });
    });

    // ── VOICE ROOM ────────────────────────────────────────
    socket.on('join_voice', ({ roomId }) => {
      if (!socket.userId) return;
      const room = db.prepare('SELECT * FROM rooms WHERE room_id=?').get(roomId);
      if (!room?.voice_enabled) return;

      // Check rank permission
      const u = db.prepare('SELECT points FROM users WHERE id=?').get(socket.userId);
      const rk = db.prepare('SELECT can_voice FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(u?.points || 0);
      if (!rk?.can_voice && socket.role !== 'admin' && socket.role !== 'owner') {
        socket.emit('voice_error', { message: 'رتبتك لا تسمح بالبث الصوتي' });
        return;
      }

      if (!voiceRooms.has(roomId)) voiceRooms.set(roomId, new Set());
      voiceRooms.get(roomId).add(socket.id);
      socket.join('voice_' + roomId);

      const voiceUsers = [...voiceRooms.get(roomId)].map(sid => {
        const u2 = onlineMap.get(sid);
        return u2 ? { socketId: sid, username: u2.username, avatar: u2.avatar } : null;
      }).filter(Boolean);

      io.to('voice_' + roomId).emit('voice_users', voiceUsers);
      io.to(roomId).emit('system', `🎤 ${socket.username} انضم للبث الصوتي`);
    });

    socket.on('leave_voice', ({ roomId }) => {
      const rid = roomId || socket.currentRoom;
      if (voiceRooms.has(rid)) {
        voiceRooms.get(rid).delete(socket.id);
        socket.leave('voice_' + rid);
        io.to('voice_' + rid).emit('voice_user_left', { socketId: socket.id, username: socket.username });
        io.to(rid).emit('system', `🔇 ${socket.username} غادر البث الصوتي`);
      }
    });

    socket.on('voice_signal', ({ to, signal }) => {
      io.to(to).emit('voice_signal', { from: socket.id, signal });
    });

    // ── WALL ──────────────────────────────────────────────
    socket.on('wall_reaction', ({ postId, reaction }) => {
      if (!socket.userId) return;
      const exists = db.prepare('SELECT * FROM post_reactions WHERE post_id=? AND user_id=?').get(postId, socket.userId);
      if (exists) {
        if (exists.type === reaction) {
          db.prepare('DELETE FROM post_reactions WHERE post_id=? AND user_id=?').run(postId, socket.userId);
          db.prepare('UPDATE wall_posts SET likes_count=MAX(0,likes_count-1) WHERE id=?').run(postId);
        } else {
          db.prepare('UPDATE post_reactions SET type=? WHERE post_id=? AND user_id=?').run(reaction, postId, socket.userId);
        }
      } else {
        db.prepare('INSERT INTO post_reactions (post_id,user_id,type) VALUES (?,?,?)').run(postId, socket.userId, reaction);
        db.prepare('UPDATE wall_posts SET likes_count=likes_count+1 WHERE id=?').run(postId);
        addPoints(socket.userId, parseInt(getCfg('pointPerLike') || '5'), 'إعجاب');
      }
      const reactions = db.prepare('SELECT type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY type').all(postId);
      io.emit('post_reaction_update', { postId, reactions });
    });

    // ── GAMES ─────────────────────────────────────────────
    socket.on('challenge', ({ targetId, gameCode, wager }) => {
      if (!socket.userId) return;
      const target = db.prepare('SELECT id,username FROM users WHERE id=?').get(targetId);
      if (!target) return;
      const info = db.prepare('INSERT INTO challenges (challenger,challenged,game_code,room_id,wager_points) VALUES (?,?,?,?,?)').run(socket.userId, targetId, gameCode, socket.currentRoom || '', wager || 0);
      const targetSid = [...onlineMap.entries()].find(([,u]) => u.userId === targetId)?.[0];
      if (targetSid) {
        io.to(targetSid).emit('challenge_received', {
          challengeId: info.lastInsertRowid, from: socket.username, fromId: socket.userId, gameCode, wager: wager || 0
        });
      }
    });

    socket.on('challenge_accept', ({ challengeId }) => {
      const ch = db.prepare('SELECT * FROM challenges WHERE id=?').get(challengeId);
      if (!ch) return;
      db.prepare("UPDATE challenges SET status='active' WHERE id=?").run(challengeId);
      const challengerSid = [...onlineMap.entries()].find(([,u]) => u.userId === ch.challenger)?.[0];
      if (challengerSid) {
        io.to(challengerSid).emit('challenge_accepted', { challengeId, gameCode: ch.game_code, opponentId: socket.userId, opponentName: socket.username });
      }
      socket.emit('challenge_accepted', { challengeId, gameCode: ch.game_code, opponentId: ch.challenger });
    });

    socket.on('game_move', ({ challengeId, move }) => {
      const ch = db.prepare('SELECT * FROM challenges WHERE id=?').get(challengeId);
      if (!ch) return;
      const opponentId = ch.challenger === socket.userId ? ch.challenged : ch.challenger;
      const sid = [...onlineMap.entries()].find(([,u]) => u.userId === opponentId)?.[0];
      if (sid) io.to(sid).emit('game_move', { challengeId, move, from: socket.userId });
    });

    socket.on('game_over', ({ challengeId, winner }) => {
      db.prepare("UPDATE challenges SET status='finished',winner_id=? WHERE id=?").run(winner, challengeId);
      const ch = db.prepare('SELECT * FROM challenges WHERE id=?').get(challengeId);
      if (ch?.wager_points > 0 && winner) {
        db.prepare('UPDATE users SET points=points+? WHERE id=?').run(ch.wager_points * 2, winner);
        addPoints(winner, ch.wager_points, `فوز في لعبة ${ch.game_code}`);
      }
    });

    // ── ADMIN ACTIONS via socket ───────────────────────────
    socket.on('admin_action', ({ action, targetId, data }) => {
      if (!['admin','owner'].includes(socket.role)) return;
      if (action === 'kick') kickUser(targetId, 'kicked');
      else if (action === 'ban') kickUser(targetId, 'banned', data);
      else if (action === 'mute') {
        const sid = [...onlineMap.entries()].find(([,u]) => u.userId === targetId)?.[0];
        if (sid) io.to(sid).emit('muted', data);
      }
    });

    // ── CONFIG update from admin ──────────────────────────
    socket.on('update_config', (cfg) => {
      if (!['admin','owner'].includes(socket.role)) return;
      io.emit('config', getAllCfg());
    });

    // ── DISCONNECT ────────────────────────────────────────
    socket.on('disconnect', () => {
      const u = onlineMap.get(socket.id);
      if (u) {
        onlineMap.delete(socket.id);
        if (socket.currentRoom) {
          io.to(socket.currentRoom).emit('system', `${u.username} غادر الموقع`);
          broadcastRoomUsers(socket.currentRoom);
        }
        io.emit('room_counts', getRoomCounts());
      }

      // Leave voice
      voiceRooms.forEach((sids, roomId) => {
        if (sids.has(socket.id)) {
          sids.delete(socket.id);
          io.to('voice_' + roomId).emit('voice_user_left', { socketId: socket.id });
        }
      });

      if (socket.userId) {
        db.prepare('UPDATE users SET is_online=0,last_seen=? WHERE id=?').run(Math.floor(Date.now()/1000), socket.userId);
      }
    });
  });
}

// ── Helpers ────────────────────────────────────────────────
function broadcastRoomUsers(roomId) {
  if (!_io) return;
  const users = [...onlineMap.values()].filter(u => u.room === roomId);
  _io.to(roomId).emit('room_users', users);
}

function getRoomCounts() {
  const counts = {};
  for (const u of onlineMap.values()) counts[u.room] = (counts[u.room] || 0) + 1;
  return counts;
}

function addPoints(userId, amount, reason) {
  if (!userId || !amount) return;
  try {
    db.prepare('UPDATE users SET points=points+? WHERE id=?').run(amount, userId);
    db.prepare('INSERT INTO point_log (user_id,amount,reason) VALUES (?,?,?)').run(userId, amount, reason);
    const pts = db.prepare('SELECT points FROM users WHERE id=?').get(userId)?.points || 0;
    const rank = db.prepare('SELECT * FROM ranks WHERE min_points<=? ORDER BY min_points DESC LIMIT 1').get(pts);
    if (rank) db.prepare('UPDATE users SET rank_title=?,rank_color=?,rank_glow=?,rank_id=?,level=? WHERE id=?').run(rank.title,rank.color,rank.glow_enabled,rank.id,rank.order_n,userId);
  } catch {}
}

function addNotification(userId, type, title, content, fromUser, fromId, icon) {
  try {
    db.prepare('INSERT INTO notifications (user_id,type,title,content,from_user,from_id,icon) VALUES (?,?,?,?,?,?,?)').run(userId,type,title,content,fromUser||'',fromId||null,icon||'');
    const sid = [...onlineMap.entries()].find(([,u]) => u.userId === userId)?.[0];
    if (sid && _io) {
      _io.to(sid).emit('notification', { type, title, content, fromUser, icon, time: Date.now() });
      const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0').get(userId).c;
      _io.to(sid).emit('notif_count', unread);
    }
  } catch {}
}

module.exports = { initSocket, getIo, kickUser, addPoints, addNotification, onlineMap };
