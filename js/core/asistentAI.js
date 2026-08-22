'use strict';

// ============================================
// ASISTENT AI — modul de interfață (fără logică AI conectată)
// ============================================
// Acest fișier conține doar structura vizuală a modulului "Asistent AI".
// Nu este conectat niciun serviciu extern și nu se face niciun apel de rețea.
// Mesajele scrise de utilizator sunt afișate local, doar pentru a demonstra
// fluxul de conversație — nu se generează niciun răspuns automat real.
// Punctul de extindere pentru viitor este funcția `requestAiAssistantReply()`.

function renderAsistentAI() {
  const input = document.getElementById('aiassistInput');
  if (input && typeof autoGrowTextarea === 'function') {
    autoGrowTextarea(input);
    input.focus();
  }
}

function handleAiAssistantSend(event) {
  event.preventDefault();

  const input = document.getElementById('aiassistInput');
  const chat = document.getElementById('aiassistChat');
  if (!input || !chat) return false;

  const text = input.value.trim();
  if (!text) return false;

  appendAiAssistantMessage(chat, text, 'user');

  input.value = '';
  if (typeof autoGrowTextarea === 'function') autoGrowTextarea(input);

  // Punct de extindere: aici va fi apelat, în viitor, serviciul AI real.
  requestAiAssistantReply(text, chat);

  return false;
}

function appendAiAssistantMessage(chat, text, sender) {
  const safeText = (typeof escapeHtml === 'function') ? escapeHtml(text) : text;

  const wrapper = document.createElement('div');
  wrapper.className = `aiassist-message aiassist-message-${sender}`;

  const avatar = document.createElement('div');
  avatar.className = `aiassist-avatar aiassist-avatar-${sender}`;
  avatar.textContent = sender === 'user' ? '🧑' : '💬';

  const bubble = document.createElement('div');
  bubble.className = `aiassist-bubble aiassist-bubble-${sender}`;
  bubble.innerHTML = `<p>${safeText}</p>`;

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chat.appendChild(wrapper);
  chat.scrollTop = chat.scrollHeight;
}

// Placeholder pentru viitoarea integrare AI.
// Momentan doar informează utilizatorul că funcționalitatea nu este activă încă.
function requestAiAssistantReply(userText, chat) {
  window.setTimeout(() => {
    appendAiAssistantMessage(
      chat,
      'Funcționalitatea de răspuns AI nu este încă activă. Această secțiune este pregătită doar ca interfață, urmând să fie conectată la un serviciu AI într-o versiune viitoare.',
      'bot'
    );
  }, 300);
}
