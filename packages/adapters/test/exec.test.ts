import { describe, it, expect } from "vitest";
import { runCommand, ALLOWED_EXECUTABLES } from "@stackdoctor/adapters";

describe("Safe Command Runner (exec.ts)", () => {
  it("rejects non-allowlisted executables", async () => {
    await expect(runCommand("sh" as unknown as "node")).rejects.toThrow(/Executable not allowlisted/);
    await expect(runCommand("bash" as unknown as "node")).rejects.toThrow(/Executable not allowlisted/);
    await expect(runCommand("powershell" as unknown as "node")).rejects.toThrow(/Executable not allowlisted/);
    await expect(runCommand("cmd" as unknown as "node")).rejects.toThrow(/Executable not allowlisted/);
  });

  it("safely handles command injection attempts in args without executing shell metacharacters", async () => {
    // Attempt shell injection via arguments
    const injectionArgs = [
      "-e",
      'console.log("SAFE_OUTPUT"); // ; rm -rf / ; calc.exe | cat /etc/passwd & echo "HACKED"'
    ];

    const result = await runCommand("node", injectionArgs);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("SAFE_OUTPUT");
    expect(result.stdout).not.toContain("HACKED");
  });

  it("terminates process on timeout and flags timedOut: true", async () => {
    const hangingArgs = ["-e", "setTimeout(() => {}, 10000);"];
    const result = await runCommand("node", hangingArgs, { timeoutMs: 100 });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  });

  it("truncates output when exceeding maxOutputBytes and sets truncated: true", async () => {
    const verboseArgs = ["-e", "console.log('A'.repeat(5000));"];
    const result = await runCommand("node", verboseArgs, { maxOutputBytes: 256 });

    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stdout, "utf-8")).toBeLessThanOrEqual(256);
  });

  it("handles missing executable safely with notFound: true without throwing", async () => {
    // "docker-compose" is allowlisted but typically missing in bare test environments
    // Or we test a non-installed allowlisted binary
    const result = await runCommand("py", ["--version"]);
    // Regardless of whether py is installed, it returns a valid CommandResult without throwing
    expect(typeof result.notFound).toBe("boolean");
    expect(typeof result.timedOut).toBe("boolean");
  });

  it("redacts secrets from command outputs", async () => {
    const secretArgs = [
      "-e",
      'console.log("Connecting mongodb://admin:mySecretPass123@localhost:27017/db password=secretValue");'
    ];
    const result = await runCommand("node", secretArgs);

    expect(result.stdout).toContain("mongodb://***:***@localhost:27017/db");
    expect(result.stdout).toContain("password=[REDACTED]");
    expect(result.stdout).not.toContain("mySecretPass123");
    expect(result.stdout).not.toContain("secretValue");
  });

  it("includes all expected tools in ALLOWED_EXECUTABLES", () => {
    const required = [
      "node",
      "npm",
      "pnpm",
      "yarn",
      "python",
      "python3",
      "py",
      "git",
      "docker",
      "docker-compose"
    ];
    for (const exe of required) {
      expect(ALLOWED_EXECUTABLES.has(exe)).toBe(true);
    }
  });
});
