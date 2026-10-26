import http from "node:http";
import { loadConfig } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./lib/db.js";
import { buildApp } from "./app.js";
import { emitLog } from "./middleware/logger.js";

async function startServer(): Promise<http.Server> {
  const config = loadConfig();

  emitLog({
    timestamp: new Date().toISOString(),
    level: "info",
    method: "SYSTEM",
    url: "/",
    message: `Connecting to database on ${config.MONGODB_URI.split("@").pop()}`
  });

  await connectDatabase({
    uri: config.MONGODB_URI
  });

  const app = buildApp(config);
  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      method: "SYSTEM",
      url: "/",
      message: `StackDoctor API listening on port ${config.PORT} (env: ${config.NODE_ENV})`
    });
  });

  const shutdown = async (signal: string) => {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      method: "SYSTEM",
      url: "/",
      message: `Received ${signal}. Shutting down gracefully...`
    });

    server.close(async () => {
      await disconnectDatabase();
      emitLog({
        timestamp: new Date().toISOString(),
        level: "info",
        method: "SYSTEM",
        url: "/",
        message: "Server and database connections closed."
      });
      process.exit(0);
    });

    // Force close after 10 seconds if hanging
    setTimeout(() => {
      emitLog({
        timestamp: new Date().toISOString(),
        level: "error",
        method: "SYSTEM",
        url: "/",
        message: "Forceful shutdown timed out after 10s."
      });
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "error",
      method: "SYSTEM",
      url: "/",
      error: `Fatal server startup failure: ${err instanceof Error ? err.message : String(err)}`
    });
    process.exit(1);
  });
}

export { startServer };
