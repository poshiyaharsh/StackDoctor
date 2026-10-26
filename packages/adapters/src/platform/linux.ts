import type { PlatformAdapter, ProcessInfo } from "./types.js";
import { runCommand } from "../exec.js";

export class LinuxPlatformAdapter implements PlatformAdapter {
  readonly platform = "linux" as const;

  getPythonExecutables(): string[] {
    return ["python3", "python"];
  }

  isCapabilitySupported(capability: string): boolean {
    const supported = new Set(["python", "node", "git", "docker", "ss", "lsof", "tcp"]);
    return supported.has(capability);
  }

  async getProcessOnPort(port: number): Promise<ProcessInfo | undefined> {
    // 1. Try ss -tulpn
    try {
      const ssRes = await runCommand("ss", ["-tulpn"]);
      if (ssRes.exitCode === 0 && ssRes.stdout) {
        // Look for line containing :port and pid=1234
        const lines = ssRes.stdout.split("\n");
        const portPattern = new RegExp(`:${port}\\s+`);
        for (const line of lines) {
          if (portPattern.test(line)) {
            const pidMatch = line.match(/pid=(\d+)/);
            if (pidMatch && pidMatch[1]) {
              const pid = parseInt(pidMatch[1], 10);
              const nameMatch = line.match(/users:\(\("([^"]+)"/);
              return { pid, name: nameMatch ? nameMatch[1] : undefined };
            }
          }
        }
      }
    } catch {
      // Continue to lsof
    }

    // 2. Try lsof -i :port -sTCP:LISTEN -t
    try {
      const lsofRes = await runCommand("lsof", ["-i", `:${port}`, "-sTCP:LISTEN", "-t"]);
      if (lsofRes.exitCode === 0 && lsofRes.stdout) {
        const firstLine = lsofRes.stdout.trim().split("\n")[0];
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
