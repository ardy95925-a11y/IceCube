/**
 * auth.js
 * Handles Google sign-in, anonymous guest, sign-out,
 * Firestore user-doc registration, and presence heartbeat.
 */

/* ── Google sign-in ── */
document.getElementById('btn-google')?.addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  ICE.auth.signInWithPopup(provider).catch(err => toast('Sign-in failed: ' + err.message));
});

/* ── Guest browse ── */
document.getElementById('btn-guest')?.addEventListener('click', () => {
  ICE.auth.signInAnonymously().catch(() => enterApp(null));
});

/* ── Sign-out (wired after nav renders) ── */
document.addEventListener('click', e => {
  if (e.target.id === 'dd-signout') {
    _stopPresence();
    if (ICE.unsubPosts) ICE.unsubPosts();
    ICE.auth.signOut().then(() => {
      ICE.me = null; ICE.myProfile = null; ICE.posts = [];
      document.getElementById('main-app').style.display   = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
    });
  }
});

/* ── Auth state listener ── */
ICE.auth.onAuthStateChanged(async user => {
  ICE.me = user || null;

  if (user && !user.isAnonymous) {
    await _registerUser(user);
    _startPresence(user);
  }

  enterApp(user);
});

/* ── Enter main app ── */
window.enterApp = async user => {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display    = 'block';

  // load Firestore profile doc before rendering nav
  if (user && !user.isAnonymous) {
    try {
      const snap = await ICE.db.collection('users').doc(user.uid).get();
      ICE.myProfile = snap.exists ? snap.data() : null;
    } catch { ICE.myProfile = null; }
  }

  renderNav(user);
  renderCompose(user);
  loadPosts();
  loadSidebar();
  initFilters();
};

/* ── Register / update user doc ── */
async function _registerUser(user) {
  const ref  = ICE.db.collection('users').doc(user.uid);
  const snap = await ref.get().catch(() => null);

  if (!snap || !snap.exists) {
    // first time — seed from Google profile
    await ref.set({
      displayName: user.displayName || 'Member',
      photoURL:    user.photoURL    || null,
      bannerURL:   null,
      bio:         '',
      joinedAt:    firebase.firestore.FieldValue.serverTimestamp(),
      lastSeen:    firebase.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
  }
}

/* ── Presence heartbeat ── */
function _startPresence(user) {
  _stopPresence();
  const update = () =>
    ICE.db.collection('users').doc(user.uid)
      .update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() })
      .catch(() => {});
  update();
  ICE.presenceTimer = setInterval(update, 45_000);
}

function _stopPresence() {
  if (ICE.presenceTimer) { clearInterval(ICE.presenceTimer); ICE.presenceTimer = null; }
}
