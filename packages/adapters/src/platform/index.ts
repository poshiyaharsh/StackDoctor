import process from "node:process";
import type { PlatformAdapter, SupportedPlatform } from "./types.js";
import { WindowsPlatformAdapter } from "./win32.js";
import { LinuxPlatformAdapter } from "./linux.js";
import { DarwinPlatformAdapter } from "./darwin.js";

export * from "./types.js";
export * from "./win32.js";
export * from "./linux.js";
export * from "./darwin.js";

class UnsupportedPlatformAdapter implements PlatformAdapter {
  readonly platform = "unsupported" as const;

  getPythonExecutables(): string[] {
    return ["python3", "python"];
  }

  isCapabilitySupported(): boolean {
    return false;
  }

  async getProcessOnPort(): Promise<undefined> {
    return undefined;
  }
}

export function getPlatformAdapter(targetPlatform: string = process.platform): PlatformAdapter {
  switch (targetPlatform as SupportedPlatform) {
    case "win32":
      return new WindowsPlatformAdapter();
    case "linux":
      return new LinuxPlatformAdapter();
    case "darwin":
      return new DarwinPlatformAdapter();
    default:
      return new UnsupportedPlatformAdapter();
  }
}
