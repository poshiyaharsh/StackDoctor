import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parsePhpVersion,
  checkPhpVersionSatisfies,
  detectPhpRequirement,
  inspectComposerDependencies,
  inspectLaravelConfig,
  detectPhpRuntime
} from "../src/php.js";

describe("PHP Adapter Unit Tests", () => {
  it("parses PHP version from standard cli output strings", () => {
    expect(
      parsePhpVersion("PHP 8.2.14 (cli) (built: Dec 21 2023 20:19:50) (NTS)")
    ).toBe("8.2.14");
    expect(
      parsePhpVersion("PHP 8.1.0-dev (cli) (built: Oct 10 2021 11:22:33)")
    ).toBe("8.1.0");
    expect(parsePhpVersion("8.3.1")).toBe("8.3.1");
    expect(parsePhpVersion("")).toBe(null);
  });

  it("checks whether installed version satisfies composer constraints", () => {
    expect(checkPhpVersionSatisfies("8.2.14", "^8.1")).toBe(true);
    expect(checkPhpVersionSatisfies("8.0.2", "^8.1")).toBe(false);
    expect(checkPhpVersionSatisfies("9.0.0", "^8.1 || ^8.2")).toBe(false);
    expect(checkPhpVersionSatisfies("8.2.0", "^8.1 || ^8.2")).toBe(true);
    expect(checkPhpVersionSatisfies("8.1.5", ">=8.0 <8.2")).toBe(true);
  });

  it("detects PHP requirements from composer.json and .php-version", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stk-php-req-"));
    try {
      expect(await detectPhpRequirement(tmp)).toBe(null);

      fs.writeFileSync(
        path.join(tmp, "composer.json"),
        JSON.stringify({
          require: {
            php: "^8.2",
            "guzzlehttp/guzzle": "^7.8"
          }
        })
      );
      const req = await detectPhpRequirement(tmp);
      expect(req).toEqual({
        requiredVersion: "^8.2",
        sourceFile: "composer.json"
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("inspects composer dependencies and missing vendor directory", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stk-composer-deps-"));
    try {
      fs.writeFileSync(
        path.join(tmp, "composer.json"),
        JSON.stringify({
          require: {
            php: "^8.2",
            "monolog/monolog": "^3.0"
          }
        })
      );

      const status1 = await inspectComposerDependencies(tmp);
      expect(status1.hasComposerJson).toBe(true);
      expect(status1.declaredDepsCount).toBe(1);
      expect(status1.hasVendor).toBe(false);
      expect(status1.missingVendor).toBe(true);

      const vendorDir = path.join(tmp, "vendor");
      fs.mkdirSync(vendorDir);
      fs.writeFileSync(path.join(vendorDir, "autoload.php"), "<?php");

      const status2 = await inspectComposerDependencies(tmp);
      expect(status2.hasVendor).toBe(true);
      expect(status2.hasAutoload).toBe(true);
      expect(status2.missingVendor).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("inspects Laravel configuration and APP_KEY presence in .env", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "stk-laravel-cfg-"));
    try {
      fs.writeFileSync(path.join(tmp, "artisan"), "#!/usr/bin/env php");
      fs.writeFileSync(
        path.join(tmp, "composer.json"),
        JSON.stringify({
          require: {
            "laravel/framework": "^10.0"
          }
        })
      );

      // Without .env
      const status1 = await inspectLaravelConfig(tmp);
      expect(status1.isLaravel).toBe(true);
      expect(status1.keyIsMissingOrEmpty).toBe(true);

      // With empty APP_KEY in .env
      fs.writeFileSync(path.join(tmp, ".env"), "APP_NAME=Laravel\nAPP_KEY=\n");
      const status2 = await inspectLaravelConfig(tmp);
      expect(status2.hasAppKey).toBe(false);
      expect(status2.keyIsMissingOrEmpty).toBe(true);

      // With valid APP_KEY
      fs.writeFileSync(
        path.join(tmp, ".env"),
        "APP_NAME=Laravel\nAPP_KEY=base64:dGVzdGluZ2tleWZvcmxhcmF2ZWwxMjM0NTY3ODkwMTI=\n"
      );
      const status3 = await inspectLaravelConfig(tmp);
      expect(status3.hasAppKey).toBe(true);
      expect(status3.keyIsMissingOrEmpty).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("handles mocked detectPhpRuntime", async () => {
    const mockExecFound = async () => ({
      exitCode: 0,
      stdout: "PHP 8.2.14 (cli) (built: Dec 21 2023 20:19:50) (NTS)",
      stderr: "",
      timedOut: false,
      truncated: false,
      notFound: false
    });

    const runtime1 = await detectPhpRuntime(mockExecFound as any);
    expect(runtime1.available).toBe(true);
    expect(runtime1.version).toBe("8.2.14");

    const mockExecNotFound = async () => ({
      exitCode: null,
      stdout: "",
      stderr: "command not found: php",
      timedOut: false,
      truncated: false,
      notFound: true
    });

    const runtime2 = await detectPhpRuntime(mockExecNotFound as any);
    expect(runtime2.available).toBe(false);
    expect(runtime2.version).toBe(null);
  });
});
