# StackDoctor: Master Log

Newest entries at the bottom. One entry per work session or Antigravity run.

## Entry template

```
### [YYYY-MM-DD] Phase X, short title
- **Prompt used:** PHASES.md > Phase X (or "custom fix prompt", paste it below)
- **What was done:**
- **Files created/changed:**
- **Verification:** (checklist items passed / failed)
- **Problems / errors:** (paste exact error text)
- **Decisions made:**
- **Next step:**
- **Status:** In progress | Needs fixes | Done
```

---

### [2026-10-26] Setup: spec reviewed, project files created
- **Prompt used:** none
- **What was done:** Full product spec reviewed. Created `INDEX.md`, `PHASES.md`, `LOG.md`. Agreed to build phase by phase in Antigravity with no manual coding.
- **Files created/changed:** INDEX.md, PHASES.md, LOG.md
- **Verification:** n/a
- **Problems / errors:** none
- **Decisions made:** CLI first; AI and dashboard only after the CLI works; log everything here.
- **Next step:** Run Phase 1 prompt in Antigravity.
- **Status:** Done

---

### [2026-10-26] Phase 1, Run 1A: Monorepo Scaffold
- **Prompt used:** PHASE1_RUNS.md > Run 1A: Monorepo Scaffold Only
- **What was done:** Initialized npm workspaces monorepo (`apps/*`, `packages/*`). Configured TypeScript project references with `tsconfig.base.json`, shared ESLint configuration in `packages/config`, and root `vitest.config.ts`. Created skeleton packages `@stackdoctor/config`, `@stackdoctor/schemas`, `@stackdoctor/rules`, `@stackdoctor/adapters`, `@stackdoctor/core`, and CLI app `stackdoctor`. Added passing tests to all 6 packages using cross-package `@stackdoctor/*` imports. Created empty docs, examples, and scripts.
- **Files created/changed:** README.md, LICENSE, .gitignore, .editorconfig, tsconfig.base.json, tsconfig.json, package.json, eslint.config.mjs, vitest.config.ts, docs/architecture.md, docs/diagnostics.md, docs/security.md, docs/installation.md, docs/contributing.md, examples/.gitkeep, scripts/.gitkeep, apps/cli (package.json, tsconfig.json, src/index.ts, test/index.test.ts), packages/config (package.json, tsconfig.package.json, tsconfig.json, src/index.ts, src/eslint.ts, test/index.test.ts), packages/schemas (package.json, tsconfig.json, src/index.ts, test/index.test.ts), packages/rules (package.json, tsconfig.json, src/index.ts, test/index.test.ts), packages/adapters (package.json, tsconfig.json, src/index.ts, test/index.test.ts), packages/core (package.json, tsconfig.json, src/index.ts, test/index.test.ts), docs/LOG.md
- **Verification:**
  - `npm install`: Passed (exit code 0)
  - `npm run build`: Passed (exit code 0)
  - `npm run lint`: Passed (exit code 0)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (6/6 tests passed)
  - Package imports via `@stackdoctor/...`: Verified
  - No diagnostic logic present: Verified
- **Problems / errors:** TS6059 rootDir path resolution from extended tsconfig resolved by configuring rootDir/outDir in package tsconfigs. ESLint no-undef on globals resolved by configuring Node + ES2021 globals in eslint configs.
- **Decisions made:** TypeScript project references (`tsc -b`) chosen for fast, dependency-ordered builds and cross-workspace typechecking.
- **Next step:** Phase 1, Run 1B: Shared Schemas (packages/schemas only).
- **Status:** Done

---

### [2026-10-26] Phase 1, Run 1B: Shared Schemas
- **Prompt used:** PHASE1.md > Run 1B: Shared Schemas (packages/schemas only)
- **What was done:** Created comprehensive Zod schemas and inferred TypeScript types in `@stackdoctor/schemas`: Severity, Confidence, CheckStatus, ReportStatus, VerificationStatus, Evidence, TechnologyDetection, CheckResult, Recommendation, Finding, Report, and RuleMetadata. Implemented helper `validateReport(unknown)` and JSON schema exporter `getReportJsonSchema()`. Generated `docs/report.schema.json`. Added unit tests verifying valid reports, missing fields rejection, oversized evidence rejection, unknown severity rejection, and strict separation between evidence facts and possible causes hypotheses. Verified cross-package schema import in `@stackdoctor/rules`.
- **Files created/changed:** `packages/schemas/package.json`, `packages/schemas/src/enums.ts`, `packages/schemas/src/evidence.ts`, `packages/schemas/src/checks.ts`, `packages/schemas/src/findings.ts`, `packages/schemas/src/rules.ts`, `packages/schemas/src/report.ts`, `packages/schemas/src/json-schema.ts`, `packages/schemas/src/index.ts`, `packages/schemas/test/report.test.ts`, `packages/rules/test/index.test.ts`, `scripts/generate-schema.mjs`, `docs/report.schema.json`, `docs/PHASE1.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `node ./scripts/generate-schema.mjs`: Passed (generated `docs/report.schema.json`)
  - `npm test`: Passed (12/12 tests across 7 suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `docs/report.schema.json` is generated: Verified
  - Evidence and possibleCauses are separate fields: Verified
  - Other packages import types from `@stackdoctor/schemas`: Verified
- **Problems / errors:** Missing `CONFIG_SOURCE` re-export fixed in schemas `index.ts`. Replaced `any` assertions with `unknown` casting in tests to ensure clean linting.
- **Decisions made:** Applied 10,000 character maximum limit for evidence `observed` string; 1,000 items maximum limit for report `findings`.
- **Next step:** Phase 1, Run 1C: Core Engine (redaction, scanner, lifecycle).
- **Status:** Done

---

### [2026-10-26] Phase 1, Run 1C: Core Engine (redaction, scanner, lifecycle)
- **Prompt used:** PHASE1.md > Run 1C: Core Engine (packages/core)
- **What was done:** Built the three core modules in `@stackdoctor/core`:
  1. `src/redact.ts`: Redaction utility masking passwords, tokens, API keys, Authorization headers, AWS keys, JWT tokens, private key blocks, and URL credentials while preserving normal non-secret text. Implemented `redactEnv` to mask values while keeping variable names.
  2. `src/scanner.ts`: Safe project scanner with directory validation, traversal checks, symlink escape protection, ignoring node_modules/.git/dist/etc. Accurately detects Node.js, Vite, Next.js, Django (`manage.py` and/or django in manifest; requirements.txt alone never flags Django), Python, lockfiles (npm/pnpm/yarn/bun), Docker, Docker Compose, and `.env.example` existence without ever reading `.env`. Identifies monorepo subprojects.
  3. `src/logger.ts` & `src/runner.ts`: Resilient diagnostic lifecycle runner that validates directories, runs project scanner, selects applicable rules, executes checks with per-check timeouts, records errors without crashing the run, supports cancellation via AbortSignal, and builds schema-validated Reports.
- **Files created/changed:** `packages/core/src/redact.ts`, `packages/core/src/scanner.ts`, `packages/core/src/logger.ts`, `packages/core/src/runner.ts`, `packages/core/src/index.ts`, `packages/core/test/redact.test.ts`, `packages/core/test/scanner.test.ts`, `packages/core/test/runner.test.ts`, `docs/PHASE1.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (34/34 tests across 10 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - Redaction masks all sample secrets and leaves normal text alone: Verified
  - requirements.txt alone does not produce "Django": Verified
  - Symlink-escape and path-traversal tests pass: Verified
  - A throwing check and a timing-out check both leave the run completed: Verified
  - Output report passes validateReport: Verified
- **Problems / errors:** Fixed `CORE_DEPENDENCIES` export in `packages/core/src/index.ts` to ensure compatibility with package assertion tests.
- **Decisions made:** Scanner checks `fs.realpath` against project directory to reject symlinks escaping project bounds. Runner protects checks with `Promise.race` timeouts and redacts error messages.
- **Next step:** Phase 1, Run 1D: Rule Registry (packages/rules).
- **Status:** Done
