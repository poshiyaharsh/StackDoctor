import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const cliDir = path.resolve(rootDir, "apps", "cli");
const outDir = path.resolve(cliDir, "dist");

console.log("[build-cli] Bundling stackdoctor CLI for distribution...");

// Plugin to resolve @stackdoctor/* to internal source files while keeping third-party deps external
const internalResolverPlugin = {
  name: "internal-resolver",
  setup(build) {
    build.onResolve({ filter: /^@stackdoctor\// }, (args) => {
      const pkg = args.path.replace(/^@stackdoctor\//, "");
      if (pkg === "config") {
        return { path: "config-virtual", namespace: "stackdoctor-config" };
      }
      const target = path.join(rootDir, "packages", pkg, "src", "index.ts");
      if (fs.existsSync(target)) {
        return { path: target };
      }
      return null;
    });

    build.onLoad({ filter: /.*/, namespace: "stackdoctor-config" }, () => {
      return {
        contents: 'export const CONFIG_PACKAGE = "@stackdoctor/config";',
        loader: "ts"
      };
    });
  }
};

await esbuild.build({
  entryPoints: {
    bin: path.join(cliDir, "src", "bin.ts"),
    index: path.join(cliDir, "src", "index.ts")
  },
  outdir: outDir,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: "#!/usr/bin/env node\n"
  },
  plugins: [internalResolverPlugin],
  packages: "external",
  sourcemap: false
});

// Remove duplicate shebang if banner added one to bin.js
const binPath = path.join(outDir, "bin.js");
if (fs.existsSync(binPath)) {
  let content = fs.readFileSync(binPath, "utf-8");
  content = content.replace(/^(?:#!\/usr\/bin\/env node\r?\n)+/, "#!/usr/bin/env node\n");
  fs.writeFileSync(binPath, content, { mode: 0o755 });
}

// Remove any lingering source map files from dist
if (fs.existsSync(outDir)) {
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith(".map")) {
      fs.unlinkSync(path.join(outDir, f));
    }
  }
}

console.log("[build-cli] Bundle complete. Checking output...");
const indexContent = fs.readFileSync(path.join(outDir, "index.js"), "utf-8");
console.log("[build-cli] Contains '@stackdoctor/' import:", indexContent.includes("from \"@stackdoctor"));
console.log("[build-cli] Contains '@eslint/js' import:", indexContent.includes("@eslint/js"));
console.log(`[build-cli] index.js size: ${(indexContent.length / 1024).toFixed(1)} KB`);
console.log(`[build-cli] bin.js size: ${(fs.readFileSync(binPath, "utf-8").length / 1024).toFixed(1)} KB`);
