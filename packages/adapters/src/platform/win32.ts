import type { PlatformAdapter } from "./types.js";

export class WindowsPlatformAdapter implements PlatformAdapter {
  readonly platform = "win32" as const;

  getPythonExecutables(): string[] {
    // Windows supports python, py launcher, and python3
    return ["py", "python", "python3"];
  }

  isCapabilitySupported(capability: string): boolean {
    const supported = new Set(["python", "node", "git", "docker", "netstat", "tcp"]);
    return supported.has(capability);
  }
}
