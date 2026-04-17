import { fetchLatest, fetchSensorStatus, fetchBoiler, fetchDevices, fetchHistory, fetchAggregations, setBoiler, connectWebSocket } from './api.js';
import { createGauges, applyReadings, applySensorStatus } from './gauges.js';
import { renderCharts } from './charts.js';

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
let historyCount = 200;  // set by renderSpanButtons on resolution change

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
let historyResolution = 'raw';

const RES_LABELS = {
  raw: 'readings', '15min': '15-min averages', '1h': 'hourly averages',
  '1d': 'daily averages', '1w': 'weekly averages',
};

// Span options per resolution: { label, count, default? }
const SPANS = {
  raw:   [{ label:'50',  count:50 }, { label:'100', count:100 }, { label:'200', count:200, def:true },
          { label:'500', count:500 }, { label:'1000', count:1000 }, { label:'2000', count:2000 }],
  '15min':[{ label:'6h',  count:24 }, { label:'12h', count:48 }, { label:'1d',  count:96,  def:true },
           { label:'2d',  count:192 }, { label:'3d',  count:288 }],
  '1h':  [{ label:'1d',  count:24 }, { label:'2d',  count:48,  def:true }, { label:'3d',  count:72  },
          { label:'1w',  count:168 }, { label:'2w',  count:336 }],
  '1d':  [{ label:'7d',  count:7  }, { label:'14d', count:14,  def:true }, { label:'30d', count:30  },
          { label:'60d', count:60  }, { label:'90d', count:90  }],
  '1w':  [{ label:'1m',  count:4  }, { label:'2m',  count:8,   def:true }, { label:'3m',  count:12  },
          { label:'6m',  count:26  }, { label:'1y',  count:52  }],
};

function renderSpanButtons(resolution) {
  const bar = document.getElementById('spanBtns');
  bar.innerHTML = '';
  SPANS[resolution].forEach(({ label, count, def }) => {
    const btn = document.createElement('button');
    btn.className = 'res-btn' + (def ? ' active' : '');
    btn.textContent = label;
    btn.dataset.count = count;
    if (def) historyCount = count;
    btn.addEventListener('click', function () {
      bar.querySelectorAll('.res-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      historyCount = parseInt(this.dataset.count);
      loadHistory();
    });
    bar.appendChild(btn);
  });
}

async function loadHistory() {
  try {
    let entries;
    if (historyResolution === 'raw') {
      entries = await fetchHistory(historyCount);
    } else {
      entries = await fetchAggregations(historyResolution, historyCount);
    }
    renderCharts(entries, historyResolution);
    document.getElementById('historyTitle').textContent =
      `Last ${entries.length} ${RES_LABELS[historyResolution] ?? historyResolution}`;
  } catch (err) { console.error('[history] load failed:', err); }
}

document.getElementById('refreshBtn').addEventListener('click', loadHistory);

document.querySelectorAll('#resBtns .res-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('#resBtns .res-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    historyResolution = this.dataset.res;
    renderSpanButtons(historyResolution);
    loadHistory();
  });
});

// Initialise span buttons for the default resolution
renderSpanButtons(historyResolution);

// ── Polling ───────────────────────────────────────────────────────────────────
pollLatest();
pollBoiler();
pollStatus();
pollSensorStatus();

setInterval(pollLatest,       10_000);
setInterval(pollBoiler,        5_000);
setInterval(pollStatus,       15_000);
setInterval(pollSensorStatus, 15_000);
