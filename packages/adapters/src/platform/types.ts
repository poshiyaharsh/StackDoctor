export type SupportedPlatform = "win32" | "linux" | "darwin" | "unsupported";

export interface ProcessInfo {
  pid?: number;
  name?: string;
}

export interface PlatformAdapter {
  readonly platform: SupportedPlatform;
  getPythonExecutables(): string[];
  isCapabilitySupported(capability: string): boolean;
  getProcessOnPort(port: number): Promise<ProcessInfo | undefined>;
}
