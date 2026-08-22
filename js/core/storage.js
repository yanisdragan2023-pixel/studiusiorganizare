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
    bibleOfflineText: {}, // textul versetelor scris/lipit de utilizator, per capitol (ex. "geneza-1")

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
 */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
