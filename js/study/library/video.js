'use strict';

/* ============================================
   MATERIALE VIDEO (episoade extensibile)
   📌 Pentru a adăuga episoade noi în viitor: adaugă o intrare
   nouă în obiectul de mai jos — restul se adaptează automat.
   ============================================ */
const DEFAULT_EPISODE_TITLES = {
  1: 'Episodul 1: Adevărata lumină a lumii',
  2: 'Episodul 2',
  3: 'Episodul 3',
  4: 'Episodul 4',
  5: 'Episodul 5',
  6: 'Episodul 6',
};
const EPISODE_IDS = Object.keys(DEFAULT_EPISODE_TITLES).map(Number);

function getVideoMeta(id) {
  if (!state.videoMeta[id]) state.videoMeta[id] = {};
  const m = state.videoMeta[id];
  if (!m.title) m.title = DEFAULT_EPISODE_TITLES[id];
  if (typeof m.watched !== 'boolean') m.watched = false;
  if (typeof m.position !== 'number') m.position = 0;
  return m;
}

// ── "Memoria" locației fișierelor (File System Access API + IndexedDB) ──
// Disponibilă doar în Chrome/Edge. Stochează doar o REFERINȚĂ către fișier
// (un "handle"), nu conținutul video. Firefox/Safari nu suportă acest API;
// acolo se revine automat la selectarea manuală a fișierului.
const supportsFileHandles = 'showOpenFilePicker' in window && 'indexedDB' in window;
const IDB_NAME = 'sp-video-db';
const IDB_STORE = 'handles';

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveHandle(slot, handle) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, String(slot));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getHandle(slot) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(String(slot));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteHandle(slot) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(String(slot));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
/** Șterge toate legăturile către fișiere video salvate (folosit la resetarea completă a datelor). */
async function deleteAllVideoHandles() {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// videoBlobs[slot] = { name, url } — doar în memorie, niciodată persistat
const videoBlobs = {};

function createVideoSlotEl(id) {
  const meta = getVideoMeta(id);
  const el = document.createElement('div');
  el.className = 'video-slot' + (meta.watched ? ' watched' : '');
  el.id = `vslot-${id}`;
  el.dataset.slot = id;
  el.innerHTML = `
    <div class="vslot-num">${id}</div>
    <div class="vslot-info">
      <input type="text" class="vslot-title-input" data-slot="${id}" maxlength="80"
             value="${escHtml(meta.title)}" placeholder="Titlu episod..." />
      <div class="vslot-meta-row">
        <span class="vslot-status empty-status">Nicio înregistrare</span>
        <span class="vslot-watched-tag ${meta.watched ? '' : 'hidden'}">✅ Vizionat</span>
      </div>
    </div>
    <button class="vslot-watched-btn ${meta.watched ? 'active' : ''}" data-slot="${id}" title="Marchează ca vizionat">⭐</button>
    <button class="vslot-play hidden" data-slot="${id}" title="Redă video">
      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>
    <label class="vslot-pick" data-slot="${id}" title="Selectează video">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <input type="file" accept="video/*" class="vslot-file" data-slot="${id}" />
    </label>
    <button class="vslot-delete hidden" data-slot="${id}" title="Șterge video">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </button>
  `;
  return el;
}

function renderVideoSlots() {
  const list = document.getElementById('video-cards-list');
  const countEl = document.getElementById('video-count');
  if (!list) return;
  const pending = {}; // păstrăm blob-urile deja încărcate din sesiunea curentă
  list.innerHTML = '';
  EPISODE_IDS.forEach(id => {
    list.appendChild(createVideoSlotEl(id));
    if (videoBlobs[id]) applyLoadedVideo(id, { name: videoBlobs[id].name }, true, true);
  });
  if (countEl) countEl.textContent = `${EPISODE_IDS.length} episoade`;
}

// ── Aplică vizual un video încărcat ──
// keepUrl=true înseamnă că videoBlobs[slot].url e deja setat (re-randare panou)
function applyLoadedVideo(slot, file, silent, keepUrl) {
  const slotEl = document.getElementById(`vslot-${slot}`);
  if (!slotEl) return;
  const statusEl = slotEl.querySelector('.vslot-status');

  if (!keepUrl) {
    if (videoBlobs[slot]) URL.revokeObjectURL(videoBlobs[slot].url);
    videoBlobs[slot] = { name: file.name, url: URL.createObjectURL(file) };
  }

  slotEl.classList.add('loaded');
  statusEl.className = 'vslot-status loaded-status';
  statusEl.textContent = `✓ ${file.name}`;
  slotEl.querySelector('.vslot-play').classList.remove('hidden');
  slotEl.querySelector('.vslot-delete').classList.remove('hidden');
  slotEl.querySelector('.vslot-pick').title = 'Schimbă videoclipul';
  delete slotEl.dataset.pendingHandle;

  if (!silent) showToast(`Episodul ${slot} încărcat! 🎬`, 'success');
}

// ── Flow cu "memorie" a fișierului (Chrome/Edge — File System Access API) ──
async function loadFileFromHandle(slot, handle, silent) {
  try {
    const file = await handle.getFile();
    applyLoadedVideo(slot, file, silent);
  } catch {
    showToast('Fișierul nu a mai fost găsit (poate a fost mutat sau șters de pe disc).', 'error');
    markSlotNeedsPermission(slot);
  }
}

function markSlotNeedsPermission(slot) {
  const slotEl = document.getElementById(`vslot-${slot}`);
  if (!slotEl) return;
  const statusEl = slotEl.querySelector('.vslot-status');
  statusEl.className = 'vslot-status permission-status';
  statusEl.textContent = '🔒 Apasă pe pictograma folder pentru a reconecta fișierul';
  slotEl.querySelector('.vslot-pick').title = 'Reconectează fișierul salvat';
  slotEl.dataset.pendingHandle = '1';
}

async function pickVideoForSlot(slot) {
  const slotEl = document.getElementById(`vslot-${slot}`);

  // Dacă avem deja un handle salvat ce așteaptă permisiune, încercăm întâi să-l reconectăm
  if (supportsFileHandles && slotEl?.dataset.pendingHandle === '1') {
    const handle = await getHandle(slot).catch(() => null);
    if (handle) {
      try {
        const perm = await handle.requestPermission({ mode: 'read' });
        if (perm === 'granted') { await loadFileFromHandle(slot, handle); return; }
        showToast('Acces refuzat. Poți selecta din nou fișierul.', 'error');
      } catch { /* continuă mai jos la selectare nouă */ }
    }
  }

  if (supportsFileHandles) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'] } }],
        multiple: false,
      });
      await saveHandle(slot, handle);
      await loadFileFromHandle(slot, handle);
    } catch (err) {
      if (err?.name === 'AbortError') return; // utilizatorul a anulat selecția
      // Metoda modernă a eșuat (ex: context nesigur, restricții de browser).
      // Trecem automat la selectorul clasic de fișiere, care funcționează garantat.
      document.querySelector(`.vslot-file[data-slot="${slot}"]`)?.click();
    }
  } else {
    // Firefox / Safari — nu pot reține fișierul, doar selectare clasică
    document.querySelector(`.vslot-file[data-slot="${slot}"]`)?.click();
  }
}

// La deschiderea paginii Bibliotecă: reconectează automat videourile salvate anterior
async function restoreSavedVideos() {
  if (!supportsFileHandles) return;
  for (const id of EPISODE_IDS) {
    const handle = await getHandle(id).catch(() => null);
    if (!handle) continue;
    try {
      const perm = await handle.queryPermission({ mode: 'read' });
      if (perm === 'granted') {
        await loadFileFromHandle(id, handle, true);
      } else {
        markSlotNeedsPermission(id);
      }
    } catch {
      markSlotNeedsPermission(id);
    }
  }
}

function toggleWatched(slot) {
  const meta = getVideoMeta(slot);
  meta.watched = !meta.watched;
  saveState();
  const slotEl = document.getElementById(`vslot-${slot}`);
  slotEl.classList.toggle('watched', meta.watched);
  slotEl.querySelector('.vslot-watched-btn').classList.toggle('active', meta.watched);
  slotEl.querySelector('.vslot-watched-tag').classList.toggle('hidden', !meta.watched);
  showToast(meta.watched ? '⭐ Marcat ca vizionat' : '↩️ Marcaj eliminat', 'success');
}

function deleteVideo(slot) {
  if (!videoBlobs[slot]) return;
  if (!confirm('Ștergi acest videoclip din aplicație? (fișierul de pe calculator nu este afectat)')) return;

  URL.revokeObjectURL(videoBlobs[slot].url);
  delete videoBlobs[slot];
  getVideoMeta(slot).position = 0;
  saveState();
  if (supportsFileHandles) deleteHandle(slot).catch(() => {});

  const slotEl = document.getElementById(`vslot-${slot}`);
  slotEl.classList.remove('loaded');
  delete slotEl.dataset.pendingHandle;
  const statusEl = slotEl.querySelector('.vslot-status');
  statusEl.className = 'vslot-status empty-status';
  statusEl.textContent = 'Nicio înregistrare';
  slotEl.querySelector('.vslot-play').classList.add('hidden');
  slotEl.querySelector('.vslot-delete').classList.add('hidden');
  slotEl.querySelector('.vslot-pick').title = 'Selectează video';

  showToast(`Videoclipul ${slot} a fost șters 🗑️`, 'success');
}

function resetEpisodeTitles() {
  if (!confirm('Resetezi toate titlurile episoadelor la valorile implicite?')) return;
  EPISODE_IDS.forEach(id => {
    getVideoMeta(id).title = DEFAULT_EPISODE_TITLES[id];
    const input = document.querySelector(`.vslot-title-input[data-slot="${id}"]`);
    if (input) input.value = DEFAULT_EPISODE_TITLES[id];
  });
  saveState();
  showToast('Titlurile au fost resetate 🔁', 'success');
}

