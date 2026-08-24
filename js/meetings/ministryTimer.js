'use strict';

// ============================================
// PREDICARE - CRONOMETRU DE PRACTICĂ (1-5 MIN, DURATĂ SELECTABILĂ)
// Folosit în secțiunea "Să fim mai eficienți în Predicare" din Caietul
// de Întrunire, pentru a exersa o prezentare/parte cu durată variabilă.
// ============================================
let ministryTimerInterval = null;
let ministryTimerDurationMinutes = 2;
let ministryTimerSeconds = ministryTimerDurationMinutes * 60;
let ministryTimerRunning = false;
let ministryTimerFinished = false;

function ministryTimerSetDuration(minutes) {
  if (ministryTimerRunning) return;
  ministryTimerDurationMinutes = Math.max(1, Math.min(5, Number(minutes) || 1));
  ministryTimerReset();
}

function ministryTimerStart() {
  if (ministryTimerFinished || ministryTimerRunning) return;
  ministryTimerRunning = true;

  var startBtn = document.getElementById('ministryTimerStartBtn');
  var pauseBtn = document.getElementById('ministryTimerPauseBtn');
  if (startBtn) startBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = 'inline-flex';
  ministryTimerUpdateChips();

  ministryTimerInterval = setInterval(function () {
    if (ministryTimerSeconds <= 0) {
      ministryTimerFinish();
      return;
    }
    ministryTimerSeconds--;
    ministryTimerUpdateUI();
  }, 1000);
}

function ministryTimerPause() {
  if (!ministryTimerRunning) return;
  clearInterval(ministryTimerInterval);
  ministryTimerRunning = false;

  var startBtn = document.getElementById('ministryTimerStartBtn');
  var pauseBtn = document.getElementById('ministryTimerPauseBtn');
  if (startBtn) { startBtn.style.display = 'inline-flex'; startBtn.textContent = '▶ Continuă'; }
  if (pauseBtn) pauseBtn.style.display = 'none';
  ministryTimerUpdateChips();
}

function ministryTimerStop() {
  clearInterval(ministryTimerInterval);
  ministryTimerRunning = false;
}

function ministryTimerReset() {
  ministryTimerStop();
  ministryTimerSeconds = ministryTimerDurationMinutes * 60;
  ministryTimerFinished = false;

  var startBtn = document.getElementById('ministryTimerStartBtn');
  var pauseBtn = document.getElementById('ministryTimerPauseBtn');
  var timerBar = document.getElementById('ministryTimerBar');
  var iconEl = document.getElementById('ministryTimerIcon');

  if (startBtn) { startBtn.style.display = 'inline-flex'; startBtn.textContent = '▶ Start'; }
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (timerBar) timerBar.classList.remove('timer-warning', 'timer-danger', 'timer-done');
  if (iconEl) iconEl.textContent = '⏱';

  var labelEl = document.getElementById('ministryTimerLabel');
  if (labelEl) {
    labelEl.textContent = 'din ' + ministryTimerDurationMinutes + (ministryTimerDurationMinutes === 1 ? ' minut' : ' minute');
  }

  ministryTimerUpdateChips();
  ministryTimerUpdateUI();
}

function ministryTimerFinish() {
  clearInterval(ministryTimerInterval);
  ministryTimerRunning = false;
  ministryTimerFinished = true;
  ministryTimerSeconds = 0;

  var timerBar = document.getElementById('ministryTimerBar');
  if (timerBar) timerBar.classList.add('timer-done');

  var startBtn = document.getElementById('ministryTimerStartBtn');
  var pauseBtn = document.getElementById('ministryTimerPauseBtn');
  if (startBtn) startBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = 'none';

  var valEl = document.getElementById('ministryTimerValue');
  var iconEl = document.getElementById('ministryTimerIcon');
  var labelEl = document.getElementById('ministryTimerLabel');
  var fillEl = document.getElementById('ministryTimerFill');
  if (valEl) valEl.textContent = '00:00';
  if (iconEl) iconEl.textContent = '🔴';
  if (labelEl) labelEl.textContent = 'Timp expirat!';
  if (fillEl) fillEl.style.width = '0%';

  if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
  if (typeof showToast === 'function') {
    showToast('⏰ Cele ' + ministryTimerDurationMinutes + ' minute s-au încheiat!', 'error');
  }
}

function ministryTimerUpdateChips() {
  document.querySelectorAll('.ministry-duration-btn').forEach(function (btn) {
    var mins = Number(btn.dataset.minutes);
    btn.classList.toggle('active', mins === ministryTimerDurationMinutes);
    btn.disabled = ministryTimerRunning;
  });
}

function ministryTimerUpdateUI() {
  var total = ministryTimerDurationMinutes * 60;
  var remaining = ministryTimerSeconds;
  var pct = total ? (remaining / total) * 100 : 0;

  var mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  var ss = String(remaining % 60).padStart(2, '0');

  var valEl = document.getElementById('ministryTimerValue');
  var fillEl = document.getElementById('ministryTimerFill');
  var iconEl = document.getElementById('ministryTimerIcon');
  var timerBar = document.getElementById('ministryTimerBar');

  if (valEl) valEl.textContent = mm + ':' + ss;
  if (fillEl) fillEl.style.width = pct + '%';

  if (timerBar && !ministryTimerFinished) {
    timerBar.classList.remove('timer-warning', 'timer-danger');
    if (remaining <= 10) {
      timerBar.classList.add('timer-danger');
      if (iconEl) iconEl.textContent = '🔴';
    } else if (remaining <= 30) {
      timerBar.classList.add('timer-warning');
      if (iconEl) iconEl.textContent = '🟠';
    } else {
      if (iconEl) iconEl.textContent = '⏱';
    }
  }
}

// Apelat la intrarea pe pagina Caiet Întrunire, ca să pornească mereu
// de la o stare curată și ca textarea-urile deja completate să aibă
// înălțimea corectă.
function renderWorkbookMinistrySection() {
  ministryTimerReset();
  document.querySelectorAll('.ministry-note-textarea').forEach(function (ta) {
    autoGrowTextarea(ta);
  });
}
