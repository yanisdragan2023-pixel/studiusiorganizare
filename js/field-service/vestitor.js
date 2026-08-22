'use strict';

// ============================================
// VESTITOR
// Nume vestitor + cronometru + rapoarte lunare.
// Tot ce se introduce aici se salvează automat în localStorage
// (prin state / saveState() din storage.js).
// ============================================

// -------- NUME VESTITOR --------

function saveVestitorNume() {
  const input = document.getElementById('vestitor-nume');
  if (!input) return;
  state.vestitorNume = input.value;
  saveState();
}

// -------- CRONOMETRU --------

let vestitorTimerSeconds = 0;
let vestitorTimerInterval = null;
let vestitorTimerRunning = false;

function vestitorTimerToggle() {
  if (vestitorTimerRunning) {
    vestitorTimerPause();
  } else {
    vestitorTimerStart();
  }
}

function vestitorTimerStart() {
  if (vestitorTimerRunning) return;
  vestitorTimerRunning = true;

  const btn = document.getElementById('vestitorTimerToggleBtn');
  if (btn) {
    btn.textContent = '⏸';
    btn.classList.add('is-running');
    btn.setAttribute('aria-label', 'Pune pe pauză');
  }

  vestitorTimerInterval = setInterval(function() {
    vestitorTimerSeconds++;
    vestitorTimerUpdateUI();
  }, 1000);
}

// "Pauză" și "Continuă" folosesc același buton (toggle): pornit -> pauză,
// oprit -> continuă de unde a rămas (secundele nu se resetează).
function vestitorTimerPause() {
  if (!vestitorTimerRunning) return;
  clearInterval(vestitorTimerInterval);
  vestitorTimerRunning = false;

  const btn = document.getElementById('vestitorTimerToggleBtn');
  if (btn) {
    btn.textContent = '▶';
    btn.classList.remove('is-running');
    btn.setAttribute('aria-label', 'Continuă cronometrul');
  }
}

function vestitorTimerReset() {
  clearInterval(vestitorTimerInterval);
  vestitorTimerRunning = false;
  vestitorTimerSeconds = 0;

  const btn = document.getElementById('vestitorTimerToggleBtn');
  if (btn) {
    btn.textContent = '▶';
    btn.classList.remove('is-running');
    btn.setAttribute('aria-label', 'Pornește cronometrul');
  }

  vestitorTimerUpdateUI();
}

function vestitorTimerUpdateUI() {
  const hh = String(Math.floor(vestitorTimerSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((vestitorTimerSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(vestitorTimerSeconds % 60).padStart(2, '0');

  const valEl = document.getElementById('vestitorTimerValue');
  if (valEl) valEl.textContent = `${hh}:${mm}:${ss}`;
}

// Transferă orele/minutele cronometrate în câmpurile "Ore"/"Minute" ale
// raportului lunar, adunându-le la ce era deja scris acolo (nu suprascrie).
function vestitorTimerAddToReport() {
  const addedHours = Math.floor(vestitorTimerSeconds / 3600);
  const addedMinutes = Math.floor((vestitorTimerSeconds % 3600) / 60);

  const oreInput = document.getElementById('vestitor-ore');
  const minuteInput = document.getElementById('vestitor-minute');
  if (!oreInput || !minuteInput) return;

  let totalMinutes =
    (parseInt(oreInput.value, 10) || 0) * 60 +
    (parseInt(minuteInput.value, 10) || 0) +
    addedHours * 60 + addedMinutes;

  oreInput.value = Math.floor(totalMinutes / 60);
  minuteInput.value = totalMinutes % 60;

  showToast('Timpul cronometrat a fost adăugat în raport');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// -------- RAPORT LUNAR --------

// Setează automat luna și anul curente în formularul "Raport lunar",
// o singură dată (nu suprascrie dacă utilizatorul a ales deja altă lună),
// astfel încât formularul urmărește singur luna reală (Iulie -> August -> ...).
function initVestitorReportMonthDefaults() {
  const lunaSel = document.getElementById('vestitor-luna');
  const anulInput = document.getElementById('vestitor-anul');
  const now = new Date();

  if (lunaSel && !lunaSel.dataset.defaulted) {
    lunaSel.value = RO_MONTHS_FULL[now.getMonth()];
    lunaSel.dataset.defaulted = '1';
  }
  if (anulInput && !anulInput.value) {
    anulInput.value = now.getFullYear();
  }
}

function saveVestitorReport() {
  const luna = document.getElementById('vestitor-luna')?.value || '';
  const anul = document.getElementById('vestitor-anul')?.value || '';
  const ore = parseInt(document.getElementById('vestitor-ore')?.value, 10) || 0;
  const minute = parseInt(document.getElementById('vestitor-minute')?.value, 10) || 0;
  const observatii = document.getElementById('vestitor-observatii')?.value || '';

  if (!anul) {
    showToast('Completează anul înainte de a salva raportul');
    return;
  }

  state.vestitorReports.push({
    id: 'vr-' + Date.now(),
    luna,
    anul,
    ore,
    minute,
    observatii,
    createdAt: new Date().toISOString(),
  });
  saveState();

  // Golește formularul (păstrăm luna/anul curente ca să fie mai rapid la
  // rapoarte succesive, dar resetăm ore/minute/observații).
  document.getElementById('vestitor-ore').value = '';
  document.getElementById('vestitor-minute').value = '';
  document.getElementById('vestitor-observatii').value = '';

  renderVestitorReports();
  renderVestitorAnnualReport();
  showToast('Raport salvat');
}

function clearVestitorReportForm() {
  const ore = document.getElementById('vestitor-ore');
  const minute = document.getElementById('vestitor-minute');
  const observatii = document.getElementById('vestitor-observatii');
  if (ore) ore.value = '';
  if (minute) minute.value = '';
  if (observatii) observatii.value = '';
  showToast('Formular golit');
}

function deleteVestitorReport(id) {
  state.vestitorReports = state.vestitorReports.filter(r => r.id !== id);
  saveState();
  renderVestitorReports();
  renderVestitorAnnualReport();
}

// -------- TRIMITE PE WHATSAPP + REAMINTIRE RAPORT --------

const RO_MONTHS_FULL = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

function vestitorMonthKey(year, monthIdx0) {
  return `${year}-${String(monthIdx0 + 1).padStart(2, '0')}`;
}

// Determină luna la care se referă în mod natural butonul „Raport trimis”:
// în zilele 1-2 ale lunii ne referim la luna anterioară (cea tocmai încheiată),
// în rest la luna curentă.
function getVestitorReportTargetMonth(now) {
  now = now || new Date();
  let year = now.getFullYear();
  let monthIdx0 = now.getMonth();
  if (now.getDate() <= 2) {
    monthIdx0 -= 1;
    if (monthIdx0 < 0) { monthIdx0 = 11; year -= 1; }
  }
  return { year, monthIdx0, key: vestitorMonthKey(year, monthIdx0) };
}

function shareVestitorReportWhatsApp() {
  const nume = (document.getElementById('vwa-nume')?.value || '').trim();
  const luna = document.getElementById('vwa-luna')?.value || '';
  const anul = document.getElementById('vwa-anul')?.value || '';

  if (!anul) {
    showToast('Completează anul înainte de a trimite raportul');
    return;
  }

  const parts = ['*Raport de predicare*'];
  if (nume) parts.push(`👤 ${nume}`);
  parts.push(`🗓️ ${luna} ${anul}`);

  const participareSel = document.getElementById('vwa-participare');
  if (participareSel) {
    parts.push(`📖 Am predicat luna aceasta: ${participareSel.value}`);
  } else {
    const ore = document.getElementById('vwa-ore')?.value || '0';
    const minute = document.getElementById('vwa-minute')?.value || '0';
    parts.push(`⏱️ ${ore} ore ${minute} minute`);
  }

  const text = parts.join('\n');
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// Randează câmpul potrivit statutului bifat în profil:
// - vestitor simplu (fără statut de auxiliar/regulat) -> câmp „Participare” Da/Nu
// - auxiliar 15/30 sau regulat -> câmp Ore/Minute, precompletat din raportul
//   deja salvat pentru luna aleasă (dacă există) sau din ținta statutului,
//   dar rămâne editabil de utilizator.
function renderVestitorWhatsAppFields() {
  const lunaSel = document.getElementById('vwa-luna');
  const anulInput = document.getElementById('vwa-anul');
  const nameInput = document.getElementById('vwa-nume');
  const container = document.getElementById('vwaDynamicField');
  if (!lunaSel || !anulInput || !container) return;

  if (!lunaSel.dataset.defaulted) {
    lunaSel.value = RO_MONTHS_FULL[new Date().getMonth()];
    lunaSel.dataset.defaulted = '1';
  }
  if (!anulInput.value) anulInput.value = new Date().getFullYear();
  if (nameInput && !nameInput.value) nameInput.value = state.vestitorNume || '';

  const { rate } = getVestitorAnnualRate();
  const luna = lunaSel.value;
  const anul = anulInput.value;

  if (rate > 0) {
    const reports = state.vestitorReports || [];
    const matched = reports.find(r => r.luna === luna && String(r.anul) === String(anul));
    const ore = matched ? matched.ore : rate;
    const minute = matched ? matched.minute : 0;
    container.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>Ore</label>
          <input type="number" id="vwa-ore" class="form-input" min="0" value="${ore}" />
        </div>
        <div class="form-group">
          <label>Minute</label>
          <input type="number" id="vwa-minute" class="form-input" min="0" max="59" value="${minute}" />
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="form-group">
        <label>Participare</label>
        <select id="vwa-participare" class="form-input">
          <option value="Da">Da</option>
          <option value="Nu">Nu</option>
        </select>
      </div>
    `;
  }
}

function onVestitorReportSentToggle(checkbox) {
  const target = getVestitorReportTargetMonth();
  state.vestitorReportSentMonths = state.vestitorReportSentMonths || {};

  if (checkbox.checked) {
    state.vestitorReportSentMonths[target.key] = true;
    showToast(`Raport confirmat pentru ${RO_MONTHS_FULL[target.monthIdx0]} ${target.year} — reamintirile pentru luna asta sunt oprite.`);
  } else {
    delete state.vestitorReportSentMonths[target.key];
    showToast(`Bifă anulată pentru ${RO_MONTHS_FULL[target.monthIdx0]} ${target.year} — reamintirile vor continua.`);
  }

  saveState();
  renderVestitorReportSentStatus();
}

function renderVestitorReportSentStatus() {
  const row = document.getElementById('vestitorReportSentRow');
  const checkbox = document.getElementById('vestitorReportSentCheckbox');
  const label = document.getElementById('vestitorReportSentLabel');
  const status = document.getElementById('vestitorReportSentStatus');
  if (!checkbox) return;

  const target = getVestitorReportTargetMonth();
  const sentMap = state.vestitorReportSentMonths || {};
  const isSent = !!sentMap[target.key];
  const monthLabel = `${RO_MONTHS_FULL[target.monthIdx0]} ${target.year}`;

  checkbox.checked = isSent;
  if (row) row.classList.toggle('is-sent', isSent);
  if (label) label.textContent = isSent ? `✅ Raport trimis (${monthLabel})` : `Raport trimis pentru ${monthLabel}`;

  if (status) {
    status.textContent = isSent
      ? `Confirmat — nu vei mai primi reamintiri pentru ${monthLabel}. Poți debifa dacă a fost din greșeală.`
      : `Bifează aici după ce trimiți raportul pentru ${monthLabel}. Până atunci vei primi reamintiri repetate, pe toată durata zilei, în prima și a doua zi a lunii următoare.`;
  }
}

// Export .ics opțional, secundar — pentru cine preferă calendarul telefonului
// în locul notificărilor locale. Creează 3 reamintiri pentru ciclul curent:
// ultima zi a lunii curente + prima și a doua zi a lunii următoare.
function exportVestitorReportReminderICS() {
  const now = new Date();
  const day1 = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);
  const day2 = new Date(now.getFullYear(), now.getMonth() + 1, 2, 9, 0, 0);

  const events = [
    { start: day1, summary: 'Ai trimis raportul de predicare?' },
    { start: day2, summary: 'Reamintire: raportul de predicare' },
  ];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudiuMeu//Reamintire Raport Vestitor//RO',
    'CALSCALE:GREGORIAN',
  ];

  events.forEach((ev, i) => {
    const end = new Date(ev.start.getTime() + 15 * 60000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:studiumeu-vr-${vestitorMonthKey(now.getFullYear(), now.getMonth())}-${i}@studiumeu.local`,
      `DTSTAMP:${icsFormatDate(new Date())}Z`,
      `DTSTART:${icsFormatDate(ev.start)}`,
      `DTEND:${icsFormatDate(end)}`,
      `SUMMARY:${icsEscape(ev.summary)}`,
      `DESCRIPTION:${icsEscape('Reamintire raport lunar - StudiuMeu')}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reamintire-raport-vestitor.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Calendar exportat 📅 — deschide fișierul ca să-l imporți.', 'success');
}

function renderVestitorReports() {
  const tbody = document.getElementById('vestitorReportsTableBody');
  if (!tbody) return;

  const reports = state.vestitorReports || [];

  if (reports.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-secondary)">Niciun raport salvat încă.</td></tr>`;
    return;
  }

  // Cele mai recente primele
  const sorted = [...reports].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td>${escapeHtml(r.luna)}</td>
      <td>${escapeHtml(String(r.anul))}</td>
      <td>${r.ore}</td>
      <td>${r.minute}</td>
      <td>${escapeHtml(r.observatii || '')}</td>
      <td><button type="button" class="btn-ghost btn-sm" onclick="deleteVestitorReport('${r.id}')">🗑️</button></td>
    </tr>
  `).join('');
}

// -------- TOGGLE SECȚIUNE (cronometru + raport lunar) --------

function toggleVestitorReportSection() {
  const section = document.getElementById('vestitorReportSection');
  const btn = document.getElementById('vestitorReportToggleBtn');
  if (!section || !btn) return;

  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? '' : 'none';
  btn.textContent = isHidden ? '📊 Ascunde raportul lunar' : '📊 Raport lunar';
}

// -------- PROFILUL VESTITORULUI --------

// Anul teocratic începe cu Septembrie, nu cu Ianuarie.
const VESTITOR_PROFIL_LUNI = ['SEP', 'OCT', 'NOI', 'DEC', 'IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG'];

function toggleVestitorProfileSection() {
  const section = document.getElementById('vestitorProfileSection');
  const btn = document.getElementById('vestitorProfileBtn');
  if (!section || !btn) return;

  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? '' : 'none';
  btn.textContent = isHidden ? '👤 Ascunde profilul vestitorului' : '👤 Profilul Vestitorului';
}

function saveVestitorProfil() {
  if (!state.vestitorProfil) state.vestitorProfil = { vestitor: false, auxiliar15: false, auxiliar30: false, regulat: false, months: {} };
  state.vestitorProfil.vestitor = !!document.getElementById('vprofile-vestitor')?.checked;
  state.vestitorProfil.auxiliar15 = !!document.getElementById('vprofile-auxiliar15')?.checked;
  state.vestitorProfil.auxiliar30 = !!document.getElementById('vprofile-auxiliar30')?.checked;
  state.vestitorProfil.regulat = !!document.getElementById('vprofile-regulat')?.checked;
  saveState();
  renderVestitorAnnualReport();
  renderVestitorWhatsAppFields();
}

function setVestitorProfilMonthColor(luna, color) {
  if (!state.vestitorProfil) state.vestitorProfil = { vestitor: '', auxiliar: '', months: {} };
  if (!state.vestitorProfil.months) state.vestitorProfil.months = {};

  state.vestitorProfil.months[luna] = color;
  saveState();
  renderVestitorProfilMonths();
  renderVestitorAnnualReport();
}

function clearVestitorProfilMonthColor(luna) {
  if (!state.vestitorProfil || !state.vestitorProfil.months) return;
  delete state.vestitorProfil.months[luna];
  saveState();
  renderVestitorProfilMonths();
  renderVestitorAnnualReport();
}

function clearAllVestitorProfilMonthColors() {
  if (!state.vestitorProfil || !state.vestitorProfil.months) return;
  const areColors = Object.keys(state.vestitorProfil.months).length > 0;
  if (!areColors) return;
  if (!confirm('Ștergi toate culorile lunilor?')) return;
  state.vestitorProfil.months = {};
  saveState();
  renderVestitorProfilMonths();
  renderVestitorAnnualReport();
}

function renderVestitorProfilMonths() {
  const wrap = document.getElementById('vprofileMonths');
  if (!wrap) return;

  const months = (state.vestitorProfil && state.vestitorProfil.months) || {};

  wrap.innerHTML = VESTITOR_PROFIL_LUNI.map(luna => {
    const color = months[luna] || '';
    const style = color ? ` style="background:${escapeHtml(color)}"` : '';
    return `
      <label class="vprofile-month-chip"${style} title="Alege o culoare pentru ${luna}" oncontextmenu="clearVestitorProfilMonthColor('${luna}');return false;">
        <span>${luna}</span>
        <input type="color" value="${color || '#ffd166'}" oninput="setVestitorProfilMonthColor('${luna}', this.value)" />
      </label>
    `;
  }).join('');
}

// -------- RAPORTUL ANUAL TEOCRATIC --------
// Anul teocratic: Septembrie (an X) -> August (an X+1).
// Ținta lunară de ore depinde de statutul bifat în profil (15 / 30 / 50 ore).
// Contează la total DOAR lunile marcate cu culoare în profil (👤).
// Orele reale se iau automat din "Raport lunar" (state.vestitorReports),
// potrivite după lună + an calendaristic.

const VESTITOR_ANNUAL_MONTH_FULL = {
  SEP: 'Septembrie', OCT: 'Octombrie', NOI: 'Noiembrie', DEC: 'Decembrie',
  IAN: 'Ianuarie', FEB: 'Februarie', MAR: 'Martie', APR: 'Aprilie',
  MAI: 'Mai', IUN: 'Iunie', IUL: 'Iulie', AUG: 'August',
};

// Rata (ore/lună țintă) în funcție de statutul bifat în profil.
// Prioritate când sunt bifate mai multe: regulat > auxiliar 30 > auxiliar 15.
function getVestitorAnnualRate() {
  const profil = state.vestitorProfil || {};
  if (profil.regulat) return { rate: 50, label: 'Vestitor regulat (50 ore/lună)' };
  if (profil.auxiliar30) return { rate: 30, label: 'Vestitor auxiliar 30 ore/lună' };
  if (profil.auxiliar15) return { rate: 15, label: 'Vestitor auxiliar 15 ore/lună' };
  return { rate: 0, label: '' };
}

// Anul teocratic implicit: cel curent, în funcție de data de azi
// (dacă suntem în Ian-Aug, anul teocratic a început în Septembrie anul trecut).
function getDefaultVestitorAnnualYear() {
  const now = new Date();
  const m = now.getMonth(); // 0 = Ianuarie ... 8 = Septembrie
  return m >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

// Construiește cele 12 luni ale anului teocratic (Sept an X -> Aug an X+1),
// fiecare cu anul calendaristic corespunzător.
function getVestitorAnnualMonths(startYear) {
  return VESTITOR_PROFIL_LUNI.map((abbr, i) => ({
    abbr,
    full: VESTITOR_ANNUAL_MONTH_FULL[abbr],
    calYear: i < 4 ? startYear : startYear + 1, // SEP,OCT,NOI,DEC = anul X; restul = anul X+1
  }));
}

function computeVestitorAnnualReport(startYear) {
  const months = getVestitorAnnualMonths(startYear);
  const profilMonths = (state.vestitorProfil && state.vestitorProfil.months) || {};
  const reports = state.vestitorReports || [];
  const { rate, label } = getVestitorAnnualRate();

  let totalMinutes = 0;
  let targetMinutes = 0;
  let activeMonthsCount = 0;

  const rows = months.map(m => {
    const isActive = !!profilMonths[m.abbr];
    const matched = reports.filter(r => r.luna === m.full && String(r.anul) === String(m.calYear));
    const monthMinutes = matched.reduce((sum, r) => sum + (parseInt(r.ore, 10) || 0) * 60 + (parseInt(r.minute, 10) || 0), 0);

    if (isActive) {
      activeMonthsCount++;
      targetMinutes += rate * 60;
      totalMinutes += monthMinutes;
    }

    return {
      abbr: m.abbr,
      full: m.full,
      calYear: m.calYear,
      isActive,
      ore: Math.floor(monthMinutes / 60),
      minute: monthMinutes % 60,
      hasReport: matched.length > 0,
    };
  });

  return {
    startYear,
    endYear: startYear + 1,
    rows,
    rate,
    label,
    activeMonthsCount,
    totalOre: Math.floor(totalMinutes / 60),
    totalMinute: totalMinutes % 60,
    targetOre: Math.floor(targetMinutes / 60),
    targetMinute: targetMinutes % 60,
    totalMinutesRaw: totalMinutes,
    targetMinutesRaw: targetMinutes,
  };
}

function changeVestitorAnnualYear(delta) {
  const current = state.vestitorAnnualYear != null ? state.vestitorAnnualYear : getDefaultVestitorAnnualYear();
  state.vestitorAnnualYear = current + delta;
  saveState();
  renderVestitorAnnualReport();
}

function renderVestitorAnnualReport() {
  const wrap = document.getElementById('vestitorAnnualReportWrap');
  if (!wrap) return;

  if (state.vestitorAnnualYear == null) {
    state.vestitorAnnualYear = getDefaultVestitorAnnualYear();
  }

  const data = computeVestitorAnnualReport(state.vestitorAnnualYear);

  const yearLabel = document.getElementById('vestitorAnnualYearLabel');
  if (yearLabel) yearLabel.textContent = `${data.startYear} - ${data.endYear}`;

  const statusEl = document.getElementById('vestitorAnnualStatus');
  if (statusEl) {
    if (!data.rate) {
      statusEl.innerHTML = `<p class="page-sub">Bifează un statut în profil (auxiliar 15 / 30 sau regulat) ca să vezi ținta anuală.</p>`;
    } else if (data.activeMonthsCount === 0) {
      statusEl.innerHTML = `<p class="page-sub">Colorează lunile în care ești activ mai sus (👤), ca să intre în calculul anual.</p>`;
    } else {
      const pct = data.targetMinutesRaw > 0 ? Math.min(100, Math.round((data.totalMinutesRaw / data.targetMinutesRaw) * 100)) : 0;
      const ramasMinutes = Math.max(0, data.targetMinutesRaw - data.totalMinutesRaw);
      const ramasOre = Math.floor(ramasMinutes / 60);
      const ramasMin = ramasMinutes % 60;
      statusEl.innerHTML = `
        <p class="page-sub" style="margin-bottom:8px">${escapeHtml(data.label)} · ${data.activeMonthsCount} ${data.activeMonthsCount === 1 ? 'lună activă' : 'luni active'}</p>
        <div class="vannual-stats">
          <div class="vannual-stat">
            <span class="vannual-stat-value">${data.totalOre}h ${data.totalMinute}m</span>
            <span class="vannual-stat-label">Realizat</span>
          </div>
          <div class="vannual-stat">
            <span class="vannual-stat-value">${data.targetOre}h ${data.targetMinute}m</span>
            <span class="vannual-stat-label">Țintă</span>
          </div>
          <div class="vannual-stat">
            <span class="vannual-stat-value">${ramasOre}h ${ramasMin}m</span>
            <span class="vannual-stat-label">Rămase</span>
          </div>
        </div>
        <div class="vannual-progress"><div class="vannual-progress-bar" style="width:${pct}%"></div></div>
        <div class="page-sub" style="text-align:right;margin-top:4px">${pct}%</div>
      `;
    }
  }

  const tbody = document.getElementById('vestitorAnnualTableBody');
  if (tbody) {
    tbody.innerHTML = data.rows.map(r => `
      <tr${r.isActive ? '' : ' style="opacity:.5"'}>
        <td>${r.abbr} ${r.calYear}</td>
        <td style="text-align:center">${r.isActive ? '🟢' : '—'}</td>
        <td>${r.hasReport ? `${r.ore}h ${r.minute}m` : '—'}</td>
      </tr>
    `).join('');
  }
}

// -------- RENDER PAGINĂ --------

function renderVestitorPage() {
  const numeInput = document.getElementById('vestitor-nume');
  if (numeInput) numeInput.value = state.vestitorNume || '';

  initVestitorReportMonthDefaults();
  vestitorTimerUpdateUI();
  renderVestitorReports();

  const profil = state.vestitorProfil || { vestitor: false, auxiliar15: false, auxiliar30: false, regulat: false, months: {} };
  const vestitorInput = document.getElementById('vprofile-vestitor');
  const auxiliar15Input = document.getElementById('vprofile-auxiliar15');
  const auxiliar30Input = document.getElementById('vprofile-auxiliar30');
  const regulatInput = document.getElementById('vprofile-regulat');
  if (vestitorInput) vestitorInput.checked = !!profil.vestitor;
  if (auxiliar15Input) auxiliar15Input.checked = !!profil.auxiliar15;
  if (auxiliar30Input) auxiliar30Input.checked = !!profil.auxiliar30;
  if (regulatInput) regulatInput.checked = !!profil.regulat;
  renderVestitorProfilMonths();
  renderVestitorAnnualReport();
  renderVestitorReportSentStatus();
  renderVestitorWhatsAppFields();
}
