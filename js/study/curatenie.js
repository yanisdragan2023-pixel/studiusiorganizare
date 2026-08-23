'use strict';

// ============================================
// CURĂȚENIE SALA REGATULUI
// ============================================
// Fiecare perioadă: [luna_start(0-11), zi_start] -> [luna_sfarsit, zi_sfarsit]
const curatenieSchedule = [
  { start: [6, 27], end: [7, 2],  text: 'Grupele 7 și 8 — curățenie' },
  { start: [7, 3],  end: [7, 9],  text: 'Grupele 9, 1 și 2 — curățenie' },
  { start: [7, 10], end: [7, 16], text: 'Grupele 3 și 4 — curățenie' },
  { start: [7, 17], end: [7, 23], text: 'Grupele 5 și 6 — curățenie' },
  { start: [7, 24], end: [7, 30], text: 'Grupele 7 și 8 — curățenie' }
];

function curatenieDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function curatenieCurrentMessage() {
  const now = curatenieDateOnly(new Date());
  const year = now.getFullYear();
  for (const period of curatenieSchedule) {
    const start = new Date(year, period.start[0], period.start[1]);
    const end = new Date(year, period.end[0], period.end[1]);
    if (now >= start && now <= end) return period.text;
  }
  return null;
}

function renderCuratenie() {
  const el = document.getElementById('curatenieScheduleText');
  if (!el) return;
  const msg = curatenieCurrentMessage();
  el.textContent = msg || 'Nu există o programare pentru perioada curentă.';
}
