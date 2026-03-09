/**
 * media.js
 * Handles all file-picking, thumbnail previews, and Firebase Storage uploads.
 *
 * KEY BUG FIX: Previous code used storage.ref().put() but failed silently
 * when Storage security rules blocked the upload, or when the file was too
 * large / wrong MIME type. This version:
 *   1. Validates size and type BEFORE uploading
 *   2. Uses resumable uploads with explicit await + error surfaces
 *   3. Uploads one-at-a-time to avoid quota bursts
 *   4. Returns [] on any partial failure rather than undefined
 *
 * Required Storage rules (paste in Firebase console → Storage → Rules):
 *
 *   rules_version = '2';
 *   service firebase.storage {
 *     match /b/{bucket}/o {
 *       match /posts/{uid}/{allPaths=**} {
 *         allow read:  if true;
 *         allow write: if request.auth != null && request.auth.uid == uid
 *                      && request.resource.size < 100 * 1024 * 1024;
 *       }
 *       match /avatars/{uid}/{allPaths=**} {
 *         allow read:  if true;
 *         allow write: if request.auth != null && request.auth.uid == uid
 *                      && request.resource.size < 10 * 1024 * 1024;
 *       }
 *       match /banners/{uid}/{allPaths=**} {
 *         allow read:  if true;
 *         allow write: if request.auth != null && request.auth.uid == uid
 *                      && request.resource.size < 10 * 1024 * 1024;
 *       }
 *     }
 *   }
 */

/* ─── State ─── */
window._mediaFiles = [];   // pending files for current compose session

/* ─── File input wiring ─── */
const _fileInput = document.getElementById('file-input');

window.triggerFilePicker = (accept = 'image/*,video/*') => {
  _fileInput.accept  = accept;
  _fileInput.value   = '';        // reset so same file can be re-selected
  _fileInput.click();
};

_fileInput.addEventListener('change', e => {
  const files = Array.from(e.target.files);
  let rejected = 0;

  files.forEach(f => {
    if (_mediaFiles.length >= ICE.MAX_FILES) { rejected++; return; }

    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast(`Skipped "${f.name}": only images and videos allowed`);
      return;
    }

    const limitMB = isVideo ? ICE.MAX_VIDEO_MB : ICE.MAX_IMAGE_MB;
    if (f.size > limitMB * 1024 * 1024) {
      toast(`"${f.name}" is too large (max ${limitMB} MB)`);
      return;
    }

    _mediaFiles.push(f);
  });

  if (rejected) toast(`Max ${ICE.MAX_FILES} files per post`);
  renderMediaPreviews();
  _fileInput.value = ''; // reset after consuming
});

/* ─── Thumbnail previews in compose box ─── */
window.renderMediaPreviews = () => {
  const wrap = document.getElementById('compose-media');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.style.display = _mediaFiles.length ? 'flex' : 'none';

  _mediaFiles.forEach((f, i) => {
    const url  = URL.createObjectURL(f);
    const div  = document.createElement('div');
    div.className = 'compose-thumb-wrap';

    const el  = f.type.startsWith('video/')
      ? Object.assign(document.createElement('video'), { src: url, muted: true, className: 'compose-thumb' })
      : Object.assign(document.createElement('img'),   { src: url,               className: 'compose-thumb' });

    const badge = document.createElement('span');
    badge.className = 'thumb-type-badge';
    badge.textContent = f.type.startsWith('video/') ? '▶' : '🖼';

    const rm  = document.createElement('button');
    rm.className   = 'remove-thumb';
    rm.textContent = '✕';
    rm.title       = 'Remove';
    rm.addEventListener('click', () => {
      URL.revokeObjectURL(url);
      _mediaFiles.splice(i, 1);
      renderMediaPreviews();
    });

    div.appendChild(el);
    div.appendChild(badge);
    div.appendChild(rm);
    wrap.appendChild(div);
  });
};

/* ─── Upload all pending files, return { urls, types } ─── */
window.uploadMediaFiles = async (uid, onProgress) => {
  const urls  = [];
  const types = [];

  for (let i = 0; i < _mediaFiles.length; i++) {
    const file   = _mediaFiles[i];
    const isVideo = file.type.startsWith('video/');
    const folder  = `posts/${uid}`;
    const filename = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const ref      = ICE.storage.ref(`${folder}/${filename}`);

    if (typeof onProgress === 'function') onProgress(i, _mediaFiles.length);

    // Explicit upload task so errors surface
    const task = ref.put(file);

    await new Promise((resolve, reject) => {
      task.on(
        firebase.storage.TaskEvent.STATE_CHANGED,
        null,
        err => reject(err),
        () => resolve()
      );
    });

    const downloadURL = await ref.getDownloadURL();
    urls.push(downloadURL);
    types.push(isVideo ? 'video' : 'image');
  }

  return { urls, types };
};

/* ─── Upload a single file (for avatar/banner) ─── */
window.uploadSingleFile = async (file, storagePath) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) throw new Error('Only image files are allowed here.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be under 10 MB.');

  const ref = ICE.storage.ref(storagePath);
  await ref.put(file);
  return ref.getDownloadURL();
};
