'use strict';

/* ============================================
   HELPERE .ics — folosite de fieldScheduling.js și standScheduling.js
   pentru a construi fișiere de calendar (.ics) exportabile.
   ============================================ */

function icsPad(n) {
  return String(n).padStart(2, '0');
}

function icsFormatDate(d) {
  return `${d.getFullYear()}${icsPad(d.getMonth() + 1)}${icsPad(d.getDate())}T${icsPad(d.getHours())}${icsPad(d.getMinutes())}00`;
}

function icsEscape(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
