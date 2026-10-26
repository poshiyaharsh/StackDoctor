import type { PlatformAdapter, ProcessInfo } from "./types.js";
import { runCommand } from "../exec.js";

export class WindowsPlatformAdapter implements PlatformAdapter {
  readonly platform = "win32" as const;

  getPythonExecutables(): string[] {
    return ["py", "python", "python3"];
  }

  isCapabilitySupported(capability: string): boolean {
    const supported = new Set(["python", "node", "git", "docker", "netstat", "tcp"]);
    return supported.has(capability);
  }

  async getProcessOnPort(port: number): Promise<ProcessInfo | undefined> {
    try {
      const res = await runCommand("netstat", ["-ano", "-p", "tcp"]);
      if (res.exitCode !== 0 || !res.stdout) {
        return undefined;
      }

      // Format: TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234
      const lines = res.stdout.split(/\r?\n/);
      const portRegex = new RegExp(`[:.]${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, "i");

      for (const line of lines) {
        const match = line.match(portRegex);
        if (match && match[1]) {
          const pid = parseInt(match[1], 10);
          if (!isNaN(pid) && pid > 0) {
            return { pid };
          }
        }
      }
    } catch {
      // Safe fallback
    }

    return undefined;
  }
}
