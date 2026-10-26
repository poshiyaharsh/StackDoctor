export type SupportedPlatform = "win32" | "linux" | "darwin" | "unsupported";

export interface PlatformAdapter {
  readonly platform: SupportedPlatform;
  getPythonExecutables(): string[];
  isCapabilitySupported(capability: string): boolean;
}
