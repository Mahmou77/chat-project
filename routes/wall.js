/**
 * routes/wall.js - حائط الأصدقاء الكامل
 */
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { db, getCfg } = require('../db');
const { authMiddleware, optionalAuth, cleanText } = require('../middleware/security');
const { addPoints, addNotification } = require('../socket');

const postStorage = multer.diskStorage({
  destination: (req,file,cb) => { const d=path.join(__dirname,'../public/uploads/posts'); fs.mkdirSync(d,{recursive:true}); cb(null,d); },
  filename: (req,file,cb) => cb(null,'post_'+Date.now()+'_'+Math.random().toString(36).slice(2)+path.extname(file.originalname))
});
const upPost = multer({ storage: postStorage, limits: { fileSize: 100*1024*1024 } });

// GET wall posts
router.get('/:userId', optionalAuth, (req, res) => {
  if (getCfg('allowWall') === '0') return res.json([]);
  const userId = parseInt(req.params.userId);
  const page   = parseInt(req.query.page) || 1;
  const posts  = db.prepare('SELECT * FROM wall_posts WHERE owner_id=? AND is_deleted=0 ORDER BY is_pinned DESC, created_at DESC LIMIT 20 OFFSET ?').all(userId, (page-1)*20);

  const result = posts.map(p => {
    const comments = db.prepare('SELECT wc.*,u.avatar as uavatar FROM wall_comments wc LEFT JOIN users u ON wc.author_id=u.id WHERE wc.post_id=? AND wc.is_deleted=0 ORDER BY wc.created_at LIMIT 5').all(p.id);
    const reactions = db.prepare('SELECT type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY type').all(p.id);
    const userReaction = req.user ? db.prepare('SELECT type FROM post_reactions WHERE post_id=? AND user_id=?').get(p.id, req.user.id) : null;
    return { ...p, comments, reactions, user_reaction: userReaction?.type || null, total_comments: db.prepare('SELECT COUNT(*) as c FROM wall_comments WHERE post_id=? AND is_deleted=0').get(p.id).c };
  });

  res.json(result);
});

// CREATE post
router.post('/', authMiddleware, upPost.fields([{name:'image',maxCount:1},{name:'video',maxCount:1}]), (req, res) => {
  if (getCfg('allowWall') === '0') return res.status(403).json({ error: 'الحائط معطل' });
  const { ownerId, content, visibility } = req.body;
  const owner = parseInt(ownerId) || req.user.id;
  const clean = cleanText(content || '', 2000);

  const author = db.prepare('SELECT username,avatar,display_name FROM users WHERE id=?').get(req.user.id);

  let mediaUrl='', mediaType='', videoUrl='';
  if (req.files?.image?.[0]) { mediaUrl='/uploads/posts/'+req.files.image[0].filename; mediaType='image'; }
  if (req.files?.video?.[0]) { videoUrl='/uploads/posts/'+req.files.video[0].filename; mediaType='video'; mediaUrl=videoUrl; }

  const info = db.prepare('INSERT INTO wall_posts (owner_id,author_id,author,author_avatar,content,media_url,media_type,video_url,visibility) VALUES (?,?,?,?,?,?,?,?,?)').run(owner, req.user.id, author?.display_name||author?.username||req.user.username, author?.avatar||'', clean, mediaUrl, mediaType, videoUrl, visibility||'public');

  addPoints(req.user.id, parseInt(getCfg('pointPerPost')||'10'), 'منشور على الحائط');
  if (owner !== req.user.id) addNotification(owner, 'wall_post', 'منشور جديد على حائطك', `${req.user.username} نشر على حائطك`, req.user.username, req.user.id, '📝');

  const post = db.prepare('SELECT * FROM wall_posts WHERE id=?').get(info.lastInsertRowid);
  res.json({ ok: true, post: { ...post, comments: [], reactions: [], user_reaction: null } });
});

// REACT to post
router.post('/:postId/react', authMiddleware, (req, res) => {
  const { reaction } = req.body;
  const postId = parseInt(req.params.postId);
  const exists = db.prepare('SELECT * FROM post_reactions WHERE post_id=? AND user_id=?').get(postId, req.user.id);

  if (exists) {
    if (exists.type === reaction) {
      db.prepare('DELETE FROM post_reactions WHERE post_id=? AND user_id=?').run(postId, req.user.id);
      db.prepare('UPDATE wall_posts SET likes_count=MAX(0,likes_count-1) WHERE id=?').run(postId);
      return res.json({ liked: false });
    }
    db.prepare('UPDATE post_reactions SET type=? WHERE post_id=? AND user_id=?').run(reaction, postId, req.user.id);
  } else {
    db.prepare('INSERT INTO post_reactions (post_id,user_id,type) VALUES (?,?,?)').run(postId, req.user.id, reaction);
    db.prepare('UPDATE wall_posts SET likes_count=likes_count+1 WHERE id=?').run(postId);
    addPoints(req.user.id, parseInt(getCfg('pointPerLike')||'5'), 'إعجاب');
    const post = db.prepare('SELECT owner_id,author_id FROM wall_posts WHERE id=?').get(postId);
    if (post && post.author_id !== req.user.id) addNotification(post.author_id, 'post_like', 'إعجاب بمنشورك', `${req.user.username} أعجب بمنشورك`, req.user.username, req.user.id, '❤️');
  }

  const reactions = db.prepare('SELECT type, COUNT(*) as count FROM post_reactions WHERE post_id=? GROUP BY type').all(postId);
  res.json({ liked: true, reactions });
});

// ADD comment
router.post('/:postId/comment', authMiddleware, (req, res) => {
  const { content, replyTo } = req.body;
  const clean = cleanText(content || '', 1000);
  if (!clean) return res.status(400).json({ error: 'تعليق فارغ' });

  const author = db.prepare('SELECT username,avatar,display_name FROM users WHERE id=?').get(req.user.id);
  const info = db.prepare('INSERT INTO wall_comments (post_id,author_id,author,avatar,content,reply_to) VALUES (?,?,?,?,?,?)').run(req.params.postId, req.user.id, author?.display_name||author?.username||req.user.username, author?.avatar||'', clean, replyTo||null);
  db.prepare('UPDATE wall_posts SET comments_count=comments_count+1 WHERE id=?').run(req.params.postId);

  const post = db.prepare('SELECT author_id FROM wall_posts WHERE id=?').get(req.params.postId);
  if (post && post.author_id !== req.user.id) addNotification(post.author_id, 'post_comment', 'تعليق جديد', `${req.user.username}: ${clean.substring(0,50)}`, req.user.username, req.user.id, '💬');

  const comment = db.prepare('SELECT * FROM wall_comments WHERE id=?').get(info.lastInsertRowid);
  res.json({ ok: true, comment });
});

// GET more comments
router.get('/:postId/comments', (req, res) => {
  const { page=1 } = req.query;
  const comments = db.prepare('SELECT wc.*,u.avatar as uavatar FROM wall_comments wc LEFT JOIN users u ON wc.author_id=u.id WHERE wc.post_id=? AND wc.is_deleted=0 ORDER BY wc.created_at LIMIT 20 OFFSET ?').all(req.params.postId, (page-1)*20);
  res.json(comments);
});

// DELETE post
router.delete('/:postId', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id=?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (post.author_id !== req.user.id && !['admin','owner'].includes(req.user.role))
    return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('UPDATE wall_posts SET is_deleted=1 WHERE id=?').run(req.params.postId);
  res.json({ ok: true });
});

// DELETE comment
router.delete('/comments/:commentId', authMiddleware, (req, res) => {
  const c = db.prepare('SELECT * FROM wall_comments WHERE id=?').get(req.params.commentId);
  if (!c) return res.status(404).json({ error: 'not found' });
  if (c.author_id !== req.user.id && !['admin','owner'].includes(req.user.role))
    return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('UPDATE wall_comments SET is_deleted=1 WHERE id=?').run(req.params.commentId);
  res.json({ ok: true });
});

// PIN post
router.post('/:postId/pin', authMiddleware, (req, res) => {
  const post = db.prepare('SELECT * FROM wall_posts WHERE id=?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'not found' });
  if (post.owner_id !== req.user.id && !['admin','owner'].includes(req.user.role))
    return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('UPDATE wall_posts SET is_pinned=0 WHERE owner_id=?').run(post.owner_id);
  db.prepare('UPDATE wall_posts SET is_pinned=1 WHERE id=?').run(req.params.postId);
  res.json({ ok: true });
});

module.exports = router;
