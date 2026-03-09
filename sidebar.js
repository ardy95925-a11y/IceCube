/**
 * sidebar.js
 * Right-sidebar widgets — all 100 % real Firebase data:
 *   - Community stats (member count, post count)
 *   - Online users  (lastSeen within 3 min, auto-refresh 90 s)
 *   - Trending tags (parsed from post texts, sorted by count)
 */

window.loadSidebar = () => {
  _loadStats();
  _loadOnlineUsers();
  // trending is computed from posts once they arrive (computeTrending called from posts.js)
};

/* ── Stats ── */
async function _loadStats() {
  try {
    const snap = await ICE.db.collection('users').get();
    const el   = document.getElementById('stat-members');
    if (el) el.textContent = snap.size >= 1000 ? '1k+' : String(snap.size);
  } catch {
    const el = document.getElementById('stat-members');
    if (el) el.textContent = '—';
  }
}

/* ── Online users ── */
async function _loadOnlineUsers() {
  const WINDOW_MS = 3 * 60 * 1000;   // 3 minutes = "online"
  const cutoff    = new Date(Date.now() - WINDOW_MS);

  const list    = document.getElementById('online-list');
  const badge   = document.getElementById('online-badge');
  const navNum  = document.getElementById('online-count-num');

  try {
    const snap = await ICE.db.collection('users')
      .where('lastSeen', '>', firebase.firestore.Timestamp.fromDate(cutoff))
      .orderBy('lastSeen', 'desc')
      .limit(10)
      .get();

    const count = snap.size;
    if (badge)  badge.textContent  = count;
    if (navNum) navNum.textContent = count;

    if (!list) return;

    if (snap.empty) {
      list.innerHTML = `<div class="no-online">No one active right now</div>`;
    } else {
      list.innerHTML = snap.docs.map(d => {
        const u = d.data();
        return `<div class="online-item" data-uid="${d.id}">
          ${avatarHTML(u.photoURL, u.displayName, 'online-av', 'online-av-letter')}
          <span class="online-name">${esc(u.displayName || 'Member')}</span>
          <span class="online-dot-wrap"><span class="online-dot"></span></span>
        </div>`;
      }).join('');

      // clicking a user opens their profile
      list.querySelectorAll('.online-item').forEach(el =>
        el.addEventListener('click', () => openProfileModal(el.dataset.uid))
      );
    }
  } catch {
    if (list)   list.innerHTML   = `<div class="no-online">—</div>`;
    if (navNum) navNum.textContent = '—';
  }

  // schedule next refresh
  setTimeout(_loadOnlineUsers, 90_000);
}

/* ── Trending tags ── */
window.computeTrending = () => {
  const counts = {};
  ICE.posts.forEach(p => {
    if (!p.text) return;
    const tags = p.text.match(/#(\w+)/gi) || [];
    tags.forEach(t => {
      const k = t.toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const el = document.getElementById('trending-list');
  if (!el) return;

  if (!sorted.length) {
    el.innerHTML = `<div class="no-trends">No hashtags yet.<br>Use #tags in posts.</div>`;
    return;
  }

  el.innerHTML = sorted.map(([tag, n]) => `
    <div class="trend-item" data-tag="${esc(tag.slice(1))}">
      <span class="trend-tag">${esc(tag)}</span>
      <span class="trend-count">${n}</span>
    </div>`).join('');

  el.querySelectorAll('.trend-item').forEach(item =>
    item.addEventListener('click', () => {
      const tag = item.dataset.tag;
      const filtered = ICE.posts.filter(p =>
        p.text?.toLowerCase().includes('#' + tag.toLowerCase())
      );
      const wrap = document.getElementById('posts-wrap');
      wrap.innerHTML = `
        <div class="tag-filter-banner">
          <span>#${esc(tag)}</span>
          <button onclick="setFilter('all');renderPosts()">✕ Clear</button>
        </div>` + filtered.map(postCard).join('');
      // re-attach after innerHTML swap
      if (typeof _attachPostListeners === 'function') {
        // posts.js exposes this internally; call renderPosts with override instead
        renderPosts(filtered);
      }
    })
  );
};
