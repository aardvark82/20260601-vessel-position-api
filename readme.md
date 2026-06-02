# 🚢 Position API

> Real-time positions of **vessels** and **aircraft** from public tracking sources — over a simple JSON HTTP API. No API key required.

A small Node.js / TypeScript service that returns the latest known location of a ship (by MMSI) or an aircraft (by ICAO address), scraped from MarineTraffic, MyShipTracking, and ADS-B Exchange.

---

## ✨ Features

- 🛳️ **Vessel positions** — latest location for any ship by MMSI (MarineTraffic / MyShipTracking AIS).
- ✈️ **Aircraft positions** — latest location for any aircraft by ICAO hex address (ADS-B Exchange).
- 🗺️ **Area & port queries** — list vessels in a region, near a coordinate, or inside a named port.
- 🤖 **Agent-ready** — machine-readable usage spec at [`/llms.txt`](http://localhost:5000/llms.txt) so LLMs can call it correctly.
- 📋 **Access logging** — every request recorded as a JSON line for easy auditing.

---

## 🚀 Quick start

```bash
# 1. Clone & install (requires Node.js v18+)
git clone https://github.com/aardvark82/20260601-vessel-position-api.git
cd 20260601-vessel-position-api
npm install

# 2. Configure
cp .env.template .env        # adjust if needed (e.g. set PORT)

# 3. Run
npm start                    # production
# or
npm run dev                  # development, with auto-reload
```

The server listens on **port 5000** by default. Try it:

```bash
curl http://localhost:5000/ais/mt/211879870/location/latest
```

> Replace `localhost:5000` with your server's host and port if you've deployed it elsewhere.

---

## 📡 API reference

All endpoints are **read-only `GET`** requests and return **JSON**.

### Vessel & aircraft positions

| Endpoint | Description |
| --- | --- |
| `GET /ais/mt/:mmsi/location/latest` | Latest position for a vessel by MMSI (MarineTraffic). |
| `GET /adsb/adsbe/:icao/location/latest` | Latest position for an aircraft by ICAO hex address (ADS-B Exchange). |

```bash
# Vessel by MMSI
curl http://localhost:5000/ais/mt/211879870/location/latest

# Aircraft by ICAO hex
curl http://localhost:5000/adsb/adsbe/abc123/location/latest
```

### Legacy endpoints

Kept for backwards compatibility.

| Endpoint | Description |
| --- | --- |
| `GET /legacy/getLastPositionFromMT/:mmsi` | Vessel position from MarineTraffic. |
| `GET /legacy/getLastPositionFromVF/:mmsi` | Vessel position (served by the MyShipTracking source). |
| `GET /legacy/getLastPosition/:mmsi` | Vessel position from the default source. |
| `GET /legacy/getVesselsInArea/:area` | Vessels in a region; `:area` is a comma-separated list, e.g. `WMED,EMED`. |
| `GET /legacy/getVesselsNearMe/:lat/:lng/:distance` | Vessels within `:distance` km of a coordinate. |
| `GET /legacy/getVesselsInPort/:shipPort` | Vessels in a named port, e.g. `Hamburg`. |

```bash
curl http://localhost:5000/legacy/getLastPosition/211879870
curl http://localhost:5000/legacy/getVesselsInArea/WMED,EMED
curl http://localhost:5000/legacy/getVesselsNearMe/37.7749/-122.4194/10
curl http://localhost:5000/legacy/getVesselsInPort/Hamburg
```

---

## 📦 Response format

Every position endpoint returns the same envelope:

```json
{
  "error": null,
  "data": {
    "timestamp": "2026-06-01T02:08:00.000Z",
    "latitude": 49.12292,
    "longitude": -123.18416,
    "course": 17,
    "speed": 0,
    "source": "myshiptracking.com",
    "source_type": "AIS"
  }
}
```

- On **success**, `error` is `null` and `data` holds the position.
- On **failure**, `error` holds a message and `data` is `null`.
- `altitude` is included for aircraft only.
- Always check `timestamp` before treating a position as "current" — data is scraped from public sources and may be delayed.

---

## 🤖 For LLMs & agents

Machine-readable instructions describing how to call the API live at [`/llms.txt`](http://localhost:5000/llms.txt) (source: [`src/static/llms.txt`](src/static/llms.txt)). Point an agent at that URL and it can use the API without further documentation.

---

## 📋 Access logs

Every request is written as a single JSON line to `logs/access.log` (and echoed to stdout):

```json
{"time":"2026-06-02T14:32:11.415Z","ip":"::1","method":"GET","url":"/ais/mt/211879870/location/latest","status":200,"durationMs":2.514,"userAgent":"curl/8.7.1"}
```

Each entry includes the timestamp, client IP, method, URL, status code, response time, and user agent. Override the directory with the `LOG_DIR` environment variable.

---

## 🛠️ Development

| Command | Action |
| --- | --- |
| `npm run dev` | Run with auto-reload. |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm test` | Run the test suite. |
| `npm run lint` | Lint the code. |
| `npm run prettier` | Format the code. |

---

## ⚠️ Notes

- All endpoints return JSON.
- Positions are scraped from public sources, so availability and freshness depend on those providers and on the vessel/aircraft actually broadcasting. Be considerate with request volume.

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

## 📄 License

[ISC](LICENSE)

---

*Powered by Node.js, Express, Puppeteer & TypeScript.*
