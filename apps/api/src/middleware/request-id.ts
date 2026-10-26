import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Assigns or propagates a unique Request ID across incoming requests.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers["x-request-id"];
  const id = typeof incomingId === "string" && incomingId.length > 0 ? incomingId : crypto.randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
