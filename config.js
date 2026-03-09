/**
 * config.js
 * Firebase initialization + global ICE state namespace.
 * All other scripts read/write via window.ICE.
 */

const _firebaseConfig = {
  apiKey:            "AIzaSyAXUptUUcOkkjxhPW0X4mrOWivWLC-URrQ",
  authDomain:        "ice-cube-97847.firebaseapp.com",
  projectId:         "ice-cube-97847",
  storageBucket:     "ice-cube-97847.firebasestorage.app",
  messagingSenderId: "354070873862",
  appId:             "1:354070873862:web:7e8e7104e1a370c3e14087",
};

firebase.initializeApp(_firebaseConfig);

window.ICE = {
  /* Firebase handles */
  db:      firebase.firestore(),
  auth:    firebase.auth(),
  storage: firebase.storage(),

  /* Runtime state */
  me:            null,   // current firebase user object (or null)
  myProfile:     null,   // Firestore user doc {displayName, bio, photoURL, bannerURL, ...}
  posts:         [],     // latest loaded posts array
  filter:        'all',  // active feed filter
  presenceTimer: null,   // setInterval handle for presence pings
  unsubPosts:    null,   // Firestore onSnapshot unsubscribe fn

  /* Tunables */
  MAX_CHARS:    500,
  MAX_FILES:    4,
  MAX_IMAGE_MB: 15,
  MAX_VIDEO_MB: 100,
};
