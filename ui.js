/**
 * ui.js
 * Shared UI utilities:
 *   - toast()          short notification pop
 *   - showLightbox()   full-screen media viewer
 *   - esc()            HTML-escape helper
 *   - timeAgo()        relative timestamp
 *   - avatarHTML()     generate avatar img or letter-fallback
 *   - initFilters()    wire up feed filter tabs
 *   - renderNav()      build the top-nav avatar / dropdown
 *   - setFilter()      change active feed filter
 */

/* ─── helpers ─── */
window.esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g,  '&lt;')
  .replace(/>/g,  '&gt;')
  .replace(/"/g,  '&quot;');

window.timeAgo = ts => {
  if (!ts) return 'just now';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)      return 'just now';
  if (s < 3600)    return Math.floor(s / 60)    + 'm ago';
  if (s < 86400)   return Math.floor(s / 3600)  + 'h ago';
  if (s < 604800)  return Math.floor(s / 86400) + 'd ago';
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' });
};

window.initials = name =>
  (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Returns an <img> or a letter-placeholder div */
window.avatarHTML = (photoURL, name, imgCls = 'p-avatar', letterCls = 'p-avatar-letter') =>
  photoURL
    ? `<img class="${imgCls}" src="${esc(photoURL)}" alt="${esc(name || '')}" loading="lazy"/>`
    : `<div class="${letterCls}">${initials(name)}</div>`;

/** Wrap #hashtags and @mentions */
window.linkifyText = raw => {
  return esc(raw)
    .replace(/#(\w+)/g, '<span class="tag" data-tag="$1">#$1</span>')
    .replace(/@(\w+)/g, '<span class="mention">@$1</span>');
};

/* ─── TOAST ─── */
let _toastTimer = null;
window.toast = (msg, duration = 2800) => {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
};

/* ─── LIGHTBOX ─── */
window.openLightbox = (src, type = 'image') => {
  const lb  = document.getElementById('lightbox');
  const lbc = document.getElementById('lb-content');
  if (!lb || !lbc) return;
  lbc.innerHTML = type === 'video'
    ? `<video src="${esc(src)}" controls autoplay style="max-width:92vw;max-height:92vh;border-radius:10px;outline:none"></video>`
    : `<img   src="${esc(src)}"          style="max-width:92vw;max-height:92vh;border-radius:10px;object-fit:contain" alt="Media"/>`;
  lb.classList.add('open');
};

window.closeLightbox = () => {
  const lb  = document.getElementById('lightbox');
  const lbc = document.getElementById('lb-content');
  if (lb)  lb.classList.remove('open');
  if (lbc) lbc.innerHTML = '';
};

/* ─── FILTER TABS ─── */
window.setFilter = filter => {
  ICE.filter = filter;
  // sync all [data-f] buttons
  document.querySelectorAll('[data-f]').forEach(el =>
    el.classList.toggle('active', el.dataset.f === filter)
  );
  // re-render
  if (typeof renderPosts === 'function') renderPosts();
};

window.initFilters = () => {
  document.querySelectorAll('[data-f]').forEach(btn =>
    btn.addEventListener('click', () => setFilter(btn.dataset.f))
  );
};

/* ─── NAV ─── */
window.renderNav = user => {
  const wrap = document.getElementById('nav-av-wrap');
  if (!wrap) return;

  if (user && !user.isAnonymous) {
    const profile = ICE.myProfile || {};
    const photo   = profile.photoURL || user.photoURL;
    const name    = profile.displayName || user.displayName || 'Member';

    wrap.innerHTML = photo
      ? `<img class="nav-avatar" src="${esc(photo)}" alt="avatar" id="nav-av-el"/>`
      : `<div class="nav-avatar-letter" id="nav-av-el">${initials(name)}</div>`;

    document.getElementById('dd-name').textContent  = name;
    document.getElementById('dd-email').textContent = user.email || 'Anonymous';

    const el = document.getElementById('nav-av-el');
    el.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('dropdown').classList.toggle('open');
    });
  } else {
    wrap.innerHTML = `<button class="btn-signin-nav" id="nav-signin-btn">Sign in</button>`;
    document.getElementById('nav-signin-btn').addEventListener('click', () => {
      document.getElementById('main-app').style.display   = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    });
    document.getElementById('dd-name').textContent  = 'Guest';
    document.getElementById('dd-email').textContent = 'Not signed in';
  }

  // always wire dropdown close
  document.addEventListener('click', () =>
    document.getElementById('dropdown')?.classList.remove('open')
  );
};

/* ─── Skeleton loader ─── */
window.skeletonCard = () => `
  <div class="skeleton-card">
    <div class="skel-row">
      <div class="skel skel-circle"></div>
      <div style="flex:1">
        <div class="skel skel-line" style="width:40%;height:12px;margin-bottom:6px"></div>
        <div class="skel skel-line" style="width:25%;height:10px"></div>
      </div>
    </div>
    <div class="skel skel-line" style="width:90%;height:13px;margin-top:14px"></div>
    <div class="skel skel-line" style="width:70%;height:13px;margin-top:8px"></div>
    <div class="skel skel-block"></div>
  </div>`;
