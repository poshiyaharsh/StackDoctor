import { redactText } from "./redact.js";

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export class SafeLogger implements Logger {
  private level: "debug" | "info" | "warn" | "error" | "silent";

  constructor(level: "debug" | "info" | "warn" | "error" | "silent" = "info") {
    this.level = level;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(`[DEBUG] ${redactText(message)}`, meta ? redactText(JSON.stringify(meta)) : "");
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(`[INFO] ${redactText(message)}`, meta ? redactText(JSON.stringify(meta)) : "");
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(`[WARN] ${redactText(message)}`, meta ? redactText(JSON.stringify(meta)) : "");
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(`[ERROR] ${redactText(message)}`, meta ? redactText(JSON.stringify(meta)) : "");
    }
  }

  private shouldLog(callLevel: "debug" | "info" | "warn" | "error"): boolean {
    if (this.level === "silent") return false;
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(callLevel) >= levels.indexOf(this.level);
  }
}
