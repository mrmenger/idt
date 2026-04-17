const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'posts.json');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadPosts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading posts.json:', e.message);
  }
  return [];
}

function savePosts(posts) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing posts.json:', e.message);
  }
}

// ─── In-memory store (синхронизирован с файлом) ───────────────────────────────
let posts = loadPosts();

// ─── Seed данные, если файл пустой ────────────────────────────────────────────
if (posts.length === 0) {
  posts = [
    {
      id: '1',
      author: 'Алексей Громов',
      handle: '@alexgromov',
      avatar: 'АГ',
      avatarColor: '#6C63FF',
      content: 'Привет всем! Рад быть здесь. Это моя первая запись в этой замечательной сети. Надеюсь на интересные знакомства и дискуссии 🚀',
      likes: 24,
      comments: 5,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      liked: false
    },
    {
      id: '2',
      author: 'Мария Светлова',
      handle: '@msveta',
      avatar: 'МС',
      avatarColor: '#FF6584',
      content: 'Только что вернулась с конференции по дизайну. Главный тренд этого года — минимализм и осознанное использование пространства. Белый фон — это не пустота, это воздух для мысли ✨',
      likes: 89,
      comments: 12,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      liked: false
    },
    {
      id: '3',
      author: 'Дмитрий Ко',
      handle: '@dmitko',
      avatar: 'ДК',
      avatarColor: '#43B89C',
      content: 'Интересное наблюдение: люди, которые читают каждый день, в среднем принимают более взвешенные решения. Читайте книги — это самая дешёвая инвестиция в себя.',
      likes: 156,
      comments: 31,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      liked: false
    }
  ];
  savePosts(posts);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/posts — получить все посты
app.get('/api/posts', (req, res) => {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ success: true, data: sorted, total: sorted.length });
});

// POST /api/posts — создать пост
app.post('/api/posts', (req, res) => {
  const { content, author, handle, avatar, avatarColor } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Текст поста не может быть пустым' });
  }
  if (content.trim().length > 1000) {
    return res.status(400).json({ success: false, message: 'Текст поста слишком длинный (макс. 1000 символов)' });
  }

  const newPost = {
    id: Date.now().toString(),
    author: author?.trim() || 'Аноним',
    handle: handle?.trim() || '@anonymous',
    avatar: avatar?.trim() || 'АН',
    avatarColor: avatarColor || '#6C63FF',
    content: content.trim(),
    likes: 0,
    comments: 0,
    createdAt: new Date().toISOString(),
    liked: false
  };

  posts.unshift(newPost);
  savePosts(posts);

  res.status(201).json({ success: true, data: newPost });
});

// PATCH /api/posts/:id/like — лайк/дизлайк
app.patch('/api/posts/:id/like', (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ success: false, message: 'Пост не найден' });
  }

  post.liked = !post.liked;
  post.likes = post.liked ? post.likes + 1 : Math.max(0, post.likes - 1);
  savePosts(posts);

  res.json({ success: true, data: { liked: post.liked, likes: post.likes } });
});

// DELETE /api/posts/:id — удалить пост
app.delete('/api/posts/:id', (req, res) => {
  const index = posts.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Пост не найден' });
  }

  posts.splice(index, 1);
  savePosts(posts);

  res.json({ success: true, message: 'Пост удалён' });
});

// Fallback — отдаём index.html для любого не-API маршрута
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});