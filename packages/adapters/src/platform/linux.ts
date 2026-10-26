import type { PlatformAdapter } from "./types.js";

export class LinuxPlatformAdapter implements PlatformAdapter {
  readonly platform = "linux" as const;

  getPythonExecutables(): string[] {
    return ["python3", "python"];
  }

  isCapabilitySupported(capability: string): boolean {
    const supported = new Set(["python", "node", "git", "docker", "ss", "lsof", "tcp"]);
    return supported.has(capability);
  }
}
