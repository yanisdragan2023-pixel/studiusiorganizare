'use strict';

// ============================================
// CURĂȚENIE SALA REGATULUI
// ============================================
// Punct de plecare al rotației: luni, 31 august 2026 (începutul primei perioade cunoscute).
// De aici, rotația se repetă la infinit, câte o săptămână (luni–duminică) pentru fiecare grupă.
const ANCHOR_MONDAY = new Date(2026, 7, 31); // lună 0-indexată: 7 = august

// Ordinea grupelor care se repetă la infinit, o intrare pe săptămână.
const GROUP_CYCLE = [
  'Grupele 9, 1 și 2',
  'Grupele 3 și 4',
  'Grupele 5 și 6',
  'Grupele 7 și 8'
];

function curatenieDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function curatenieCurrentMessage() {
  const now = curatenieDateOnly(new Date());
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((now - ANCHOR_MONDAY) / msPerDay);
  const weekIndex = Math.floor(diffDays / 7);
  const n = GROUP_CYCLE.length;
  const idx = ((weekIndex % n) + n) % n; // modulo pozitiv, funcționează și pt. date anterioare ancorei
  return GROUP_CYCLE[idx];
}

function renderCuratenie() {
  const el = document.getElementById('curatenieScheduleText');
  if (!el) return;
  const msg = curatenieCurrentMessage();
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}
