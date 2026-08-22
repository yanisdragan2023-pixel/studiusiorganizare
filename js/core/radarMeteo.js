'use strict';

/* ============================================
   RADAR METEO (Reșița)
   Hartă cu radar de precipitații live, ca să se vadă
   exact în ce zonă a orașului plouă chiar acum.

   Surse externe folosite (fără cheie API, gratuite):
   - hartă de bază: CARTO (bazat pe OpenStreetMap)
   - radar precipitații: RainViewer (api.rainviewer.com)

   Leaflet (biblioteca de hărți) se încarcă abia când
   utilizatorul deschide prima dată această pagină, ca să
   nu îngreuneze restul aplicației.
   ============================================ */

let radarLeafletLoading = null;
let radarMap = null;
let radarBaseLayer = null;
let radarRainLayer = null;
let radarBaseTheme = null;
let radarAutoRefreshTimer = null;

function radarLoadLeaflet() {
  if (radarLeafletLoading) return radarLeafletLoading;
  radarLeafletLoading = new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Nu s-a putut încărca harta (Leaflet).'));
    document.body.appendChild(script);
  });
  return radarLeafletLoading;
}

function radarSetStatus(message) {
  const el = document.getElementById('radarMapStatus');
  if (!el) return;
  if (!message) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent = message;
  el.style.display = 'flex';
}

function radarCurrentBasemapUrls() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

function radarEnsureMap() {
  if (radarMap) return;
  radarMap = L.map('radarMapContainer', { attributionControl: true }).setView([WEATHER_LAT, WEATHER_LON], 10);

  radarBaseTheme = document.documentElement.getAttribute('data-theme');
  radarBaseLayer = L.tileLayer(radarCurrentBasemapUrls(), {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(radarMap);

  L.marker([WEATHER_LAT, WEATHER_LON]).addTo(radarMap).bindPopup('Reșița');
}

/** Dacă utilizatorul a schimbat tema (luminos/întunecat) de la ultima randare, schimbă și harta de bază. */
function radarSyncBasemapWithTheme() {
  if (!radarMap) return;
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === radarBaseTheme) return;
  radarBaseTheme = theme;
  if (radarBaseLayer) radarMap.removeLayer(radarBaseLayer);
  radarBaseLayer = L.tileLayer(radarCurrentBasemapUrls(), {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(radarMap);
  radarBaseLayer.bringToBack();
}

async function radarLoadPrecipitation() {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Radarul meteo nu a răspuns.');
  const data = await res.json();
  const frames = data && data.radar && data.radar.past;
  if (!Array.isArray(frames) || !frames.length) throw new Error('Nu există date radar momentan.');
  const latest = frames[frames.length - 1];

  if (radarRainLayer) radarMap.removeLayer(radarRainLayer);
  radarRainLayer = L.tileLayer(`${data.host}${latest.path}/256/{z}/{x}/{y}/4/1_1.png`, {
    opacity: 0.7,
    maxZoom: 19,
  }).addTo(radarMap);

  const updatedAt = new Date(latest.time * 1000);
  const label = document.getElementById('radarUpdated');
  if (label) label.textContent = 'Actualizat: ' + updatedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

async function refreshRadarMeteo() {
  const btn = document.getElementById('radarRefreshBtn');
  if (btn) btn.disabled = true;
  radarSetStatus('Se încarcă radarul…');
  try {
    await radarLoadLeaflet();
    radarEnsureMap();
    radarSyncBasemapWithTheme();
    await radarLoadPrecipitation();
    radarSetStatus('');
    setTimeout(() => { if (radarMap) radarMap.invalidateSize(); }, 50);
  } catch (err) {
    console.warn('Radar meteo indisponibil:', err);
    radarSetStatus('Radarul meteo nu a putut fi încărcat. Verifică conexiunea la internet.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Apelată din navigation.js -> renderPage() de fiecare dată când se deschide pagina. */
function renderRadarMeteo() {
  refreshRadarMeteo();
  if (radarAutoRefreshTimer) clearInterval(radarAutoRefreshTimer);
  radarAutoRefreshTimer = setInterval(() => {
    if (typeof currentPage !== 'undefined' && currentPage === 'radarmeteo') refreshRadarMeteo();
  }, 10 * 60000);
}
