import express from "express";
import cors from "cors";
import path from "path";
import { api } from "../legacy/api";
import { areaApi } from "../legacy/area";
import ADSBexchange from "./sources/adsb/adsbe";
import accessLog, { readRecentLogs } from "./middleware/accessLog";
class Server {
  app: any;
  server: any;
  constructor(port) {
    this.init(port);
  }

  init(port: number) {
    this.app = express();
    this.app.set("port", port);
    this.app.use(
      cors({
        origin: "*",
      }),
    );
    this.app.use(accessLog());
    this.app.get("/", (_request: any, response: any) => {
      response.sendFile(path.join(__dirname, "/../static/index.html"));
    });
    // Machine-readable usage instructions for LLMs / agents.
    this.app.get("/llms.txt", (_request: any, response: any) => {
      response.type("text/plain");
      response.sendFile(path.join(__dirname, "/../static/llms.txt"));
    });
    // Access log viewer: JSON when ?format=json, otherwise a small HTML page.
    this.app.get("/logs", (req: any, res: any) => {
      const entries = readRecentLogs(200);
      if (req.query.format === "json") {
        res.json(entries);
        return;
      }
      res.type("html").send(this.renderLogsPage(entries));
    });
    this.loadLegacyRoutes();
    this.loadRoutes();
    this.server = this.app.listen(this.app.get("port"), () => {
      console.log("Node this.appp is running on port", this.app.get("port"));
    });
  }

  close() {
    if (this.server) {
      this.server.close();
      console.log("Server closed");
    }
  }

  // Renders the recent access-log entries as a small dark-themed HTML page.
  renderLogsPage(entries: any[]): string {
    const esc = (v: any) =>
      String(v ?? "").replace(
        /[&<>"]/g,
        (c) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
            c
          ] as string,
      );
    const statusColor = (s: number) =>
      s >= 500
        ? "#ff6b6b"
        : s >= 400
          ? "#ffb454"
          : s >= 300
            ? "#7c9cff"
            : "#2ea043";
    const rows = entries
      .map((e) => {
        if (e.raw !== undefined) {
          return `<tr><td colspan="6"><code>${esc(e.raw)}</code></td></tr>`;
        }
        return `<tr>
          <td class="t">${esc(e.time)}</td>
          <td>${esc(e.method)}</td>
          <td class="url">${esc(e.url)}</td>
          <td style="color:${statusColor(
            Number(e.status),
          )};font-weight:600">${esc(e.status)}</td>
          <td class="num">${esc(e.durationMs)} ms</td>
          <td class="ip">${esc(e.ip)}</td>
        </tr>`;
      })
      .join("\n");
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Access log — Position API</title>
<style>
  :root { --bg:#0b1220; --card:#16233a; --border:#243650; --text:#e6edf6; --muted:#9fb1c9; --accent:#4cc2ff; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1000px; margin:0 auto; padding:32px 24px; }
  a { color:var(--accent); text-decoration:none; }
  h1 { font-size:24px; margin:0 0 4px; }
  .sub { color:var(--muted); margin:0 0 20px; font-size:14px; }
  .bar { display:flex; gap:14px; align-items:center; margin-bottom:18px; flex-wrap:wrap; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; font-size:13px; }
  th,td { text-align:left; padding:8px 12px; border-bottom:1px solid var(--border); white-space:nowrap; }
  th { color:var(--muted); font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:.05em; }
  tr:last-child td { border-bottom:none; }
  td.t,td.ip,td.num { color:var(--muted); font-family:ui-monospace,Menlo,monospace; }
  td.url { font-family:ui-monospace,Menlo,monospace; white-space:normal; word-break:break-all; }
  .empty { color:var(--muted); padding:24px 0; }
  code { font-family:ui-monospace,Menlo,monospace; }
</style></head>
<body><div class="wrap">
  <h1>Access log</h1>
  <p class="sub">Most recent ${entries.length} request${
    entries.length === 1 ? "" : "s"
  } (newest first).</p>
  <div class="bar">
    <a href="/">← Back home</a>
    <a href="/logs">↻ Refresh</a>
    <a href="/logs?format=json">View as JSON</a>
  </div>
  ${
    entries.length === 0
      ? '<p class="empty">No requests logged yet.</p>'
      : `<table>
    <thead><tr><th>Time (UTC)</th><th>Method</th><th>URL</th><th>Status</th><th>Duration</th><th>IP</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }
</div></body></html>`;
  }

  loadRoutes() {
    // /:sourcetype/:source/:vehicleidentifier/location/latest
    this.app.get(
      "/ais/mt/:mmsi/location/latest",
      async (req: any, res: any) => {
        const mmsi = req.params.mmsi;
        // MarineTraffic's vessel pages are currently behind anti-bot protection,
        // so the direct MT scrape returns nothing (and is slow). Serve AIS
        // positions from the working MyShipTracking source, falling back to
        // MarineTraffic only if MyShipTracking has no data. Note: getLocationFrom*
        // already passes a complete { error, data } envelope to the callback, so
        // we forward it as-is rather than re-wrapping it.
        api.getLocationFromMST(mmsi, (mstResult) => {
          if (mstResult.data) {
            res.send(mstResult);
            return;
          }
          api.getLocationFromMT(mmsi, (mtResult) => {
            res.send(mtResult);
          });
        });
      },
    );
    this.app.get(
      "/adsb/adsbe/:icao/location/latest",
      async (req: any, res: any) => {
        console.log(req.params.icao);
        const adsbe = new ADSBexchange();
        const location = await adsbe.getLocation(req.params.icao);
        console.log(location);
        res.send({
          error: null,
          data: location,
        });
      },
    );
  }

  loadLegacyRoutes() {
    // this route is wrongly named on purpose for legacy reasons.
    // AS VF is not as easy to reverse as the other ones, it is replaced by MST
    this.app.get(
      "/legacy/getLastPositionFromVF/:mmsi",
      (req: any, res: any) => {
        api.getLocationFromMST(req.params.mmsi, (result) => {
          res.send(result);
        });
      },
    );
    this.app.get(
      "/legacy/getLastPositionFromMT/:mmsi",
      (req: any, res: any) => {
        api.getLocationFromMT(req.params.mmsi, (result) => {
          res.send(result);
        });
      },
    );
    this.app.get("/legacy/getLastPosition/:mmsi", (req: any, res: any) => {
      api.getLocation(req.params.mmsi, (result) => {
        res.send(result);
      });
    });
    // e.g. /getVesselsInArea/WMED,EMED
    this.app.get(
      "/legacy/getVesselsInArea/:area",
      async (req: any, res: any) => {
        await areaApi.fetchVesselsInArea(
          req.params.area.split(","),
          (result) => {
            res.json(result);
          },
        );
      },
    );
    this.app.get(
      "/legacy/getVesselsNearMe/:lat/:lng/:distance",
      async (req: any, res: any) => {
        await areaApi.fetchVesselsNearMe(
          req.params.lat,
          req.params.lng,
          req.params.distance,
          (result) => {
            res.json(result);
          },
        );
      },
    );
    this.app.get("/legacy/getVesselsInPort/:shipPort", (req: any, res: any) => {
      api.getVesselsInPort(req.params.shipPort, (result) => {
        res.send(result);
      });
    });
  }
}

export default Server;
