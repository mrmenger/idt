/* ═══════════════════════════════════════════════════════
   итд. — Vanilla JS Client
═══════════════════════════════════════════════════════ */
'use strict';

// ─── Constants ────────────────────────────────────────
const API   = '/api';
const TOKEN_KEY = 'itd_token';
const USER_KEY  = 'itd_user';

// ─── Emoji sets ───────────────────────────────────────
const AVATAR_EMOJIS = [
  '😀','😄','😁','😎','🤩','😍','🥳','😇',
  '🤔','🧐','🥸','😏','😌','🤗','😴','🤓',
  '👻','🤖','👽','🐼','🐨','🦊','🐯','🦁',
  '🐸','🐧','🦉','🦋','🌞','⚡','🔥','🌈',
  '🎭','🎩','🎸','🚀','💎','🍀','🌸','🍕',
  '🦄','🐲','🌊','🌙','⭐','🍭','🎯','💫',
];

const TOOLBAR_EMOJIS = ['💡','🚀','❤️','✨','😂','🔥','💯','👀','🎉','💬'];

const AVATAR_COLORS = [
  '#6C63FF','#FF6584','#43B89C',
  '#F7B731','#FC5C65','#45AAF2',
  '#A29BFE','#FD79A8','#00B894',
];

// ─── State ────────────────────────────────────────────
const state = {
  token:         null,
  user:          null,
  posts:         [],
  users:         [],
  currentPage:   'feed',
  selectedEmoji: '😀',
  selectedColor: AVATAR_COLORS[0],
};

// ─── DOM shortcuts ────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ─── Persisted session ────────────────────────────────
function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  state.token = token;
  state.user  = user;
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  state.token = null;
  state.user  = null;
}

function loadSession() {
  const t = localStorage.getItem(TOKEN_KEY);
  const u = localStorage.getItem(USER_KEY);
  if (t && u) {
    try {
      state.token = t;
      state.user  = JSON.parse(u);
      return true;
    } catch { return false; }
  }
  return false;
}

// ─── API helper ───────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (state.token) {
    opts.headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + path, opts);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

// ─── Utils ────────────────────────────────────────────
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)      return 'только что';
  if (s < 3600)    return `${Math.floor(s / 60)} мин. назад`;
  if (s < 86400)   return `${Math.floor(s / 3600)} ч. назад`;
  if (s < 604800)  return `${Math.floor(s / 86400)} дн. назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
}

function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0','') + 'k' : String(n || 0);
}

// ─── Toast ────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3000) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  $('toastContainer').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, ms);
}

// ═══════════════════════════════════════════════════════
//  AUTH UI
// ═══════════════════════════════════════════════════════

// Show auth / app
function showAuth()  {
  $('authScreen').classList.remove('hidden');
  $('appScreen').classList.add('hidden');
}
function showApp()   {
  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
}

// Switch panels
$('toRegister').onclick = () => {
  $('loginPanel').classList.add('hidden');
  $('registerPanel').classList.remove('hidden');
};
$('toLogin').onclick = () => {
  $('registerPanel').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
};

// ─── Build emoji grid ─────────────────────────────────
(function buildEmojiGrid() {
  const grid = $('emojiGrid');
  AVATAR_EMOJIS.forEach((em, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn' + (i === 0 ? ' selected' : '');
    btn.textContent = em;
    btn.title = em;
    btn.addEventListener('click', () => {
      $$('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedEmoji = em;
      $('previewAvatar').textContent = em;
      $('regPreviewAv').textContent  = em;
    });
    grid.appendChild(btn);
  });
})();

// ─── Build color swatches ─────────────────────────────
(function buildColorSwatches() {
  const wrap = $('avatarColorSwatches');
  AVATAR_COLORS.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch' + (i === 0 ? ' active' : '');
    btn.style.background = c;
    btn.dataset.color = c;
    btn.title = c;
    btn.addEventListener('click', () => {
      $$('.color-swatch').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      state.selectedColor = c;
      $('previewAvatar').style.background = c;
      $('regPreviewAv').style.background  = c;
    });
    wrap.appendChild(btn);
  });

  // Set initial bg
  $('previewAvatar').style.background = AVATAR_COLORS[0];
  $('regPreviewAv').style.background  = AVATAR_COLORS[0];
})();

// ─── Step navigation ──────────────────────────────────
$('step1Next').onclick = () => {
  $('regStep1').classList.add('hidden');
  $('regStep2').classList.remove('hidden');
  $('regName').focus();
};

$('backToStep1').onclick = () => {
  $('regStep2').classList.add('hidden');
  $('regStep1').classList.remove('hidden');
};

// ─── Password strength ────────────────────────────────
$('regPassword').addEventListener('input', () => {
  const val = $('regPassword').value;
  const bar = $('pwStrengthBar');
  const lbl = $('pwStrengthLabel');

  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const levels = [
    { pct: '0%',   color: 'transparent', label: '' },
    { pct: '25%',  color: '#FC5C65',     label: '😬 Слабый' },
    { pct: '50%',  color: '#F7B731',     label: '🤔 Средний' },
    { pct: '75%',  color: '#45AAF2',     label: '👍 Хороший' },
    { pct: '100%', color: '#34C77B',     label: '💪 Сильный' },
  ];

  const lvl = levels[Math.min(score, 4)];
  bar.style.width      = lvl.pct;
  bar.style.background = lvl.color;
  lbl.textContent      = lvl.label;
});

// ─── LOGIN ────────────────────────────────────────────
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;

  // clear errors
  $('loginError').textContent = '';

  if (!username) { $('loginUsernameErr').textContent = 'Введите логин'; return; }
  else $('loginUsernameErr').textContent = '';

  if (!password) { $('loginPasswordErr').textContent = 'Введите пароль'; return; }
  else $('loginPasswordErr').textContent = '';

  setLoading('login', true);

  try {
    const { data } = await api('POST', '/auth/login', { username, password });
    saveSession(data.token, data.user);
    await bootApp();
  } catch (err) {
    $('loginError').textContent = err.message;
  } finally {
    setLoading('login', false);
  }
});

// ─── REGISTER ─────────────────────────────────────────
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();

  const displayName = $('regName').value.trim();
  const username    = $('regUsername').value.trim();
  const password    = $('regPassword').value;
  const emoji       = state.selectedEmoji;
  const color       = state.selectedColor;

  $('registerError').textContent = '';
  $('regNameErr').textContent     = '';
  $('regUsernameErr').textContent = '';
  $('regPasswordErr').textContent = '';

  let valid = true;
  if (!displayName) { $('regNameErr').textContent = 'Введите имя'; valid = false; }
  if (!username)    { $('regUsernameErr').textContent = 'Введите логин'; valid = false; }
  if (password.length < 6) { $('regPasswordErr').textContent = 'Минимум 6 символов'; valid = false; }
  if (!valid) return;

  setLoading('register', true);

  try {
    const { data } = await api('POST', '/auth/register', {
      displayName, username, password, emoji, color
    });
    saveSession(data.token, data.user);
    await bootApp();
    toast('Добро пожаловать! 🎉', 'success');
  } catch (err) {
    $('registerError').textContent = err.message;
  } finally {
    setLoading('register', false);
  }
});

// Loading state helpers
function setLoading(form, on) {
  if (form === 'login') {
    $('loginBtn').disabled         = on;
    $('loginBtnText').textContent  = on ? 'Входим...' : 'Войти';
    $('loginSpinner').classList.toggle('hidden', !on);
  }
  if (form === 'register') {
    $('registerBtn').disabled           = on;
    $('registerBtnText').textContent    = on ? 'Создаём...' : 'Создать аккаунт';
    $('registerSpinner').classList.toggle('hidden', !on);
  }
}

// Password visibility toggle
document.addEventListener('click', e => {
  const btn = e.target.closest('.pw-toggle');
  if (!btn) return;
  const inp = $(btn.dataset.target);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.querySelector('.pw-toggle__icon').textContent =
    inp.type === 'password' ? '👁' : '🙈';
});

// ═══════════════════════════════════════════════════════
//  APP BOOT
// ═══════════════════════════════════════════════════════
async function bootApp() {
  showApp();
  updateHeaderUI();
  await Promise.all([loadPosts(), loadUsers()]);
  renderFeed();
  renderPeople();
  updateSidebarStats();
}

function updateHeaderUI() {
  const u = state.user;
  if (!u) return;

  // Header avatar
  $('headerAvatar').textContent = u.emoji;
  $('headerAvatar').style.background = u.color;

  // Dropdown
  $('menuDisplayName').textContent = u.displayName;
  $('menuHandle').textContent      = '@' + u.username;

  // Sidebar profile
  $('sideAvatar').textContent = u.emoji;
  $('sideAvatar').style.background = u.color;
  $('sideName').textContent   = u.displayName;
  $('sideHandle').textContent = '@' + u.username;

  // Quick compose avatar
  $('quickAvatar').textContent = u.emoji;
  $('quickAvatar').style.background = u.color;

  // Modal avatar
  $('modalAvatar').textContent = u.emoji;
  $('modalAvatar').style.background = u.color;
  $('modalName').textContent   = u.displayName;
  $('modalHandle').textContent = '@' + u.username;
}

// ─── LOGOUT ───────────────────────────────────────────
$('logoutBtn').onclick = () => {
  clearSession();
  state.posts = [];
  state.users = [];
  $('postsList').innerHTML = '';
  $('peopleList').innerHTML = '';
  $('userMenuDropdown').classList.remove('open');
  showAuth();
  $('loginPanel').classList.remove('hidden');
  $('registerPanel').classList.add('hidden');
  $('loginForm').reset();
  toast('Вы вышли из аккаунта', 'info');
};

// ═══════════════════════════════════════════════════════
//  POSTS
// ═══════════════════════════════════════════════════════
async function loadPosts() {
  try {
    const { data } = await api('GET', '/posts');
    state.posts = data;
  } catch (err) {
    console.error(err);
    toast('Не удалось загрузить посты', 'error');
  }
}

function renderFeed() {
  $('skeletons').classList.add('hidden');
  const list = $('postsList');
  list.innerHTML = '';

  if (state.posts.length === 0) {
    $('feedEmpty').classList.remove('hidden');
    return;
  }
  $('feedEmpty').classList.add('hidden');

  state.posts.forEach(p => list.appendChild(buildPostCard(p)));
  updateSidebarStats();
}

function buildPostCard(post) {
  const isOwn = post.authorId === state.user?.id;
  const liked = post.likes?.includes(state.user?.id);
  const likeCount = post.likes?.length || 0;

  const a = post.author || {};

  const art = document.createElement('article');
  art.className = 'post-card';
  art.dataset.id = post.id;

  art.innerHTML = `
    <div class="post-card__head">
      <div class="post-card__author">
        <div class="post-card__avatar"
             style="background:${esc(a.color||'#6C63FF')};border-color:${esc(a.color||'#6C63FF')}">
          ${esc(a.emoji||'👤')}
        </div>
        <div class="post-card__info">
          <span class="post-card__name">${esc(a.displayName||'Аноним')}</span>
          <div class="post-card__meta">
            <span class="post-card__handle">@${esc(a.username||'?')}</span>
            <span class="post-card__sep">·</span>
            <time class="post-card__date" datetime="${post.createdAt}">
              ${relTime(post.createdAt)}
            </time>
          </div>
        </div>
      </div>
      ${isOwn ? `<button class="post-card__del" data-del="${esc(post.id)}" title="Удалить">🗑</button>` : ''}
    </div>

    <div class="post-card__body">
      <p class="post-card__text">${esc(post.content)}</p>
    </div>

    <div class="post-card__foot">
      <button class="post-action post-action--like ${liked ? 'liked' : ''}"
              data-like="${esc(post.id)}" aria-label="Нравится">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
        <span class="like-n">${fmtNum(likeCount)}</span>
      </button>
    </div>
  `;

  return art;
}

// Delegated click handler on feed
$('postsList').addEventListener('click', async e => {

  // Like
  const likeBtn = e.target.closest('[data-like]');
  if (likeBtn) {
    const id = likeBtn.dataset.like;
    try {
      const { data } = await api('PATCH', `/posts/${id}/like`);
      // Update state
      const p = state.posts.find(x => x.id === id);
      if (p) {
        if (data.liked) {
          p.likes.push(state.user.id);
        } else {
          p.likes = p.likes.filter(uid => uid !== state.user.id);
        }
      }
      // Update UI without full re-render
      likeBtn.classList.toggle('liked', data.liked);
      likeBtn.querySelector('svg').setAttribute('fill', data.liked ? 'currentColor' : 'none');
      likeBtn.querySelector('.like-n').textContent = fmtNum(data.likesCount);

      likeBtn.classList.add('pop');
      likeBtn.addEventListener('animationend', () => likeBtn.classList.remove('pop'), { once: true });

      updateSidebarStats();
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }

  // Delete
  const delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    if (!confirm('Удалить этот пост?')) return;
    const id = delBtn.dataset.del;
    try {
      await api('DELETE', `/posts/${id}`);
      state.posts = state.posts.filter(p => p.id !== id);
      const card = $('postsList').querySelector(`[data-id="${id}"]`);
      if (card) {
        card.style.transition = 'opacity .3s, transform .3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(.97)';
        setTimeout(() => { card.remove(); updateSidebarStats(); }, 300);
      }
      if (state.posts.length === 0) $('feedEmpty').classList.remove('hidden');
    } catch (err) {
      toast(err.message, 'error');
    }
  }
});

// ─── Sidebar stats ────────────────────────────────────
function updateSidebarStats() {
  const myPosts  = state.posts.filter(p => p.authorId === state.user?.id);
  const myLikes  = myPosts.reduce((s, p) => s + (p.likes?.length || 0), 0);
  const follLen  = state.user?.followers?.length || 0;

  // Left sidebar
  $('sidePostCount').textContent = myPosts.length;
  $('sideFollowers').textContent = follLen;
  $('sideFollowing').textContent = state.user?.following?.length || 0;

  // Right sidebar
  $('myPostCount').textContent  = myPosts.length;
  $('myLikesCount').textContent = fmtNum(myLikes);
  $('myFollowers').textContent  = follLen;
}

// ═══════════════════════════════════════════════════════
//  POST MODAL
// ═══════════════════════════════════════════════════════

// Build emoji toolbar
(function buildToolbar() {
  const bar = $('emojiToolbar');
  TOOLBAR_EMOJIS.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toolbar-emoji';
    btn.textContent = em;
    btn.title = 'Вставить ' + em;
    btn.addEventListener('click', () => insertAtCursor($('postTextarea'), em));
    bar.appendChild(btn);
  });
})();

function insertAtCursor(el, text) {
  const s = el.selectionStart;
  const e = el.selectionEnd;
  el.value = el.value.slice(0, s) + text + el.value.slice(e);
  el.selectionStart = el.selectionEnd = s + text.length;
  el.dispatchEvent(new Event('input'));
  el.focus();
}

function openPostModal() {
  $('postModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('postTextarea').focus(), 200);
}

function closePostModal() {
  $('postModal').classList.add('hidden');
  document.body.style.overflow = '';
  $('postTextarea').value = '';
  $('charCount').textContent = '0';
  $('charCount').parentElement.className = 'char-counter';
  $('publishBtn').disabled = true;
  $('postError').textContent = '';
}

// Open triggers
['headerPostBtn','sidePostBtn','quickTrigger','emptyPostBtn']
  .forEach(id => { const el = $(id); if (el) el.onclick = openPostModal; });

// Close triggers
$('closePostModal').onclick = closePostModal;
$('cancelPostBtn').onclick  = closePostModal;
$('postModal').addEventListener('click', e => {
  if (e.target === $('postModal')) closePostModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('postModal').classList.contains('hidden')) {
    closePostModal();
  }
});

// Textarea input
$('postTextarea').addEventListener('input', () => {
  const len = $('postTextarea').value.length;
  const cc  = $('charCount');
  cc.textContent = len;
  const wrap = cc.parentElement;
  wrap.className = 'char-counter';
  if (len > 800) wrap.classList.add('warn');
  if (len > 950) wrap.classList.add('danger');
  $('publishBtn').disabled = len === 0 || len > 1000;
  $('postError').textContent = '';
});

// Ctrl+Enter
$('postTextarea').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('publishBtn').disabled) {
    e.preventDefault();
    submitPost();
  }
});

$('publishBtn').onclick = submitPost;

async function submitPost() {
  const content = $('postTextarea').value.trim();
  if (!content) return;

  $('publishBtn').disabled        = true;
  $('publishBtnText').textContent  = 'Публикуем...';
  $('publishSpinner').classList.remove('hidden');
  $('postError').textContent       = '';

  try {
    const { data } = await api('POST', '/posts', { content });
    state.posts.unshift(data);

    $('feedEmpty').classList.add('hidden');
    const card = buildPostCard(data);
    $('postsList').prepend(card);
    updateSidebarStats();

    closePostModal();
    toast('Пост опубликован! 🎉', 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    $('postError').textContent = err.message;
    $('publishBtn').disabled   = false;
  } finally {
    $('publishBtnText').textContent = 'Опубликовать';
    $('publishSpinner').classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════════════
//  PEOPLE
// ═══════════════════════════════════════════════════════
async function loadUsers() {
  try {
    const { data } = await api('GET', '/users');
    state.users = data;
  } catch (err) {
    console.error(err);
  }
}

function renderPeople(filter = '') {
  const list = $('peopleList');
  list.innerHTML = '';

  const filtered = state.users.filter(u =>
    u.displayName.toLowerCase().includes(filter.toLowerCase()) ||
    u.username.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    $('peopleEmpty').classList.remove('hidden');
    return;
  }
  $('peopleEmpty').classList.add('hidden');

  filtered.forEach(u => list.appendChild(buildPersonCard(u)));
}

function buildPersonCard(u) {
  const isFollowing = state.user?.following?.includes(u.id);
  const postCount   = state.posts.filter(p => p.authorId === u.id).length;

  const div = document.createElement('div');
  div.className = 'person-card';
  div.dataset.userId = u.id;

  div.innerHTML = `
    <div class="person-card__avatar"
         style="background:${esc(u.color||'#6C63FF')};border-color:${esc(u.color||'#6C63FF')};">
      ${esc(u.emoji||'👤')}
    </div>
    <div class="person-card__info">
      <div class="person-card__name">${esc(u.displayName)}</div>
      <div class="person-card__handle">@${esc(u.username)}</div>
      <div class="person-card__stats">
        ${postCount} постов · ${u.followers?.length||0} читателей
      </div>
    </div>
    <button class="btn btn--outline ${isFollowing ? 'following' : ''}"
            data-follow="${esc(u.id)}">
      ${isFollowing ? 'Читаю' : '+ Читать'}
    </button>
  `;

  return div;
}

// Follow / unfollow delegation
$('peopleList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-follow]');
  if (!btn) return;

  const targetId = btn.dataset.follow;
  try {
    const { data } = await api('PATCH', `/users/me/follow/${targetId}`);

    // Sync local user
    if (data.following) {
      if (!state.user.following.includes(targetId)) {
        state.user.following.push(targetId);
      }
    } else {
      state.user.following = state.user.following.filter(id => id !== targetId);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(state.user));

    // Sync target in state.users
    const tu = state.users.find(u => u.id === targetId);
    if (tu) {
      if (data.following) {
        if (!tu.followers.includes(state.user.id)) tu.followers.push(state.user.id);
      } else {
        tu.followers = tu.followers.filter(id => id !== state.user.id);
      }
    }

    // Update button inline
    btn.classList.toggle('following', data.following);
    btn.textContent = data.following ? 'Читаю' : '+ Читать';

    // Update followers count in card
    const card = btn.closest('.person-card');
    const statsEl = card?.querySelector('.person-card__stats');
    if (statsEl && tu) {
      const pc = state.posts.filter(p => p.authorId === tu.id).length;
      statsEl.textContent = `${pc} постов · ${tu.followers.length} читателей`;
    }

    updateSidebarStats();
    toast(data.following ? `Вы подписались на @${tu?.username}` : `Отписались от @${tu?.username}`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

// People search
$('peopleSearch').addEventListener('input', e => {
  renderPeople(e.target.value);
});

// ═══════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════
function switchPage(page) {
  state.currentPage = page;

  // Feed / People pages
  $('feedPage').classList.toggle('hidden',   page !== 'feed');
  $('peoplePage').classList.toggle('hidden', page !== 'people');

  // Header nav active
  $$('.nav__link').forEach(l => {
    l.classList.toggle('nav__link--active', l.dataset.page === page);
  });

  // Sidebar nav active
  $$('.side-nav__item').forEach(l => {
    l.classList.toggle('side-nav__item--active', l.dataset.page === page);
  });

  if (page === 'people') {
    $('peopleSearch').value = '';
    renderPeople();
  }
}

// Nav click delegation
document.addEventListener('click', e => {
  const link = e.target.closest('[data-page]');
  if (!link) return;

  // Only nav links and side-nav items
  if (
    link.classList.contains('nav__link') ||
    link.classList.contains('side-nav__item')
  ) {
    e.preventDefault();
    switchPage(link.dataset.page);
  }
});

$('goHome').onclick = e => { e.preventDefault(); switchPage('feed'); };

// ═══════════════════════════════════════════════════════
//  HEADER USER MENU
// ═══════════════════════════════════════════════════════
$('userMenuTrigger').addEventListener('click', e => {
  e.stopPropagation();
  $('userMenuDropdown').classList.toggle('open');
});

document.addEventListener('click', e => {
  if (!e.target.closest('#userMenu')) {
    $('userMenuDropdown').classList.remove('open');
  }
});

// ═══════════════════════════════════════════════════════
//  SCROLL
// ═══════════════════════════════════════════════════════
window.addEventListener('scroll', () => {
  $('header').classList.toggle('scrolled', window.scrollY > 10);
  $('scrollTop').classList.toggle('hidden', window.scrollY < 400);

  // Refresh relative dates
  $$('.post-card__date').forEach(el => {
    el.textContent = relTime(el.getAttribute('datetime'));
  });
}, { passive: true });

$('scrollTop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

// Auto-refresh dates every minute
setInterval(() => {
  $$('.post-card__date').forEach(el => {
    el.textContent = relTime(el.getAttribute('datetime'));
  });
}, 60_000);

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
(async function init() {
  if (loadSession()) {
    try {
      // Verify token is still valid
      const { data } = await api('GET', '/auth/me');
      state.user = data;
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      await bootApp();
    } catch {
      clearSession();
      showAuth();
    }
  } else {
    showAuth();
  }
})();
