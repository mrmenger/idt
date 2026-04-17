'use strict';

const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'itd_super_secret_key_2024';

// ─── File paths ───────────────────────────────────────────────────
const USERS_FILE = path.join(__dirname, 'users.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── File helpers ─────────────────────────────────────────────────
function readJSON(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.error(`Error reading ${file}:`, e.message);
  }
  return [];
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing ${file}:`, e.message);
  }
}

// ─── In-memory stores ─────────────────────────────────────────────
let users = readJSON(USERS_FILE);
let posts = readJSON(POSTS_FILE);

// ─── Auth middleware ──────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Нет токена' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Токен недействителен' });
  }
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { username, password, displayName, emoji, color } = req.body;

  // Validation
  if (!username || !password || !displayName || !emoji) {
    return res.status(400).json({
      success: false,
      message: 'Заполните все обязательные поля'
    });
  }

  const cleanUsername = username.trim().toLowerCase();

  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Логин: от 3 до 20 символов'
    });
  }

  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({
      success: false,
      message: 'Логин: только латинские буквы, цифры и _'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Пароль: минимум 6 символов'
    });
  }

  if (displayName.trim().length < 2 || displayName.trim().length > 40) {
    return res.status(400).json({
      success: false,
      message: 'Имя: от 2 до 40 символов'
    });
  }

  // Check duplicate
  if (users.find(u => u.username === cleanUsername)) {
    return res.status(409).json({
      success: false,
      message: 'Такой логин уже занят'
    });
  }

  // Hash password
  const hash = await bcrypt.hash(password, 10);

  const newUser = {
    id:          Date.now().toString(),
    username:    cleanUsername,
    password:    hash,
    displayName: displayName.trim(),
    emoji:       emoji,
    color:       color || '#6C63FF',
    bio:         '',
    followers:   [],
    following:   [],
    createdAt:   new Date().toISOString(),
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);

  // Issue token
  const token = jwt.sign(
    { id: newUser.id, username: newUser.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  const { password: _, ...safeUser } = newUser;

  res.status(201).json({
    success: true,
    data:  { token, user: safeUser }
  });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Введите логин и пароль'
    });
  }

  const user = users.find(u => u.username === username.trim().toLowerCase());

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Неверный логин или пароль'
    });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'Неверный логин или пароль'
    });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  const { password: _, ...safeUser } = user;

  res.json({
    success: true,
    data:  { token, user: safeUser }
  });
});

// GET /api/auth/me
app.get('/api/auth/me', auth, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Пользователь не найден' });
  }
  const { password: _, ...safeUser } = user;
  res.json({ success: true, data: safeUser });
});

// ═══════════════════════════════════════════════════════════════════
//  POSTS ROUTES
// ═══════════════════════════════════════════════════════════════════

// GET /api/posts
app.get('/api/posts', auth, (req, res) => {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  // Attach author info
  const enriched = sorted.map(p => {
    const author = users.find(u => u.id === p.authorId);
    return {
      ...p,
      author: author
        ? {
            id:          author.id,
            username:    author.username,
            displayName: author.displayName,
            emoji:       author.emoji,
            color:       author.color,
          }
        : null,
    };
  });

  res.json({ success: true, data: enriched, total: enriched.length });
});

// POST /api/posts
app.post('/api/posts', auth, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Текст поста не может быть пустым'
    });
  }

  if (content.trim().length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Максимум 1000 символов'
    });
  }

  const author = users.find(u => u.id === req.user.id);

  const newPost = {
    id:        Date.now().toString(),
    authorId:  req.user.id,
    content:   content.trim(),
    likes:     [],
    comments:  [],
    createdAt: new Date().toISOString(),
  };

  posts.unshift(newPost);
  writeJSON(POSTS_FILE, posts);

  res.status(201).json({
    success: true,
    data: {
      ...newPost,
      author: author
        ? {
            id:          author.id,
            username:    author.username,
            displayName: author.displayName,
            emoji:       author.emoji,
            color:       author.color,
          }
        : null,
    }
  });
});

// PATCH /api/posts/:id/like
app.patch('/api/posts/:id/like', auth, (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, message: 'Пост не найден' });
  }

  const uid = req.user.id;
  const idx = post.likes.indexOf(uid);

  if (idx === -1) {
    post.likes.push(uid);
  } else {
    post.likes.splice(idx, 1);
  }

  writeJSON(POSTS_FILE, posts);

  res.json({
    success: true,
    data: {
      liked: idx === -1,
      likesCount: post.likes.length,
    }
  });
});

// DELETE /api/posts/:id
app.delete('/api/posts/:id', auth, (req, res) => {
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Пост не найден' });
  }

  if (posts[idx].authorId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Нет прав' });
  }

  posts.splice(idx, 1);
  writeJSON(POSTS_FILE, posts);

  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
//  USERS ROUTES
// ═══════════════════════════════════════════════════════════════════

// GET /api/users — все пользователи (без паролей)
app.get('/api/users', auth, (req, res) => {
  const safe = users
    .filter(u => u.id !== req.user.id)
    .map(({ password: _, ...u }) => u);
  res.json({ success: true, data: safe });
});

// GET /api/users/:id
app.get('/api/users/:id', auth, (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Пользователь не найден' });
  }
  const { password: _, ...safe } = user;
  res.json({ success: true, data: safe });
});

// PATCH /api/users/me/follow/:id — подписка / отписка
app.patch('/api/users/me/follow/:id', auth, (req, res) => {
  const me     = users.find(u => u.id === req.user.id);
  const target = users.find(u => u.id === req.params.id);

  if (!target) {
    return res.status(404).json({ success: false, message: 'Пользователь не найден' });
  }
  if (me.id === target.id) {
    return res.status(400).json({ success: false, message: 'Нельзя подписаться на себя' });
  }

  const already = me.following.includes(target.id);

  if (already) {
    me.following      = me.following.filter(id => id !== target.id);
    target.followers  = target.followers.filter(id => id !== me.id);
  } else {
    me.following.push(target.id);
    target.followers.push(me.id);
  }

  writeJSON(USERS_FILE, users);

  res.json({
    success: true,
    data: { following: !already, followersCount: target.followers.length }
  });
});

// Fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server → http://localhost:${PORT}`);
});
