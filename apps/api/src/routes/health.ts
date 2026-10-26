import { Router, Request, Response } from "express";
import { isDatabaseConnected } from "../lib/db.js";
import { CURRENT_TOOL_VERSION, CURRENT_SCHEMA_VERSION } from "@stackdoctor/schemas";

export const healthRouter = Router();

healthRouter.get("/", (req: Request, res: Response) => {
  const dbConnected = isDatabaseConnected();
  const statusCode = dbConnected ? 200 : 503;

  res.status(statusCode).json({
    status: dbConnected ? "ok" : "degraded",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    toolVersion: CURRENT_TOOL_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    database: {
      status: dbConnected ? "connected" : "disconnected"
    }
  });
});
