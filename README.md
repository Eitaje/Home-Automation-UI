# EITAJE Home Automation UI

A real-time dashboard for monitoring environmental sensors and controlling a home heating system. Built with vanilla JavaScript and Vite — no framework overhead.

---

## Overview

The dashboard connects to a backend API (running on TrueNAS) and displays live data from a NodeMCU ESP8266 sensor node. It shows temperature, humidity, air quality, pressure, and light readings, and lets you control a boiler remotely.

**Key capabilities:**
- Real-time sensor data via WebSocket
- Historical trend charts with configurable time windows
- Boiler on/off control with runtime tracking
- Sensor fault detection with graceful UI degradation
- Fully responsive, mobile-friendly layout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Build tool | Vite 6 |
| Language | Vanilla JavaScript (ES Modules) |
| Charts | Chart.js 4.4 (CDN) |
| Gauges | Custom SVG (no library) |
| Fonts | Google Fonts — Orbitron, Inter, JetBrains Mono |
| Styling | CSS3 with CSS custom properties |
| API | Fetch (REST) + WebSocket |

---

## Project Structure

```
home-automation-ui/
├── index.html                    # Full UI markup — header, tabs, cards, gauge containers
├── vite.config.js                # Dev server config with API proxy
├── .env.example                  # Environment variable template
├── .env                          # Local config (git-ignored)
├── Dockerfile                    # Multi-stage build: Node builder + nginx serving
├── docker-entrypoint.sh          # Runtime entrypoint — injects API_URL into nginx config
├── nginx.template.conf           # nginx config template with __API_URL__ placeholder
├── docker-compose.ui.truenas.yml # TrueNAS deployment compose file
└── src/
    ├── main.js         # App entry — polling loops, event handling, orchestration
    ├── api.js          # API layer — REST calls and WebSocket connection
    ├── gauges.js       # SVG gauge creation and value animation
    ├── charts.js       # Chart.js integration, history rendering, moving average
    └── style.css       # Design tokens, layout, responsive breakpoints, animations
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- The [home automation backend server](../home%20automation%20server/) running and accessible

### Installation

```bash
npm install
```

### Configuration

Copy the example env file and set your API URL:

```bash
cp .env.example .env
```

`.env.example`:
```
# Only required when UI is NOT served from the same host as the API.
# In development, the Vite proxy handles routing — leave this empty.
# In production, set the full API origin (scheme + host + port).
VITE_API_URL=http://<truenas-ip>:8000
```

> In development the Vite proxy transparently forwards `/devices` and `/ws` requests to the backend, so you typically leave `VITE_API_URL` empty in your local `.env`.

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`. All API calls are proxied to `VITE_API_URL` (or `http://localhost:8000` by default).

### Production Build

```bash
npm run build
```

Outputs optimized static files to `dist/`. Set `VITE_API_URL` in `.env` to your production API origin before building.

```bash
npm run preview   # locally preview the production build
```

---

## Docker Deployment

The UI ships as a Docker image (`eitaje/homeauto-ui:latest`) built with a two-stage Dockerfile:

1. **Builder stage** — Node 20 runs `npm ci && npm run build`, producing static files in `dist/`.
2. **Serve stage** — nginx 1.27 (Alpine) serves the static files and proxies `/devices` and `/ws` to the backend at runtime.

The backend URL is injected at container start via the `API_URL` environment variable. `docker-entrypoint.sh` substitutes the `__API_URL__` placeholder in `nginx.template.conf` and writes the final nginx config before starting the server.

### Build & Push

```bash
cd "home automation UI"
docker build -t eitaje/homeauto-ui:latest .
docker push eitaje/homeauto-ui:latest
```

### TrueNAS Deployment

Copy `docker-compose.ui.truenas.yml` to TrueNAS, then:

```bash
sudo docker compose -f docker-compose.ui.truenas.yml pull
sudo docker compose -f docker-compose.ui.truenas.yml up -d
```

The UI is served on port `8080`. `SERVER_IP` defaults to `192.168.1.70`; override it with an environment variable if needed:

```bash
SERVER_IP=192.168.1.100 sudo docker compose -f docker-compose.ui.truenas.yml up -d
```

---

## Features

### Live Tab

The default view. Updates in real time via WebSocket, with polling fallback.

| Card | Metric | Range |
|---|---|---|
| Water Tank | Temperature (°C) | 0 – 80 |
| ENS160 | Temperature (°C) | 0 – 50 |
| BMP580 | Temperature (°C) | 0 – 50 |
| Humidity | Relative humidity (%) | 0 – 100 |
| Light | Intensity (lux) | 0 – 1000 |
| Pressure | Atmospheric (hPa) | 900 – 1100 |
| CO₂ | Concentration (ppm) | 400 – 2000 |
| VOC | Volatile organics (ppb) | 0 – 500 |
| AQI | Air quality index (1–5) | Excellent → Unhealthy |

**Boiler control** — toggle heating on/off; the card shows current state and cumulative runtime.

**Connection status** — header indicator turns red if the backend is unreachable.

**Sensor faults** — if a sensor is disabled or reporting a fault, its card is greyed out automatically.

### History Tab

Time-series charts for every metric. Loaded lazily when the tab is first opened.

- **Time window selector** — 50 / 100 / 200 (default) / 500 / 1000 / 2000 data points
- **Moving average toggle** — overlays an 8-point moving average on each chart
- **Manual refresh** button
- Temperature chart shows ENS160 and BMP580 as two overlaid lines
- AQI chart uses a color-coded bar style (green → red)

---

## API Integration

The UI communicates with the backend at the path prefix `/devices` (REST) and `/ws` (WebSocket).

### REST Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/devices` | List devices — used to determine online status |
| `GET` | `/devices/nodemcu/latest` | Latest sensor reading |
| `GET` | `/devices/nodemcu/sensor_status` | Per-sensor health (active / fault / disabled) |
| `GET` | `/devices/nodemcu/boiler` | Boiler state and runtime |
| `GET` | `/devices/nodemcu/history?count=N` | Historical readings |
| `POST` | `/devices/nodemcu/boiler` | Set boiler on/off |

### WebSocket

`WS /ws/live` — streams live readings as they arrive.

Expected message format:
```json
{
  "type": "reading",
  "device_id": "nodemcu",
  "data": { }
}
```

### Polling Intervals

| Data | Interval |
|---|---|
| Latest readings | 10 s |
| Boiler state | 5 s |
| Online status | 15 s |
| Sensor status | 15 s |

---

## Architecture Notes

- **No framework.** Vanilla JS keeps the bundle minimal. All state lives in module-level variables; the DOM is the source of truth for display.
- **Four focused modules.** `api.js` owns all network I/O. `gauges.js` and `charts.js` own their respective rendering. `main.js` wires everything together.
- **Vite proxy strategy.** All fetch/WebSocket calls use relative paths (e.g. `/devices/…`). In dev, `vite.config.js` proxies them to the backend. In production (Docker), nginx handles the proxying based on the `API_URL` injected at container start.
- **Polling + WebSocket hybrid.** WebSocket gives low-latency updates; periodic polling ensures the UI recovers after a dropped connection without manual intervention.
- **SVG gauges, Canvas charts.** Custom SVG for gauges (crisp at any DPI, animatable with CSS); Chart.js Canvas for time-series (well-suited to dense datasets).
- **Lazy chart init.** `charts.js` builds Chart instances only when the History tab is first activated, avoiding unnecessary work on initial load.
- **CSS design tokens.** All colors, spacing, and typography are defined as CSS custom properties in `style.css`, making the theme consistent and easy to adjust.
