'use strict';

// ─── Config ───────────────────────────────────────────
const API = '/api';
const TK  = 'itd_token';
const UK  = 'itd_user';

const EMOJIS = [
  '😀','😄','😁','😎','🤩','😍','🥳','😇','🤔','🧐','🥸','😏',
  '😌','🤗','😴','🤓','👻','🤖','👽','🐼','🐨','🦊','🐯','🦁',
  '🐸','🐧','🦉','🦋','🌞','⚡','🔥','🌈','🎭','🎩','🎸','🚀',
  '💎','🍀','🌸','🍕','🦄','🐲','🌊','🌙','⭐','🍭','🎯','💫',
  '🏆','🎪','🌺','🎨','🦸','🧙','🌴','🍔','🎲','🦩','🐬','🌵',
];
const COLORS = ['#6C63FF','#FF6584','#43B89C','#F7B731','#FC5C65','#45AAF2','#A29BFE','#FD79A8','#00B894'];
const BAR_EMOJIS = ['💡','🚀','❤️','✨','😂','🔥','💯','👀','🎉','💬','🙌','⚡'];

// ─── State ────────────────────────────────────────────
const S = {
  token: null, user: null,
  posts: [], users: [],
  currentPage: 'feed',
  profileUserId: null,
  chatPartnerId: null,
  chatPartner: null,
  selEmoji: EMOJIS[0],
  selColor: COLORS[0],
  editEmoji: '', editColor: '',
  pollTimer: null,
};

// ─── DOM ──────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = s => document.querySelectorAll(s);

// ─── Session ──────────────────────────────────────────
function saveSession(token, user) {
  localStorage.setItem(TK, token);
  localStorage.setItem(UK, JSON.stringify(user));
  S.token = token; S.user = user;
}
function clearSession() {
  localStorage.removeItem(TK); localStorage.removeItem(UK);
  S.token = null; S.user = null;
}
function loadSession() {
  const t = localStorage.getItem(TK);
  const u = localStorage.getItem(UK);
  if (t && u) { try { S.token = t; S.user = JSON.parse(u); return true; } catch {} }
  return false;
}

// ─── API ──────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json',
                ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}) }
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(API + path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

// ─── Utils ────────────────────────────────────────────
function esc(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(s)));
  return d.innerHTML;
}
function relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)     return 'только что';
  if (s < 3600)   return `${Math.floor(s/60)} мин. назад`;
  if (s < 86400)  return `${Math.floor(s/3600)} ч. назад`;
  if (s < 604800) return `${Math.floor(s/86400)} дн. назад`;
  return new Date(iso).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
}
function fmtN(n) { return n>=1000?(n/1000).toFixed(1).replace('.0','')+'k':String(n||0); }

// ─── Toast ────────────────────────────────────────────
function toast(msg, type='info', ms=3200) {
  const icons = {success:'✓',error:'✕',info:'ℹ'};
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${esc(msg)}</span>`;
  $('toastBox').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), {once:true});
  }, ms);
}

// ═══════════════════════════════════════════════════════
//  AUTH UI BUILDERS
// ═══════════════════════════════════════════════════════

function buildEmojiGrid(containerId, selClass, onSelect) {
  const grid = $(containerId);
  grid.innerHTML = '';
  EMOJIS.forEach((em,i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn' + (i===0 ? ' sel' : '');
    btn.textContent = em;
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      onSelect(em);
    });
    grid.appendChild(btn);
  });
}

function buildColorSwatches(containerId, onSelect) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  COLORS.forEach((c,i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-swatch' + (i===0?' sel':'');
    btn.style.background = c;
    btn.dataset.color = c;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('sel'));
      btn.classList.add('sel');
      onSelect(c);
    });
    wrap.appendChild(btn);
  });
}

// Build register emoji grid
buildEmojiGrid('emojiGrid', 'sel', em => {
  S.selEmoji = em;
  $('previewBubble').textContent = em;
  $('step2AvatarPreview').textContent = em;
});

buildColorSwatches('colorSwatches', c => {
  S.selColor = c;
  setAvatarBg('previewBubble', c);
  setAvatarBg('step2AvatarPreview', c);
});

// Init preview colors
setAvatarBg('previewBubble', COLORS[0]);
setAvatarBg('step2AvatarPreview', COLORS[0]);

function setAvatarBg(id, color) {
  const el = $(id);
  if (el) { el.style.background = color; el.style.borderColor = color; }
}

function setAvatar(id, emoji, color) {
  const el = $(id);
  if (!el) return;
  el.textContent = emoji;
  el.style.background   = color;
  el.style.borderColor  = color;
}

// ─── Panel switch ─────────────────────────────────────
$('goRegister').onclick = () => {
  $('loginPanel').classList.add('hidden');
  $('registerPanel').classList.remove('hidden');
};
$('goLogin').onclick = () => {
  $('registerPanel').classList.add('hidden');
  $('loginPanel').classList.remove('hidden');
};

// ─── Step nav ─────────────────────────────────────────
$('step1Next').onclick = () => {
  $('regStep1').classList.add('hidden');
  $('regStep2').classList.remove('hidden');
  $('re-name').focus();
};
$('backStep1').onclick = () => {
  $('regStep2').classList.add('hidden');
  $('regStep1').classList.remove('hidden');
};

// ─── PW eye ───────────────────────────────────────────
document.addEventListener('click', e => {
  const btn = e.target.closest('.pw-eye');
  if (!btn) return;
  const inp = $(btn.dataset.for);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
});

// ─── PW strength ──────────────────────────────────────
$('re-password').addEventListener('input', () => {
  const v = $('re-password').value;
  let score = 0;
  if(v.length>=6)  score++;
  if(v.length>=10) score++;
  if(/[A-Z]/.test(v)) score++;
  if(/[0-9]/.test(v)) score++;
  if(/[^A-Za-z0-9]/.test(v)) score++;
  const lvls=[
    {w:'0%',c:'transparent',l:''},
    {w:'25%',c:'#FC5C65',l:'😬 Слабый'},
    {w:'50%',c:'#F7B731',l:'🤔 Средний'},
    {w:'75%',c:'#45AAF2',l:'👍 Хороший'},
    {w:'100%',c:'#34C77B',l:'💪 Сильный'},
  ];
  const lv = lvls[Math.min(score,4)];
  $('pwBarFill').style.width      = lv.w;
  $('pwBarFill').style.background = lv.c;
  $('pwBarLabel').textContent     = lv.l;
});

// ─── LOGIN ────────────────────────────────────────────
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('li-usernameErr').textContent='';
  $('li-passwordErr').textContent='';
  $('loginErr').textContent='';

  const username = $('li-username').value.trim();
  const password = $('li-password').value;
  if(!username){$('li-usernameErr').textContent='Введите логин';return;}
  if(!password){$('li-passwordErr').textContent='Введите пароль';return;}

  setBusy('loginBtn','loginBtnTxt','loginSpin',true,'Входим...');
  try {
    const {data} = await api('POST','/auth/login',{username,password});
    saveSession(data.token, data.user);
    await bootApp();
  } catch(err) {
    $('loginErr').textContent = err.message;
  } finally {
    setBusy('loginBtn','loginBtnTxt','loginSpin',false,'Войти');
  }
});

// ─── REGISTER ─────────────────────────────────────────
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  ['re-nameErr','re-usernameErr','re-passwordErr'].forEach(id=>$(id).textContent='');
  $('registerErr').textContent='';

  const displayName = $('re-name').value.trim();
  const username    = $('re-username').value.trim();
  const password    = $('re-password').value;
  const emoji = S.selEmoji;
  const color = S.selColor;

  let ok = true;
  if(!displayName){$('re-nameErr').textContent='Введите имя';ok=false;}
  if(!username)   {$('re-usernameErr').textContent='Введите логин';ok=false;}
  if(password.length<6){$('re-passwordErr').textContent='Минимум 6 символов';ok=false;}
  if(!ok) return;

  setBusy('registerBtn','registerBtnTxt','registerSpin',true,'Создаём...');
  try {
    const {data} = await api('POST','/auth/register',{displayName,username,password,emoji,color});
    saveSession(data.token, data.user);
    await bootApp();
    toast('Добро пожаловать! 🎉','success');
  } catch(err) {
    $('registerErr').textContent = err.message;
  } finally {
    setBusy('registerBtn','registerBtnTxt','registerSpin',false,'Создать аккаунт');
  }
});

function setBusy(btnId, txtId, spinId, on, txt) {
  $(btnId).disabled        = on;
  $(txtId).textContent     = txt;
  $(spinId).classList.toggle('hidden', !on);
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
async function bootApp() {
  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  refreshHeaderUI();
  await Promise.all([loadPosts(), loadUsers()]);
  renderFeed();
  renderPeople();
  updateStats();
  pollUnread();
}

function refreshHeaderUI() {
  const u = S.user;
  if(!u) return;
  setAvatar('hdrAvatar', u.emoji, u.color);
  setAvatar('sideAvatar', u.emoji, u.color);
  setAvatar('qbAvatar', u.emoji, u.color);
  setAvatar('modalAvatar', u.emoji, u.color);
  $('hdrName').textContent    = u.displayName;
  $('hdrHandle').textContent  = '@'+u.username;
  $('sideName').textContent   = u.displayName;
  $('sideHandle').textContent = '@'+u.username;
  $('modalName').textContent   = u.displayName;
  $('modalHandle').textContent = '@'+u.username;
}

// ─── LOGOUT ───────────────────────────────────────────
$('logoutBtn').onclick = () => {
  if(S.pollTimer) clearInterval(S.pollTimer);
  clearSession();
  S.posts=[]; S.users=[];
  $('postsList').innerHTML='';
  $('peopleList').innerHTML='';
  $('inboxList').innerHTML='';
  $('appScreen').classList.add('hidden');
  $('authScreen').classList.remove('hidden');
  $('loginPanel').classList.remove('hidden');
  $('registerPanel').classList.add('hidden');
  $('loginForm').reset();
  $('avatarMenuDrop').classList.remove('open');
  toast('Вы вышли','info');
};

// ═══════════════════════════════════════════════════════
//  POSTS
// ═══════════════════════════════════════════════════════
async function loadPosts() {
  try {
    const {data} = await api('GET','/posts');
    S.posts = data;
  } catch(e) { console.error(e); }
}

function renderFeed() {
  $('skeletons').classList.add('hidden');
  const list = $('postsList');
  list.innerHTML = '';
  const filtered = S.posts;
  if(!filtered.length){ $('feedEmpty').classList.remove('hidden'); return; }
  $('feedEmpty').classList.add('hidden');
  filtered.forEach(p => list.appendChild(buildPostCard(p)));
}

function buildPostCard(p, showDelete=null) {
  const isOwn = showDelete !== null ? showDelete : p.authorId === S.user?.id;
  const liked  = Array.isArray(p.likes) && p.likes.includes(S.user?.id);
  const likes  = p.likeCount ?? (Array.isArray(p.likes) ? p.likes.length : 0);
  const a      = p.author || {};

  const art = document.createElement('article');
  art.className  = 'post-card';
  art.dataset.id = p.id;

  art.innerHTML = `
    <div class="post-card__head">
      <div class="post-card__author" data-uid="${esc(p.authorId)}">
        <div class="avatar-bubble av-sm" style="background:${esc(a.color||'#6C63FF')};border-color:${esc(a.color||'#6C63FF')}">
          ${esc(a.emoji||'👤')}
        </div>
        <div class="post-card__info">
          <span class="post-card__name">${esc(a.displayName||'Аноним')}</span>
          <div class="post-card__meta">
            <span class="post-card__handle">@${esc(a.username||'?')}</span>
            <span class="post-card__sep">·</span>
            <time class="post-card__date" datetime="${esc(p.createdAt)}">${relTime(p.createdAt)}</time>
          </div>
        </div>
      </div>
      ${isOwn ? `<button class="post-card__del" data-del="${esc(p.id)}">🗑</button>` : ''}
    </div>
    <p class="post-card__text">${esc(p.content)}</p>
    <div class="post-card__foot">
      <button class="post-action post-action--like ${liked?'liked':''}" data-like="${esc(p.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24"
             fill="${liked?'currentColor':'none'}" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
        <span class="like-n">${fmtN(likes)}</span>
      </button>
    </div>`;

  return art;
}

// Delegated — feed
$('postsList').addEventListener('click', e => handlePostClick(e, 'postsList'));
// Delegated — profile posts
$('profilePostsList').addEventListener('click', e => handlePostClick(e, 'profilePostsList'));

async function handlePostClick(e, listId) {
  // Navigate to profile
  const authorEl = e.target.closest('.post-card__author[data-uid]');
  if (authorEl) {
    openProfile(authorEl.dataset.uid);
    return;
  }

  // Like
  const likeBtn = e.target.closest('[data-like]');
  if (likeBtn) {
    const id = likeBtn.dataset.like;
    try {
      const {data} = await api('PATCH',`/posts/${id}/like`);
      // sync state
      const p = S.posts.find(x=>x.id===id);
      if(p){
        if(data.liked){ if(!p.likes.includes(S.user.id)) p.likes.push(S.user.id); }
        else { p.likes=p.likes.filter(u=>u!==S.user.id); }
        p.likeCount = data.likesCount;
      }
      likeBtn.classList.toggle('liked', data.liked);
      likeBtn.querySelector('svg').setAttribute('fill', data.liked?'currentColor':'none');
      likeBtn.querySelector('.like-n').textContent = fmtN(data.likesCount);
      likeBtn.classList.add('pop');
      likeBtn.addEventListener('animationend',()=>likeBtn.classList.remove('pop'),{once:true});
      updateStats();
    } catch(err){ toast(err.message,'error'); }
    return;
  }

  // Delete
  const delBtn = e.target.closest('[data-del]');
  if (delBtn) {
    if(!confirm('Удалить пост?')) return;
    const id = delBtn.dataset.del;
    try {
      await api('DELETE',`/posts/${id}`);
      S.posts = S.posts.filter(p=>p.id!==id);
      const card = document.querySelector(`.post-card[data-id="${id}"]`);
      if(card){
        card.style.transition='opacity .3s,transform .3s';
        card.style.opacity='0';
        card.style.transform='scale(.97)';
        setTimeout(()=>{ card.remove(); updateStats();
          if(listId==='postsList' && !$('postsList').children.length)
            $('feedEmpty').classList.remove('hidden');
          if(listId==='profilePostsList' && !$('profilePostsList').children.length)
            $('profilePostsEmpty').classList.remove('hidden');
        },300);
      }
    } catch(err){ toast(err.message,'error'); }
  }
}

// ─── Stats ────────────────────────────────────────────
function updateStats() {
  const u = S.user;
  if(!u) return;
  const myPosts = S.posts.filter(p=>p.authorId===u.id);
  const likes   = myPosts.reduce((s,p)=>s+(p.likeCount||(p.likes?.length||0)),0);
  const follLen = u.followers?.length||0;
  const fingLen = u.following?.length||0;

  $('sidePostCnt').textContent = myPosts.length;
  $('sideFollCnt').textContent = follLen;
  $('sideFingCnt').textContent = fingLen;
  $('rsPostCnt').textContent   = myPosts.length;
  $('rsLikesCnt').textContent  = fmtN(likes);
  $('rsFollCnt').textContent   = follLen;
}

// ═══════════════════════════════════════════════════════
//  POST MODAL
// ═══════════════════════════════════════════════════════

// Build emoji toolbar
(()=>{
  const bar = $('postEmojiBar');
  BAR_EMOJIS.forEach(em=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='emoji-bar-btn';
    btn.textContent=em;
    btn.addEventListener('click',()=>insertAt($('postTextarea'),em));
    bar.appendChild(btn);
  });
})();

function insertAt(el, text){
  const s=el.selectionStart, e2=el.selectionEnd;
  el.value=el.value.slice(0,s)+text+el.value.slice(e2);
  el.selectionStart=el.selectionEnd=s+text.length;
  el.dispatchEvent(new Event('input'));
  el.focus();
}

function openPostModal(){
  $('postModal').classList.remove('hidden');
  document.body.style.overflow='hidden';
  setTimeout(()=>$('postTextarea').focus(),200);
}
function closePostModal(){
  $('postModal').classList.add('hidden');
  document.body.style.overflow='';
  $('postTextarea').value='';
  $('charCount').textContent='0';
  $('charCount').parentElement.className='char-counter';
  $('publishBtn').disabled=true;
  $('postError').textContent='';
}

['hdrPostBtn','sidePostBtn','quickTrigger','emptyPostBtn']
  .forEach(id=>{ const el=$(id); if(el) el.onclick=openPostModal; });

$('closePostModal').onclick=closePostModal;
$('cancelPost').onclick=closePostModal;
$('postModal').addEventListener('click',e=>{ if(e.target===$('postModal')) closePostModal(); });
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && !$('postModal').classList.contains('hidden')) closePostModal();
});

$('postTextarea').addEventListener('input',()=>{
  const len=$('postTextarea').value.length;
  $('charCount').textContent=len;
  const w=$('charCount').parentElement;
  w.className='char-counter';
  if(len>800) w.classList.add('warn');
  if(len>950) w.classList.add('danger');
  $('publishBtn').disabled=len===0||len>1000;
  $('postError').textContent='';
});

$('postTextarea').addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!$('publishBtn').disabled){
    e.preventDefault(); submitPost();
  }
});

$('publishBtn').onclick = submitPost;

async function submitPost(){
  const content=$('postTextarea').value.trim();
  if(!content) return;
  setBusy('publishBtn','publishTxt','publishSpin',true,'Публикуем...');
  $('postError').textContent='';
  try {
    const {data}=await api('POST','/posts',{content});
    S.posts.unshift(data);
    $('feedEmpty').classList.add('hidden');
    $('postsList').prepend(buildPostCard(data));
    updateStats();
    closePostModal();
    toast('Пост опубликован! 🎉','success');
    window.scrollTo({top:0,behavior:'smooth'});
  } catch(err){
    $('postError').textContent=err.message;
    $('publishBtn').disabled=false;
  } finally {
    setBusy('publishBtn','publishTxt','publishSpin',false,'Опубликовать');
  }
}

// ═══════════════════════════════════════════════════════
//  PEOPLE
// ═══════════════════════════════════════════════════════
async function loadUsers(){
  try {
    const {data}=await api('GET','/users');
    S.users=data;
  } catch(e){ console.error(e); }
}

function renderPeople(filter=''){
  const list=$('peopleList');
  list.innerHTML='';
  const arr = filter
    ? S.users.filter(u=>
        u.displayName.toLowerCase().includes(filter.toLowerCase())||
        u.username.toLowerCase().includes(filter.toLowerCase()))
    : S.users;

  if(!arr.length){ $('peopleEmpty').classList.remove('hidden'); return; }
  $('peopleEmpty').classList.add('hidden');
  arr.forEach(u=>list.appendChild(buildPersonCard(u)));
}

function buildPersonCard(u){
  const isFollowing = S.user?.following?.includes(u.id);
  const pc = S.posts.filter(p=>p.authorId===u.id).length;

  const div=document.createElement('div');
  div.className='person-card';
  div.dataset.uid=u.id;

  div.innerHTML=`
    <div class="avatar-bubble av-md"
         style="background:${esc(u.color||'#6C63FF')};border-color:${esc(u.color||'#6C63FF')}">
      ${esc(u.emoji||'👤')}
    </div>
    <div class="person-card__info">
      <div class="person-card__name">${esc(u.displayName)}</div>
      <div class="person-card__handle">@${esc(u.username)}</div>
      <div class="person-card__stats">${pc} постов · ${u.followers?.length||0} читателей</div>
    </div>
    <div class="person-card__actions">
      <button class="btn btn--sm btn--outline ${isFollowing?'following':''}"
              data-follow="${esc(u.id)}">
        ${isFollowing?'Читаю':'+ Читать'}
      </button>
      <button class="btn btn--sm btn--ghost" data-msg="${esc(u.id)}" title="Написать">💬</button>
    </div>`;

  // Click on card → profile
  div.addEventListener('click', e => {
    if(e.target.closest('[data-follow]')||e.target.closest('[data-msg]')) return;
    openProfile(u.id);
  });

  return div;
}

$('peopleList').addEventListener('click', async e => {
  // Follow
  const fBtn = e.target.closest('[data-follow]');
  if(fBtn){
    const tid=fBtn.dataset.follow;
    try{
      const {data}=await api('PATCH',`/users/me/follow/${tid}`);
      if(data.following){ if(!S.user.following.includes(tid)) S.user.following.push(tid); }
      else { S.user.following=S.user.following.filter(i=>i!==tid); }
      localStorage.setItem(UK,JSON.stringify(S.user));
      const tu=S.users.find(u=>u.id===tid);
      if(tu){
        if(data.following){if(!tu.followers.includes(S.user.id))tu.followers.push(S.user.id);}
        else {tu.followers=tu.followers.filter(i=>i!==S.user.id);}
      }
      fBtn.classList.toggle('following',data.following);
      fBtn.textContent=data.following?'Читаю':'+ Читать';
      const statsEl=fBtn.closest('.person-card')?.querySelector('.person-card__stats');
      if(statsEl&&tu){
        const pc2=S.posts.filter(p=>p.authorId===tu.id).length;
        statsEl.textContent=`${pc2} постов · ${tu.followers.length} читателей`;
      }
      updateStats();
      toast(data.following?`Вы подписались на @${tu?.username}`:`Отписались от @${tu?.username}`,'success');
    }catch(err){toast(err.message,'error');}
    return;
  }

  // Message
  const mBtn = e.target.closest('[data-msg]');
  if(mBtn){
    openChat(mBtn.dataset.msg);
  }
});

$('peopleSearch').addEventListener('input',e=>renderPeople(e.target.value));

// ═══════════════════════════════════════════════════════
//  MESSAGES
// ═══════════════════════════════════════════════════════

async function loadInbox(){
  try {
    const {data}=await api('GET','/messages/inbox');
    renderInbox(data);
  } catch(e){ console.error(e); }
}

function renderInbox(dialogs){
  const list=$('inboxList');
  list.innerHTML='';
  if(!dialogs.length){ $('inboxEmpty').classList.remove('hidden'); return; }
  $('inboxEmpty').classList.add('hidden');
  dialogs.forEach(d=>{
    const el=document.createElement('div');
    el.className='dialog-item'+(d.partner?.id===S.chatPartnerId?' active':'');
    el.dataset.uid=d.partner.id;
    el.innerHTML=`
      <div class="avatar-bubble av-sm"
           style="background:${esc(d.partner.color||'#6C63FF')};border-color:${esc(d.partner.color||'#6C63FF')}">
        ${esc(d.partner.emoji||'👤')}
      </div>
      <div class="dialog-item__info">
        <div class="dialog-item__name">${esc(d.partner.displayName)}</div>
        <div class="dialog-item__preview">@${esc(d.partner.username)}</div>
      </div>
      <div class="dialog-item__meta">
        <span class="dialog-item__time">${relTime(d.lastAt)}</span>
        ${d.unread>0?`<span class="dialog-item__dot"></span>`:''}
      </div>`;
    el.addEventListener('click',()=>openChat(d.partner.id));
    list.appendChild(el);
  });
}

async function openChat(partnerId){
  S.chatPartnerId=partnerId;
  const partner = S.users.find(u=>u.id===partnerId)
    || (await api('GET',`/users/${partnerId}`).catch(()=>null))?.data;
  if(!partner) return;
  S.chatPartner=partner;

  // Switch to messages page
  switchPage('messages');

  // On mobile, show chat panel fullscreen
  $('inboxPanel').classList.add('hidden');
  $('chatPanel').classList.remove('hidden');

  // Update chat header
  setAvatar('chatPartnerAvatar',partner.emoji,partner.color);
  $('chatPartnerName').textContent   = partner.displayName;
  $('chatPartnerHandle').textContent = '@'+partner.username;

  // Mark inbox item active
  $$('.dialog-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.uid===partnerId);
  });

  await loadChat();
  loadInbox();
  checkUnread();
}

async function loadChat(){
  try {
    const {data}=await api('GET',`/messages/${S.chatPartnerId}`);
    renderChat(data);
  } catch(e){ console.error(e); }
}

function renderChat(msgs){
  const box=$('chatMessages');
  box.innerHTML='';
  if(!msgs.length){
    box.innerHTML='<div class="chat-empty">✉️<br>Начните разговор!</div>';
    return;
  }
  msgs.forEach(m=>{
    const isMe=m.fromId===S.user?.id;
    const el=document.createElement('div');
    el.className=`chat-msg ${isMe?'chat-msg--me':'chat-msg--them'}`;
    el.innerHTML=`
      <div class="chat-msg__bubble">${esc(m.content)}</div>
      <span class="chat-msg__time">${relTime(m.createdAt)}</span>`;
    box.appendChild(el);
  });
  box.scrollTop=box.scrollHeight;
}

// Chat send
async function sendMessage(){
  const content=$('chatInput').value.trim();
  if(!content||!S.chatPartnerId) return;
  $('chatInput').value='';
  autoResizeChatInput();
  try {
    const {data}=await api('POST',`/messages/${S.chatPartnerId}`,{content});
    const box=$('chatMessages');
    const empty=box.querySelector('.chat-empty');
    if(empty) empty.remove();
    const el=document.createElement('div');
    el.className='chat-msg chat-msg--me';
    el.innerHTML=`<div class="chat-msg__bubble">${esc(data.content)}</div>
                  <span class="chat-msg__time">только что</span>`;
    box.appendChild(el);
    box.scrollTop=box.scrollHeight;
  } catch(err){ toast(err.message,'error'); }
}

$('chatSendBtn').onclick=sendMessage;
$('chatInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}
});

// Auto-resize textarea
function autoResizeChatInput(){
  const el=$('chatInput');
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,120)+'px';
}
$('chatInput').addEventListener('input',autoResizeChatInput);

// Back button (mobile)
$('chatBack').onclick=()=>{
  $('chatPanel').classList.add('hidden');
  $('inboxPanel').classList.remove('hidden');
  S.chatPartnerId=null;
};

// Poll for new messages & unread count
function pollUnread(){
  checkUnread();
  S.pollTimer=setInterval(()=>{
    checkUnread();
    // Refresh chat if open
    if(S.chatPartnerId && S.currentPage==='messages'){
      loadChat();
    }
    // Refresh inbox if on messages page
    if(S.currentPage==='messages'){
      loadInbox();
    }
  }, 5000);
}

async function checkUnread(){
  try {
    const {data}=await api('GET','/messages/unread/count');
    const cnt=data.count;
    [$('unreadBadge'),$('sideUnread')].forEach(el=>{
      if(!el) return;
      el.textContent=cnt;
      el.classList.toggle('hidden', cnt===0);
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════
async function openProfile(userId){
  S.profileUserId = userId;
  switchPage('profile');

  const isOwn = userId === S.user?.id;

  try {
    const {data:u} = await api('GET',`/users/${userId}`);
    const {data:posts} = await api('GET',`/posts/user/${userId}`);

    setAvatar('profileAvatar', u.emoji, u.color);
    $('profileName').textContent   = u.displayName;
    $('profileHandle').textContent = '@'+u.username;
    $('profileBio').textContent    = u.bio||'';
    $('profilePostCnt').textContent = posts.length;
    $('profileFollCnt').textContent = u.followers?.length||0;
    $('profileFingCnt').textContent = u.following?.length||0;

    // Actions
    const actions=$('profileActions');
    actions.innerHTML='';
    if(isOwn){
      const editBtn=document.createElement('button');
      editBtn.className='btn btn--outline btn--sm';
      editBtn.textContent='✏️ Редактировать';
      editBtn.onclick=()=>openEditProfile(u);
      actions.appendChild(editBtn);
    } else {
      const isFollowing=S.user?.following?.includes(userId);
      const fBtn=document.createElement('button');
      fBtn.className=`btn btn--outline btn--sm ${isFollowing?'following':''}`;
      fBtn.textContent=isFollowing?'Читаю':'+ Читать';
      fBtn.onclick=async()=>{
        try{
          const {data}=await api('PATCH',`/users/me/follow/${userId}`);
          if(data.following){if(!S.user.following.includes(userId))S.user.following.push(userId);}
          else{S.user.following=S.user.following.filter(i=>i!==userId);}
          localStorage.setItem(UK,JSON.stringify(S.user));
          fBtn.classList.toggle('following',data.following);
          fBtn.textContent=data.following?'Читаю':'+ Читать';
          $('profileFollCnt').textContent=data.followersCount;
          updateStats();
          const tu=S.users.find(x=>x.id===userId);
          if(tu){
            if(data.following){if(!tu.followers.includes(S.user.id))tu.followers.push(S.user.id);}
            else{tu.followers=tu.followers.filter(i=>i!==S.user.id);}
          }
        }catch(err){toast(err.message,'error');}
      };
      actions.appendChild(fBtn);

      const msgBtn=document.createElement('button');
      msgBtn.className='btn btn--sm btn--ghost';
      msgBtn.textContent='💬 Написать';
      msgBtn.onclick=()=>openChat(userId);
      actions.appendChild(msgBtn);
    }

    // Posts
    const pList=$('profilePostsList');
    pList.innerHTML='';
    if(!posts.length){ $('profilePostsEmpty').classList.remove('hidden'); }
    else {
      $('profilePostsEmpty').classList.add('hidden');
      posts.forEach(p=>pList.appendChild(buildPostCard(p, isOwn)));
    }

    $('editProfileCard').classList.add('hidden');

  } catch(err){ toast(err.message,'error'); }
}

// Edit profile
function openEditProfile(u){
  S.editEmoji = u.emoji;
  S.editColor = u.color;

  setAvatar('editAvatarPreview', u.emoji, u.color);
  $('editName').value = u.displayName;
  $('editBio').value  = u.bio||'';

  // Build edit emoji grid
  buildEmojiGrid('editEmojiGrid','sel', em=>{
    S.editEmoji = em;
    setAvatar('editAvatarPreview', em, S.editColor);
  });
  // Mark selected
  const editGrid=$('editEmojiGrid');
  editGrid.querySelectorAll('.emoji-btn').forEach(btn=>{
    btn.classList.toggle('sel', btn.textContent===u.emoji);
  });

  // Edit color swatches
  buildColorSwatches('editColorSwatches', c=>{
    S.editColor = c;
    setAvatar('editAvatarPreview', S.editEmoji, c);
  });
  const esw=$('editColorSwatches');
  esw.querySelectorAll('.color-swatch').forEach(s=>{
    s.classList.toggle('sel', s.dataset.color===u.color);
  });

  $('editProfileCard').classList.remove('hidden');
  $('editProfileCard').scrollIntoView({behavior:'smooth',block:'start'});
}

$('cancelEditBtn').onclick=()=>$('editProfileCard').classList.add('hidden');

$('saveProfileBtn').onclick=async()=>{
  const displayName=$('editName').value.trim();
  const bio=$('editBio').value.trim();
  if(!displayName){ toast('Введите имя','error'); return; }
  try{
    const {data}=await api('PATCH','/users/me',{
      displayName,
      bio,
      emoji: S.editEmoji,
      color: S.editColor,
    });
    S.user=data;
    localStorage.setItem(UK,JSON.stringify(data));
    refreshHeaderUI();
    updateStats();
    toast('Профиль обновлён!','success');
    $('editProfileCard').classList.add('hidden');
    
