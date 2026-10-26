import { spawnSync } from "node:child_process";
import process from "node:process";

/**
 * Attempts a cross-platform copy to the system clipboard without external dependencies.
 * Returns true if copied successfully, false otherwise.
 */
export function copyToClipboard(text: string): boolean {
  if (!text) return false;

  try {
    if (process.platform === "win32") {
      const res = spawnSync("clip", {
        input: text,
        encoding: "utf-8",
        stdio: ["pipe", "ignore", "ignore"],
        windowsHide: true
      });
      return res.status === 0;
    }

    if (process.platform === "darwin") {
      const res = spawnSync("pbcopy", {
        input: text,
        encoding: "utf-8",
        stdio: ["pipe", "ignore", "ignore"]
      });
      return res.status === 0;
    }

    if (process.platform === "linux") {
      let res = spawnSync("xclip", ["-selection", "clipboard"], {
        input: text,
        encoding: "utf-8",
        stdio: ["pipe", "ignore", "ignore"]
      });
      if (res.status === 0) return true;

      res = spawnSync("wl-copy", {
        input: text,
        encoding: "utf-8",
        stdio: ["pipe", "ignore", "ignore"]
      });
      return res.status === 0;
    }

    return false;
  } catch {
    return false;
  }
}
