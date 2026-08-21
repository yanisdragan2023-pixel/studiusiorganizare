'use strict';

/* ============================================
   NOTIFICĂRI – Program Întrunire de Ieșire pe Teren
   Anunță cu o zi înainte și în ziua respectivă.

   Notă importantă despre funcționare "cu aplicația închisă":
   Web-ul nu are un echivalent identic cu notificările native.
   Ce facem aici:
     1. Cât timp aplicația e deschisă (chiar și în alt tab / minimizată),
        verificăm programul și afișăm notificarea prin Service Worker.
     2. Când aplicația e complet închisă, folosim "Periodic Background Sync",
        suportat doar de Chrome/Edge pe Android și Desktop (instalat ca PWA).
        Safari/iOS NU suportă acest API, deci pe iPhone notificarea vine
        doar când deschizi aplicația (verificare automată la deschidere).
   ============================================ */

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

// --- IndexedDB (oglindă a programului, citibilă și de Service Worker
//     când aplicația/pagina e complet închisă) ---
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

async function nmIdbSet(key, value) {
  const db = await nmIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function nmIdbGet(key) {
  const db = await nmIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

// ============================================
// STARE / SETĂRI
// ============================================
function isNotifEnabled() {
  return !!(state.notifSettings && state.notifSettings.enabled);
}

async function requestNotifPermission() {
  if (!('Notification' in window)) {
    showToast('Acest telefon/browser nu suportă notificări.', 'error');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    state.notifSettings = state.notifSettings || {};
    state.notifSettings.enabled = true;
    saveState();
    await mirrorSchedulingToIdb();
    await registerPeriodicSync();
    checkScheduleNotifications();
    showToast('Notificări activate! 🔔', 'success');
  } else {
    showToast('Permisiunea pentru notificări a fost refuzată din setările telefonului.', 'error');
  }
  renderNotifSettingsUI();
}

function disableNotifications() {
  state.notifSettings = state.notifSettings || {};
  state.notifSettings.enabled = false;
  saveState();
  renderNotifSettingsUI();
  showToast('Notificări dezactivate.', 'success');
}

function toggleNotifSettings() {
  if (isNotifEnabled()) {
    disableNotifications();
  } else {
    requestNotifPermission();
  }
}

function renderNotifSettingsUI() {
  const btn = document.getElementById('notifToggleBtn');
  const status = document.getElementById('notifStatusLabel');
  if (!btn || !status) return;

  const permission = ('Notification' in window) ? Notification.permission : 'unsupported';

  if (permission === 'unsupported') {
    status.textContent = 'Nesuportate pe acest dispozitiv';
    btn.disabled = true;
    btn.textContent = 'Indisponibil';
  } else if (permission === 'denied') {
    status.textContent = 'Blocate din setările telefonului/browserului';
    btn.disabled = true;
    btn.textContent = 'Blocat';
  } else if (isNotifEnabled() && permission === 'granted') {
    status.textContent = 'Activate';
    btn.disabled = false;
    btn.textContent = 'Dezactivează';
  } else {
    status.textContent = 'Dezactivate';
    btn.disabled = false;
    btn.textContent = 'Activează';
  }
}

// ============================================
// VERIFICARE PROGRAM + AFIȘARE NOTIFICARE
// ============================================

// Oglindește tabelul personal în IndexedDB, ca Service Worker-ul să îl
// poată citi și când pagina e complet închisă (fără acces la localStorage).
async function mirrorSchedulingToIdb() {
  try {
    await nmIdbSet('fieldSchedulingRows', state.fieldSchedulingRows || []);
  } catch (e) { console.error('Notif idb mirror error:', e); }
}

async function getSentLedger() {
  const todayStr = new Date().toISOString().split('T')[0];
  let ledger = await nmIdbGet('notifSent');
  if (!ledger || ledger.date !== todayStr) {
    ledger = { date: todayStr, keys: [] };
  }
  return ledger;
}

async function checkScheduleNotifications() {
  if (!isNotifEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  await mirrorSchedulingToIdb();

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const ledger = await getSentLedger();

  checkFieldSchedulingNotifications(ledger, now, tomorrow);
  await checkVestitorReportNotifications(now);

  await nmIdbSet('notifSent', ledger);
}

// Notificare pentru tabelul personal "Programare de ieșire pe teren":
// îl anunță pe vestitorul care și-a scris numele, pe telefonul lui, azi
// și cu o zi înainte de ieșirea programată.
function checkFieldSchedulingNotifications(ledger, now, tomorrow) {
  const rows = Array.isArray(state.fieldSchedulingRows) ? state.fieldSchedulingRows : [];
  const todayStr = now.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  rows.forEach((row) => {
    if (!row.date) return;
    const vestitor = (row.vestitor || '').trim();
    const coleg = (row.coleg || '').trim();
    const cu = coleg ? `Cu ${coleg}.` : '';

    if (row.date === todayStr) {
      const key = `fs2-${row.id}-today`;
      if (!ledger.keys.includes(key)) {
        showScheduleNotification(
          'Astăzi ai ieșire pe teren',
          [vestitor, cu].filter(Boolean).join(' — ') || 'Ai o ieșire programată astăzi.',
          key
        );
        ledger.keys.push(key);
      }
    }

    if (row.date === tomorrowStr) {
      const key = `fs2-${row.id}-tomorrow`;
      if (!ledger.keys.includes(key)) {
        showScheduleNotification(
          'Mâine ai ieșire pe teren',
          [vestitor, cu].filter(Boolean).join(' — ') || 'Ai o ieșire programată mâine.',
          key
        );
        ledger.keys.push(key);
      }
    }
  });
}

// Reamintire "Raport trimis?" pentru vestitorul care și-a scris numele:
// se repetă la câteva ore, pe toată durata zilei, în prima și a doua zi
// a lunii (pentru raportul lunii anterioare), până când utilizatorul
// apasă "✅ Raport trimis" din pagina Vestitor (sau trec cele 2 zile).
const VR_MONTHS_CAP = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

const VR_REPEAT_GAP_MS = 3 * 60 * 60 * 1000; // reamintește din nou după ~3 ore

function vrMonthKey(year, monthIdx0) {
  return `${year}-${String(monthIdx0 + 1).padStart(2, '0')}`;
}

async function checkVestitorReportNotifications(now) {
  const nume = ((state.vestitorNume || '') + '').trim();
  if (!nume) return; // doar dacă vestitorul și-a scris numele în profil

  const day = now.getDate();
  if (day !== 1 && day !== 2) return; // doar prima și a doua zi din lună

  let prevMonth = now.getMonth() - 1;
  let prevYear = now.getFullYear();
  if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
  const key = vrMonthKey(prevYear, prevMonth);

  const sentMap = state.vestitorReportSentMonths || {};
  if (sentMap[key]) return; // deja confirmat, nu mai reamintim

  const idbKey = 'vrLastNotified-' + key;
  const lastShown = await nmIdbGet(idbKey);
  if (lastShown && (now.getTime() - lastShown) < VR_REPEAT_GAP_MS) return;

  showScheduleNotification(
    'Ai trimis raportul lunar?',
    `Nu ai confirmat încă raportul pentru ${VR_MONTHS_CAP[prevMonth]} ${prevYear}.`,
    'vr-' + key + '-reminder'
  );
  await nmIdbSet(idbKey, now.getTime());
}

async function showScheduleNotification(title, body, tag) {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag,
      });
    } else {
      new Notification(title, { body });
    }
  } catch (e) { console.error('Notif show error:', e); }
}

// Best-effort: funcționează doar pe Chrome/Edge (Android sau Desktop, PWA
// instalată). Pe iOS Safari / Firefox nu există acest API — se ignoră tăcut.
async function registerPeriodicSync() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state === 'granted') {
      await reg.periodicSync.register('check-schedule', { minInterval: 12 * 60 * 60 * 1000 });
    }
  } catch (e) {
    // Nesuportat pe acest browser/telefon — normal, nu e o eroare reală.
  }
}

// Se apelează o dată, la pornirea aplicației.
function initNotifChecks() {
  renderNotifSettingsUI();
  if (isNotifEnabled()) {
    checkScheduleNotifications();
    registerPeriodicSync();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkScheduleNotifications();
  });
  // Verificare orară cât timp aplicația rămâne deschisă (chiar și în fundal).
  setInterval(checkScheduleNotifications, 60 * 60 * 1000);
}
