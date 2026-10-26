import type { Request, Response, NextFunction } from "express";
import { redactText } from "@stackdoctor/core";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  requestId?: string;
  method: string;
  url: string;
  statusCode?: number;
  durationMs?: number;
  message?: string;
  error?: string;
}

/**
 * Emits a structured, redacted log entry to standard out.
 * Strictly avoids logging request bodies, cookies, authorization headers, and raw credentials.
 */
export function emitLog(entry: LogEntry): void {
  // Redact any string message or error
  const sanitized: LogEntry = {
    ...entry,
    message: entry.message ? redactText(entry.message) : undefined,
    error: entry.error ? redactText(entry.error) : undefined
  };

  const line = JSON.stringify(sanitized);
  if (entry.level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

/**
 * Express middleware that logs incoming requests and responses with timing and redaction.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    emitLog({
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs
    });
  });

  next();
}
