/**
 * comments.js
 * Per-post comment sections: render input + list,
 * load existing comments, send new ones.
 */

/** Called when the comment section is toggled open. */
window.renderCommentSection = async id => {
  const sec = document.getElementById('cs-' + id);
  if (!sec) return;

  const me = ICE.me;
  const canComment = me && !me.isAnonymous;

  sec.innerHTML = `
    ${canComment ? `
      <div class="comment-input-row">
        ${avatarHTML(ICE.myProfile?.photoURL || me?.photoURL, ICE.myProfile?.displayName || me?.displayName, 'c-av', 'c-av-letter')}
        <input class="comment-field" type="text" id="ci-${id}"
          placeholder="Write a comment…" autocomplete="off"/>
        <button class="btn-send" data-id="${id}">Send</button>
      </div>` : `
      <p class="sign-in-prompt">
        <a onclick="document.getElementById('auth-screen').style.display='flex';
                    document.getElementById('main-app').style.display='none'">
          Sign in</a> to comment
      </p>`
    }
    <div class="comment-list" id="cl-${id}">
      <div class="spinner" style="width:20px;height:20px;margin:.6rem auto"></div>
    </div>`;

  /* wire send button / enter key */
  document.getElementById('ci-' + id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') _sendComment(id);
  });
  document.querySelector(`.btn-send[data-id="${id}"]`)?.addEventListener('click', () => _sendComment(id));

  await _loadComments(id);
};

async function _loadComments(postId) {
  const list = document.getElementById('cl-' + postId);
  if (!list) return;

  try {
    const snap = await ICE.db.collection('posts').doc(postId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .limit(30)
      .get();

    if (snap.empty) {
      list.innerHTML = `<p class="no-comments">No comments yet — be the first!</p>`;
      return;
    }

    list.innerHTML = snap.docs.map(d => _commentHTML(d.data())).join('');
  } catch (err) {
    list.innerHTML = `<p class="no-comments" style="color:var(--red)">Failed to load comments.</p>`;
  }
}

async function _sendComment(postId) {
  const me = ICE.me;
  if (!me || me.isAnonymous) { toast('Sign in to comment'); return; }

  const field = document.getElementById('ci-' + postId);
  if (!field) return;
  const text = field.value.trim();
  if (!text) return;

  const profile  = ICE.myProfile || {};
  const sendName = profile.displayName || me.displayName || 'Member';
  const sendPhoto= profile.photoURL   || me.photoURL    || null;

  field.value    = '';
  field.disabled = true;

  try {
    await ICE.db.collection('posts').doc(postId).collection('comments').add({
      text,
      uid:         me.uid,
      displayName: sendName,
      photoURL:    sendPhoto,
      createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    });
    await ICE.db.collection('posts').doc(postId).update({
      commentCount: firebase.firestore.FieldValue.increment(1),
    });
    await _loadComments(postId);
  } catch (err) {
    toast('Could not send comment: ' + err.message);
    field.value = text; // restore text on failure
  } finally {
    field.disabled = false;
    field.focus();
  }
}

function _commentHTML(c) {
  return `
    <div class="comment-row">
      ${avatarHTML(c.photoURL, c.displayName, 'c-av', 'c-av-letter')}
      <div class="comment-bubble">
        <div class="comment-name">${esc(c.displayName || 'Member')}</div>
        <div class="comment-text">${esc(c.text)}</div>
        <div class="comment-time">${timeAgo(c.createdAt)}</div>
      </div>
    </div>`;
}
