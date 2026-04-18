'use strict';

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'itd_secret_key_change_me';

// ─── SQLite setup ─────────────────────────────────────
// /opt/render/project/src/ is persistent on Render with a Disk
// Without paid disk, use /tmp (survives restarts within same instance)
const DB_PATH = process.env.DB_PATH || path.join('/tmp', 'itd.db');

let db;
try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (e) {
  // fallback
  const fallback = path.join(__dirname, 'itd.db');
  db = new Database(fallback);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

// ─── Create tables ────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    displayName TEXT NOT NULL,
    emoji       TEXT NOT NULL DEFAULT '😀',
    color       TEXT NOT NULL DEFAULT '#6C63FF',
    bio         TEXT NOT NULL DEFAULT '',
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS follows (
    followerId  TEXT NOT NULL,
    followingId TEXT NOT NULL,
    createdAt   TEXT NOT NULL,
    PRIMARY KEY (followerId, followingId),
    FOREIGN KEY (followerId)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followingId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id        TEXT PRIMARY KEY,
    authorId  TEXT NOT NULL,
    content   TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS likes (
    userId  TEXT NOT NULL,
    postId  TEXT NOT NULL,
    PRIMARY KEY (userId, postId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (postId) REFERENCES posts(id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         TEXT PRIMARY KEY,
    fromId     TEXT NOT NULL,
    toId       TEXT NOT NULL,
    content    TEXT NOT NULL,
    isRead     INTEGER NOT NULL DEFAULT 0,
    createdAt  TEXT NOT NULL,
    FOREIGN KEY (fromId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (toId)   REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ─── Prepared statements ──────────────────────────────
const stmts = {
  // Users
  insertUser:    db.prepare(`INSERT INTO users (id,username,password,displayName,emoji,color,bio,createdAt) VALUES (?,?,?,?,?,?,?,?)`),
  getUserById:   db.prepare(`SELECT * FROM users WHERE id = ?`),
  getUserByName: db.prepare(`SELECT * FROM users WHERE username = ?`),
  getAllUsers:   db.prepare(`SELECT * FROM users ORDER BY createdAt DESC`),
  updateBio:     db.prepare(`UPDATE users SET bio = ? WHERE id = ?`),
  updateProfile: db.prepare(`UPDATE users SET displayName=?, emoji=?, color=?, bio=? WHERE id=?`),

  // Follows
  insertFollow:  db.prepare(`INSERT OR IGNORE INTO follows (followerId,followingId,createdAt) VALUES (?,?,?)`),
  deleteFollow:  db.prepare(`DELETE FROM follows WHERE followerId=? AND followingId=?`),
  getFollowers:  db.prepare(`SELECT followerId as id FROM follows WHERE followingId=?`),
  getFollowing:  db.prepare(`SELECT followingId as id FROM follows WHERE followerId=?`),
  isFollowing:   db.prepare(`SELECT 1 FROM follows WHERE followerId=? AND followingId=?`),

  // Posts
  insertPost:    db.prepare(`INSERT INTO posts (id,authorId,content,createdAt) VALUES (?,?,?,?)`),
  getAllPosts:    db.prepare(`SELECT * FROM posts ORDER BY createdAt DESC`),
  getPostById:   db.prepare(`SELECT * FROM posts WHERE id=?`),
  deletePost:    db.prepare(`DELETE FROM posts WHERE id=? AND authorId=?`),
  getPostsByUser:db.prepare(`SELECT * FROM posts WHERE authorId=? ORDER BY createdAt DESC`),

  // Likes
  insertLike:    db.prepare(`INSERT OR IGNORE INTO likes (userId,postId) VALUES (?,?)`),
  deleteLike:    db.prepare(`DELETE FROM likes WHERE userId=? AND postId=?`),
  getLikeCount:  db.prepare(`SELECT COUNT(*) as cnt FROM likes WHERE postId=?`),
  isLiked:       db.prepare(`SELECT 1 FROM likes WHERE userId=? AND postId=?`),
  getLikesForPost: db.prepare(`SELECT userId FROM likes WHERE postId=?`),

  // Messages
  insertMsg:     db.prepare(`INSERT INTO messages (id,fromId,toId,content,isRead,createdAt) VALUES (?,?,?,?,0,?)`),
  getConversation: db.prepare(`
    SELECT * FROM messages
    WHERE (fromId=? AND toId=?) OR (fromId=? AND toId=?)
    ORDER BY createdAt ASC
  `),
  getInbox:      db.prepare(`
    SELECT DISTINCT
      CASE WHEN fromId=? THEN toId ELSE fromId END as partnerId,
      MAX(createdAt) as lastAt
    FROM messages
    WHERE fromId=? OR toId=?
    GROUP BY partnerId
    ORDER BY lastAt DESC
  `),
  markRead:      db.prepare(`UPDATE messages SET isRead=1 WHERE fromId=? AND toId=? AND isRead=0`),
  unreadCount:   db.prepare(`SELECT COUNT(*) as cnt FROM messages WHERE toId=? AND isRead=0`),
  getUnreadFrom: db.prepare(`SELECT COUNT(*) as cnt FROM messages WHERE toId=? AND fromId=? AND isRead=0`),
};

// ─── Helpers ──────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function uid()    { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function safeUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  rest.followers = stmts.getFollowers.all(u.id).map(r => r.id);
  rest.following = stmts.getFollowing.all(u.id).map(r => r.id);
  return rest;
}

function enrichPost(post, userId) {
  const author    = db.prepare('SELECT * FROM users WHERE id=?').get(post.authorId);
  const likes     = stmts.getLikesForPost.all(post.id).map(r => r.userId);
  const likeCount = likes.length;
  const liked     = userId ? likes.includes(userId) : false;

  return {
    ...post,
    likes,
    likeCount,
    liked,
    author: author ? {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      emoji: author.emoji,
      color: author.color,
    } : null,
  };
}

// ─── Middleware ───────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ success:false, message:'Нет токена' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success:false, message:'Токен недействителен' });
  }
}

// ════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, displayName, emoji, color } = req.body;

    if (!username?.trim() || !password || !displayName?.trim() || !emoji) {
      return res.status(400).json({ success:false, message:'Заполните все поля' });
    }

    const clean = username.trim().toLowerCase();

    if (clean.length < 3 || clean.length > 20)
      return res.status(400).json({ success:false, message:'Логин: 3–20 символов' });
    if (!/^[a-z0-9_]+$/.test(clean))
      return res.status(400).json({ success:false, message:'Логин: только a-z, 0-9, _' });
    if (password.length < 6)
      return res.status(400).json({ success:false, message:'Пароль: минимум 6 символов' });
    if (displayName.trim().length < 2)
      return res.status(400).json({ success:false, message:'Имя: минимум 2 символа' });

    if (stmts.getUserByName.get(clean))
      return res.status(409).json({ success:false, message:'Логин уже занят' });

    const hash = await bcrypt.hash(password, 10);
    const id   = uid();

    stmts.insertUser.run(id, clean, hash, displayName.trim(), emoji, color||'#6C63FF', '', nowISO());

    const user  = stmts.getUserById.get(id);
    const token = jwt.sign({ id, username: clean }, JWT_SECRET, { expiresIn:'90d' });

    res.status(201).json({ success:true, data:{ token, user: safeUser(user) } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Ошибка сервера' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success:false, message:'Введите логин и пароль' });

    const user = stmts.getUserByName.get(username.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ success:false, message:'Неверный логин или пароль' });

    const token = jwt.sign({ id:user.id, username:user.username }, JWT_SECRET, { expiresIn:'90d' });
    res.json({ success:true, data:{ token, user: safeUser(user) } });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message:'Ошибка сервера' });
  }
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = stmts.getUserById.get(req.user.id);
  if (!user) return res.status(404).json({ success:false, message:'Не найден' });
  res.json({ success:true, data: safeUser(user) });
});

// ════════════════════════════════════════════════════════
//  USERS
// ════════════════════════════════════════════════════════

app.get('/api/users', auth, (req, res) => {
  const all = stmts.getAllUsers.all()
    .filter(u => u.id !== req.user.id)
    .map(safeUser);
  res.json({ success:true, data: all });
});

app.get('/api/users/:id', auth, (req, res) => {
  const user = stmts.getUserById.get(req.params.id);
  if (!user) return res.status(404).json({ success:false, message:'Не найден' });
  res.json({ success:true, data: safeUser(user) });
});

// Update own profile
app.patch('/api/users/me', auth, (req, res) => {
  const { displayName, emoji, color, bio } = req.body;
  const user = stmts.getUserById.get(req.user.id);
  if (!user) return res.status(404).json({ success:false, message:'Не найден' });

  const newName  = (displayName?.trim() || user.displayName).slice(0, 40);
  const newEmoji = emoji || user.emoji;
  const newColor = color || user.color;
  const newBio   = (bio ?? user.bio).slice(0, 200);

  stmts.updateProfile.run(newName, newEmoji, newColor, newBio, req.user.id);
  const updated = stmts.getUserById.get(req.user.id);
  res.json({ success:true, data: safeUser(updated) });
});

// Follow / unfollow
app.patch('/api/users/me/follow/:id', auth, (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ success:false, message:'Нельзя подписаться на себя' });

  const target = stmts.getUserById.get(req.params.id);
  if (!target) return res.status(404).json({ success:false, message:'Не найден' });

  const already = stmts.isFollowing.get(req.user.id, req.params.id);
  if (already) {
    stmts.deleteFollow.run(req.user.id, req.params.id);
  } else {
    stmts.insertFollow.run(req.user.id, req.params.id, nowISO());
  }

  const followersCount = stmts.getFollowers.all(req.params.id).length;
  res.json({ success:true, data:{ following: !already, followersCount } });
});

// ════════════════════════════════════════════════════════
//  POSTS
// ════════════════════════════════════════════════════════

app.get('/api/posts', auth, (req, res) => {
  const all = stmts.getAllPosts.all().map(p => enrichPost(p, req.user.id));
  res.json({ success:true, data: all });
});

app.get('/api/posts/user/:id', auth, (req, res) => {
  const posts = stmts.getPostsByUser.all(req.params.id)
    .map(p => enrichPost(p, req.user.id));
  res.json({ success:true, data: posts });
});

app.post('/api/posts', auth, (req, res) => {
  const { content } = req.body;
  if (!content?.trim())
    return res.status(400).json({ success:false, message:'Пост не может быть пустым' });
  if (content.trim().length > 1000)
    return res.status(400).json({ success:false, message:'Максимум 1000 символов' });

  const id = uid();
  stmts.insertPost.run(id, req.user.id, content.trim(), nowISO());
  const post = stmts.getPostById.get(id);
  res.status(201).json({ success:true, data: enrichPost(post, req.user.id) });
});

app.patch('/api/posts/:id/like', auth, (req, res) => {
  const post = stmts.getPostById.get(req.params.id);
  if (!post) return res.status(404).json({ success:false, message:'Пост не найден' });

  const already = stmts.isLiked.get(req.user.id, req.params.id);
  if (already) {
    stmts.deleteLike.run(req.user.id, req.params.id);
  } else {
    stmts.insertLike.run(req.user.id, req.params.id);
  }

  const likeCount = stmts.getLikeCount.get(req.params.id).cnt;
  res.json({ success:true, data:{ liked: !already, likesCount: likeCount } });
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const post = stmts.getPostById.get(req.params.id);
  if (!post) return res.status(404).json({ success:false, message:'Не найден' });
  if (post.authorId !== req.user.id)
    return res.status(403).json({ success:false, message:'Нет прав' });

  stmts.deletePost.run(req.params.id, req.user.id);
  res.json({ success:true });
});

// ════════════════════════════════════════════════════════
//  MESSAGES
// ════════════════════════════════════════════════════════

// GET /api/messages/inbox — список диалогов
app.get('/api/messages/inbox', auth, (req, res) => {
  const myId = req.user.id;
  const rows = stmts.getInbox.all(myId, myId, myId);

  const dialogs = rows.map(row => {
    const partner = stmts.getUserById.get(row.partnerId);
    const unread  = stmts.getUnreadFrom.get(myId, row.partnerId).cnt;
    return {
      partner:   partner ? safeUser(partner) : null,
      lastAt:    row.lastAt,
      unread,
    };
  }).filter(d => d.partner);

  res.json({ success:true, data: dialogs });
});

// GET /api/messages/:userId — история с конкретным пользователем
app.get('/api/messages/:userId', auth, (req, res) => {
  const myId      = req.user.id;
  const partnerId = req.params.userId;

  // mark as read
  stmts.markRead.run(partnerId, myId);

  const msgs = stmts.getConversation.all(myId, partnerId, partnerId, myId);
  res.json({ success:true, data: msgs });
});

// POST /api/messages/:userId — отправить сообщение
app.post('/api/messages/:userId', auth, (req, res) => {
  const { content } = req.body;
  const myId      = req.user.id;
  const partnerId = req.params.userId;

  if (!content?.trim())
    return res.status(400).json({ success:false, message:'Пустое сообщение' });
  if (content.trim().length > 2000)
    return res.status(400).json({ success:false, message:'Слишком длинное' });
  if (myId === partnerId)
    return res.status(400).json({ success:false, message:'Нельзя писать себе' });

  const target = stmts.getUserById.get(partnerId);
  if (!target) return res.status(404).json({ success:false, message:'Пользователь не найден' });

  const id = uid();
  stmts.insertMsg.run(id, myId, partnerId, content.trim(), nowISO());

  res.status(201).json({ success:true, data:{
    id, fromId: myId, toId: partnerId,
    content: content.trim(), isRead: 0, createdAt: nowISO()
  }});
});

// GET /api/messages/unread/count
app.get('/api/messages/unread/count', auth, (req, res) => {
  const cnt = stmts.unreadCount.get(req.user.id).cnt;
  res.json({ success:true, data:{ count: cnt } });
});

// Fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
