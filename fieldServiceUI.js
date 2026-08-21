'use strict';

// ============================================
// FIELD SERVICE — UI
// Generarea de HTML pentru lista de notițe salvate a modulului de
// Serviciu de Teren. (Programul Marți/Vineri/Sâmbătă, tabelele
// suplimentare, colaboratorii și sugestia automată au fost mutate
// într-o altă aplicație și nu mai fac parte de aici.)
// ============================================

function renderFieldServiceList() {
  const container = document.getElementById('fsNotesList');
  if (!container) return;

  const filtered = state.notes.filter(n => n.category === 'fieldservice');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state full-width">
        <p>Nicio notiță de serviciu de teren salvată încă.</p>
      </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sorted.map(note => `
    <div class="note-card" onclick="openNoteCard('${note.id}')">
      <div class="note-card-header">
        <span class="note-card-title">${escHtml(note.title)}</span>
        <span class="badge" style="background:#ec489922;color:#ec4899;flex-shrink:0">
          🧑‍🤝‍🧑 Serviciu
        </span>
      </div>
      <p class="note-card-body">${escHtml(note.content || 'Fără conținut')}</p>
      <div class="note-card-footer">
        <span class="note-card-date">${formatDate(note.date)}</span>
        <div style="display:flex;gap:6px">
          <button class="edit-btn-fs" onclick="event.stopPropagation(); openNoteCard('${note.id}')" title="Editează">✏️ Editează</button>
          <button class="delete-btn-fs" onclick="event.stopPropagation(); deleteFieldServiceNote('${note.id}')" title="Șterge">🗑 Șterge</button>
        </div>
      </div>
    </div>
  `).join('');
}
