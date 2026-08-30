'use strict';

/* ============================================
   MUZICĂ — două categorii: "Melodiile Regatului" (kingdom)
   și "Melodii Internaționale" (intl). Ambele folosesc același
   cod, parametrizat prin `category`, dar au liste, contoare și
   „continuă ascultarea" separate. Modalul de adăugare și
   player-ul audio sunt comune (un singur modal/player pe ecran),
   dar știu mereu pentru ce categorie lucrează.
   ============================================ */
const MUSIC_CATEGORIES = {
  kingdom: {
    stateKey: 'songs',
    lastPlayedKey: 'lastPlayedSongId',
    listId: 'music-cards-list',
    countId: 'music-count',
    emptyId: 'music-empty',
    continueCardId: 'continue-listen-card',
    continueTitleId: 'continue-listen-title',
    continueTimeId: 'continue-listen-time',
    continueBtnId: 'continue-listen-btn',
    addedLabel: 'Melodie',
  },
  intl: {
    stateKey: 'songsIntl',
    lastPlayedKey: 'lastPlayedSongIntlId',
    listId: 'music-cards-list-intl',
    countId: 'music-count-intl',
    emptyId: 'music-empty-intl',
    continueCardId: 'continue-listen-card-intl',
    continueTitleId: 'continue-listen-title-intl',
    continueTimeId: 'continue-listen-time-intl',
    continueBtnId: 'continue-listen-btn-intl',
    addedLabel: 'Melodie internațională',
  },
};

const songBlobs = {}; // songBlobs[id] = { name, url } — doar în memorie
let currentPlayingSongId = null;
let currentPlayingCategory = null;
let pendingAddCategory = 'kingdom';
let songPositionSaveTimer = null;

function songsOf(category) {
  const key = MUSIC_CATEGORIES[category].stateKey;
  if (!Array.isArray(state[key])) state[key] = [];
  return state[key];
}

function categoryOfSongId(id) {
  if (state.songs?.some(s => s.id === id)) return 'kingdom';
  if (state.songsIntl?.some(s => s.id === id)) return 'intl';
  return null;
}

function initMusicOnce() {
  document.getElementById('song-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('song-modal')) closeAddSongModal();
  });
  document.getElementById('song-title-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNewSong();
  });

  document.getElementById('aplayer-close')?.addEventListener('click', closeAudioPlayer);
  document.getElementById('aplayer-exit')?.addEventListener('click', closeAudioPlayer);
  document.getElementById('aplayer-next')?.addEventListener('click', () => playAdjacentSong(1));
  document.getElementById('aplayer-prev')?.addEventListener('click', () => playAdjacentSong(-1));
  document.getElementById('audio-player-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('audio-player-modal')) closeAudioPlayer();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeAddSongModal(); closeAudioPlayer(); }
  });

  Object.entries(MUSIC_CATEGORIES).forEach(([category, cfg]) => {
    document.getElementById(cfg.continueBtnId)?.addEventListener('click', () => {
      const lastId = state[cfg.lastPlayedKey];
      if (lastId) openAudioPlayer(lastId, category);
    });

    const list = document.getElementById(cfg.listId);
    list?.addEventListener('input', e => {
      if (!e.target.classList.contains('vslot-title-input')) return;
      const song = songsOf(category).find(s => s.id === e.target.dataset.slot);
      if (song) song.title = e.target.value;
    });
    list?.addEventListener('blur', e => {
      if (!e.target.classList || !e.target.classList.contains('vslot-title-input')) return;
      const song = songsOf(category).find(s => s.id === e.target.dataset.slot);
      if (song && !e.target.value.trim()) e.target.value = song.title = 'Melodie fără titlu';
      saveState();
    }, true);
    list?.addEventListener('click', e => {
      const playBtn = e.target.closest('.vslot-play');
      if (playBtn) { openAudioPlayer(playBtn.dataset.slot, category); return; }

      const delBtn = e.target.closest('.vslot-delete');
      if (delBtn) { deleteSong(delBtn.dataset.slot, category); return; }

      const pickLabel = e.target.closest('.vslot-pick');
      if (pickLabel) { e.preventDefault(); reconnectSongFile(pickLabel.dataset.slot, category); return; }
    });
  });
}

// ── Adăugare melodie nouă (titlu + selectare fișier) ──
function openAddSongModal(category = 'kingdom') {
  pendingAddCategory = category;
  const titleEl = document.getElementById('song-modal-title');
  if (titleEl) titleEl.textContent = category === 'intl' ? 'Melodie internațională nouă' : 'Melodie nouă';
  document.getElementById('song-modal')?.classList.remove('hidden');
  document.getElementById('song-title-input')?.focus();
}
function closeAddSongModal() {
  document.getElementById('song-modal')?.classList.add('hidden');
  document.getElementById('song-title-input').value = '';
}

async function saveNewSong() {
  const titleIn = document.getElementById('song-title-input');
  const title = titleIn.value.trim();
  if (!title) { showToast('Introdu un titlu pentru melodie!', 'error'); return; }
  const category = pendingAddCategory;
  closeAddSongModal();
  await pickFileForNewSong(title, category);
}

async function pickFileForNewSong(title, category = 'kingdom') {
  const id = `s${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cfg = MUSIC_CATEGORIES[category];

  const finish = async (file, handle) => {
    songBlobs[id] = { name: file.name, url: URL.createObjectURL(file) };
    songsOf(category).push({ id, title, position: 0 });
    if (handle && supportsFileHandles) await saveHandle(`song-${id}`, handle).catch(() => {});
    saveState();
    renderMusicPanel(category);
    showToast(`„${title}" a fost adăugată! 🎵`, 'success');
  };

  if (supportsFileHandles) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Audio', accept: { 'audio/*': ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'] } }],
        multiple: false,
      });
      const file = await handle.getFile();
      await finish(file, handle);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      pickWithClassicInput(finish);
    }
  } else {
    pickWithClassicInput(finish);
  }
  void cfg; // rezervat pentru eventuale etichete specifice categoriei
}

function pickWithClassicInput(onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (file) onFile(file, null);
  });
  document.body.appendChild(input);
  input.click();
}

// ── Reconectare fișier existent (Chrome/Edge — după ce permisiunea a expirat) ──
async function reconnectSongFile(id, category) {
  category = category || categoryOfSongId(id) || 'kingdom';
  if (supportsFileHandles) {
    const handle = await getHandle(`song-${id}`).catch(() => null);
    if (handle) {
      try {
        const perm = await handle.requestPermission({ mode: 'read' });
        if (perm === 'granted') {
          const file = await handle.getFile();
          songBlobs[id] = { name: file.name, url: URL.createObjectURL(file) };
          renderMusicPanel(category);
          return;
        }
      } catch { /* trecem la selectare clasică mai jos */ }
    }
  }
  pickWithClassicInput((file) => {
    songBlobs[id] = { name: file.name, url: URL.createObjectURL(file) };
    renderMusicPanel(category);
  });
}

async function restoreSavedSongs() {
  if (!supportsFileHandles) return;
  for (const category of Object.keys(MUSIC_CATEGORIES)) {
    for (const song of songsOf(category)) {
      if (songBlobs[song.id]) continue;
      const handle = await getHandle(`song-${song.id}`).catch(() => null);
      if (!handle) continue;
      try {
        const perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          const file = await handle.getFile();
          songBlobs[song.id] = { name: file.name, url: URL.createObjectURL(file) };
        }
      } catch { /* rămâne needs-reconnect, afișat la randare */ }
    }
  }
}

function deleteSong(id, category) {
  category = category || categoryOfSongId(id) || 'kingdom';
  if (!confirm('Ștergi această melodie din listă? (fișierul de pe calculator nu este afectat)')) return;
  const list = songsOf(category);
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return;
  list.splice(idx, 1);
  if (songBlobs[id]) { URL.revokeObjectURL(songBlobs[id].url); delete songBlobs[id]; }
  const cfg = MUSIC_CATEGORIES[category];
  if (state[cfg.lastPlayedKey] === id) state[cfg.lastPlayedKey] = null;
  saveState();
  if (supportsFileHandles) deleteHandle(`song-${id}`).catch(() => {});
  renderMusicPanel(category);
  showToast('Melodie ștearsă 🗑️', 'success');
}

function formatSongTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function createSongSlotEl(song, index) {
  const el = document.createElement('div');
  const loaded = !!songBlobs[song.id];
  el.className = 'video-slot song-slot' + (loaded ? ' loaded' : '') + (song.id === currentPlayingSongId ? ' playing' : '');
  el.id = `sslot-${song.id}`;
  el.dataset.slot = song.id;
  el.innerHTML = `
    <div class="vslot-num">${index + 1}</div>
    <div class="vslot-info">
      <input type="text" class="vslot-title-input" data-slot="${song.id}" maxlength="120"
             value="${escHtml(song.title)}" placeholder="Titlu melodie..." />
      <div class="vslot-meta-row">
        <span class="vslot-status ${loaded ? 'loaded-status' : 'permission-status'}">
          ${loaded ? '✓ ' + escHtml(songBlobs[song.id].name) : '🔒 Apasă pe pictograma folder pentru a reconecta fișierul'}
        </span>
        ${song.position > 3 ? `<span class="vslot-watched-tag">⏱ ${formatSongTime(song.position)}</span>` : ''}
      </div>
    </div>
    <button class="vslot-play ${loaded ? '' : 'hidden'}" data-slot="${song.id}" title="Redă melodia">
      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
    <button class="vslot-pick" data-slot="${song.id}" title="${loaded ? 'Reconectează fișierul' : 'Selectează fișierul'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    </button>
    <button class="vslot-delete" data-slot="${song.id}" title="Șterge melodia" style="display:flex">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
  `;
  return el;
}

function renderMusicPanel(category) {
  if (category) {
    renderMusicCategoryPanel(category);
  } else {
    Object.keys(MUSIC_CATEGORIES).forEach(renderMusicCategoryPanel);
  }
}

function renderMusicCategoryPanel(category) {
  const cfg = MUSIC_CATEGORIES[category];
  const list = document.getElementById(cfg.listId);
  const countEl = document.getElementById(cfg.countId);
  const emptyEl = document.getElementById(cfg.emptyId);
  if (!list) return;

  const songs = songsOf(category);
  if (countEl) countEl.textContent = `${songs.length} melodii`;

  list.querySelectorAll('.song-slot').forEach(el => el.remove());
  if (songs.length === 0) {
    if (emptyEl) emptyEl.style.display = '';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    songs.forEach((song, i) => list.appendChild(createSongSlotEl(song, i)));
  }

  // Card "Continuă ascultarea"
  const continueCard = document.getElementById(cfg.continueCardId);
  const lastSong = songs.find(s => s.id === state[cfg.lastPlayedKey]);
  if (continueCard) {
    if (lastSong && lastSong.position > 3) {
      continueCard.classList.remove('hidden');
      document.getElementById(cfg.continueTitleId).textContent = lastSong.title;
      document.getElementById(cfg.continueTimeId).textContent = `de la ${formatSongTime(lastSong.position)}`;
    } else {
      continueCard.classList.add('hidden');
    }
  }
}

/* ── Player audio (comun ambelor categorii) ── */
function openAudioPlayer(id, category) {
  category = category || categoryOfSongId(id) || 'kingdom';
  if (!songBlobs[id]) { reconnectSongFile(id, category); return; }
  const song = songsOf(category).find(s => s.id === id);
  if (!song) return;

  const modal = document.getElementById('audio-player-modal');
  const audioEl = document.getElementById('aplayer-el');
  const titleEl = document.getElementById('aplayer-title');

  currentPlayingSongId = id;
  currentPlayingCategory = category;
  state[MUSIC_CATEGORIES[category].lastPlayedKey] = id;
  audioEl.src = songBlobs[id].url;
  titleEl.textContent = song.title;
  modal.classList.remove('hidden');

  const resumeAt = song.position || 0;
  const resumeOnce = () => {
    if (resumeAt > 2 && resumeAt < audioEl.duration - 2) {
      audioEl.currentTime = resumeAt;
      showToast(`▶️ Continuă de la ${formatSongTime(resumeAt)}`, 'success');
    }
    audioEl.removeEventListener('loadedmetadata', resumeOnce);
  };
  audioEl.addEventListener('loadedmetadata', resumeOnce);
  audioEl.play().catch(() => {});

  clearInterval(songPositionSaveTimer);
  songPositionSaveTimer = setInterval(saveSongPosition, 4000);
  audioEl.onpause = saveSongPosition;
  audioEl.onended = () => playAdjacentSong(1);

  renderMusicPanel(category);
}

function saveSongPosition() {
  if (currentPlayingSongId == null || !currentPlayingCategory) return;
  const audioEl = document.getElementById('aplayer-el');
  const song = songsOf(currentPlayingCategory).find(s => s.id === currentPlayingSongId);
  if (!song || !isFinite(audioEl.currentTime)) return;
  song.position = audioEl.currentTime;
  saveState();
}

function closeAudioPlayer() {
  const modal = document.getElementById('audio-player-modal');
  const audioEl = document.getElementById('aplayer-el');
  if (!modal || !audioEl) return;
  saveSongPosition();
  clearInterval(songPositionSaveTimer);
  audioEl.pause();
  audioEl.src = '';
  modal.classList.add('hidden');
  const playedCategory = currentPlayingCategory;
  currentPlayingSongId = null;
  currentPlayingCategory = null;
  saveState();
  renderMusicPanel(playedCategory);
}

function playAdjacentSong(dir) {
  if (!currentPlayingCategory) return;
  const songs = songsOf(currentPlayingCategory);
  const idx = songs.findIndex(s => s.id === currentPlayingSongId);
  if (idx === -1) return;
  let next = idx + dir;
  while (next >= 0 && next < songs.length && !songBlobs[songs[next].id]) next += dir;
  if (next < 0 || next >= songs.length) { closeAudioPlayer(); return; }
  openAudioPlayer(songs[next].id, currentPlayingCategory);
}
