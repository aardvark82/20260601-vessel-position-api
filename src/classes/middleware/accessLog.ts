import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";

// Directory + file where access logs are persisted.
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), "logs");
export const LOG_FILE = path.join(LOG_DIR, "access.log");

fs.mkdirSync(LOG_DIR, { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });

/**
 * Return the most recent access-log entries (newest first), parsed from JSON.
 * Safe to call before any request has been logged (returns []).
 */
export function readRecentLogs(limit = 200): any[] {
  let raw: string;
  try {
    raw = fs.readFileSync(LOG_FILE, "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines
    .slice(-limit)
    .reverse()
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return { raw: l };
      }
    });
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "-";
}

/**
 * Express middleware that logs every request once the response finishes.
 * Each line is a single JSON object so logs are easy to grep or ship to a
 * log aggregator. Lines are also echoed to stdout for live tailing.
 */
export function accessLog() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const entry = {
        time: new Date().toISOString(),
        ip: clientIp(req),
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 1000) / 1000,
        userAgent: req.headers["user-agent"] ?? "-",
      };
      const line = JSON.stringify(entry);
      logStream.write(line + "\n");
      console.log(line);
    });

    next();
  };
}

export default accessLog;
