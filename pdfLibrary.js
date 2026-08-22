'use strict';

// ============================================
// BIBLIOTECA PDF
// PDF-urile importate NU se salvează în `state` (localStorage) — sunt prea
// mari și nu trebuie incluse în exportul/transferul de date. Se salvează
// direct în IndexedDB, separat pe fiecare dispozitiv (laptop, mobil etc.),
// exact cum a cerut utilizatorul: rămân doar local, nu circulă niciunde.
// ============================================

const PDF_LIB_DB_NAME = 'studiuMeuPdfDB';
const PDF_LIB_STORE = 'pdfs';

function pdfLibDbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDF_LIB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PDF_LIB_STORE)) {
        req.result.createObjectStore(PDF_LIB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pdfLibGetAll() {
  return pdfLibDbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_LIB_STORE, 'readonly');
    const req = tx.objectStore(PDF_LIB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

function pdfLibPut(record) {
  return pdfLibDbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_LIB_STORE, 'readwrite');
    tx.objectStore(PDF_LIB_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function pdfLibDelete(id) {
  return pdfLibDbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_LIB_STORE, 'readwrite');
    tx.objectStore(PDF_LIB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function formatPdfFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================
// IMPORT
// ============================================
async function importPdfFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  let imported = 0;
  for (const file of files) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
    const record = {
      id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
      name: file.name,
      size: file.size,
      importedAt: new Date().toISOString(),
      blob: file, // File-ul este el însuși un Blob, se poate salva direct în IndexedDB
    };
    try {
      await pdfLibPut(record);
      imported++;
    } catch (e) {
      console.error('Eroare la salvarea PDF-ului:', e);
    }
  }

  document.getElementById('pdfLibraryFileInput').value = '';

  if (imported > 0) {
    showToast(imported === 1 ? 'PDF importat! 📚' : imported + ' PDF-uri importate! 📚', 'success');
  } else {
    showToast('Niciun fișier PDF valid selectat.', 'error');
  }

  renderPdfLibrary();
}

// ============================================
// RANDARE LISTĂ
// ============================================
async function renderPdfLibrary() {
  const container = document.getElementById('pdfLibraryList');
  if (!container) return;

  let records = [];
  try {
    records = await pdfLibGetAll();
  } catch (e) {
    console.error('Eroare la citirea bibliotecii PDF:', e);
  }

  if (records.length === 0) {
    container.innerHTML = `
      <div class="empty-state full-width">
        <p>Niciun PDF importat încă.</p>
      </div>`;
    return;
  }

  records.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));

  container.innerHTML = records.map(r => `
    <div class="note-card">
      <div class="note-card-header">
        <span class="note-card-title">📄 ${escHtml(r.name)}</span>
        <span class="badge" style="background:#4f8ef722;color:#4f8ef7;flex-shrink:0">
          ${formatPdfFileSize(r.size)}
        </span>
      </div>
      <p class="note-card-body">Importat pe ${formatDate(r.importedAt.split('T')[0])}</p>
      <div class="note-card-footer">
        <span class="note-card-date"></span>
        <div style="display:flex;gap:6px">
          <button class="edit-btn-fs" onclick="openPdfEntry('${r.id}')" title="Deschide">👁️ Deschide</button>
          <button class="delete-btn-fs" onclick="deletePdfEntry('${r.id}')" title="Șterge">🗑 Șterge</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================
// DESCHIDERE / ȘTERGERE
// ============================================
async function openPdfEntry(id) {
  try {
    const records = await pdfLibGetAll();
    const record = records.find(r => r.id === id);
    if (!record) return;
    const url = URL.createObjectURL(record.blob);
    window.open(url, '_blank');
    // Eliberăm URL-ul după un timp, ca să nu rămână în memorie.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    console.error('Eroare la deschiderea PDF-ului:', e);
    showToast('Nu s-a putut deschide PDF-ul.', 'error');
  }
}

async function deletePdfEntry(id) {
  if (!confirm('Ștergi acest PDF de pe dispozitiv?')) return;
  try {
    await pdfLibDelete(id);
    showToast('PDF șters.', 'success');
    renderPdfLibrary();
  } catch (e) {
    console.error('Eroare la ștergerea PDF-ului:', e);
    showToast('Nu s-a putut șterge PDF-ul.', 'error');
  }
}
