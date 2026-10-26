import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface StoredConfig {
  serverUrl: string;
  token: string;
}

/**
 * Returns the directory path where StackDoctor stores CLI credentials and configuration.
 */
export function getConfigDir(): string {
  if (process.env.STACKDOCTOR_CONFIG_DIR) {
    return process.env.STACKDOCTOR_CONFIG_DIR;
  }
  return path.join(os.homedir(), ".stackdoctor");
}

/**
 * Returns the path to the config file.
 */
export function getConfigFilePath(): string {
  return path.join(getConfigDir(), "config.json");
}

/**
 * Validates a server URL. Refuses non-localhost HTTP connections for security.
 */
export function validateServerUrl(serverUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(`Invalid server URL: "${serverUrl}" is not a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Invalid server protocol "${parsed.protocol}". Must use https:// (or http:// for localhost).`
    );
  }

  if (parsed.protocol === "http:") {
    const hostname = parsed.hostname.toLowerCase();
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (!isLocal) {
      throw new Error(
        `Insecure connection refused: HTTP is only permitted for localhost/127.0.0.1. Remote servers must use HTTPS.`
      );
    }
  }

  return parsed;
}

/**
 * Saves server URL and API token with restricted file permissions (0600).
 */
export function saveConfig(config: StoredConfig): void {
  validateServerUrl(config.serverUrl);
  const configDir = getConfigDir();
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

  const filePath = getConfigFilePath();
  const content = JSON.stringify(config, null, 2);

  fs.writeFileSync(filePath, content, { encoding: "utf-8", mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows chmod may not support POSIX mode bits
  }
}

/**
 * Loads credentials from environment variables or stored config file.
 */
export function loadConfig(): StoredConfig | null {
  const envToken = process.env.STACKDOCTOR_TOKEN?.trim();
  const envServer = process.env.STACKDOCTOR_SERVER?.trim();

  const filePath = getConfigFilePath();
  let fileConfig: StoredConfig | null = null;

  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed.token === "string" && typeof parsed.serverUrl === "string") {
        fileConfig = {
          serverUrl: parsed.serverUrl.trim(),
          token: parsed.token.trim()
        };
      }
    } catch {
      // Ignore corrupt config file
    }
  }

  const serverUrl = envServer || fileConfig?.serverUrl;
  const token = envToken || fileConfig?.token;

  if (serverUrl && token) {
    return { serverUrl, token };
  }

  return null;
}

/**
 * Removes stored credentials.
 */
export function clearConfig(): void {
  const filePath = getConfigFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
