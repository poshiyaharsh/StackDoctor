import type { PlatformAdapter } from "./types.js";

export class DarwinPlatformAdapter implements PlatformAdapter {
  readonly platform = "darwin" as const;

  getPythonExecutables(): string[] {
    return ["python3", "python"];
  }

  isCapabilitySupported(capability: string): boolean {
    const supported = new Set(["python", "node", "git", "docker", "lsof", "tcp"]);
    return supported.has(capability);
  }
}
