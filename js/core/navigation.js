'use strict';

// ============================================
// NAVIGATION
// ============================================
const pageTitles = {
  dashboard: 'PAGINA PRINCIPALĂ',
  asistentai: '💬 Asistent AI',
  temacursant: 'Temă pentru cursant',
  watchtower: 'Turnul de Veghe – Studiu',
  discurs: 'Discurs Biblic – 30 minute',
  workbook: 'Viața creștină și predicarea',
  talk5cuv: 'Cuvântare – 5 minute',
  talk10cuv: 'Discurs principal – 10 minute',
  bible: 'Studiu Biblic Personal',
  library: 'Bibliotecă',
  pdflibrary: 'Biblioteca PDF',
  biblereader: 'Citește Biblia',
  fieldservice: 'Întrunirea de Serviciu de Teren',
  fieldschedulingpreview: 'Programare de ieșire pe teren',
  standscheduling: 'Programare de ieșire cu standul',
  preachingassistant: 'Ministry Assistant (Raport)',
  vestitor: 'Vestitor',
  notes: 'Notițele Mele',
  meetings: 'Programul Meu',
};

let currentPage = 'dashboard';

function navigateTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');
  if (page === 'watchtower' || page === 'discurs') {
    document.getElementById('navGroup-watchtower')?.classList.add('open');
    document.getElementById('navGroup-intruniri')?.classList.add('open');
  }
  if (page === 'workbook' || page === 'talk5cuv' || page === 'talk10cuv') {
    document.getElementById('navGroup-workbook')?.classList.add('open');
    document.getElementById('navGroup-intruniri')?.classList.add('open');
  }
  if (page === 'fieldservice' || page === 'preachingassistant' || page === 'fieldschedulingpreview' || page === 'standscheduling' || page === 'vestitor') {
    document.getElementById('navGroup-fieldservice')?.classList.add('open');
  }

  document.getElementById('pageTitle').textContent = pageTitles[page] || page;
  currentPage = page;

  // Meniul ☰ de lângă titlul paginii apare doar pe pagina "Asistent de predicare (raport)"
  const titleMenuBtn = document.getElementById('pageTitleMenuBtn');
  if (titleMenuBtn) titleMenuBtn.style.display = (page === 'preachingassistant') ? 'flex' : 'none';
  closePreachTitleMenu();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');

  // Re-render page
  renderPage(page);
  return false;
}

function renderPage(page) {
  switch(page) {
    case 'dashboard': renderDashboard(); break;
    case 'asistentai': renderAsistentAI(); break;
    case 'temacursant': renderTemaCursantPage(); break;
    case 'notes': renderNotesList(); break;
    case 'bible': renderVersesList('all'); renderProphecies(); break;
    case 'library': renderLibraryPage(); break;
    case 'pdflibrary': renderPdfLibrary(); break;
    case 'meetings': renderMeetings(); break;
    case 'watchtower': renderWtParagraphs(); break;
    case 'discurs': renderDiscursPage(); break;
    case 'workbook': break;
    case 'talk5cuv': renderTalk5Page(); break;
    case 'talk10cuv': renderTalk10Page(); break;
    case 'biblereader': initBibleReader(); break;
    case 'fieldservice': renderFieldServiceList(); break;
    case 'fieldschedulingpreview': renderFieldSchedulingTable(); break;
    case 'standscheduling': renderStandSchedulingTable(); break;
    case 'vestitor': renderVestitorPage(); break;
  }
  updateWordCounters();
}

function toggleNavGroup(id) {
  document.getElementById(`navGroup-${id}`)?.classList.toggle('open');
}

// ============================================
// MENIU ☰ lângă titlul "Asistent de predicare (raport)"
// ============================================
function togglePreachTitleMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = document.getElementById('pageTitleMenuDropdown');
  const btn = document.getElementById('pageTitleMenuBtn');
  if (!dropdown || !btn) return;
  const isOpen = dropdown.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function closePreachTitleMenu() {
  document.getElementById('pageTitleMenuDropdown')?.classList.remove('open');
  document.getElementById('pageTitleMenuBtn')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const titleWrap = document.querySelector('.topbar-title-wrap');
  if (titleWrap && !titleWrap.contains(e.target)) closePreachTitleMenu();
});

// ============================================
// SUBMENIU "Întrunirea de ieșire pe teren" (Panou Principal)
// ============================================
function toggleQuickLinkGroup(id, headerEl) {
  const submenu = document.getElementById(id);
  if (!submenu) return;
  const isOpen = submenu.style.display === 'flex';
  submenu.style.display = isOpen ? 'none' : 'flex';
  if (headerEl) headerEl.classList.toggle('expanded', !isOpen);
}

// ============================================
// ECRAN COMPLET NOTIȚE (fundal alb, pe tot ecranul)
// ============================================
let fullscreenNoteState = null; // { textarea, placeholder }

function openFullscreenNote(textareaId, title) {
  const textarea = document.getElementById(textareaId);
  const overlay = document.getElementById('noteFullscreenOverlay');
  const slot = document.getElementById('noteFullscreenSlot');
  if (!textarea || !overlay || !slot) return;

  // marcator ca să știm unde să punem textarea înapoi
  const placeholder = document.createComment(`fullscreen-placeholder-${textareaId}`);
  textarea.parentNode.insertBefore(placeholder, textarea);
  fullscreenNoteState = { textarea, placeholder };

  document.getElementById('noteFullscreenTitle').textContent = title || 'Notițe';
  slot.appendChild(textarea);
  overlay.classList.add('active');
  textarea.focus();
}

function closeFullscreenNote() {
  const overlay = document.getElementById('noteFullscreenOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');

  if (fullscreenNoteState) {
    const { textarea, placeholder } = fullscreenNoteState;
    placeholder.parentNode.replaceChild(textarea, placeholder);
    fullscreenNoteState = null;
    if (typeof autoGrowTextarea === 'function') autoGrowTextarea(textarea);
  }
}

// ============================================
// ============================================
// QUICK ADD BUTTON
// ============================================
function handleQuickAdd() {
  switch(currentPage) {
    case 'watchtower': addWtParagraph(); break;
    case 'notes': openNewNoteModal(); break;
    case 'fieldservice': document.getElementById('fs-title')?.focus(); break;
    case 'bible': document.getElementById('verse-ref-input')?.focus(); break;
    case 'meetings': addMeetingEntry(); break;
    default: openNewNoteModal();
  }
}

// ============================================
