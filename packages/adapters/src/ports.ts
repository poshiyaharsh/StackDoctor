import net from "node:net";
import type { Evidence } from "@stackdoctor/schemas";
import { getPlatformAdapter, type ProcessInfo } from "./platform/index.js";

export type PortStatus = "available" | "in_use" | "unknown" | "invalid";

export interface PortCheckResult {
  port: number;
  host: string;
  status: PortStatus;
  conclusive: boolean;
  processInfo?: ProcessInfo;
  evidence: Evidence[];
  error?: string;
}

/**
 * Checks whether a given host and port is available or in use.
 * Tests via non-intrusive TCP connection probe without side effects.
 * Never signals, terminates, or modifies any processes.
 * Validates port range 1-65535 safely without crashing.
 */
export async function checkPort(
  host: string,
  port: number,
  timeoutMs: number = 600
): Promise<PortCheckResult> {
  const now = new Date().toISOString();

  // Validate port range
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    const evidence: Evidence = {
      id: `ev-port-invalid-${port}`,
      kind: "config_value",
      description: `Port validation check for port ${port}`,
      observed: `Port value ${port} is not a valid TCP port number (must be an integer between 1 and 65535).`,
      source: `${host}:${port}`,
      collectedAt: now
    };

    return {
      port,
      host,
      status: "invalid",
      conclusive: true,
      evidence: [evidence],
      error: `Port ${port} is invalid (must be an integer between 1 and 65535)`
    };
  }

  return new Promise<PortCheckResult>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = async (
      status: PortStatus,
      conclusive: boolean,
      observed: string,
      error?: string,
      processInfo?: ProcessInfo
    ) => {
      if (settled) return;
      settled = true;

      try {
        socket.destroy();
      } catch {
        // Ignore
      }

      const evidence: Evidence = {
        id: `ev-port-${host}-${port}`,
        kind: "network_probe",
        description: `TCP connection probe to ${host}:${port}`,
        observed,
        source: `${host}:${port}`,
        collectedAt: now
      };

      resolve({
        port,
        host,
        status,
        conclusive,
        processInfo,
        evidence: [evidence],
        error
      });
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", async () => {
      // Port accepted connection -> actively in use
      const platform = getPlatformAdapter();
      let processInfo: ProcessInfo | undefined;
      try {
        processInfo = await platform.getProcessOnPort(port);
      } catch {
        // Process info is best-effort
      }

      const hasOwner = !!(processInfo && processInfo.pid);
      const conclusive = hasOwner;
      const processDesc = hasOwner
        ? ` Identified owning process PID ${processInfo?.pid}${processInfo?.name ? ` (${processInfo.name})` : ""}. Evidence is conclusive.`
        : " Could not determine the owning process; evidence is not conclusive.";

      await finalize(
        "in_use",
        conclusive,
        `Port ${port} on ${host} is already in use by a listening process.${processDesc}`,
        undefined,
        processInfo
      );
    });

    socket.once("timeout", async () => {
      await finalize(
        "unknown",
        false,
        `Connection attempt to ${host}:${port} timed out after ${timeoutMs}ms; unable to conclusively verify port state.`,
        "Connection timed out"
      );
    });

    socket.once("error", async (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED") {
        await finalize(
          "available",
          true,
          `Connection to ${host}:${port} was refused (ECONNREFUSED); port is available.`
        );
      } else {
        await finalize(
          "unknown",
          false,
          `Connection attempt to ${host}:${port} resulted in error: ${err.message}.`,
          err.message
        );
      }
    });

    try {
      socket.connect(port, host);
    } catch (err) {
      finalize(
        "unknown",
        false,
        `Failed to initiate socket connection: ${(err as Error).message}`,
        (err as Error).message
      );
    }
  });
}
