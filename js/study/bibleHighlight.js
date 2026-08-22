'use strict';

// ============================================
// BIBLE WORD HIGHLIGHTING (Citește Biblia)
// Evidențiază (tip marcador) cuvinte din textul capitolului
// (nu versete întregi). Complet separat de restul
// modulului bibleReader.js — doar randează textul deja
// existent în stare (state.bibleOfflineText) sub formă
// de cuvinte apăsabile, salvează culorile în
// state.bibleWordColors și ideile/notițele legate de
// cuvintele evidențiate în state.bibleWordIdeas,
// folosind saveState() existent.
// ============================================

const BW_COLORS = ['#fff59d', '#a5d6a7', '#90caf9', '#f48fb1', '#ffcc80', '#ce93d8'];

let bwSelected = new Set();       // indecșii cuvintelor selectate curent
let bwToolbarEl = null;           // bara mică de culori + coș + idee (creată o singură dată)
let bwIdeaPanelEl = null;         // panoul cu ideea legată de cuvintele evidențiate (creat o singură dată)
let bwIdeaSaveTimer = null;       // debounce pentru auto-salvarea ideii
let bwIdeaActiveIdxKey = null;    // cheia (indecși uniți prin "_") pentru ideea deschisă curent
let bwEditFieldOpen = false;      // true = e deschis câmpul text (textarea) pentru scris/lipit textul capitolului

function bwGetKey() {
  if (!brState.bookSlug || !brState.chapter) return null;
  return `${brState.bookSlug}-${brState.chapter}`;
}

/** Împarte textul capitolului în „tokens": numere de verset (necolorabile) și cuvinte (colorabile). */
function bwTokenize(text) {
  const lines = text.split('\n');
  const tokens = [];
  lines.forEach((line, li) => {
    if (li > 0) tokens.push({ type: 'br' });
    const parts = line.split(/\s+/).filter(Boolean);
    parts.forEach(part => {
      if (/^\d{1,3}$/.test(part)) {
        tokens.push({ type: 'num', text: part });
      } else {
        tokens.push({ type: 'word', text: part });
      }
    });
  });
  return tokens;
}

/** Apelată la deschiderea unui capitol: afișează mereu textul ca listă de cuvinte apăsabile
 *  (un singur loc unde se vede textul, fără un „mod" separat de citit vs. colorat).
 *  Câmpul text (textarea) rămâne ascuns, disponibil doar prin apăsarea butonului „✏️". */
function bwOnChapterOpen() {
  bwCloseToolbar();
  bwEditFieldOpen = false;

  const textarea = document.getElementById('chapterVerseText');
  const colorView = document.getElementById('bibleVerseColorView');
  const btn = document.getElementById('bibleEditTextBtn');

  if (textarea) textarea.style.display = 'none';
  if (colorView) colorView.style.display = 'block';
  if (btn) { btn.textContent = '✏️'; btn.title = 'Scrie sau lipește textul capitolului'; }

  bwRenderChapterColorView();
}

/** Deschide/închide câmpul text (textarea) folosit pentru a scrie sau lipi textul capitolului.
 *  La deschidere: se ascunde lista de cuvinte evidențiabile și apare caseta de scris.
 *  La închidere: se salvează textul și revine lista de cuvinte, actualizată. */
function bwToggleEditField() {
  const key = bwGetKey();
  if (!key) return;
  const textarea = document.getElementById('chapterVerseText');
  const colorView = document.getElementById('bibleVerseColorView');
  const btn = document.getElementById('bibleEditTextBtn');
  if (!textarea || !colorView || !btn) return;

  bwEditFieldOpen = !bwEditFieldOpen;

  if (bwEditFieldOpen) {
    bwCloseToolbar();
    bwCloseIdeaField();
    textarea.style.display = '';
    colorView.style.display = 'none';
    btn.textContent = '✓';
    btn.title = 'Salvează și revino la evidențiere';
    textarea.focus();
  } else {
    if (typeof saveChapterVerseText === 'function') saveChapterVerseText();
    textarea.style.display = 'none';
    colorView.style.display = 'block';
    btn.textContent = '✏️';
    btn.title = 'Scrie sau lipește textul capitolului';
    bwRenderChapterColorView();
  }
}

/** Randează textul capitolului curent ca listă de cuvinte apăsabile.
 *  Evidențierea e de tip „marcador": cuvintele alăturate cu aceeași culoare se ating,
 *  fără spațiu alb între ele, ca o singură linie continuă de marcator (nu cuburi separate). */
function bwRenderChapterColorView() {
  const container = document.getElementById('bibleVerseColorView');
  if (!container) return;

  bwSelected.clear();
  bwToolbarEl = null;
  bwIdeaPanelEl = null;
  bwIdeaActiveIdxKey = null;

  const key = bwGetKey();
  const text = key && state.bibleOfflineText ? (state.bibleOfflineText[key] || '') : '';

  if (!text.trim()) {
    container.innerHTML = '<p class="bw-empty-hint">Apasă „✏️” ca să scrii sau să lipești textul capitolului.</p>';
    return;
  }

  const colors = (key && state.bibleWordColors && state.bibleWordColors[key]) || {};
  const ideas = (key && state.bibleWordIdeas && state.bibleWordIdeas[key]) || {};
  // Set cu indecșii care sunt ultimul cuvânt al unei idei salvate (pentru indicatorul 💬)
  const ideaEndIdx = new Set();
  Object.keys(ideas).forEach(idxKeyStr => {
    if (ideas[idxKeyStr] && ideas[idxKeyStr].text && ideas[idxKeyStr].text.trim()) {
      const parts = idxKeyStr.split('_');
      ideaEndIdx.add(parts[parts.length - 1]);
    }
  });

  const tokens = bwTokenize(text);

  let wIdx = 0;
  const html = tokens.map(t => {
    if (t.type === 'br') return '<br>';
    if (t.type === 'num') return `<span class="bw-vnum">${escHtml(t.text)}</span> `;
    const idx = wIdx++;
    const color = colors[idx];
    const style = color ? ` style="background:${color}"` : '';
    const ideaCls = ideaEndIdx.has(String(idx)) ? ' bw-has-idea' : '';
    // Spațiul e inclus ÎN span (nu după) ca să nu rămână „gol" alb între cuvinte alăturate
    // colorate cu aceeași culoare — astfel evidențierea arată continuă, ca un marcador.
    return `<span class="bw-word${ideaCls}" data-idx="${idx}"${style}>${escHtml(t.text)} </span>`;
  }).join('');

  container.innerHTML = html;
}

/** Apelată la click pe un cuvânt: adaugă/scoate din selecție și arată bara de instrumente. */
function bwWordClick(evt) {
  const el = evt.currentTarget;
  const idx = el.getAttribute('data-idx');
  if (bwSelected.has(idx)) {
    bwSelected.delete(idx);
    el.classList.remove('bw-selected');
  } else {
    bwSelected.add(idx);
    el.classList.add('bw-selected');
  }

  if (bwSelected.size === 0) {
    bwCloseToolbar();
  } else {
    bwOpenToolbar(el);
  }
}

/** Creează (o singură dată) și poziționează bara mică: culori + 🗑️ + „+” (idee). */
function bwOpenToolbar(anchorEl) {
  const container = document.getElementById('bibleVerseColorView');
  if (!container) return;
  container.style.position = 'relative';

  bwCloseIdeaField();

  if (!bwToolbarEl) {
    bwToolbarEl = document.createElement('div');
    bwToolbarEl.className = 'bw-toolbar';
    bwToolbarEl.innerHTML =
      BW_COLORS.map(c => `<button type="button" class="bw-swatch" style="background:${c}" onclick="bwApplyColor('${c}')" title="Evidențiază"></button>`).join('') +
      `<button type="button" class="bw-swatch bw-trash-btn" onclick="bwClearColor()" title="Șterge culoarea">🗑️</button>` +
      `<button type="button" class="bw-swatch bw-idea-btn" onclick="bwOpenIdeaField()" title="Adaugă o idee legată de cuvintele evidențiate">+</button>`;
    container.appendChild(bwToolbarEl);
  }
  bwToolbarEl.style.display = 'flex';

  // Poziționare deasupra cuvântului apăsat (sau dedesubt, dacă nu e loc sus)
  const cRect = container.getBoundingClientRect();
  const aRect = anchorEl.getBoundingClientRect();
  const top = (aRect.top - cRect.top) - 44;
  const left = Math.max(0, Math.min(
    (aRect.left - cRect.left),
    container.clientWidth - 250
  ));
  bwToolbarEl.style.top = (top < 0 ? (aRect.bottom - cRect.top + 6) : top) + 'px';
  bwToolbarEl.style.left = left + 'px';
}

function bwCloseToolbar() {
  bwSelected.forEach(idx => {
    const el = document.querySelector(`#bibleVerseColorView .bw-word[data-idx="${idx}"]`);
    if (el) el.classList.remove('bw-selected');
  });
  bwSelected.clear();
  if (bwToolbarEl) bwToolbarEl.style.display = 'none';
}

/** Aplică o culoare tuturor cuvintelor selectate în acest moment și salvează. */
function bwApplyColor(color) {
  const key = bwGetKey();
  if (!key || bwSelected.size === 0) return;
  if (!state.bibleWordColors) state.bibleWordColors = {};
  if (!state.bibleWordColors[key]) state.bibleWordColors[key] = {};

  bwSelected.forEach(idx => {
    state.bibleWordColors[key][idx] = color;
    const el = document.querySelector(`#bibleVerseColorView .bw-word[data-idx="${idx}"]`);
    if (el) el.style.background = color;
  });
  saveState();
  bwCloseToolbar();
}

/** Șterge (elimină) culoarea de pe cuvintele selectate curent și salvează. */
function bwClearColor() {
  const key = bwGetKey();
  if (!key || bwSelected.size === 0) return;
  if (state.bibleWordColors && state.bibleWordColors[key]) {
    bwSelected.forEach(idx => {
      delete state.bibleWordColors[key][idx];
      const el = document.querySelector(`#bibleVerseColorView .bw-word[data-idx="${idx}"]`);
      if (el) el.style.background = '';
    });
    saveState();
  }
  bwCloseToolbar();
}

// ============================================
// IDEI legate de cuvintele evidențiate
// Salvate în: state.bibleWordIdeas[bookSlug-capitol][idxUnitPrin_] = { color, text }
// ============================================

/** Deschide panoul cu ideea legată de cuvintele selectate curent (culoarea panoului = culoarea evidențierii). */
function bwOpenIdeaField() {
  const key = bwGetKey();
  if (!key || bwSelected.size === 0) return;

  const idxArr = Array.from(bwSelected).map(Number).sort((a, b) => a - b);
  const idxKeyStr = idxArr.join('_');

  const colorsMap = (state.bibleWordColors && state.bibleWordColors[key]) || {};
  let color = null;
  for (const idx of idxArr) {
    if (colorsMap[idx]) { color = colorsMap[idx]; break; }
  }
  if (!color) color = BW_COLORS[0];

  bwIdeaActiveIdxKey = idxKeyStr;

  const container = document.getElementById('bibleVerseColorView');
  if (!container) return;
  container.style.position = 'relative';

  if (!bwIdeaPanelEl) {
    bwIdeaPanelEl = document.createElement('div');
    bwIdeaPanelEl.className = 'bw-idea-panel';
    bwIdeaPanelEl.innerHTML =
      `<textarea class="bw-idea-textarea" placeholder="Scrie o idee legată de cuvintele evidențiate..."></textarea>
       <div class="bw-idea-panel-actions">
         <button type="button" class="btn-ghost btn-sm" onclick="bwDeleteIdea()">🗑️ Șterge ideea</button>
         <button type="button" class="btn-primary btn-sm" onclick="bwFinishIdea()">✓ Gata</button>
       </div>`;
    container.appendChild(bwIdeaPanelEl);
    bwIdeaPanelEl.querySelector('.bw-idea-textarea').addEventListener('input', bwAutoSaveIdea);
  }

  if (bwToolbarEl) bwToolbarEl.style.display = 'none';
  bwIdeaPanelEl.style.display = 'flex';
  bwIdeaPanelEl.style.borderColor = color;
  bwIdeaPanelEl.style.background = color + '2b';

  const existing = (state.bibleWordIdeas && state.bibleWordIdeas[key] && state.bibleWordIdeas[key][idxKeyStr]) || null;
  const ta = bwIdeaPanelEl.querySelector('.bw-idea-textarea');
  ta.value = existing ? existing.text : '';

  // Poziționare sub primul cuvânt din selecția curentă
  const anchorIdx = idxArr[0];
  const anchorEl = document.querySelector(`#bibleVerseColorView .bw-word[data-idx="${anchorIdx}"]`) || container;
  const cRect = container.getBoundingClientRect();
  const aRect = anchorEl.getBoundingClientRect();
  const panelWidth = 260;
  const top = (aRect.bottom - cRect.top) + 6;
  const left = Math.max(0, Math.min((aRect.left - cRect.left), container.clientWidth - panelWidth));
  bwIdeaPanelEl.style.top = top + 'px';
  bwIdeaPanelEl.style.left = left + 'px';

  ta.focus();
}

function bwAutoSaveIdea() {
  clearTimeout(bwIdeaSaveTimer);
  bwIdeaSaveTimer = setTimeout(bwSaveIdea, 500);
}

/** Salvează ideea curentă (sau o șterge, dacă textul e gol) și actualizează indicatorul 💬. */
function bwSaveIdea() {
  const key = bwGetKey();
  if (!key || !bwIdeaActiveIdxKey || !bwIdeaPanelEl) return;

  const idxArr = bwIdeaActiveIdxKey.split('_');
  const ta = bwIdeaPanelEl.querySelector('.bw-idea-textarea');
  const text = ta ? ta.value : '';

  const colorsMap = (state.bibleWordColors && state.bibleWordColors[key]) || {};
  let color = null;
  for (const idx of idxArr) {
    if (colorsMap[idx]) { color = colorsMap[idx]; break; }
  }
  if (!color) color = BW_COLORS[0];

  const lastIdx = idxArr[idxArr.length - 1];
  const markerEl = document.querySelector(`#bibleVerseColorView .bw-word[data-idx="${lastIdx}"]`);

  if (!text.trim()) {
    if (state.bibleWordIdeas && state.bibleWordIdeas[key]) {
      delete state.bibleWordIdeas[key][bwIdeaActiveIdxKey];
    }
    if (markerEl) markerEl.classList.remove('bw-has-idea');
  } else {
    if (!state.bibleWordIdeas) state.bibleWordIdeas = {};
    if (!state.bibleWordIdeas[key]) state.bibleWordIdeas[key] = {};
    state.bibleWordIdeas[key][bwIdeaActiveIdxKey] = { color, text };
    if (markerEl) markerEl.classList.add('bw-has-idea');
  }
  saveState();
}

/** Șterge ideea curentă, apoi închide totul (panou + selecție). */
function bwDeleteIdea() {
  if (bwIdeaPanelEl) {
    const ta = bwIdeaPanelEl.querySelector('.bw-idea-textarea');
    if (ta) ta.value = '';
  }
  clearTimeout(bwIdeaSaveTimer);
  bwSaveIdea();
  bwCloseIdeaField();
  bwCloseToolbar();
}

/** Salvează și închide panoul cu ideea (fără să atingă selecția curentă de cuvinte). */
function bwCloseIdeaField() {
  clearTimeout(bwIdeaSaveTimer);
  if (bwIdeaActiveIdxKey) bwSaveIdea();
  if (bwIdeaPanelEl) bwIdeaPanelEl.style.display = 'none';
  bwIdeaActiveIdxKey = null;
}

/** Apelată din butonul „✓ Gata”: salvează ideea și închide totul (panou + selecție). */
function bwFinishIdea() {
  bwCloseIdeaField();
  bwCloseToolbar();
}

// Delegare click (funcționează și pe telefon, și pe calculator)
document.addEventListener('click', (evt) => {
  const wordEl = evt.target.closest('#bibleVerseColorView .bw-word');
  if (wordEl) {
    bwWordClick({ currentTarget: wordEl });
    return;
  }
  // Click în afara unui cuvânt, a barei sau a panoului de idei -> închide tot, păstrează salvările
  if (evt.target.closest('.bw-toolbar') || evt.target.closest('.bw-idea-panel')) return;
  if (bwToolbarEl && bwToolbarEl.style.display !== 'none') bwCloseToolbar();
  if (bwIdeaPanelEl && bwIdeaPanelEl.style.display !== 'none') bwCloseIdeaField();
});
