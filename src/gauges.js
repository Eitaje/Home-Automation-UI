// ── SVG arc gauge — no external library ───────────────────────────────────────
const R         = 72;
const CIRC      = 2 * Math.PI * R;
const TRACK_ARC = (300 / 360) * CIRC;
const GAP_ARC   = CIRC - TRACK_ARC;
const START_ROT = 120;

const CONFIGS = {
  water_temperature:  { min: 0,   max: 80,   dec: 1, colors: ['#0ea5e9', '#06b6d4'] },
  temperature:        { min: 0,   max: 50,   dec: 1, colors: ['#f97316', '#fbbf24'] },
  temperature_bmp580: { min: 0,   max: 50,   dec: 1, colors: ['#ef4444', '#f97316'] },
  humidity:           { min: 0,   max: 100,  dec: 0, colors: ['#8b5cf6', '#06b6d4'] },
  light:              { min: 0,   max: 1000, dec: 0, colors: ['#fbbf24', '#f97316'] },
  pressure:           { min: 900, max: 1100, dec: 1, colors: ['#6366f1', '#8b5cf6'] },
  CO2:                { min: 400, max: 2000, dec: 0, colors: ['#10b981', '#ef4444'] },
  VOC:                { min: 0,   max: 500,  dec: 0, colors: ['#10b981', '#ec4899'] },
  AQI:                { min: 1,   max: 5,    dec: 0, colors: ['#10b981', '#7c3aed'], isAQI: true },
};

const AQI_LABELS = ['', 'Excellent', 'Good', 'Moderate', 'Poor', 'Unhealthy'];
const AQI_COLORS = ['', '#10b981', '#84cc16', '#f59e0b', '#ef4444', '#7c3aed'];

function buildGauge(fieldId, { min, max, dec, colors, isAQI }) {
  const container = document.getElementById(`gauge-${fieldId}`);
  if (!container) return null;

  const uid  = fieldId.replace(/_/g, '-');
  const arcId = `arc-${uid}`;
  const valId = `val-${uid}`;
  const subId = `sub-${uid}`;
  const gid   = `grad-${uid}`;
  const fid   = `filt-${uid}`;

  container.innerHTML = `
    <svg viewBox="0 0 200 200" class="gauge-svg" aria-label="${fieldId}">
      <defs>
        <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stop-color="${colors[0]}"/>
          <stop offset="100%" stop-color="${colors[1]}"/>
        </linearGradient>
        <filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle class="g-track" cx="100" cy="100" r="${R}"
        stroke-dasharray="${TRACK_ARC.toFixed(2)} ${GAP_ARC.toFixed(2)}"
        transform="rotate(${START_ROT}, 100, 100)"/>
      <circle id="${arcId}" class="g-arc" cx="100" cy="100" r="${R}"
        stroke="url(#${gid})"
        stroke-dasharray="0 ${CIRC.toFixed(2)}"
        transform="rotate(${START_ROT}, 100, 100)"
        filter="url(#${fid})"/>
      <text id="${valId}" class="g-val"
        x="100" y="98" text-anchor="middle" dominant-baseline="middle"
        font-family="JetBrains Mono, monospace" font-size="30" font-weight="500"
        fill="#0f172a">—</text>
      <text id="${subId}" class="g-sub"
        x="100" y="121" text-anchor="middle"
        font-family="Inter, sans-serif" font-size="11"
        fill="#94a3b8"></text>
      <text class="g-mm" x="24"  y="174" text-anchor="middle"
        font-family="JetBrains Mono, monospace" font-size="9" fill="#cbd5e1">${min}</text>
      <text class="g-mm" x="176" y="174" text-anchor="middle"
        font-family="JetBrains Mono, monospace" font-size="9" fill="#cbd5e1">${max}</text>
    </svg>`;

  // Use getElementById — works in all contexts, no namespace ambiguity
  const arcEl = document.getElementById(arcId);
  const valEl = document.getElementById(valId);
  const subEl = document.getElementById(subId);

  if (!arcEl || !valEl || !subEl) {
    console.error(`[gauge] failed to find elements for ${fieldId}`, { arcEl, valEl, subEl });
    return null;
  }

  return {
    setValue(raw) {
      const v    = Number(raw);
      const frac = Math.max(0, Math.min(1, (v - min) / (max - min)));
      const len  = frac * TRACK_ARC;

      arcEl.setAttribute('stroke-dasharray', `${len.toFixed(2)} ${(CIRC - len).toFixed(2)}`);
      valEl.textContent = Number.isFinite(v) ? v.toFixed(dec) : '—';

      if (isAQI) {
        const idx = Math.min(5, Math.max(1, Math.round(v)));
        const c   = AQI_COLORS[idx] || '#94a3b8';
        subEl.textContent = AQI_LABELS[idx] || '';
        subEl.setAttribute('fill', c);
        arcEl.setAttribute('stroke', c);
        arcEl.setAttribute('filter', '');
        arcEl.style.filter = `drop-shadow(0 0 6px ${c}88)`;
      } else {
        subEl.textContent = '';
      }
    },
  };
}

export function createGauges() {
  const gauges = {};
  for (const [field, cfg] of Object.entries(CONFIGS)) {
    const g = buildGauge(field, cfg);
    if (g) gauges[field] = g;
  }
  return gauges;
}

export function applyReadings(gauges, data) {
  for (const [field, gauge] of Object.entries(gauges)) {
    if (data[field] != null) gauge.setValue(data[field]);
  }
}

export function applySensorStatus(status) {
  const map = {
    aht21:   ['temperature', 'humidity'],
    ens160:  ['CO2', 'VOC', 'AQI'],
    bh1750:  ['light'],
    bmp580:  ['pressure', 'temperature_bmp580'],
    ds18b20: ['water_temperature'],
  };
  for (const [sensor, fields] of Object.entries(map)) {
    const inactive = status[sensor] === 'fault' || status[sensor] === 'disabled';
    for (const f of fields) {
      document.getElementById(`card-${f}`)?.classList.toggle('sensor-inactive', inactive);
    }
  }
}
