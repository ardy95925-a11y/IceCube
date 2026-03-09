/**
 * profile.js
 * Profile modal: view any user's profile, posts, and (for own profile)
 * edit display name, bio, avatar, and banner image.
 */

/* ── Open modal ── */
window.openProfileModal = async uid => {
  if (!uid) return;

  // build modal shell immediately
  let modal = document.getElementById('profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-box profile-box" id="profile-box">
        <button class="modal-close" id="profile-close">✕</button>
        <div id="profile-content"><div class="spinner" style="margin:3rem auto"></div></div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('profile-close').addEventListener('click', closeProfileModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeProfileModal(); });
  }
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  await _renderProfile(uid);
};

window.closeProfileModal = () => {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
};

/* ── Load and render ── */
async function _renderProfile(uid) {
  const content = document.getElementById('profile-content');
  const isOwn   = ICE.me && !ICE.me.isAnonymous && ICE.me.uid === uid;

  try {
    const [userSnap, postsSnap] = await Promise.all([
      ICE.db.collection('users').doc(uid).get(),
      ICE.db.collection('posts').where('uid', '==', uid)
             .orderBy('createdAt', 'desc').limit(20).get(),
    ]);

    const u = userSnap.exists ? userSnap.data() : {
      displayName: 'Unknown',
      photoURL: null, bannerURL: null, bio: '',
    };

    const userPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    content.innerHTML = `
      <!-- BANNER -->
      <div class="profile-banner-wrap" id="prof-banner-wrap"
           style="background-image:${u.bannerURL ? `url('${esc(u.bannerURL)}')` : 'none'}">
        ${isOwn ? `<label class="banner-edit-btn" title="Change banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <input type="file" id="banner-file" accept="image/*" style="display:none"/>
        </label>` : ''}
      </div>

      <!-- AVATAR + NAME -->
      <div class="profile-head">
        <div class="profile-av-wrap">
          ${avatarHTML(u.photoURL, u.displayName, 'profile-av', 'profile-av-letter')}
          ${isOwn ? `<label class="av-edit-btn" title="Change avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <input type="file" id="avatar-file" accept="image/*" style="display:none"/>
          </label>` : ''}
        </div>

        <div class="profile-info">
          <div id="prof-name-display" class="profile-name">${esc(u.displayName || 'Member')}</div>
          <div id="prof-bio-display"  class="profile-bio">${u.bio ? esc(u.bio) : (isOwn ? '<em style="color:var(--muted)">No bio yet — add one below</em>' : '')}</div>
          <div class="profile-joined">
            ❄️ Joined ${u.joinedAt ? timeAgo(u.joinedAt) : 'a while ago'}
            · ${userPosts.length} post${userPosts.length !== 1 ? 's' : ''}
          </div>
        </div>

        ${isOwn ? `<button class="btn-edit-profile" id="btn-edit-toggle">Edit profile</button>` : ''}
      </div>

      <!-- EDIT FORM (own only) -->
      ${isOwn ? `
      <div class="profile-edit-form" id="profile-edit-form" style="display:none">
        <label class="form-label">Display name
          <input class="form-input" id="edit-name" type="text" value="${esc(u.displayName || '')}" maxlength="32"/>
        </label>
        <label class="form-label">Bio
          <textarea class="form-input" id="edit-bio" rows="3" maxlength="160">${esc(u.bio || '')}</textarea>
        </label>
        <div class="edit-actions">
          <button class="btn-save-profile" id="btn-save-profile">Save changes</button>
          <button class="btn-cancel-edit"  id="btn-cancel-edit">Cancel</button>
        </div>
      </div>` : ''}

      <!-- POSTS GRID -->
      <div class="profile-posts-header">Posts</div>
      <div class="profile-posts-grid" id="profile-posts-grid">
        ${userPosts.length === 0
          ? '<p class="no-comments" style="padding:1rem">No posts yet.</p>'
          : userPosts.map(p => _profilePostThumb(p)).join('')}
      </div>`;

    /* ── wire edit form ── */
    if (isOwn) {
      document.getElementById('btn-edit-toggle')?.addEventListener('click', () => {
        const form = document.getElementById('profile-edit-form');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
      document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
        document.getElementById('profile-edit-form').style.display = 'none';
      });
      document.getElementById('btn-save-profile')?.addEventListener('click', () => _saveProfile(uid));

      /* avatar upload */
      document.getElementById('avatar-file')?.addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        const btn = document.querySelector('.av-edit-btn');
        btn.style.opacity = '.4';
        try {
          const url = await uploadSingleFile(file, `avatars/${uid}/avatar_${Date.now()}`);
          await ICE.db.collection('users').doc(uid).update({ photoURL: url });
          ICE.myProfile = { ...ICE.myProfile, photoURL: url };
          toast('Avatar updated!');
          renderNav(ICE.me);
          await _renderProfile(uid);
        } catch (err) { toast('Avatar upload failed: ' + err.message); }
        finally { btn.style.opacity = '1'; }
      });

      /* banner upload */
      document.getElementById('banner-file')?.addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const url = await uploadSingleFile(file, `banners/${uid}/banner_${Date.now()}`);
          await ICE.db.collection('users').doc(uid).update({ bannerURL: url });
          ICE.myProfile = { ...ICE.myProfile, bannerURL: url };
          toast('Banner updated!');
          document.getElementById('prof-banner-wrap').style.backgroundImage = `url('${url}')`;
        } catch (err) { toast('Banner upload failed: ' + err.message); }
      });
    }

    /* post thumbs click */
    document.querySelectorAll('.profile-post-thumb').forEach(el => {
      el.addEventListener('click', () => {
        const src  = el.dataset.src;
        const type = el.dataset.type;
        if (src) openLightbox(src, type);
      });
    });

  } catch (err) {
    content.innerHTML = `<div class="empty"><p>Could not load profile: ${esc(err.message)}</p></div>`;
  }
}

async function _saveProfile(uid) {
  const name = document.getElementById('edit-name')?.value.trim();
  const bio  = document.getElementById('edit-bio')?.value.trim();
  if (!name) { toast('Display name cannot be empty'); return; }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    await ICE.db.collection('users').doc(uid).update({ displayName: name, bio });
    ICE.myProfile = { ...ICE.myProfile, displayName: name, bio };
    document.getElementById('prof-name-display').textContent = name;
    document.getElementById('prof-bio-display').textContent  = bio || '';
    document.getElementById('profile-edit-form').style.display = 'none';
    renderNav(ICE.me);
    toast('Profile saved! ❄️');
  } catch (err) { toast('Save failed: ' + err.message); }
  finally { btn.disabled = false; btn.textContent = 'Save changes'; }
}

function _profilePostThumb(p) {
  const firstMedia = p.mediaUrls?.[0];
  const firstType  = p.mediaTypes?.[0] || 'image';

  if (firstMedia) {
    return `<div class="profile-post-thumb" data-src="${esc(firstMedia)}" data-type="${firstType}">
      ${firstType === 'video'
        ? `<video src="${esc(firstMedia)}" muted style="width:100%;height:100%;object-fit:cover"></video>`
        : `<img src="${esc(firstMedia)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt=""/>`}
    </div>`;
  }
  // text-only post
  return `<div class="profile-post-thumb profile-post-text">
    <span>${esc((p.text || '').slice(0, 60))}${p.text?.length > 60 ? '…' : ''}</span>
  </div>`;
}
