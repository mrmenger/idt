/* ═══════════════════════════════════════════════════════════════════
   ИТОГО — Vanilla JS App
═══════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Config ───────────────────────────────────────────────────────
const API = '/api/posts';

// ─── State ────────────────────────────────────────────────────────
const state = {
  posts: [],
  currentTab: 'all',
  selectedColor: '#6C63FF',
  isLoading: false,
  isSubmitting: false,
};

// ─── DOM refs ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const Dom = {
  postsContainer:     $('postsContainer'),
  skeletonWrapper:    $('skeletonWrapper'),
  emptyState:         $('emptyState'),
  errorState:         $('errorState'),
  modalOverlay:       $('modalOverlay'),
  postTextarea:       $('postTextarea'),
  charCount:          $('charCount'),
  submitBtn:          $('submitBtn'),
  submitBtnText:      $('submitBtnText'),
  submitSpinner:      $('submitSpinner'),
  cancelBtn:          $('cancelBtn'),
  closeModalBtn:      $('closeModalBtn'),
  openModalBtn:       $('openModalBtn'),
  openModalBtnSide:   $('openModalBtnSide'),
  quickComposeTrigger:$('quickComposeTrigger'),
  emptyStateBtn:      $('emptyStateBtn'),
  retryBtn:           $('retryBtn'),
  inputName:          $('inputName'),
  inputHandle:        $('inputHandle'),
  formAvatar:         $('formAvatar'),
  colorPicker:        $('colorPicker'),
  modalHint:          $('modalHint'),
  toastContainer:     $('toastContainer'),
  header:             $('header'),
  scrollTopBtn:       $('scrollTopBtn'),
  statTotal:          $('statTotal'),
  statLikes:          $('statLikes'),
  feedTabs:           document.querySelectorAll('.feed-tab'),
};

// ─── Utils ────────────────────────────────────────────────────────

/**
 * Форматирует дату относительно текущего времени
 */
function formatDate(iso) {
  const date = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000); // секунды

  if (diff < 60)         return 'только что';
  if (diff < 3600)       return `${Math.floor(diff / 60)} мин. назад`;
  if (diff < 86400)      return `${Math.floor(diff / 3600)} ч. назад`;
  if (diff < 604800)     return `${Math.floor(diff / 86400)} дн. назад`;

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Экранирует HTML-символы
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Генерирует инициалы из имени
 */
function getInitials(name) {
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Форматирует число: 1234 → 1.2k
 */
function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

// ─── Toast ────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${escapeHtml(message)}</span>`;
  Dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

// ─── API ──────────────────────────────────────────────────────────
async function fetchPosts() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function createPost(payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return (await res.json()).data;
}

async function likePost(id) {
  const res = await fetch(`${API}/${id}/like`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function deletePost(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ─── Render ───────────────────────────────────────────────────────
function createPostCard(post, isNew = false) {
  const article = document.createElement('article');
  article.className = `post-card${isNew ? ' post-card--new' : ''}`;
  article.dataset.id = post.id;

  article.innerHTML = `
    <div class="post-card__header">
      <div class="post-card__author">
        <div class="post-card__avatar"
             style="background: ${escapeHtml(post.avatarColor || '#6C63FF')}">
          ${escapeHtml(getInitials(post.author))}
        </div>
        <div class="post-card__info">
          <span class="post-card__name">${escapeHtml(post.author)}</span>
          <div class="post-card__meta">
            <span class="post-card__handle">${escapeHtml(post.handle || '')}</span>
            <span class="post-card__sep">·</span>
            <time class="post-card__date" datetime="${post.createdAt}"
                  title="${new Date(post.createdAt).toLocaleString('ru-RU')}">
              ${formatDate(post.createdAt)}
            </time>
          </div>
        </div>
      </div>
      <button class="post-action post-card__menu-btn" aria-label="Опции">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/>
          <circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
    </div>

    <div class="post-card__body">
      <p class="post-card__content">${escapeHtml(post.content)}</p>
    </div>

    <div class="post-card__footer">
      <button class="post-action post-action--like ${post.liked ? 'liked' : ''}"
              aria-label="Нравится" data-action="like">
        <svg width="17" height="17" viewBox="0 0 24 24"
             fill="${post.liked ? 'currentColor' : 'none'}"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
        <span class="like-count">${formatCount(post.likes)}</span>
      </button>

      <button class="post-action post-action--comment"
              aria-label="Комментарии" data-action="comment">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <span>${formatCount(post.comments)}</span>
      </button>

      <button class="post-action post-action--share"
              aria-label="Поделиться" data-action="share">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        Поделиться
      </button>

      <button class="post-action post-action--delete"
              aria-label="Удалить пост" data-action="delete">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `;

  // Remove "new" highlight after animation
  if (isNew) {
    setTimeout(() => article.classList.remove('post-card--new'), 2000);
  }

  return article;
}

function renderPosts(posts) {
  Dom.postsContainer.innerHTML = '';

  if (!posts || posts.length === 0) {
    Dom.emptyState.classList.remove('hidden');
    return;
  }

  Dom.emptyState.classList.add('hidden');
  posts.forEach(post => {
    Dom.postsContainer.appendChild(createPostCard(post));
  });
}

function updateStats(posts) {
  if (!posts) return;
  Dom.statTotal.textContent = posts.length;
  Dom.statLikes.textContent = formatCount(
    posts.reduce((sum, p) => sum + (p.likes || 0), 0)
  );
}

function getFilteredPosts() {
  const { posts, currentTab } = state;
  if (currentTab === 'popular') {
    return [...posts].sort((a, b) => b.likes - a.likes);
  }
  if (currentTab === 'new') {
    return [...posts].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }
  return posts; // 'all' — server order (newest first)
}

// ─── Load posts ───────────────────────────────────────────────────
async function loadPosts() {
  if (state.isLoading) return;
  state.isLoading = true;

  Dom.skeletonWrapper.classList.remove('hidden');
  Dom.postsContainer.innerHTML = '';
  Dom.emptyState.classList.add('hidden');
  Dom.errorState.classList.add('hidden');

  try {
    state.posts = await fetchPosts();
    renderPosts(getFilteredPosts());
    updateStats(state.posts);
  } catch (err) {
    console.error('Failed to load posts:', err);
    Dom.errorState.classList.remove('hidden');
  } finally {
    Dom.skeletonWrapper.classList.add('hidden');
    state.isLoading = false;
  }
}

// ─── Modal ────────────────────────────────────────────────────────
function openModal() {
  Dom.modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => Dom.postTextarea.focus(), 300);
}

function closeModal() {
  Dom.modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function resetForm() {
  Dom.postTextarea.value = '';
  Dom.charCount.textContent = '0';
  Dom.charCount.parentElement.className = 'char-counter';
  Dom.submitBtn.disabled = true;
  Dom.modalHint.textContent = '';
}

// ─── Submit post ──────────────────────────────────────────────────
async function handleSubmit() {
  const content = Dom.postTextarea.value.trim();

  if (!content) {
    Dom.modalHint.textContent = 'Напишите что-нибудь!';
    Dom.postTextarea.focus();
    return;
  }

  if (content.length > 1000) {
    Dom.modalHint.textContent = 'Слишком длинный текст (макс. 1000 символов)';
    return;
  }

  const name   = Dom.inputName.value.trim()   || 'Аноним';
  const handle = Dom.inputHandle.value.trim() || '@anonymous';

  const payload = {
    content,
    author:      name,
    handle:      handle.startsWith('@') ? handle : '@' + handle,
    avatar:      getInitials(name),
    avatarColor: state.selectedColor,
  };

  state.isSubmitting = true;
  Dom.submitBtn.disabled     = true;
  Dom.submitBtnText.textContent = 'Публикуем...';
  Dom.submitSpinner.classList.remove('hidden');
  Dom.modalHint.textContent  = '';

  try {
    const newPost = await createPost(payload);
    state.posts.unshift(newPost);

    // Prepend to DOM
    const card = createPostCard(newPost, true);
    Dom.postsContainer.prepend(card);
    Dom.emptyState.classList.add('hidden');
    updateStats(state.posts);

    closeModal();
    resetForm();
    showToast('Пост опубликован!', 'success');

    // Scroll to top of feed
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Failed to create post:', err);
    Dom.modalHint.textContent = err.message || 'Ошибка. Попробуйте ещё раз.';
    showToast('Не удалось опубликовать пост', 'error');
  } finally {
    state.isSubmitting = false;
    Dom.submitBtn.disabled     = false;
    Dom.submitBtnText.textContent = 'Опубликовать';
    Dom.submitSpinner.classList.add('hidden');
  }
}

// ─── Post actions (delegation) ────────────────────────────────────
Dom.postsContainer.addEventListener('click', async e => {
  const btn  = e.target.closest('[data-action]');
  const card = e.target.closest('.post-card');
  if (!btn || !card) return;

  const id = card.dataset.id;
  const action = btn.dataset.action;

  if (action === 'like') {
    try {
      const { liked, likes } = await likePost(id);
      const post = state.posts.find(p => p.id === id);
      if (post) { post.liked = liked; post.likes = likes; }

      // Update UI
      btn.classList.toggle('liked', liked);
      btn.querySelector('svg').setAttribute('fill', liked ? 'currentColor' : 'none');
      btn.querySelector('.like-count').textContent = formatCount(likes);

      // Pop animation
      btn.classList.add('pop');
      btn.addEventListener('animationend', () => btn.classList.remove('pop'), { once: true });

      updateStats(state.posts);
    } catch (err) {
      showToast('Не удалось поставить лайк', 'error');
    }
  }

  if (action === 'comment') {
    showToast('Комментарии скоро появятся 💬', 'info');
  }

  if (action === 'share') {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Пост на итд.',
          text: state.posts.find(p => p.id === id)?.content || '',
          url: window.location.href,
        });
      } catch (_) { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => showToast('Ссылка скопирована!', 'success'))
        .catch(() => showToast('Не удалось скопировать', 'error'));
    }
  }

  if (action === 'delete') {
    if (!confirm('Удалить этот пост?')) return;
    try {
      await deletePost(id);
      state.posts = state.posts.filter(p => p.id !== id);

      // Animate out
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.96)';
      setTimeout(() => card.remove(), 300);

      updateStats(state.posts);
      if (state.posts.length === 0) Dom.emptyState.classList.remove('hidden');
      showToast('Пост удалён', 'info');
    } catch (err) {
      showToast('Не удалось удалить пост', 'error');
    }
  }
});

// ─── Textarea ─────────────────────────────────────────────────────
Dom.postTextarea.addEventListener('input', () => {
  const len = Dom.postTextarea.value.length;
  Dom.charCount.textContent = len;

  const counter = Dom.charCount.parentElement;
  counter.className = 'char-counter';
  if (len > 800) counter.classList.add('warn');
  if (len > 950) counter.classList.add('danger');

  Dom.submitBtn.disabled = len === 0 || len > 1000;
  Dom.modalHint.textContent = '';
});

// Ctrl/Cmd + Enter для публикации
Dom.postTextarea.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!Dom.submitBtn.disabled) handleSubmit();
  }
});

// ─── Color picker ─────────────────────────────────────────────────
Dom.colorPicker.addEventListener('click', e => {
  const swatch = e.target.closest('.color-swatch');
  if (!swatch) return;

  Dom.colorPicker.querySelectorAll('.color-swatch').forEach(s =>
    s.classList.remove('active')
  );
  swatch.classList.add('active');

  state.selectedColor = swatch.dataset.color;
  Dom.formAvatar.style.background = state.selectedColor;
});

// ─── Mood buttons ─────────────────────────────────────────────────
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cursor = Dom.postTextarea.selectionStart;
    const val    = Dom.postTextarea.value;
    const emoji  = btn.dataset.mood;

    Dom.postTextarea.value =
      val.slice(0, cursor) + emoji + val.slice(cursor);
    Dom.postTextarea.selectionStart =
    Dom.postTextarea.selectionEnd = cursor + emoji.length;

    // Trigger input event for char counter
    Dom.postTextarea.dispatchEvent(new Event('input'));
    Dom.postTextarea.focus();
  });
});

// ─── Name/handle → avatar initials ───────────────────────────────
Dom.inputName.addEventListener('input', () => {
  const initials = getInitials(Dom.inputName.value) || 'АН';
  Dom.formAvatar.textContent = initials;
});

// ─── Feed tabs ────────────────────────────────────────────────────
Dom.feedTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    Dom.feedTabs.forEach(t => t.classList.remove('feed-tab--active'));
    tab.classList.add('feed-tab--active');
    state.currentTab = tab.dataset.tab;
    renderPosts(getFilteredPosts());
  });
});

// ─── Modal open/close ─────────────────────────────────────────────
[Dom.openModalBtn, Dom.openModalBtnSide, Dom.quickComposeTrigger, Dom.emptyStateBtn]
  .forEach(el => el?.addEventListener('click', openModal));

[Dom.closeModalBtn, Dom.cancelBtn].forEach(el =>
  el?.addEventListener('click', () => { closeModal(); resetForm(); })
);

Dom.modalOverlay.addEventListener('click', e => {
  if (e.target === Dom.modalOverlay) { closeModal(); resetForm(); }
});

// Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Dom.modalOverlay.classList.contains('open')) {
    closeModal();
    resetForm();
  }
});

Dom.submitBtn.addEventListener('click', handleSubmit);

// ─── Retry button ─────────────────────────────────────────────────
Dom.retryBtn.addEventListener('click', loadPosts);

// ─── Scroll behaviours ────────────────────────────────────────────
let lastScrollY = 0;

window.addEventListener('scroll', () => {
  const y = window.scrollY;

  // Header shadow
  Dom.header.classList.toggle('scrolled', y > 10);

  // Scroll-top button
  Dom.scrollTopBtn.classList.toggle('visible', y > 400);

  lastScrollY = y;
}, { passive: true });

Dom.scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Auto-refresh dates (every minute) ───────────────────────────
setInterval(() => {
  document.querySelectorAll('.post-card__date').forEach(el => {
    el.textContent = formatDate(el.getAttribute('datetime'));
  });
}, 60_000);

// ─── Init ─────────────────────────────────────────────────────────
loadPosts();