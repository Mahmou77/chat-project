/**
 * routes/games.js - الألعاب
 */
const express = require('express');
const router  = express.Router();
const { db } = require('../db');
const { authMiddleware } = require('../middleware/security');

// GET available games
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM games WHERE active=1').all());
});

// GET game session
router.get('/session/:id', authMiddleware, (req, res) => {
  const session = db.prepare('SELECT gs.*,u1.username as p1_name,u2.username as p2_name FROM game_sessions gs LEFT JOIN users u1 ON gs.player1_id=u1.id LEFT JOIN users u2 ON gs.player2_id=u2.id WHERE gs.id=?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  res.json(session);
});

// GET user challenges
router.get('/challenges', authMiddleware, (req, res) => {
  const challenges = db.prepare(`
    SELECT c.*,u1.username as challenger_name,u2.username as challenged_name
    FROM challenges c
    LEFT JOIN users u1 ON c.challenger=u1.id
    LEFT JOIN users u2 ON c.challenged=u2.id
    WHERE (c.challenger=? OR c.challenged=?) AND c.status='pending'
    ORDER BY c.created_at DESC`).all(req.user.id, req.user.id);
  res.json(challenges);
});

// GET leaderboard
router.get('/leaderboard', (req, res) => {
  const board = db.prepare('SELECT id,username,display_name,avatar,points,rank_title,rank_color,subscription FROM users ORDER BY points DESC LIMIT 50').all();
  res.json(board);
});

module.exports = router;
