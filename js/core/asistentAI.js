/* ============================================
   StudiuMeu – ASISTENT AI (Google Gemini)
   Cheia API și modelul se salvează în `state` (localStorage),
   la fel ca restul aplicației. Fiecare mesaj se trimite direct
   din browser către Google, prin fetch — nu există server propriu.
   ============================================ */

'use strict';

const AI_DEFAULT_MODEL = 'gemini-flash-latest';
const AI_HISTORY_LIMIT = 8;
const AI_MAX_INPUT_CHARS = 6000;
const AI_LEGACY_MODELS = new Set([
  'gemini-1.0-pro',
  'gemini-1.0-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
]);

class GeminiApiError extends Error {
  constructor(type, message, status = null) {
    super(message);
    this.name = 'GeminiApiError';
    this.type = type;
    this.status = status;
  }
}

// -------- SETĂRI --------

function renderAsistentAIPage() {
  const keyInput = document.getElementById('ai-apikey');
  const modelInput = document.getElementById('ai-model');
  const currentModel = normalizeGeminiModel(state.geminiModel);
  if (currentModel !== state.geminiModel) {
    state.geminiModel = currentModel;
    saveState();
  }
  if (keyInput) keyInput.value = state.geminiApiKey || '';
  if (modelInput) modelInput.value = currentModel;
  renderAIChatLog();
}

function saveAISettings() {
  state.geminiApiKey = (document.getElementById('ai-apikey')?.value || '').trim();
  state.geminiModel = normalizeGeminiModel(document.getElementById('ai-model')?.value);
  saveState();
}

function handleAIKeyBlur() {
  const apiKey = (state.geminiApiKey || '').trim();
  if (apiKey && typeof showToast === 'function') {
    showToast('Cheia API a fost salvată pe acest dispozitiv.', 'success');
  }
}

async function testAIKey() {
  const apiKey = (state.geminiApiKey || '').trim();
  if (!apiKey) {
    showToast('Completează mai întâi cheia API Gemini.', 'error');
    return;
  }
  const btn = document.getElementById('aiTestKeyBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Se testează...'; }
  try {
    await callGeminiAPIWithRetry([{ role: 'user', text: 'Răspunde doar cu cuvântul: OK' }], apiKey, normalizeGeminiModel(state.geminiModel));
    showToast('✅ Cheia funcționează! Asistentul AI e gata de folosit.', 'success');
  } catch (err) {
    console.error('Test cheie AI eșuat:', err);
    showToast(aiErrorMessage(err), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔎 Testează cheia'; }
  }
}

function normalizeGeminiModel(model) {
  const value = (model || '').trim();
  if (!value || AI_LEGACY_MODELS.has(value)) return AI_DEFAULT_MODEL;
  return value;
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
    showToast('Completează mai întâi cheia API Gemini, mai sus.');
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
    const reply = await callGeminiAPIWithRetry(
      state.aiChatHistory,
      apiKey,
      normalizeGeminiModel(state.geminiModel),
      (attempt) => { if (pendingEl) pendingEl.textContent = `Serverul Gemini e ocupat, se reîncearcă (${attempt})...`; }
    );
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
  if (err?.type === 'missing-api-key') {
    return '⚠️ Cheia API lipsește. Introdu cheia Gemini în setările de mai sus.';
  }
  if (err?.type === 'invalid-api-key') {
    return '⚠️ Cheia API Gemini pare invalidă sau nu are acces. Verifică cheia în setările de mai sus.';
  }
  if (err?.type === 'model-unavailable') {
    return `⚠️ Modelul Gemini selectat nu este disponibil. Folosește un model curent, de exemplu ${AI_DEFAULT_MODEL}.`;
  }
  if (err?.type === 'rate-limit') {
    return '⚠️ Limita API Gemini a fost atinsă. Mai încearcă puțin mai târziu.';
  }
  if (err?.type === 'overloaded') {
    return '⚠️ Serverele Gemini sunt momentan suprasolicitate (eroare de la Google, nu de la aplicație sau de la rețeaua ta). Aplicația a reîncercat automat, dar tot nu a mers — mai așteaptă puțin și încearcă din nou.';
  }
  if (err?.type === 'network') {
    return '⚠️ Eroare de rețea: nu am putut contacta Google Gemini. Verifică internetul și încearcă din nou.';
  }
  if (err?.type === 'timeout') {
    return '⚠️ Gemini a durat prea mult să răspundă (peste 20s) și cererea a fost anulată. Verifică rețeaua (Wi-Fi/date mobile) și încearcă din nou — dacă se repetă des, e posibil ca ceva din rețea (firewall/VPN) să blocheze Google.';
  }
  if (err?.type === 'invalid-response') {
    return '⚠️ Gemini a trimis un răspuns invalid sau gol. Încearcă din nou.';
  }
  const msg = (err && err.message) || '';
  return `⚠️ A apărut o eroare: ${msg || 'necunoscută'}.`;
}

// Trimite ultimele mesaje ca „conversation history” către Gemini
// și întoarce textul răspunsului asistentului.
async function callGeminiAPI(history, apiKey, model) {
  const cleanApiKey = (apiKey || '').trim();
  if (!cleanApiKey) {
    throw new GeminiApiError('missing-api-key', 'Cheia API lipsește.');
  }

  const selectedModel = normalizeGeminiModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`;

  // Gemini nu are rol „system”/„assistant” direct — folosim „user”/„model”
  // și trimitem doar ultimele mesaje ca să nu creștem prea mult cererea.
  const recent = history
    .slice(-AI_HISTORY_LIMIT)
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: String(m.text || '').slice(-AI_MAX_INPUT_CHARS),
    }));

  const contents = recent.map(m => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  // Timeout explicit: dacă rețeaua e lentă sau cererea rămâne blocată
  // (Wi-Fi slab, firewall/VPN, blocaj DNS pe domeniul Google), browserul ar
  // putea aștepta minute întregi înainte să renunțe singur. Anulăm noi cererea
  // mai devreme, ca eroarea să apară rapid și clar, nu după un blocaj lung.
  const AI_TIMEOUT_MS = 20000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), AI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanApiKey,
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          // Limitează răspunsurile foarte lungi pentru un timp de răspuns mai bun.
          maxOutputTokens: 1200,
        },
      }),
      signal: timeoutController.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new GeminiApiError('timeout', 'Cererea către Gemini a durat prea mult și a fost anulată.');
    }
    throw new GeminiApiError('network', err?.message || 'Nu s-a putut contacta Gemini.');
  } finally {
    clearTimeout(timeoutId);
  }

  const rawText = await response.text().catch(() => '');
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      throw new GeminiApiError('invalid-response', 'Răspunsul Gemini nu este JSON valid.', response.status);
    }
  }

  if (!response.ok) {
    const googleStatus = data?.error?.status || '';
    const googleMessage = data?.error?.message || rawText || `HTTP ${response.status}`;
    if (response.status === 400 && googleStatus === 'INVALID_ARGUMENT' && /api key/i.test(googleMessage)) {
      throw new GeminiApiError('invalid-api-key', googleMessage, response.status);
    }
    if (response.status === 400 || response.status === 404) {
      throw new GeminiApiError('model-unavailable', googleMessage, response.status);
    }
    if (response.status === 401 || response.status === 403 || googleStatus === 'PERMISSION_DENIED') {
      throw new GeminiApiError('invalid-api-key', googleMessage, response.status);
    }
    if (response.status === 429 || googleStatus === 'RESOURCE_EXHAUSTED') {
      throw new GeminiApiError('rate-limit', googleMessage, response.status);
    }
    if (response.status === 503 || googleStatus === 'UNAVAILABLE') {
      throw new GeminiApiError('overloaded', googleMessage, response.status);
    }
    throw new GeminiApiError('api-error', googleMessage, response.status);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
    throw new GeminiApiError(
      'invalid-response',
      blockReason ? `Blocat de Google: ${blockReason}` : 'Răspuns gol de la Gemini',
      response.status
    );
  }
  return text;
}

// Reîncearcă automat cererea când Google răspunde că e supraîncărcat sau
// că s-a atins limita de rată — aceste erori sunt de obicei temporare
// (câteva secunde), deci merită o reîncercare înainte să deranjăm userul.
const AI_RETRY_DELAYS_MS = [3000, 6000];

async function callGeminiAPIWithRetry(history, apiKey, model, onRetry) {
  let lastErr;
  for (let attempt = 0; attempt <= AI_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callGeminiAPI(history, apiKey, model);
    } catch (err) {
      lastErr = err;
      const retryable = err?.type === 'overloaded' || err?.type === 'rate-limit';
      if (!retryable || attempt >= AI_RETRY_DELAYS_MS.length) throw err;
      if (typeof onRetry === 'function') onRetry(attempt + 1);
      await new Promise(resolve => setTimeout(resolve, AI_RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

function clearAIChat() {
  if (!confirm('Ștergi toată conversația cu Asistentul AI?')) return;
  state.aiChatHistory = [];
  saveState();
  renderAIChatLog();
}
