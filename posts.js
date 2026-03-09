/**
 * posts.js
 * Compose box, post creation, feed loading + real-time updates,
 * post card rendering, likes, emoji reactions, delete, bookmarks,
 * and hashtag filtering.
 */

const REACTIONS = ['❄️','🔥','😂','😍','💯'];

/* ════════════════════════════════════════
   COMPOSE BOX
════════════════════════════════════════ */
window.renderCompose = user => {
  const wrap = document.getElementById('compose-wrap');
  if (!wrap) return;

  if (!user || user.isAnonymous) {
    wrap.innerHTML = `
      <div class="guest-compose">
        <p>The feed is <strong>public</strong> — everyone can read.<br>
           Sign in to post, like, comment &amp; bookmark.</p>
        <button class="btn-signin-inline" id="inline-signin">Sign in with Google</button>
      </div>`;
    document.getElementById('inline-signin')?.addEventListener('click', () => {
      document.getElementById('main-app').style.display    = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    });
    return;
  }

  const profile = ICE.myProfile || {};
  const photo   = profile.photoURL || user.photoURL;
  const name    = profile.displayName || user.displayName || 'Member';

  wrap.innerHTML = `
    <div class="compose" id="compose">
      <div class="compose-top">
        ${avatarHTML(photo, name)}
        <textarea class="compose-input" id="compose-text"
          placeholder="What's on your mind? Use #tags ❄️"
          maxlength="${ICE.MAX_CHARS}"></textarea>
      </div>
      <div class="compose-media" id="compose-media" style="display:none"></div>
      <div class="compose-bottom">
        <div class="compose-tools">
          <button class="tool-btn" id="tb-photo" title="Add photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>Photo
          </button>
          <button class="tool-btn" id="tb-video" title="Add video">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>Video
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem">
          <span class="char-count" id="char-count">0 / ${ICE.MAX_CHARS}</span>
          <button class="btn-post" id="btn-post">Post</button>
        </div>
      </div>
      <div class="compose-progress" id="compose-progress" style="display:none">
        <div class="compose-progress-bar" id="compose-progress-bar"></div>
        <span id="compose-progress-label">Uploading…</span>
      </div>
    </div>`;

  /* char counter */
  document.getElementById('compose-text').addEventListener('input', () => {
    const len = document.getElementById('compose-text').value.length;
    const el  = document.getElementById('char-count');
    el.textContent = `${len} / ${ICE.MAX_CHARS}`;
    el.className = 'char-count'
      + (len > ICE.MAX_CHARS * 0.85 ? ' warn' : '')
      + (len >= ICE.MAX_CHARS       ? ' limit': '');
  });

  /* media triggers */
  document.getElementById('tb-photo').addEventListener('click', () => triggerFilePicker('image/*'));
  document.getElementById('tb-video').addEventListener('click', () => triggerFilePicker('video/*'));

  /* submit */
  document.getElementById('btn-post').addEventListener('click', submitPost);
  document.getElementById('compose-text').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') submitPost();
  });
};

async function submitPost() {
  const ta  = document.getElementById('compose-text');
  const btn = document.getElementById('btn-post');
  if (!ta || !btn) return;

  const text = ta.value.trim();
  if (!text && _mediaFiles.length === 0) {
    toast('Write something or add a photo/video first');
    return;
  }
  if (!ICE.me || ICE.me.isAnonymous) {
    toast('Sign in to post');
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Posting…';

  const progressWrap  = document.getElementById('compose-progress');
  const progressBar   = document.getElementById('compose-progress-bar');
  const progressLabel = document.getElementById('compose-progress-label');

  try {
    let urls  = [];
    let types = [];

    if (_mediaFiles.length > 0) {
      progressWrap.style.display = 'flex';

      const result = await uploadMediaFiles(ICE.me.uid, (idx, total) => {
        const pct = Math.round((idx / total) * 100);
        progressBar.style.width     = pct + '%';
        progressLabel.textContent   = `Uploading file ${idx + 1} of ${total}…`;
      });

      urls  = result.urls;
      types = result.types;
    }

    const profile  = ICE.myProfile || {};
    const postName = profile.displayName || ICE.me.displayName || 'Member';
    const postPhoto= profile.photoURL   || ICE.me.photoURL    || null;

    await ICE.db.collection('posts').add({
      text,
      mediaUrls:    urls,
      mediaTypes:   types,
      uid:          ICE.me.uid,
      displayName:  postName,
      photoURL:     postPhoto,
      likes:        [],
      reactions:    {},
      commentCount: 0,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });

    ta.value      = '';
    _mediaFiles.length = 0;
    renderMediaPreviews();

    const cc = document.getElementById('char-count');
    if (cc) { cc.textContent = `0 / ${ICE.MAX_CHARS}`; cc.className = 'char-count'; }

    toast('Posted! ❄️');
  } catch (err) {
    console.error('Post error:', err);
    toast('Upload failed: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Post';
    if (progressWrap) progressWrap.style.display = 'none';
    if (progressBar)  progressBar.style.width    = '0%';
  }
}

/* ════════════════════════════════════════
   FEED LOADING
════════════════════════════════════════ */
window.loadPosts = () => {
  const wrap = document.getElementById('posts-wrap');
  wrap.innerHTML = [1,2,3].map(() => skeletonCard()).join('');

  if (ICE.unsubPosts) ICE.unsubPosts();

  ICE.unsubPosts = ICE.db.collection('posts')
    .orderBy('createdAt', 'desc')
    .limit(60)
    .onSnapshot(snap => {
      ICE.posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPosts();
      if (typeof computeTrending === 'function') computeTrending();
      const el = document.getElementById('stat-posts');
      if (el) el.textContent = snap.size >= 100 ? '100+' : String(snap.size);
    }, err => {
      wrap.innerHTML = `<div class="empty">
        <p>Could not load posts.<br>
           Make sure Firestore rules allow public reads.<br>
           <a style="cursor:pointer;color:var(--cyan)" onclick="loadPosts()">Retry</a>
        </p></div>`;
    });
};

/* ════════════════════════════════════════
   RENDER FEED
════════════════════════════════════════ */
window.renderPosts = (overrideList) => {
  const wrap = document.getElementById('posts-wrap');
  if (!wrap) return;

  let posts = overrideList || ICE.posts;

  if (ICE.filter === 'image')     posts = posts.filter(p => p.mediaTypes?.some(t => t === 'image'));
  else if (ICE.filter === 'video') posts = posts.filter(p => p.mediaTypes?.some(t => t === 'video'));
  else if (ICE.filter === 'text')  posts = posts.filter(p => !p.mediaUrls?.length);
  else if (ICE.filter === 'bookmarks') {
    const saved = getBookmarks();
    posts = posts.filter(p => saved.includes(p.id));
  }

  if (!posts.length) {
    wrap.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 15h8M9 9h.01M15 9h.01"/>
      </svg>
      <p>${ICE.filter === 'bookmarks'
          ? 'No bookmarks yet — save posts by clicking the bookmark icon.'
          : 'Nothing here yet.'}</p>
    </div>`;
    return;
  }

  wrap.innerHTML = posts.map(postCard).join('');
  _attachPostListeners();
};

/* ════════════════════════════════════════
   POST CARD HTML
════════════════════════════════════════ */
function postCard(p) {
  const mc = p.mediaUrls?.length || 0;
  let mediaHTML = '';

  if (mc > 0) {
    const cls = `post-media-grid n${Math.min(mc, 4)}`;
    const items = p.mediaUrls.map((url, i) => {
      const isV = p.mediaTypes?.[i] === 'video';
      return `<div class="mi" data-src="${esc(url)}" data-type="${isV ? 'video' : 'image'}">
        ${isV
          ? `<video src="${esc(url)}" muted playsinline preload="metadata"
               style="width:100%;height:100%;object-fit:cover;display:block;cursor:pointer"></video>`
          : `<img src="${esc(url)}" loading="lazy" alt="Post media"/>`
        }
      </div>`;
    }).join('');
    mediaHTML = `<div class="${cls}">${items}</div>`;
  }

  const me     = ICE.me;
  const liked  = p.likes?.includes(me?.uid);
  const lc     = p.likes?.length || 0;
  const saved  = isBookmarked(p.id);
  const isOwn  = me && !me.isAnonymous && me.uid === p.uid;

  // Reactions summary (top 3 by count)
  const rxMap  = p.reactions || {};
  const rxHTML = REACTIONS.map(emoji => {
    const count = (rxMap[emoji] || []).length;
    if (!count) return '';
    const isMine = me && (rxMap[emoji] || []).includes(me.uid);
    return `<button class="rx-pill${isMine ? ' mine' : ''}" data-id="${p.id}" data-emoji="${emoji}">
      ${emoji} <span>${count}</span>
    </button>`;
  }).join('');

  return `<div class="post-card" data-id="${p.id}">
    <div class="post-head">
      <span class="post-av-link" data-uid="${p.uid}">
        ${avatarHTML(p.photoURL, p.displayName)}
      </span>
      <div class="p-meta">
        <div class="p-name post-av-link" data-uid="${p.uid}">${esc(p.displayName || 'Member')}</div>
        <div class="p-time">${timeAgo(p.createdAt)}</div>
      </div>
      ${isOwn ? `<button class="icon-btn delete-btn" data-id="${p.id}" title="Delete post">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>` : ''}
    </div>

    ${p.text ? `<div class="post-body">${linkifyText(p.text)}</div>` : ''}
    ${mediaHTML}

    ${rxHTML ? `<div class="rx-pills">${rxHTML}</div>` : ''}

    <div class="post-actions">
      <button class="act-btn like-btn${liked ? ' liked' : ''}" data-id="${p.id}">
        <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}"
             stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06
                   a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78
                   1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>${lc ? lc : 'Like'}
      </button>

      <button class="act-btn comment-btn" data-id="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>${p.commentCount || 'Comment'}
      </button>

      <div class="rx-trigger-wrap">
        <button class="act-btn rx-trigger" data-id="${p.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>React
        </button>
        <div class="rx-picker" id="rxp-${p.id}">
          ${REACTIONS.map(e => `<button class="rx-opt" data-id="${p.id}" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      </div>

      <button class="act-btn bookmark-btn${saved ? ' saved' : ''}" data-id="${p.id}" title="${saved ? 'Remove bookmark' : 'Bookmark'}">
        <svg viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}"
             stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <button class="act-btn share-btn" data-id="${p.id}" style="margin-left:auto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49"/>
        </svg>
      </button>
    </div>

    <div class="comment-section" id="cs-${p.id}"></div>
  </div>`;
}

/* ════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════ */
function _attachPostListeners() {
  /* LIKE */
  document.querySelectorAll('.like-btn').forEach(b => b.addEventListener('click', async () => {
    if (!ICE.me || ICE.me.isAnonymous) { toast('Sign in to like posts'); return; }
    const id   = b.dataset.id;
    const post = ICE.posts.find(x => x.id === id);
    if (!post) return;
    const has = post.likes?.includes(ICE.me.uid);
    await ICE.db.collection('posts').doc(id).update({
      likes: has
        ? firebase.firestore.FieldValue.arrayRemove(ICE.me.uid)
        : firebase.firestore.FieldValue.arrayUnion(ICE.me.uid),
    });
  }));

  /* COMMENTS TOGGLE */
  document.querySelectorAll('.comment-btn').forEach(b => b.addEventListener('click', () => {
    const id  = b.dataset.id;
    const sec = document.getElementById('cs-' + id);
    const open = !sec.dataset.open;
    sec.dataset.open = open ? '1' : '';
    if (open) renderCommentSection(id);
    else sec.innerHTML = '';
  }));

  /* REACTIONS PICKER */
  document.querySelectorAll('.rx-trigger').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const id  = b.dataset.id;
    const picker = document.getElementById('rxp-' + id);
    document.querySelectorAll('.rx-picker.open').forEach(p => { if (p !== picker) p.classList.remove('open'); });
    picker?.classList.toggle('open');
  }));

  document.addEventListener('click', () =>
    document.querySelectorAll('.rx-picker.open').forEach(p => p.classList.remove('open'))
  );

  document.querySelectorAll('.rx-opt, .rx-pill').forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    if (!ICE.me || ICE.me.isAnonymous) { toast('Sign in to react'); return; }
    const { id, emoji } = b.dataset;
    const post  = ICE.posts.find(x => x.id === id);
    const field = `reactions.${emoji}`;
    const list  = post?.reactions?.[emoji] || [];
    const has   = list.includes(ICE.me.uid);
    await ICE.db.collection('posts').doc(id).update({
      [field]: has
        ? firebase.firestore.FieldValue.arrayRemove(ICE.me.uid)
        : firebase.firestore.FieldValue.arrayUnion(ICE.me.uid),
    }).catch(err => toast('Error: ' + err.message));
    document.getElementById('rxp-' + id)?.classList.remove('open');
  }));

  /* BOOKMARK */
  document.querySelectorAll('.bookmark-btn').forEach(b => b.addEventListener('click', () => {
    toggleBookmark(b.dataset.id);
    renderPosts();
    toast(isBookmarked(b.dataset.id) ? 'Bookmarked ❄️' : 'Bookmark removed');
  }));

  /* SHARE */
  document.querySelectorAll('.share-btn').forEach(b => b.addEventListener('click', () => {
    const url = `${location.origin}${location.pathname}?p=${b.dataset.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast('Link copied!'))
      .catch(() => toast('Link: ' + url));
  }));

  /* DELETE */
  document.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await ICE.db.collection('posts').doc(b.dataset.id)
      .delete()
      .catch(err => toast('Error: ' + err.message));
    toast('Post deleted');
  }));

  /* MEDIA LIGHTBOX */
  document.querySelectorAll('.mi').forEach(m => m.addEventListener('click', e => {
    if (m.dataset.type === 'video' && e.target.tagName === 'VIDEO') return;
    openLightbox(m.dataset.src, m.dataset.type);
  }));

  /* HASHTAG FILTER */
  document.querySelectorAll('.tag').forEach(t => t.addEventListener('click', () => {
    const tag = t.dataset.tag;
    const filtered = ICE.posts.filter(p =>
      p.text?.toLowerCase().includes('#' + tag.toLowerCase())
    );
    const wrap = document.getElementById('posts-wrap');
    wrap.innerHTML = `
      <div class="tag-filter-banner">
        <span>#${esc(tag)}</span>
        <button onclick="setFilter('all');renderPosts()">✕ Clear</button>
      </div>`;
    wrap.innerHTML += filtered.map(postCard).join('');
    _attachPostListeners();
  }));

  /* PROFILE LINK */
  document.querySelectorAll('.post-av-link').forEach(el => el.addEventListener('click', () => {
    const uid = el.dataset.uid;
    if (uid && typeof openProfileModal === 'function') openProfileModal(uid);
  }));
}

/* ════════════════════════════════════════
   BOOKMARKS (localStorage)
════════════════════════════════════════ */
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('ice_bookmarks') || '[]'); }
  catch { return []; }
}
function isBookmarked(id) { return getBookmarks().includes(id); }
function toggleBookmark(id) {
  const saved = getBookmarks();
  const idx   = saved.indexOf(id);
  if (idx > -1) saved.splice(idx, 1); else saved.push(id);
  localStorage.setItem('ice_bookmarks', JSON.stringify(saved));
}
