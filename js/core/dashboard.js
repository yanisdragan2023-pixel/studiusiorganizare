'use strict';

// ============================================
// GREETING & DATE
// ============================================
function updateGreeting() {
  const now = new Date();
  const hours = now.getHours();
  let greeting;
  if (hours < 12) greeting = 'Bună dimineața! 🌅';
  else if (hours < 18) greeting = 'Bună ziua! 🌿';
  else greeting = 'Bună seara! 🌙';

  document.getElementById('greetingText').textContent = greeting;

  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('greetingDate').textContent =
    now.toLocaleDateString('ro-RO', opts);

  // Set default date fields
  const today = now.toISOString().split('T')[0];
  const dateInputs = ['wt-date', 'wb-date', 'fs-date'];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
}

// ============================================
// WEATHER (Reșița)
// ============================================
const WEATHER_LAT = 45.2971;
const WEATHER_LON = 21.8892;

// Cod meteo WMO -> emoji + descriere (ro)
const WEATHER_CODE_MAP = {
  0: ['☀️', 'Senin'],
  1: ['🌤️', 'Predominant senin'],
  2: ['⛅', 'Parțial noros'],
  3: ['☁️', 'Înnorat'],
  45: ['🌫️', 'Ceață'],
  48: ['🌫️', 'Ceață cu chiciură'],
  51: ['🌦️', 'Burniță slabă'],
  53: ['🌦️', 'Burniță'],
  55: ['🌦️', 'Burniță intensă'],
  61: ['🌧️', 'Ploaie slabă'],
  63: ['🌧️', 'Ploaie'],
  65: ['🌧️', 'Ploaie puternică'],
  71: ['🌨️', 'Ninsoare slabă'],
  73: ['🌨️', 'Ninsoare'],
  75: ['🌨️', 'Ninsoare puternică'],
  80: ['🌦️', 'Averse slabe'],
  81: ['🌧️', 'Averse'],
  82: ['⛈️', 'Averse puternice'],
  95: ['⛈️', 'Furtună'],
  96: ['⛈️', 'Furtună cu grindină'],
  99: ['⛈️', 'Furtună puternică']
};

/**
 * Cere vremea curentă de la Open-Meteo. Încearcă întâi modelul ICON (DWD),
 * folosit și de WetterOnline / meteoradar.ro, ca temperatura afișată să fie
 * cât mai apropiată de ce arată acel site. Dacă modelul ICON nu răspunde
 * pentru zona respectivă, se comută automat pe modelul implicit ("best_match").
 */
async function fetchWeatherData() {
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,precipitation,weather_code&timezone=Europe%2FBucharest`;
  try {
    const res = await fetch(`${base}&models=icon_seamless`);
    if (!res.ok) throw new Error('ICON model unavailable');
    const data = await res.json();
    if (!data.current) throw new Error('ICON model unavailable');
    return data;
  } catch (err) {
    console.warn('Modelul ICON indisponibil, revin la modelul implicit:', err);
    const res = await fetch(base);
    if (!res.ok) throw new Error('Weather request failed');
    return res.json();
  }
}

async function fetchWeather() {
  const widget = document.getElementById('weatherWidget');
  if (!widget) return;
  try {
    const data = await fetchWeatherData();
    const current = data.current;
    if (!current) throw new Error('No current weather data');

    const code = current.weather_code;
    const [icon, desc] = WEATHER_CODE_MAP[code] || ['🌡️', 'Vreme'];
    const temp = Math.round(current.temperature_2m);
    const precip = current.precipitation ?? 0;

    document.getElementById('weatherIcon').textContent = icon;
    document.getElementById('weatherTemp').textContent = `${temp}°C`;
    document.getElementById('weatherDetail').textContent =
      precip > 0
        ? `Reșița · ${desc} · ${precip} mm precipitații`
        : `Reșița · ${desc}`;

    widget.style.display = 'flex';
  } catch (err) {
    console.warn('Nu s-a putut încărca vremea:', err);
    widget.style.display = 'none';
  }
}

// ============================================
// DASHBOARD RENDER
// ============================================
function renderDashboard() {
  // Stats
  document.getElementById('stat-articles').textContent = state.wtStudies.length;
  document.getElementById('stat-notes').textContent = state.notes.length;
  document.getElementById('stat-meetings').textContent = state.meetings.length;
  document.getElementById('stat-verses').textContent = state.verses.length;

  // Streak
  updateStreak();
  document.getElementById('streakCount').textContent = `${state.streak} zile studiu`;

  // Next meeting
  updateNextMeeting();

  // Recent notes
  renderRecentNotes();
}

function updateStreak() {
  const today = new Date().toDateString();
  if (state.lastStudyDate === today) return;
  // Just show the current streak from state
  const el = document.getElementById('streakCount');
  if (el) el.textContent = `${state.streak} zile studiu`;
}

function updateNextMeeting() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  // Duminică (0)
  let daysUntilSun = (0 - day + 7) % 7;
  let nextSun = new Date(today);
  nextSun.setDate(today.getDate() + daysUntilSun);

  // Joi (4)
  let daysUntilThu = (4 - day + 7) % 7;
  let nextThu = new Date(today);
  nextThu.setDate(today.getDate() + daysUntilThu);

  let nextMeeting, nextName;
  if (nextThu < nextSun) {
    nextMeeting = nextThu;
    nextName = 'Viața și Activitatea Creștină';
  } else {
    nextMeeting = nextSun;
    nextName = 'Studierea Turnului de Veghe';
  }

  const nameEl = document.getElementById('nextMeetingName');
  const dateEl = document.getElementById('nextMeetingDate');
  if (nameEl) nameEl.textContent = nextName;
  if (dateEl) {
    const opts = { weekday: 'long', day: 'numeric', month: 'long' };
    const diff = Math.round((nextMeeting - today) / (1000 * 60 * 60 * 24));
    let dateStr = nextMeeting.toLocaleDateString('ro-RO', opts);
    if (diff === 0) {
      dateStr += ' (astăzi)';
    } else if (diff === 1) {
      dateStr += ' (mâine)';
    } else {
      dateStr += ` (în ${diff} zile)`;
    }
    dateEl.textContent = dateStr;
  }

  // Progress
  const lastStudy = nextName.includes('Turnul') ? state.wtStudies[state.wtStudies.length - 1] : state.workbooks[state.workbooks.length - 1];
  const prog = lastStudy ? (lastStudy.progress || 0) : 0;
  const progressEl = document.getElementById('nextMeetingProgress');
  const barEl = document.getElementById('nextMeetingProgressBar');
  if (progressEl) progressEl.textContent = `${prog}%`;
  if (barEl) barEl.style.width = `${prog}%`;
}

function renderRecentNotes() {
  const container = document.getElementById('recentNotesList');
  if (!container) return;

  const recent = [...state.notes].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state-small">Nicio notiță încă. Începe studiul!</div>';
    return;
  }

  const colors = { watchtower: '#4f8ef7', workbook: '#10c9a0', bible: '#a855f7', general: '#f97b4f', fieldservice: '#ec4899' };

  container.innerHTML = recent.map(note => `
    <div class="recent-item" onclick="openNoteCard('${note.id}')">
      <div class="recent-item-dot" style="background:${colors[note.category] || '#4f8ef7'}"></div>
      <span class="recent-item-title">${escHtml(note.title)}</span>
      <span class="recent-item-date">${formatDate(note.date)}</span>
    </div>
  `).join('');
}

// ============================================
// ============================================
// VERSE OF THE DAY
// ============================================
// Textele versetelor (citate biblice) NU stau în acest fișier public —
// se încarcă din js/study/verse-of-day.local.js (fișier local, exclus din git,
// vezi .gitignore și verse-of-day.example.js).
const DAILY_VERSES = (window.DAILY_VERSES_SEED || []).filter(v => v && v.text && v.ref);

let currentVerseIdx = DAILY_VERSES.length ? Math.floor(Math.random() * DAILY_VERSES.length) : -1;

function setVerse(v) {
  const textEl = document.getElementById('verseText');
  const refEl = document.getElementById('verseRef');
  if (!v) {
    if (textEl) textEl.textContent = 'Adaugă fișierul local js/study/verse-of-day.local.js pentru a vedea versetul zilei (vezi verse-of-day.example.js).';
    if (refEl) refEl.textContent = '';
    applyVerseColor();
    return;
  }
  if (textEl) textEl.textContent = v.text;
  if (refEl) refEl.textContent = `— ${v.ref}`;
  applyVerseColor();
}

// ============================================
// CULOARE VERSETUL ZILEI
// ============================================
let verseTextColor = localStorage.getItem('studiuMeu_verseColor') || '#e6edf3';

function applyVerseColor() {
  const textEl = document.getElementById('verseText');
  if (textEl) textEl.style.color = verseTextColor;
  document.querySelectorAll('#verseColorDropdown .color-swatch').forEach(b => {
    b.classList.toggle('active', b.dataset.color === verseTextColor);
  });
}

function toggleVerseColorMenu() {
  document.getElementById('verseColorDropdown')?.classList.toggle('open');
}

function selectVerseColor(btn) {
  verseTextColor = btn.dataset.color;
  localStorage.setItem('studiuMeu_verseColor', verseTextColor);
  applyVerseColor();
}

// Închide meniul de culoare al Versetului Zilei la click în afara lui
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('verseColorDropdown');
  const btn = document.getElementById('verseColorMenuBtn');
  if (dropdown && dropdown.classList.contains('open') && !dropdown.contains(e.target) && e.target !== btn) {
    dropdown.classList.remove('open');
  }
});

function newVerse() {
  if (!DAILY_VERSES.length) { setVerse(null); return; }
  currentVerseIdx = (currentVerseIdx + 1) % DAILY_VERSES.length;
  setVerse(DAILY_VERSES[currentVerseIdx]);
}

function readVerseInBible() {
  const v = DAILY_VERSES[currentVerseIdx];
  if (!v || !v.ref) {
    navigateTo('biblereader');
    return;
  }

  const parts = v.ref.trim().split(' ');
  let bookName = '';
  let chapVerse = '';

  if (parts.length === 3) {
    bookName = parts[0] + ' ' + parts[1];
    chapVerse = parts[2];
  } else if (parts.length === 2) {
    bookName = parts[0];
    chapVerse = parts[1];
  } else {
    navigateTo('biblereader');
    return;
  }

  const chapParts = chapVerse.split(':');
  const chapNum = parseInt(chapParts[0]) || 1;

  const allBooks = [...BIBLE_BOOKS.ot, ...BIBLE_BOOKS.nt];
  let normalizedSearch = bookName.toLowerCase()
    .replace(/ă/g, 'a')
    .replace(/î/g, 'i')
    .replace(/ș/g, 's')
    .replace(/ț/g, 't')
    .trim();

  if (normalizedSearch === 'revelatia') {
    normalizedSearch = 'apocalipsa';
  }

  const foundBook = allBooks.find(b => {
    const normName = b.name.toLowerCase()
      .replace(/ă/g, 'a')
      .replace(/î/g, 'i')
      .replace(/ș/g, 's')
      .replace(/ț/g, 't')
      .trim();
    return normName === normalizedSearch;
  });

  if (foundBook) {
    const isOt = BIBLE_BOOKS.ot.some(b => b.slug === foundBook.slug);
    const testament = isOt ? 'ot' : 'nt';

    navigateTo('biblereader');
    selectBook(foundBook.slug, 1, foundBook.chapters, testament);
    openChapter(chapNum);
  } else {
    navigateTo('biblereader');
  }
}

// ============================================
// ============================================
// STREAK
// ============================================
function markStudyDay() {
  const today = new Date().toDateString();
  if (state.lastStudyDate !== today) {
    state.streak = (state.lastStudyDate === new Date(Date.now() - 86400000).toDateString())
      ? state.streak + 1 : 1;
    state.lastStudyDate = today;
  }
}

// ============================================
