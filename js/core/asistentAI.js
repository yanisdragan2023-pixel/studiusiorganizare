/* ============================================
   StudiuMeu – ASISTENT AI (Google Gemini)
   Cheia API și modelul se salvează în `state` (localStorage),
   la fel ca restul aplicației. Fiecare mesaj se trimite direct
   din browser către Google, prin fetch — nu există server propriu.
   ============================================ */

'use strict';

const AI_DEFAULT_MODEL = 'gemini-2.0-flash';

// -------- SETĂRI --------

function renderAsistentAIPage() {
  const keyInput = document.getElementById('ai-apikey');
  const modelInput = document.getElementById('ai-model');
  if (keyInput) keyInput.value = state.geminiApiKey || '';
  if (modelInput) modelInput.value = state.geminiModel || AI_DEFAULT_MODEL;
  renderAIChatLog();
}

function saveAISettings() {
  state.geminiApiKey = (document.getElementById('ai-apikey')?.value || '').trim();
  state.geminiModel = (document.getElementById('ai-model')?.value || '').trim() || AI_DEFAULT_MODEL;
  saveState();
}

// -------- CONVERSAȚIE --------

function handleAIChatKeydown(event) {
  // Enter trimite mesajul, Shift+Enter face rând nou
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendAIMessage();
  }
}

function renderAIChatLog() {
  const log = document.getElementById('aiChatLog');
  if (!log) return;

  const history = state.aiChatHistory || [];
  if (history.length === 0) {
    log.innerHTML = '<p class="ai-chat-empty">Nicio conversație încă. Scrie o întrebare mai jos.</p>';
    return;
  }

  log.innerHTML = history.map(msg => {
    const cls = msg.role === 'user' ? 'ai-msg-user' : (msg.role === 'error' ? 'ai-msg-error' : 'ai-msg-assistant');
    return `<div class="ai-msg ${cls}">${escapeAIText(msg.text)}</div>`;
  }).join('');

  log.scrollTop = log.scrollHeight;
}

function escapeAIText(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

async function sendAIMessage() {
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('aiChatSendBtn');
  const text = (input?.value || '').trim();
  if (!text) return;

  const apiKey = (state.geminiApiKey || '').trim();
  if (!apiKey) {
    showToast('Completează mai întâi cheia API Gemini, mai sus');
    return;
  }

  state.aiChatHistory = state.aiChatHistory || [];
  state.aiChatHistory.push({ role: 'user', text });
  saveState();
  if (input) input.value = '';
  renderAIChatLog();

  // Mesaj temporar „se gândește...”
  const log = document.getElementById('aiChatLog');
  const pendingEl = document.createElement('div');
  pendingEl.className = 'ai-msg ai-msg-assistant ai-msg-pending';
  pendingEl.textContent = 'Asistentul scrie...';
  if (log) { log.appendChild(pendingEl); log.scrollTop = log.scrollHeight; }
  if (sendBtn) sendBtn.disabled = true;

  try {
    const reply = await callGeminiAPI(state.aiChatHistory, apiKey, state.geminiModel || AI_DEFAULT_MODEL);
    state.aiChatHistory.push({ role: 'assistant', text: reply });
  } catch (err) {
    console.error('Eroare Asistent AI:', err);
    state.aiChatHistory.push({ role: 'error', text: aiErrorMessage(err) });
  } finally {
    saveState();
    if (sendBtn) sendBtn.disabled = false;
    renderAIChatLog();
  }
}

function aiErrorMessage(err) {
  const msg = (err && err.message) || '';
  if (msg.includes('API_KEY_INVALID') || msg.includes('400') || msg.includes('403')) {
    return '⚠️ Cheia API pare greșită sau nu are acces la acest model. Verific-o în setările de mai sus.';
  }
  if (msg.includes('429')) {
    return '⚠️ Prea multe cereri la rând — mai încearcă puțin mai târziu (limita gratuită de Google).';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return '⚠️ Nu am putut contacta Google (verifică internetul).';
  }
  return `⚠️ A apărut o eroare: ${msg || 'necunoscută'}.`;
}

// Trimite ultimele mesaje ca „conversation history” către Gemini
// și întoarce textul răspunsului asistentului.
async function callGeminiAPI(history, apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Gemini nu are rol „system”/„assistant” direct — folosim „user”/„model”
  // și trimitem doar ultimele mesaje ca să nu creștem prea mult cererea.
  const recent = history.slice(-20).filter(m => m.role === 'user' || m.role === 'assistant');
  const contents = recent.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`${response.status} ${errText}`.trim());
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Blocat de Google: ${blockReason}` : 'Răspuns gol de la Gemini');
  }
  return text;
}

function clearAIChat() {
  if (!confirm('Ștergi toată conversația cu Asistentul AI?')) return;
  state.aiChatHistory = [];
  saveState();
  renderAIChatLog();
}
