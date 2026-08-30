'use strict';

/* ============================================
   PLAYER VIDEO (redare, continuă de unde ai rămas, ieșire)
   ============================================ */
let currentPlayingSlot = null;
let positionSaveTimer = null;

function formatVideoTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function openVideoPlayer(slot, title) {
  if (!videoBlobs[slot]) return;
  const vPlayerModal = document.getElementById('video-player-modal');
  const vPlayerEl = document.getElementById('vplayer-el');
  const vPlayerTitle = document.getElementById('vplayer-title');

  currentPlayingSlot = slot;
  vPlayerEl.src = videoBlobs[slot].url;
  vPlayerTitle.textContent = title;
  vPlayerModal.classList.remove('hidden');

  const resumeAt = getVideoMeta(slot).position || 0;
  const resumeOnce = () => {
    if (resumeAt > 2 && resumeAt < vPlayerEl.duration - 3) {
      vPlayerEl.currentTime = resumeAt;
      showToast(`▶️ Continuă de la ${formatVideoTime(resumeAt)}`, 'success');
    }
    vPlayerEl.removeEventListener('loadedmetadata', resumeOnce);
  };
  vPlayerEl.addEventListener('loadedmetadata', resumeOnce);

  vPlayerEl.play().catch(() => {});

  clearInterval(positionSaveTimer);
  positionSaveTimer = setInterval(savePlaybackPosition, 4000);
  vPlayerEl.addEventListener('pause', savePlaybackPosition);
}

function savePlaybackPosition() {
  if (currentPlayingSlot == null) return;
  const vPlayerEl = document.getElementById('vplayer-el');
  const t = vPlayerEl.currentTime;
  if (!isFinite(t)) return;
  getVideoMeta(currentPlayingSlot).position = t;
  saveState();
}

function closeVideoPlayer() {
  const vPlayerModal = document.getElementById('video-player-modal');
  const vPlayerEl = document.getElementById('vplayer-el');
  if (!vPlayerModal || !vPlayerEl) return;
  savePlaybackPosition();
  clearInterval(positionSaveTimer);
  vPlayerEl.pause();
  vPlayerEl.src = '';
  vPlayerModal.classList.add('hidden');
  currentPlayingSlot = null;
}

