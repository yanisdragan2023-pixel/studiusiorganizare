// StudiuMeu — Service Worker
// Cache-first pentru fisierele aplicatiei = functionare completa offline.

const CACHE_VERSION = 'studiumeu-v33';
const CACHE_NAME = CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './html/acasa.html',
  './html/asistent-ai.html',
  './html/asistent-predicare.html',
  './html/biblioteca.html',
  './html/caiet-intrunire.html',
  './html/calendar-intruniri.html',
  './html/citeste-biblia.html',
  './html/curatenie.html',
  './html/cuvantare-5-minute.html',
  './html/discurs.html',
  './html/layout-sidebar.html',
  './html/layout-topbar.html',
  './html/notite.html',
  './html/programare-stand.html',
  './html/programare-teren.html',
  './html/radar-meteo.html',
  './html/serviciu-teren.html',
  './html/setari.html',
  './html/studiu-biblic.html',
  './html/suprapuneri-pwa.html',
  './html/tema-cursant.html',
  './html/toast.html',
  './html/transfer.html',
  './html/turnul-de-veghe.html',
  './html/vestitor.html',
  './js/core/app.js',
  './js/core/asistentAI.js',
  './js/core/dashboard.js',
  './js/core/dataIO.js',
  './js/core/fontScale.js',
  './js/core/navigation.js',
  './js/core/notifications.js',
  './js/core/radarMeteo.js',
  './js/core/settings.js',
  './js/core/storage.js',
  './js/core/theme.js',
  './js/core/transfer.js',
  './js/core/utils.js',
  './js/study/bibleReader.js',
  './js/study/curatenie.js',
  './js/study/library.js',
  './js/study/notes.js',
  './js/study/prophecies.js',
  './js/study/search.js',
  './js/study/temacursant.js',
  './js/study/verses.js',
  './js/study/workbook.js',
  './js/study/wtStudy.js',
  './js/meetings/discursTimer.js',
  './js/meetings/icsExport.js',
  './js/meetings/meetings.js',
  './js/meetings/talkTimer.js',
  './js/meetings/wordCounter.js',
  './js/field-service/fieldService.js',
  './js/field-service/fieldServiceUI.js',
  './js/field-service/fieldScheduling.js',
  './js/field-service/standScheduling.js',
  './js/field-service/vestitor.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      // field-service-data.local.js e opțional (conține nume reale și nu e pe
      // GitHub) — îl cache-uim separat ca să nu pice tot instalarea dacă lipsește.
      .then(() => caches.open(CACHE_NAME).then((cache) =>
        cache.add('./js/field-service/field-service-data.local.js').catch(() => {})
      ))
      // verse-of-day.local.js e la fel opțional (index.html are deja fallback
      // pentru el) — aceeași logică, nu blocăm instalarea dacă lipsește.
      .then(() => caches.open(CACHE_NAME).then((cache) =>
        cache.add('./js/study/verse-of-day.local.js').catch(() => {})
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  if (!isSameOrigin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

/* ============================================
   NOTIFICĂRI DE PROGRAM – rulează chiar și cu pagina închisă
   (doar Chrome/Edge Android sau Desktop, PWA instalată — vezi notifications.js)
   ============================================ */

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-schedule') {
    event.waitUntil(swCheckScheduleAndNotify());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});

// --- IndexedDB (duplicat aici: Service Worker-ul nu poate accesa
//     localStorage sau scripturile paginii, rulează în context separat) ---
function nmIdbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('studiuMeuNotifDB', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('kv')) {
        req.result.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function nmIdbGet(key) {
  return nmIdbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const r = tx.objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result ? r.result.value : null);
    r.onerror = () => reject(r.error);
  }));
}

function nmIdbSet(key, value) {
  return nmIdbOpen().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

const RO_MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

function parseRoDate(str) {
  if (!str) return null;
  const parts = str.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const day = parseInt(parts[0], 10);
  const monthIdx = RO_MONTHS.indexOf(parts[1]);
  if (isNaN(day) || monthIdx === -1) return null;
  return { day, month: monthIdx };
}

async function swCheckScheduleAndNotify() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const todayStr = now.toISOString().split('T')[0];
  let ledger = await nmIdbGet('notifSent');
  if (!ledger || ledger.date !== todayStr) ledger = { date: todayStr, keys: [] };

  // Tabelul personal "Programare de ieșire pe teren"
  const schedulingRows = await nmIdbGet('fieldSchedulingRows');
  if (Array.isArray(schedulingRows)) {
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const row of schedulingRows) {
      if (!row.date) continue;
      const vestitor = (row.vestitor || '').trim();
      const coleg = (row.coleg || '').trim();
      const cu = coleg ? `Cu ${coleg}.` : '';
      const body = [vestitor, cu].filter(Boolean).join(' — ');

      if (row.date === todayStr) {
        const key = `fs2-${row.id}-today`;
        if (!ledger.keys.includes(key)) {
          await self.registration.showNotification('Astăzi ai ieșire pe teren', {
            body: body || 'Ai o ieșire programată astăzi.',
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: key,
          });
          ledger.keys.push(key);
        }
      }

      if (row.date === tomorrowStr) {
        const key = `fs2-${row.id}-tomorrow`;
        if (!ledger.keys.includes(key)) {
          await self.registration.showNotification('Mâine ai ieșire pe teren', {
            body: body || 'Ai o ieșire programată mâine.',
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png',
            tag: key,
          });
          ledger.keys.push(key);
        }
      }
    }
  }

  await nmIdbSet('notifSent', ledger);
}
