/* ============================================
   StudiuMeu – STORAGE
   Tot ce ține de persistarea datelor în localStorage.
   ============================================ */

'use strict';

// Cheia principală sub care se salvează tot obiectul `state`
const STORAGE_KEY = 'studiuMeu_data';

/**
 * Forma implicită (goală) a stării aplicației. Folosită atât la pornirea
 * aplicației, cât și la import (dataIO.js), ca să existe UN SINGUR loc care
 * definește ce câmpuri are `state` — dacă se adaugă un câmp nou aici, el se
 * salvează și se restaurează automat la export/import, fără alt cod.
 */
function defaultAppState() {
  return {
    notes: [],
    verses: [],
    wtStudies: [],
    workbooks: [],
    discursTalks: [],
    meetings: [],
    temeCursant: [],
    prophecies: [],
    streak: 0,
    lastStudyDate: null,
    publications: [],
    videoMeta: {},
    songs: [],
    lastPlayedSongId: null,
    songsIntl: [],
    lastPlayedSongIntlId: null,
    myUser: null,      // { id, name } — identitatea folosită la trimiterea cuvântărilor
    contacts: [],      // [{ id, name }] — persoane cu care s-au trimis/primit cuvântări
    bibleNotes: {},    // notițe/versete marcate per capitol din citirea Bibliei
    bibleOfflineText: {}, // text simplu per capitol
    bibleOfflineRichText: {}, // text cu culori/formatare per capitol

    // Setări notificări (anunț cu o zi înainte / în ziua respectivă)
    notifSettings: { enabled: false },

    // Tabel "Programare de ieșire pe teren" — fiecare vestitor își
    // programează propriile ieșiri: [{ id, date, vestitor, coleg }].
    // `date` e un string yyyy-mm-dd (din <input type="date">); ziua/luna/
    // anul afișate în tabel se calculează din el, nu se salvează separat.
    fieldSchedulingRows: [],
    standSchedulingRows: [],

    // Secțiunea "Vestitor": numele vestitorului + rapoartele lunare
    // introduse manual (lună, an, ore, minute, observații).
    vestitorNume: '',
    vestitorReports: [], // [{ id, luna, anul, ore, minute, observatii, createdAt }]

    // Profilul vestitorului: statutul (Vestitor / Vestitor auxiliar) +
    // culoarea aleasă pentru fiecare lună a anului teocratic (Sept-Aug),
    // ca să marcheze vizual lunile în care a fost activ.
    vestitorProfil: { vestitor: false, auxiliar15: false, auxiliar30: false, regulat: false, months: {} },

    // Anul teocratic selectat în calculatorul "Raportul Anual Teocratic"
    // (numărul reprezintă anul calendaristic în care începe Septembrie,
    // ex. 2025 = anul teocratic Septembrie 2025 - August 2026).
    vestitorAnnualYear: null,

    // Luni (cheie "YYYY-MM") pentru care utilizatorul a apăsat "Raport trimis",
    // folosit ca să oprim reamintirile locale pentru luna respectivă.
    vestitorReportSentMonths: {},

    // Asistent AI (Google Gemini): cheia API + modelul ales, salvate local,
    // și istoricul conversației curente.
    geminiApiKey: '',
    geminiModel: 'gemini-3.7-flash',
    aiChatHistory: [], // [{ role: 'user'|'assistant'|'error', text }]

    // Ciornă „Cuvântare 5 minute" (talk5) — subiect/durată/notițe curente.
    talkDraft: {},
    talk5Talks: [], // [{ id, subject, duration, notes }]

    // Ciornă „Discurs 30 minute" — cuvântarea la care lucrezi acum, plus
    // un istoric de ciorne ținute minte pe zi (dată -> ciornă), ca să poți
    // relua fiecare zi separat.
    discursDraft: {},
    discursDraftsByDate: {},
  };
}

// Starea centrală a aplicației. Toate modulele citesc/scriu în acest obiect.
let state = defaultAppState();

/**
 * Încarcă `state` din localStorage și rulează curățarea notițelor/caietelor
 * "orfane" (fără notiță corespondentă), exact ca în versiunea originală.
 */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state = { ...defaultAppState(), ...JSON.parse(saved) };

      // Cleanup orphaned watchtower studies (studies with no matching note)
      let cleaned = false;
      if (state.wtStudies && state.wtStudies.length > 0) {
        const initialCount = state.wtStudies.length;
        state.wtStudies = state.wtStudies.filter(study => {
          return state.notes.some(note =>
            note.id === study.id + '_wt' ||
            (note.category === 'watchtower' && note.title === `TV: ${study.title}`)
          );
        });
        if (state.wtStudies.length !== initialCount) cleaned = true;
      }

      // Cleanup orphaned workbooks
      if (state.workbooks && state.workbooks.length > 0) {
        const initialCount = state.workbooks.length;
        state.workbooks = state.workbooks.filter(wb => {
          return state.notes.some(note =>
            note.id === wb.id + '_wb' ||
            (note.category === 'workbook' && note.title === `Caiet: ${wb.week}`)
          );
        });
        if (state.workbooks.length !== initialCount) cleaned = true;
      }

      if (cleaned) {
        saveState();
      }
    }
  } catch (e) { console.error('Load error:', e); }
}

/**
 * Salvează `state` curent în localStorage (serializat ca JSON).
 * Sigură: dacă localStorage aruncă o eroare (spațiu plin, mod privat etc.),
 * nu lasă aplicația să se blocheze și nu șterge datele deja salvate —
 * doar anunță discret utilizatorul prin indicator + toast.
 */
function saveState() {
  setSaveIndicator('saving');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveIndicator('saved');
    return true;
  } catch (e) {
    console.error('Eroare la salvare (saveState):', e);
    setSaveIndicator('error');
    if (typeof showToast === 'function') {
      showToast('⚠️ Salvarea a eșuat (spațiu de stocare plin sau indisponibil). Datele deja salvate NU au fost șterse.', 'error');
    }
    return false;
  }
}

// ============================================
// SALVARE DEBOUNCED — pentru câmpuri unde utilizatorul tastează continuu
// (ex: subiect cuvântare, titlu discurs, nume vestitor). Evită să scriem
// în localStorage la fiecare literă; scriem o singură dată, la scurt timp
// după ce utilizatorul se oprește din tastat.
// ============================================
let __saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 400;

function saveStateDebounced(delay = SAVE_DEBOUNCE_MS) {
  setSaveIndicator('saving');
  clearTimeout(__saveDebounceTimer);
  __saveDebounceTimer = setTimeout(() => {
    __saveDebounceTimer = null;
    saveState();
  }, delay);
}

/**
 * Dacă există o salvare amânată (debounced) neexecutată încă, o execută
 * imediat. Apelată înainte de schimbarea paginii, la visibilitychange
 * (fundal) și la închiderea aplicației, ca să nu se piardă nimic.
 */
function flushPendingSave() {
  if (__saveDebounceTimer) {
    clearTimeout(__saveDebounceTimer);
    __saveDebounceTimer = null;
    saveState();
  }
}

// ============================================
// INDICATOR DISCRET DE SALVARE ("Salvat ✓" / "Se salvează…" / "Salvare eșuată")
// ============================================
let __saveIndicatorHideTimer = null;

function setSaveIndicator(status) {
  const el = document.getElementById('globalSaveIndicator');
  if (!el) return;

  clearTimeout(__saveIndicatorHideTimer);
  el.classList.remove('is-saving', 'is-saved', 'is-error');

  if (status === 'saving') {
    el.textContent = 'Se salvează…';
    el.classList.add('is-saving');
    el.classList.add('visible');
  } else if (status === 'saved') {
    el.textContent = 'Salvat ✓';
    el.classList.add('is-saved');
    el.classList.add('visible');
    __saveIndicatorHideTimer = setTimeout(() => el.classList.remove('visible'), 1600);
  } else if (status === 'error') {
    el.textContent = 'Salvare eșuată ⚠️';
    el.classList.add('is-error');
    el.classList.add('visible');
    __saveIndicatorHideTimer = setTimeout(() => el.classList.remove('visible'), 5000);
  }
}

// ============================================
// PLASĂ DE SIGURANȚĂ: salvează la schimbarea vizibilității (fundal) și la
// închiderea/reîmprospătarea paginii. Nu blochează nimic, doar apelează
// flushPendingSave() ca să nu rămână modificări netrimise în localStorage.
// ============================================
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushPendingSave();
});
window.addEventListener('pagehide', flushPendingSave);
window.addEventListener('beforeunload', flushPendingSave);
