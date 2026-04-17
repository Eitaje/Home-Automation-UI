import { fetchLatest, fetchSensorStatus, fetchBoiler, fetchDevices, fetchHistory, setBoiler, connectWebSocket } from './api.js';
import { createGauges, applyReadings, applySensorStatus } from './gauges.js';
import { renderCharts, toggleMA } from './charts.js';

// ── Clock ─────────────────────────────────────────────────────────────────────
(function clock() {
  const el = document.getElementById('headerClock');
  const tick = () => { if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  tick();
  setInterval(tick, 30000);
})();

// ── Gauges ────────────────────────────────────────────────────────────────────
const gauges = createGauges();

// ── Online status ─────────────────────────────────────────────────────────────
function setOnline(online) {
  document.getElementById('statusDot').className = `status-dot ${online ? 'online' : 'offline'}`;
  document.getElementById('serverState').textContent = online ? 'online' : 'offline';
}

async function pollStatus() {
  try {
    const devices = await fetchDevices();
    const nodemcu = devices.find(d => d.id === 'nodemcu');
    setOnline(nodemcu?.online ?? false);
  } catch {
    setOnline(false);
  }
}

// ── Latest readings ───────────────────────────────────────────────────────────
async function pollLatest() {
  try {
    const data = await fetchLatest();
    applyReadings(gauges, data);
  } catch (err) { console.warn('[pollLatest]', err); }
}

// ── Sensor status ─────────────────────────────────────────────────────────────
async function pollSensorStatus() {
  try {
    const status = await fetchSensorStatus();
    applySensorStatus(status);
  } catch { /* ignore */ }
}

// ── Boiler ────────────────────────────────────────────────────────────────────
const boilerToggle = document.getElementById('boilerToggle');
const boilerState  = document.getElementById('boilerState');
const boilerCard   = document.getElementById('boilerCard');
let boilerLocked = false;

function applyBoiler({ state, runtime_minutes }) {
  boilerLocked = true;
  boilerToggle.checked = state === 1;
  boilerLocked = false;
  const on = state === 1;
  boilerCard.classList.toggle('on', on);
  boilerState.classList.toggle('on', on);
  if (on && runtime_minutes != null) {
    boilerState.textContent = `ON — ${runtime_minutes.toFixed(1)} min`;
  } else {
    boilerState.textContent = on ? 'ON' : 'OFF';
  }
}

async function pollBoiler() {
  try { applyBoiler(await fetchBoiler()); } catch { /* ignore */ }
}

boilerToggle.addEventListener('change', async () => {
  if (boilerLocked) return;
  try { applyBoiler(await setBoiler(boilerToggle.checked ? 1 : 0)); } catch { /* ignore */ }
});

// ── WebSocket live feed ───────────────────────────────────────────────────────
connectWebSocket((data) => {
  applyReadings(gauges, data);
  setOnline(true);
});

// ── Tab switching ─────────────────────────────────────────────────────────────
let historyCount = 200;

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-live').classList.toggle('tab-hidden',    tab !== 'live');
    document.getElementById('tab-history').classList.toggle('tab-hidden', tab !== 'history');
    // Delay one frame so the browser finishes layout before Chart.js measures canvas size
    if (tab === 'history') requestAnimationFrame(() => loadHistory());
  });
});

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const entries = await fetchHistory(historyCount);
    renderCharts(entries);
    document.getElementById('historyTitle').textContent =
      `Last ${entries.length} readings`;
  } catch (err) { console.error('[history] load failed:', err); }
}

document.getElementById('refreshBtn').addEventListener('click', loadHistory);

document.getElementById('maToggleBtn').addEventListener('click', function () {
  const on = toggleMA();
  this.classList.toggle('active', on);
});
document.getElementById('maToggleBtn').classList.add('active');

document.querySelectorAll('.count-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    historyCount = parseInt(this.dataset.count);
    loadHistory();
  });
});

// ── Polling ───────────────────────────────────────────────────────────────────
pollLatest();
pollBoiler();
pollStatus();
pollSensorStatus();

setInterval(pollLatest,       10_000);
setInterval(pollBoiler,        5_000);
setInterval(pollStatus,       15_000);
setInterval(pollSensorStatus, 15_000);
