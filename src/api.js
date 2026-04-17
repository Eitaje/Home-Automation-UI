// Always use relative URLs — Vite proxy forwards /devices and /ws to the API server.
// VITE_API_URL is only used by vite.config.js to set the proxy target.
const BASE = '';

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export const fetchLatest      = () => get('/devices/nodemcu/latest');
export const fetchSensorStatus= () => get('/devices/nodemcu/sensor_status');
export const fetchBoiler      = () => get('/devices/nodemcu/boiler');
export const fetchDevices     = () => get('/devices');
export const fetchHistory        = (count = 200) => get(`/devices/nodemcu/history?count=${count}`);
export const fetchAggregations   = (resolution, count) => get(`/devices/nodemcu/aggregations?resolution=${resolution}&count=${count}`);

export async function setBoiler(state) {
  const r = await fetch(`${BASE}/devices/nodemcu/boiler`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export function connectWebSocket(onReading) {
  const wsBase = BASE
    ? BASE.replace(/^http/, 'ws')
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  const ws = new WebSocket(`${wsBase}/ws/live`);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'reading' && msg.device_id === 'nodemcu') onReading(msg.data);
  };

  // Auto-reconnect
  ws.onclose = () => setTimeout(() => connectWebSocket(onReading), 3000);

  return ws;
}
