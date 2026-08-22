'use strict';

// ============================================
// PROGRAMARE DE IEȘIRE CU STANDUL
// Tabel în care fiecare vestitor își programează propriile ieșiri cu standul.
// Fiecare rând = { id, date (yyyy-mm-dd), time (hh:mm), vestitor, coleg, coleg2 }.
// Spre deosebire de fieldScheduling.js (programarea de ieșire pe teren, doar
// 2 vestitori), aici sunt până la 3 vestitori (vestitor + coleg + coleg2),
// conform noilor reglementări pentru ieșirile cu standul. Propriul state
// (state.standSchedulingRows) și propriul tabel (#standTableBody), ca cele
// două programări să rămână independente.
//
// Depinde de: state.standSchedulingRows (storage.js), saveState(),
// escHtml() / showToast() (utils.js).
// ============================================

const STAND_MONTHS = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

function defaultStandSchedulingRow() {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), date: '', time: '', vestitor: '', coleg: '', coleg2: '' };
}

// Descompune un string yyyy-mm-dd în { ziua, luna, anul } pentru afișare.
function standDateParts(dateStr) {
  if (!dateStr) return { ziua: '', luna: '', anul: '' };
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { ziua: '', luna: '', anul: '' };
  return { ziua: String(d), luna: STAND_MONTHS[m - 1] || '', anul: String(y) };
}

// Construiește toate perechile posibile (neordonate) dintr-o listă de
// nume, ignorând câmpurile goale. Ex: [Ion, Maria, Vasile] -> perechile
// Ion+Maria, Ion+Vasile, Maria+Vasile. Folosit la stand, unde acum ies
// până la 3 vestitori odată (conform noilor reglementări).
function standNamePairs(names) {
  const clean = names.map(n => (n || '').trim()).filter(Boolean);
  const pairs = [];
  for (let i = 0; i < clean.length; i++) {
    for (let j = i + 1; j < clean.length; j++) {
      const key = [clean[i].toLowerCase(), clean[j].toLowerCase()].sort().join('|');
      pairs.push({ key, a: clean[i], b: clean[j] });
    }
  }
  return pairs;
}

// Caută, printre celelalte rânduri salvate, o programare anterioară în
// care oricare DOI dintre vestitorii rândului curent (vestitor, coleg,
// coleg2) au mai fost programați împreună — indiferent cu cine altcineva
// erau atunci. Întoarce { row, a, b } (rândul găsit + numele perechii
// care se repetă) sau null.
function standFindPairMatch(vestitor, coleg, coleg2, excludeId) {
  const pairs = standNamePairs([vestitor, coleg, coleg2]);
  if (pairs.length === 0) return null;

  const rows = Array.isArray(state.standSchedulingRows) ? state.standSchedulingRows : [];
  for (const r of rows) {
    if (r.id === excludeId) continue;
    const rPairs = standNamePairs([r.vestitor, r.coleg, r.coleg2]);
    if (rPairs.length === 0) continue;
    const found = pairs.find(p => rPairs.some(rp => rp.key === p.key));
    if (found) return { row: r, a: found.a, b: found.b };
  }
  return null;
}

function addStandSchedulingRow() {
  if (!Array.isArray(state.standSchedulingRows)) state.standSchedulingRows = [];
  state.standSchedulingRows.push(defaultStandSchedulingRow());
  saveState();
  renderStandSchedulingTable();
  requestAnimationFrame(() => {
    const inputs = document.querySelectorAll('#standTableBody .fs2-cell-date');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
  });
}

function updateStandSchedulingCell(id, field, value) {
  const row = (state.standSchedulingRows || []).find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  saveState();
  renderStandSchedulingTable();
}

// Salvează valoarea la fiecare literă tastată, fără să redeseneze tabelul
// (redesenarea ar scoate cursorul din câmp). Redesenarea are loc la blur.
function updateStandSchedulingCellSilent(id, field, value) {
  const row = (state.standSchedulingRows || []).find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  saveState();
}

function deleteStandSchedulingRow(id) {
  if (!confirm('Ștergi această programare?')) return;
  state.standSchedulingRows = (state.standSchedulingRows || []).filter(r => r.id !== id);
  saveState();
  renderStandSchedulingTable();
  showToast('Programare ștearsă.', 'success');
}

function saveStandSchedulingTable() {
  saveState();
  showToast('Programare salvată! 💾', 'success');
}

// ============================================
// TRIMITE PE WHATSAPP
// ============================================
function shareStandSchedulingWhatsApp() {
  const rows = Array.isArray(state.standSchedulingRows) ? state.standSchedulingRows : [];
  const filled = rows.filter(r => r.date || r.vestitor || r.coleg);

  if (filled.length === 0) {
    showToast('Nu există nicio programare de trimis.', 'error');
    return;
  }

  const sorted = [...filled].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const parts = ['*Programare de ieșire cu standul*'];
  sorted.forEach(r => {
    const { ziua, luna, anul } = standDateParts(r.date);
    const dataText = ziua ? `${ziua} ${luna} ${anul}` : '—';
    const oraText = r.time && r.time.trim() ? ` ora ${r.time.trim()}` : '';
    const vestitor = r.vestitor && r.vestitor.trim() ? r.vestitor.trim() : '—';
    const coleg = r.coleg && r.coleg.trim() ? r.coleg.trim() : '—';
    const coleg2 = r.coleg2 && r.coleg2.trim() ? ` + ${r.coleg2.trim()}` : '';
    parts.push(`• ${dataText}${oraText}: ${vestitor} + ${coleg}${coleg2}`);
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
function buildStandSchedulingICS() {
  const rows = Array.isArray(state.standSchedulingRows) ? state.standSchedulingRows : [];
  const withDate = rows.filter(r => r.date);
  if (withDate.length === 0) return null;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudiuMeu//Programare Ieșire cu Standul//RO',
    'CALSCALE:GREGORIAN',
  ];

  withDate.forEach((row, i) => {
    const [y, m, d] = row.date.split('-').map(Number);
    const [hh, mm] = (row.time && row.time.trim()) ? row.time.split(':').map(Number) : [9, 0];
    const start = new Date(y, m - 1, d, hh, mm, 0);
    const end = new Date(start.getTime() + 60 * 60000);

    const names = [row.vestitor, row.coleg, row.coleg2].map(n => (n || '').trim()).filter(Boolean).join(' + ');
    const summary = names ? `Ieșire cu standul — ${names}` : 'Ieșire cu standul';
    const uid = `studiumeu-stand-${row.id || i}@studiumeu.local`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${icsFormatDate(new Date())}Z`,
      `DTSTART:${icsFormatDate(start)}`,
      `DTEND:${icsFormatDate(end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape('Programare de ieșire cu standul - StudiuMeu')}`,
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

function exportStandSchedulingICS() {
  const result = buildStandSchedulingICS();
  if (!result) {
    showToast('Nu există nicio programare cu dată completată pentru export.', 'error');
    return;
  }

  const blob = new Blob([result.ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'programare-iesire-stand.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Calendar exportat (${result.count} evenimente) 📅 — deschide fișierul ca să-l imporți.`, 'success');
}

// ============================================
// RANDARE
// ============================================
function renderStandSchedulingTable() {
  const container = document.getElementById('standTableBody');
  if (!container) return;

  if (!Array.isArray(state.standSchedulingRows)) state.standSchedulingRows = [];
  const rows = state.standSchedulingRows;

  if (rows.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="9" class="fs2-empty">Nicio programare încă. Apasă „+ Adaugă programare”.</td>
      </tr>`;
    return;
  }

  container.innerHTML = rows.map(row => {
    const { ziua, luna, anul } = standDateParts(row.date);
    const match = standFindPairMatch(row.vestitor, row.coleg, row.coleg2, row.id);
    const warningRow = match ? `
      <tr class="fs2-warning-row">
        <td colspan="9">
          ⚠️ ${escHtml(match.a)} a mai fost programat cu ${escHtml(match.b)}
          ${match.row.date ? `pe ${escHtml(standDateParts(match.row.date).ziua)} ${escHtml(standDateParts(match.row.date).luna)} ${escHtml(standDateParts(match.row.date).anul)}` : 'anterior'}.
          Alege altă combinație data aceasta, dacă se poate.
        </td>
      </tr>` : '';

    return `
      <tr class="fs2-row${match ? ' fs2-row-flagged' : ''}">
        <td class="fs2-cell fs2-cell-date-wrap">
          <input type="date" class="fs2-cell-input fs2-cell-date" value="${escHtml(row.date || '')}"
            onchange="updateStandSchedulingCell('${row.id}', 'date', this.value)" />
        </td>
        <td class="fs2-cell fs2-cell-part">${ziua || '—'}</td>
        <td class="fs2-cell fs2-cell-part">${luna || '—'}</td>
        <td class="fs2-cell fs2-cell-part">${anul || '—'}</td>
        <td class="fs2-cell fs2-cell-time-wrap">
          <input type="time" class="fs2-cell-input fs2-cell-time" value="${escHtml(row.time || '')}"
            onchange="updateStandSchedulingCell('${row.id}', 'time', this.value)" />
        </td>
        <td class="fs2-cell">
          <input type="text" class="fs2-cell-input" placeholder="Nume vestitor" value="${escHtml(row.vestitor || '')}"
            oninput="updateStandSchedulingCellSilent('${row.id}', 'vestitor', this.value)"
            onblur="renderStandSchedulingTable()" />
        </td>
        <td class="fs2-cell">
          <input type="text" class="fs2-cell-input" placeholder="Nume vestitor colaborator" value="${escHtml(row.coleg || '')}"
            oninput="updateStandSchedulingCellSilent('${row.id}', 'coleg', this.value)"
            onblur="renderStandSchedulingTable()" />
        </td>
        <td class="fs2-cell">
          <input type="text" class="fs2-cell-input" placeholder="Nume vestitor colaborator 2" value="${escHtml(row.coleg2 || '')}"
            oninput="updateStandSchedulingCellSilent('${row.id}', 'coleg2', this.value)"
            onblur="renderStandSchedulingTable()" />
        </td>
        <td class="fs2-cell fs2-cell-del">
          <button class="fs-sched-del" onclick="deleteStandSchedulingRow('${row.id}')" title="Șterge programarea">✕</button>
        </td>
      </tr>
      ${warningRow}
    `;
  }).join('');
}
