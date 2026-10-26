import type { PlatformAdapter, ProcessInfo } from "./types.js";
import { runCommand } from "../exec.js";

export class DarwinPlatformAdapter implements PlatformAdapter {
  readonly platform = "darwin" as const;

  getPythonExecutables(): string[] {
    return ["python3", "python"];
  }

  isCapabilitySupported(capability: string): boolean {
    const supported = new Set(["python", "node", "git", "docker", "lsof", "tcp"]);
    return supported.has(capability);
  }

  async getProcessOnPort(port: number): Promise<ProcessInfo | undefined> {
    try {
      const res = await runCommand("lsof", ["-i", `:${port}`, "-sTCP:LISTEN", "-t"]);
      if (res.exitCode === 0 && res.stdout) {
        const firstLine = res.stdout.trim().split("\n")[0];
        if (firstLine) {
          const pid = parseInt(firstLine.trim(), 10);
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
