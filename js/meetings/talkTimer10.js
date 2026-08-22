'use strict';

// ============================================
// DISCURS PRINCIPAL - TIMER 10 MIN
// ============================================
let talk10TimerInterval = null;
let talk10TimerSeconds = 600;
let talk10TimerRunning = false;
let talk10TimerFinished = false;

function talk10TimerStart() {
  if (talk10TimerFinished || talk10TimerRunning) return;
  talk10TimerRunning = true;
  document.getElementById('talk10TimerStartBtn').style.display = 'none';
  document.getElementById('talk10TimerPauseBtn').style.display = 'inline-flex';

  talk10TimerInterval = setInterval(function() {
    if (talk10TimerSeconds <= 0) {
      talk10TimerFinish();
      return;
    }
    talk10TimerSeconds--;
    talk10TimerUpdateUI();
  }, 1000);
}

function talk10TimerPause() {
  if (!talk10TimerRunning) return;
  clearInterval(talk10TimerInterval);
  talk10TimerRunning = false;
  var startBtn = document.getElementById('talk10TimerStartBtn');
  if (startBtn) { startBtn.style.display = 'inline-flex'; startBtn.textContent = '▶ Continuă'; }
  document.getElementById('talk10TimerPauseBtn').style.display = 'none';
}

function talk10TimerStop() {
  clearInterval(talk10TimerInterval);
  talk10TimerRunning = false;
}

function talk10TimerReset() {
  talk10TimerStop();
  talk10TimerSeconds = 600;
  talk10TimerFinished = false;

  var startBtn = document.getElementById('talk10TimerStartBtn');
  var pauseBtn = document.getElementById('talk10TimerPauseBtn');
  var timerBar = document.getElementById('talk10TimerBar');

  if (startBtn) { startBtn.style.display = 'inline-flex'; startBtn.textContent = '▶ Start'; }
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (timerBar) { timerBar.classList.remove('timer-warning', 'timer-danger', 'timer-done'); }

  var labelEl = document.getElementById('talk10TimerLabel');
  if (labelEl) labelEl.textContent = 'din 10 minute';

  talk10TimerUpdateUI();
}

function talk10TimerFinish() {
  clearInterval(talk10TimerInterval);
  talk10TimerRunning = false;
  talk10TimerFinished = true;
  talk10TimerSeconds = 0;

  var timerBar = document.getElementById('talk10TimerBar');
  if (timerBar) timerBar.classList.add('timer-done');

  var startBtn = document.getElementById('talk10TimerStartBtn');
  var pauseBtn = document.getElementById('talk10TimerPauseBtn');
  if (startBtn) startBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = 'none';

  document.getElementById('talk10TimerValue').textContent = '00:00';
  document.getElementById('talk10TimerIcon').textContent = '🔴';
  document.getElementById('talk10TimerLabel').textContent = 'Timp expirat!';
  document.getElementById('talk10TimerFill').style.width = '0%';

  showToast('⏰ Cele 10 minute pentru discurs s-au încheiat!', 'error');
}

function talk10TimerUpdateUI() {
  var total = 600;
  var remaining = talk10TimerSeconds;
  var pct = (remaining / total) * 100;

  var mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  var ss = String(remaining % 60).padStart(2, '0');

  var valEl = document.getElementById('talk10TimerValue');
  var fillEl = document.getElementById('talk10TimerFill');
  var iconEl = document.getElementById('talk10TimerIcon');
  var timerBar = document.getElementById('talk10TimerBar');

  if (valEl) valEl.textContent = mm + ':' + ss;
  if (fillEl) fillEl.style.width = pct + '%';

  if (timerBar) {
    timerBar.classList.remove('timer-warning', 'timer-danger');
    if (remaining <= 30) {
      timerBar.classList.add('timer-danger');
      if (iconEl) iconEl.textContent = '🔴';
    } else if (remaining <= 90) {
      timerBar.classList.add('timer-warning');
      if (iconEl) iconEl.textContent = '🟠';
    } else {
      if (iconEl) iconEl.textContent = '⏱';
    }
  }
}

// ============================================
