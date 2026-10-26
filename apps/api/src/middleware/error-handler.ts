import type { Request, Response, NextFunction } from "express";
import { redactText } from "@stackdoctor/core";
import { emitLog } from "./logger.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Centralized Express error handler.
 * Sanitizes error messages and strictly suppresses stack traces in production mode.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  const rawMessage = err instanceof Error ? err.message : "Internal Server Error";
  const message = redactText(rawMessage);

  emitLog({
    timestamp: new Date().toISOString(),
    level: "error",
    requestId: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    error: message
  });

  res.status(statusCode).json({
    error: {
      message: statusCode === 500 && isProduction ? "Internal Server Error" : message,
      code: err instanceof ApiError ? err.name : "ServerError",
      requestId: req.id,
      details: err instanceof ApiError ? err.details : undefined,
      stack: isProduction ? undefined : err instanceof Error ? err.stack : undefined
    }
  });
}
