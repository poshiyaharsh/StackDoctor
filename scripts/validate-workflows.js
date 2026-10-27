import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const wfDir = path.resolve(".github", "workflows");
let hasError = false;

console.log("======================================================");
console.log("       GitHub Actions Workflow Syntax Validation      ");
console.log("======================================================\n");

for (const file of fs.readdirSync(wfDir)) {
  if (file.endsWith(".yml") || file.endsWith(".yaml")) {
    const fullPath = path.join(wfDir, file);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const parsed = yaml.parse(content);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("YAML did not produce a root object");
      }
      if (!parsed.name || !parsed.on || !parsed.jobs) {
        throw new Error("Missing required workflow fields (name, on, or jobs)");
      }
      for (const [jobId, job] of Object.entries(parsed.jobs)) {
        if (!job || typeof job !== "object") {
          throw new Error(`Job '${jobId}' must be an object`);
        }
        if (job.steps && Array.isArray(job.steps)) {
          for (let i = 0; i < job.steps.length; i++) {
            const step = job.steps[i];
            if (step && typeof step === "object") {
              if ("cwd" in step) {
                throw new Error(`Job '${jobId}' step #${i + 1} ('${step.name || "unnamed"}') uses invalid property 'cwd'. Use 'working-directory' instead.`);
              }
            }
          }
        }
      }
      console.log(`[PASS] Valid Workflow: ${file.padEnd(25)} (jobs: ${Object.keys(parsed.jobs).join(", ")})`);
    } catch (err) {
      console.error(`[FAIL] Error in ${file}: ${err.message}`);
      hasError = true;
    }
  }
}

console.log("\n======================================================");
if (!hasError) {
  console.log("Workflow Validation: PASSED (All 4 workflows valid)");
  console.log("======================================================");
  process.exit(0);
} else {
  console.error("Workflow Validation: FAILED");
  console.log("======================================================");
  process.exit(1);
}
