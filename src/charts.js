// ── Chart.js — light theme ─────────────────────────────────────────────────
const GRID  = 'rgba(0,0,0,0.06)';
const TICK  = '#94a3b8';
const FONT  = { family: 'JetBrains Mono', size: 10 };

// Matches gauge gradient end-colors for visual consistency
const COLOR = {
  water_temperature:  '#06b6d4',
  temperature:        '#fbbf24',
  temperature_bmp580: '#f97316',
  humidity:           '#8b5cf6',
  light:              '#f59e0b',
  CO2:                '#ef4444',
  VOC:                '#ec4899',
  AQI:                null,
  pressure:           '#6366f1',
};
const AQI_COLORS = ['', '#10b981', '#84cc16', '#f59e0b', '#ef4444', '#7c3aed'];

let charts = {};
let showMA  = true;
const MA_WIN = 8;

// ── Helpers ───────────────────────────────────────────────────────────────────
function ma(data) {
  return data.map((_, i) => {
    if (i < MA_WIN - 1) return null;
    const slice = data.slice(i - MA_WIN + 1, i + 1).filter(v => v != null);
    return slice.length ? parseFloat((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2)) : null;
  });
}

function hex2rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lineDS(label, data, color) {
  return {
    label, data,
    borderColor: color,
    backgroundColor: hex2rgba(color, 0.07),
    borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 5,
    pointHoverBackgroundColor: color,
    tension: 0.35, fill: true,
  };
}

function maDS(label, data, color) {
  return {
    label, data: ma(data),
    borderColor: hex2rgba(color, 0.55),
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderDash: [5, 4],
    pointRadius: 0, tension: 0.35, fill: false,
    hidden: !showMA,
  };
}

function baseOpts(extraY = {}) {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1,
        titleColor: '#94a3b8', bodyColor: '#e2e8f0',
        titleFont: FONT, bodyFont: { ...FONT, size: 12 }, padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: TICK, font: FONT, maxTicksLimit: 8, maxRotation: 0 },
        grid: { color: GRID }, border: { color: 'rgba(0,0,0,0.08)' },
      },
      y: {
        ticks: { color: TICK, font: FONT },
        grid: { color: GRID }, border: { color: 'rgba(0,0,0,0.08)' },
        ...extraY,
      },
    },
  };
}

function build(id, labels, datasets, extraY = {}) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  charts[id] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: baseOpts(extraY),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export function renderCharts(entries) {
  if (!entries?.length) {
    console.warn('[charts] no entries received');
    return;
  }

  // Sort by stream ID (epoch_ms prefix) ascending — newest K entries, oldest-first for chart display
  entries = [...entries].sort((a, b) => {
    const ta = parseInt(String(a.id).split('-')[0]);
    const tb = parseInt(String(b.id).split('-')[0]);
    return ta - tb;
  });

  const labels = [];
  const s = {
    water_temperature: [], temperature: [], temperature_bmp580: [],
    humidity: [], light: [], CO2: [], VOC: [], AQI: [], pressure: [],
  };

  for (const entry of entries) {
    const ms = parseInt(String(entry.id).split('-')[0]);
    if (ms > 0) {
      const d = new Date(ms);
      labels.push(
        d.getHours().toString().padStart(2, '0') + ':' +
        d.getMinutes().toString().padStart(2, '0')
      );
    } else {
      labels.push('');
    }
    for (const key of Object.keys(s)) {
      const v = entry[key];
      s[key].push(v != null && v !== '' ? parseFloat(v) : null);
    }
  }

  // Water-tank temperature
  build('chart-water-temperature', labels,
    [lineDS('Water Tank', s.water_temperature, COLOR.water_temperature),
     maDS('MA', s.water_temperature, COLOR.water_temperature)]);

  // Outside temp: ENS160 + BMP580, dual-line with legend
  const tempCanvas = document.getElementById('chart-temperature');
  if (tempCanvas) {
    if (charts['chart-temperature']) { charts['chart-temperature'].destroy(); delete charts['chart-temperature']; }
    const opts = baseOpts();
    opts.plugins.legend = {
      display: true,
      labels: { color: TICK, font: FONT, boxWidth: 10, padding: 12 },
    };
    charts['chart-temperature'] = new Chart(tempCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          lineDS('ENS160', s.temperature, COLOR.temperature),
          maDS('ENS160 MA', s.temperature, COLOR.temperature),
          lineDS('BMP580', s.temperature_bmp580, COLOR.temperature_bmp580),
          maDS('BMP580 MA', s.temperature_bmp580, COLOR.temperature_bmp580),
        ],
      },
      options: opts,
    });
  }

  build('chart-humidity', labels,
    [lineDS('Humidity', s.humidity, COLOR.humidity), maDS('MA', s.humidity, COLOR.humidity)]);

  build('chart-light', labels,
    [lineDS('Lux', s.light, COLOR.light), maDS('MA', s.light, COLOR.light)]);

  build('chart-CO2', labels,
    [lineDS('CO₂', s.CO2, COLOR.CO2), maDS('MA', s.CO2, COLOR.CO2)]);

  build('chart-VOC', labels,
    [lineDS('VOC', s.VOC, COLOR.VOC), maDS('MA', s.VOC, COLOR.VOC)]);

  build('chart-pressure', labels,
    [lineDS('Pressure', s.pressure, COLOR.pressure), maDS('MA', s.pressure, COLOR.pressure)],
    { suggestedMin: 990, suggestedMax: 1030 });

  // AQI — colour-coded bar chart
  const aqiCanvas = document.getElementById('chart-AQI');
  if (aqiCanvas) {
    if (charts['chart-AQI']) { charts['chart-AQI'].destroy(); delete charts['chart-AQI']; }
    charts['chart-AQI'] = new Chart(aqiCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'AQI', data: s.AQI,
          backgroundColor: s.AQI.map(v => hex2rgba(AQI_COLORS[Math.round(v)] ?? '#94a3b8', 0.7)),
          borderColor:     s.AQI.map(v => AQI_COLORS[Math.round(v)] ?? '#94a3b8'),
          borderWidth: 1, borderRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.92)',
            borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1,
            titleColor: '#94a3b8', bodyColor: '#e2e8f0',
            titleFont: FONT, bodyFont: { ...FONT, size: 12 }, padding: 10,
            callbacks: {
              label: ctx => (['','Excellent','Good','Moderate','Poor','Unhealthy'][Math.round(ctx.parsed.y)] ?? ctx.parsed.y),
            },
          },
        },
        scales: {
          y: { min: 0, max: 5, ticks: { stepSize: 1, color: TICK, font: FONT }, grid: { color: GRID }, border: { color: 'rgba(0,0,0,0.08)' } },
          x: { ticks: { color: TICK, font: FONT, maxTicksLimit: 8, maxRotation: 0 }, grid: { color: GRID }, border: { color: 'rgba(0,0,0,0.08)' } },
        },
      },
    });
  }
}

export function toggleMA() {
  showMA = !showMA;
  for (const chart of Object.values(charts)) {
    chart.data.datasets.forEach(ds => {
      if (Array.isArray(ds.borderDash)) ds.hidden = !showMA;
    });
    chart.update('none');
  }
  return showMA;
}
