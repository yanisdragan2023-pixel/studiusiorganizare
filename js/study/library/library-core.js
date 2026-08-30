'use strict';

/* ============================================
   StudiuMeu – BIBLIOTECĂ
   Mutat din aplicația "Studiu Personal": Publicații
   (linkuri/PDF-uri de pe jw.org) + Materiale Video.

   Notă privind confidențialitatea: fișierele video NU sunt
   niciodată încărcate nicăieri și NU sunt stocate ca atare —
   sunt citite direct din calculator. Doar titlul, starea
   "vizionat", poziția de redare și — acolo unde browserul
   permite — o "legătură" către locația fișierului (nu
   conținutul lui!) sunt salvate local (state / IndexedDB).
   ============================================ */

// ── Tab-uri mari: Publicații / Materiale Video ──
function switchLibTab(target) {
  document.querySelectorAll('.lib-big-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${target}`)?.classList.add('active');

  const panels = { pub: 'lib-pub', video: 'lib-video', music: 'lib-music' };
  Object.entries(panels).forEach(([key, panelId]) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    panel.classList.toggle('active', key === target);
    panel.classList.toggle('hidden', key !== target);
  });

  if (target === 'music' && !musicInitialized) {
    musicInitialized = true;
    restoreSavedSongs().then(renderMusicPanel);
  }
}

// ── Randare generală a paginii Bibliotecă (apelată la navigare) ──
let libraryInitialized = false;
let musicInitialized = false;

function renderLibraryPage() {
  if (!Array.isArray(state.publications)) state.publications = [];
  if (!state.videoMeta || typeof state.videoMeta !== 'object') state.videoMeta = {};
  if (!Array.isArray(state.songs)) state.songs = [];
  if (!Array.isArray(state.songsIntl)) state.songsIntl = [];

  if (!libraryInitialized) {
    initLibraryOnce();
    initMusicOnce();
    libraryInitialized = true;
  }
  renderPubs();
  renderVideoSlots();
  if (musicInitialized) renderMusicPanel();
}

function initLibraryOnce() {
  // Închidere modale la click pe overlay / Escape
  document.getElementById('pub-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('pub-modal')) closePubModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePubModal();
      if (typeof closeVideoPlayer === 'function') closeVideoPlayer();
    }
  });

  document.getElementById('reset-titles-btn')?.addEventListener('click', resetEpisodeTitles);
  document.getElementById('vplayer-close')?.addEventListener('click', closeVideoPlayer);
  document.getElementById('vplayer-exit')?.addEventListener('click', closeVideoPlayer);
  document.getElementById('video-player-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('video-player-modal')) closeVideoPlayer();
  });

  const list = document.getElementById('video-cards-list');
  list?.addEventListener('change', e => {
    if (!e.target.classList.contains('vslot-file')) return;
    const file = e.target.files[0];
    if (!file) return;
    applyLoadedVideo(e.target.dataset.slot, file);
    e.target.value = '';
  });
  list?.addEventListener('input', e => {
    if (!e.target.classList.contains('vslot-title-input')) return;
    state.videoMeta[e.target.dataset.slot].title = e.target.value;
  });
  list?.addEventListener('blur', e => {
    if (!e.target.classList || !e.target.classList.contains('vslot-title-input')) return;
    const id = e.target.dataset.slot;
    if (!e.target.value.trim()) {
      e.target.value = DEFAULT_EPISODE_TITLES[id] || `Episodul ${id}`;
      state.videoMeta[id].title = e.target.value;
    }
    saveState();
  }, true); // capture — blur nu urcă (bubble)
  list?.addEventListener('click', e => {
    const watchedBtn = e.target.closest('.vslot-watched-btn');
    if (watchedBtn) { toggleWatched(watchedBtn.dataset.slot); return; }

    const playBtn = e.target.closest('.vslot-play');
    if (playBtn) {
      const id = playBtn.dataset.slot;
      const titleInput = document.querySelector(`.vslot-title-input[data-slot="${id}"]`);
      openVideoPlayer(id, titleInput ? titleInput.value : `Episodul ${id}`);
      return;
    }

    const delBtn = e.target.closest('.vslot-delete');
    if (delBtn) { deleteVideo(delBtn.dataset.slot); return; }

    const pickLabel = e.target.closest('.vslot-pick');
    if (pickLabel && supportsFileHandles) {
      e.preventDefault();
      pickVideoForSlot(pickLabel.dataset.slot);
      return;
    }
  });

  restoreSavedVideos();
}

