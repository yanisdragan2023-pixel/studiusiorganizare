'use strict';

// ============================================
// PROGRAMARE DE IEȘIRE PE TEREN
// Tabel în care fiecare vestitor își programează propriile ieșiri.
// Fiecare rând = { id, date (yyyy-mm-dd), time (hh:mm), vestitor, coleg }.
// Ziua / Luna / Anul afișate în tabel se calculează din `date`, nu se
// salvează separat — un singur câmp de dată e mai simplu de întreținut
// și elimină erorile de tastare.
//
// La completarea coloanelor "Nume vestitor" + "Nume vestitor colaborator",
// aplicația verifică restul rândurilor salvate: dacă aceeași pereche a
// mai fost programată împreună, afișează un avertisment sub rând, ca
// vestitorul să știe și să aleagă alt coleg data viitoare.
//
// Fiecare vestitor are datele lui doar pe telefonul/calculatorul propriu
// (nu există un tabel comun online) — vezi și file-handling din storage.js.
//
// Depinde de: state.fieldSchedulingRows (storage.js), saveState(),
// escHtml() / showToast() (utils.js).
// ============================================

const FS2_MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

function defaultFieldSchedulingRow() {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), date: '', time: '', vestitor: '', coleg: '' };
}

// Descompune un string yyyy-mm-dd în { ziua, luna, anul } pentru afișare.
// Dacă data nu e completată, întoarce câmpuri goale (afișate ca "—").
function fs2DateParts(dateStr) {
  if (!dateStr) return { ziua: '', luna: '', anul: '' };
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { ziua: '', luna: '', anul: '' };
  return { ziua: String(d), luna: FS2_MONTHS[m - 1] || '', anul: String(y) };
}

// Caută, printre celelalte rânduri salvate, o programare anterioară cu
// aceeași pereche vestitor + coleg (comparație fără spații/majuscule,
// nesensibilă la ordine — "Ion + Maria" == "Maria + Ion"). Întoarce
// rândul găsit sau null.
function fs2FindPairMatch(vestitor, coleg, excludeId) {
  const v = (vestitor || '').trim().toLowerCase();
  const c = (coleg || '').trim().toLowerCase();
  if (!v || !c) return null;

  const rows = Array.isArray(state.fieldSchedulingRows) ? state.fieldSchedulingRows : [];
  return rows.find(r => {
    if (r.id === excludeId) return false;
    const rv = (r.vestitor || '').trim().toLowerCase();
    const rc = (r.coleg || '').trim().toLowerCase();
    if (!rv || !rc) return false;
    return (rv === v && rc === c) || (rv === c && rc === v);
  }) || null;
}

function addFieldSchedulingRow() {
  if (!Array.isArray(state.fieldSchedulingRows)) state.fieldSchedulingRows = [];
  state.fieldSchedulingRows.push(defaultFieldSchedulingRow());
  saveState();
  renderFieldSchedulingTable();
  requestAnimationFrame(() => {
    const inputs = document.querySelectorAll('.fs2-cell-date');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
  });
}

function updateFieldSchedulingCell(id, field, value) {
  const row = (state.fieldSchedulingRows || []).find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  saveState();
  renderFieldSchedulingTable();
}

// Folosită la fiecare literă tastată în câmpurile de nume: salvează
// valoarea dar NU redesenează tabelul (redesenarea ar distruge input-ul
// și te-ar scoate din câmp după fiecare literă). Tabelul se redesenează
// abia când ieși din câmp (blur), ca să se recalculeze avertismentul.
function updateFieldSchedulingCellSilent(id, field, value) {
  const row = (state.fieldSchedulingRows || []).find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  saveState();
}

function deleteFieldSchedulingRow(id) {
  if (!confirm('Ștergi această programare?')) return;
  state.fieldSchedulingRows = (state.fieldSchedulingRows || []).filter(r => r.id !== id);
  saveState();
  renderFieldSchedulingTable();
  showToast('Programare ștearsă.', 'success');
}

function saveFieldSchedulingTable() {
  saveState();
  if (typeof checkScheduleNotifications === 'function') checkScheduleNotifications();
  showToast('Programare salvată! 💾', 'success');
}

// ============================================
// TRIMITE PE WHATSAPP
// ============================================
function shareFieldSchedulingWhatsApp() {
  const rows = Array.isArray(state.fieldSchedulingRows) ? state.fieldSchedulingRows : [];
  const filled = rows.filter(r => r.date || r.vestitor || r.coleg);

  if (filled.length === 0) {
    showToast('Nu există nicio programare de trimis.', 'error');
    return;
  }

  const sorted = [...filled].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const parts = ['*Programare de ieșire pe teren*'];
  sorted.forEach(r => {
    const { ziua, luna, anul } = fs2DateParts(r.date);
    const dataText = ziua ? `${ziua} ${luna} ${anul}` : '—';
    const oraText = r.time && r.time.trim() ? ` ora ${r.time.trim()}` : '';
    const vestitor = r.vestitor && r.vestitor.trim() ? r.vestitor.trim() : '—';
    const coleg = r.coleg && r.coleg.trim() ? r.coleg.trim() : '—';
    parts.push(`• ${dataText}${oraText}: ${vestitor} + ${coleg}`);
  });

  const text = parts.join('\n');
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ============================================
// EXPORTĂ ÎN CALENDAR (.ics)
// Reutilizează icsPad/icsFormatDate/icsEscape din js/meetings/icsExport.js
// (scripturile sunt încărcate global, deci funcțiile sunt disponibile la
// momentul apăsării butonului, indiferent de ordinea fișierelor).
// ============================================
function buildFieldSchedulingICS() {
  const rows = Array.isArray(state.fieldSchedulingRows) ? state.fieldSchedulingRows : [];
  const withDate = rows.filter(r => r.date);
  if (withDate.length === 0) return null;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudiuMeu//Programare Ieșire pe Teren//RO',
    'CALSCALE:GREGORIAN',
  ];

  withDate.forEach((row, i) => {
    const [y, m, d] = row.date.split('-').map(Number);
    const [hh, mm] = (row.time && row.time.trim()) ? row.time.split(':').map(Number) : [9, 0];
    const start = new Date(y, m - 1, d, hh, mm, 0);
    const end = new Date(start.getTime() + 60 * 60000);

    const names = [row.vestitor, row.coleg].map(n => (n || '').trim()).filter(Boolean).join(' + ');
    const summary = names ? `Ieșire pe teren — ${names}` : 'Ieșire pe teren';
    const uid = `studiumeu-fs2-${row.id || i}@studiumeu.local`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${icsFormatDate(new Date())}Z`,
      `DTSTART:${icsFormatDate(start)}`,
      `DTEND:${icsFormatDate(end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape('Programare de ieșire pe teren - StudiuMeu')}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape('Mâine: ' + summary)}`,
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(summary)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return { ics: lines.join('\r\n'), count: withDate.length };
}

function exportFieldSchedulingICS() {
  const result = buildFieldSchedulingICS();
  if (!result) {
    showToast('Nu există nicio programare cu dată completată pentru export.', 'error');
    return;
  }

  const blob = new Blob([result.ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'programare-iesire-teren.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Calendar exportat (${result.count} evenimente) 📅 — deschide fișierul ca să-l imporți.`, 'success');
}

// ============================================
// RANDARE
// ============================================
function renderFieldSchedulingTable() {
  const container = document.getElementById('fs2TableBody');
  if (!container) return;

  if (!Array.isArray(state.fieldSchedulingRows)) state.fieldSchedulingRows = [];
  const rows = state.fieldSchedulingRows;

  if (rows.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="fs2-empty">Nicio programare încă. Apasă „+ Adaugă programare”.</td>
      </tr>`;
    return;
  }

  container.innerHTML = rows.map(row => {
    const { ziua, luna, anul } = fs2DateParts(row.date);
    const match = fs2FindPairMatch(row.vestitor, row.coleg, row.id);
    const warningRow = match ? `
      <tr class="fs2-warning-row">
        <td colspan="8">
          ⚠️ ${escHtml((row.vestitor || '').trim())} a mai fost programat cu ${escHtml((row.coleg || '').trim())}
          ${match.date ? `pe ${escHtml(fs2DateParts(match.date).ziua)} ${escHtml(fs2DateParts(match.date).luna)} ${escHtml(fs2DateParts(match.date).anul)}` : 'anterior'}.
          Alege alt coleg data aceasta, dacă se poate.
        </td>
      </tr>` : '';

    return `
      <tr class="fs2-row${match ? ' fs2-row-flagged' : ''}">
        <td class="fs2-cell fs2-cell-date-wrap">
          <input type="date" class="fs2-cell-input fs2-cell-date" value="${escHtml(row.date || '')}"
            onchange="updateFieldSchedulingCell('${row.id}', 'date', this.value)" />
        </td>
        <td class="fs2-cell fs2-cell-part">${ziua || '—'}</td>
        <td class="fs2-cell fs2-cell-part">${luna || '—'}</td>
        <td class="fs2-cell fs2-cell-part">${anul || '—'}</td>
        <td class="fs2-cell fs2-cell-time-wrap">
          <input type="time" class="fs2-cell-input fs2-cell-time" value="${escHtml(row.time || '')}"
            onchange="updateFieldSchedulingCell('${row.id}', 'time', this.value)" />
        </td>
        <td class="fs2-cell">
          <input type="text" class="fs2-cell-input" placeholder="Nume vestitor" value="${escHtml(row.vestitor || '')}"
            oninput="updateFieldSchedulingCellSilent('${row.id}', 'vestitor', this.value)"
            onblur="renderFieldSchedulingTable()" />
        </td>
        <td class="fs2-cell">
          <input type="text" class="fs2-cell-input" placeholder="Nume vestitor colaborator" value="${escHtml(row.coleg || '')}"
            oninput="updateFieldSchedulingCellSilent('${row.id}', 'coleg', this.value)"
            onblur="renderFieldSchedulingTable()" />
        </td>
        <td class="fs2-cell fs2-cell-del">
          <button class="fs-sched-del" onclick="deleteFieldSchedulingRow('${row.id}')" title="Șterge programarea">✕</button>
        </td>
      </tr>
      ${warningRow}
    `;
  }).join('');
}
