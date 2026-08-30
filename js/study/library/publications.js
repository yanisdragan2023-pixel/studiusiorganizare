'use strict';

/* ============================================
   PUBLICAȚII
   ============================================ */
function openPubModal() {
  document.getElementById('pub-modal')?.classList.remove('hidden');
  document.getElementById('pub-title-input')?.focus();
}
function closePubModal() {
  document.getElementById('pub-modal')?.classList.add('hidden');
  document.getElementById('pub-title-input').value = '';
  document.getElementById('pub-url-input').value = '';
}
function savePub() {
  const titleIn = document.getElementById('pub-title-input');
  const urlIn = document.getElementById('pub-url-input');
  const title = titleIn.value.trim();
  if (!title) { showToast('Introdu un titlu!', 'error'); return; }
  state.publications.push({ title, url: urlIn.value.trim() });
  saveState();
  titleIn.value = ''; urlIn.value = '';
  closePubModal();
  renderPubs();
  showToast('Publicație adăugată! 📚', 'success');
}
function deletePub(index) {
  if (!confirm('Ștergi această publicație?')) return;
  state.publications.splice(index, 1);
  saveState();
  renderPubs();
  showToast('Publicație ștearsă.', 'success');
}

function renderPubs() {
  const pubList = document.getElementById('pub-list');
  if (!pubList) return;
  pubList.querySelectorAll('.pub-card, .pub-card-wrap').forEach(el => el.remove());
  const empty = pubList.querySelector('.pub-empty');
  if (state.publications.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  state.publications.forEach((pub, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'pub-card-wrap';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';

    const a = document.createElement('a');
    a.className = 'pub-card';
    a.style.flex = '1';
    a.href = pub.url || '#';
    if (pub.url) a.target = '_blank';
    a.innerHTML = `
      <div class="pub-card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      </div>
      <div>
        <div class="pub-card-title">${escHtml(pub.title)}</div>
        ${pub.url ? `<div class="pub-card-url">${escHtml(pub.url)}</div>` : ''}
      </div>
    `;

    const delBtn = document.createElement('button');
    delBtn.className = 'vslot-delete';
    delBtn.style.display = 'flex';
    delBtn.title = 'Șterge publicația';
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    delBtn.addEventListener('click', () => deletePub(i));

    wrap.appendChild(a);
    wrap.appendChild(delBtn);
    pubList.appendChild(wrap);
  });
}

