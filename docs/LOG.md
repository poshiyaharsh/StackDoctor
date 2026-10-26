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

---

### [2026-10-26] Phase 1, Run 1D: Rule Registry (packages/rules)
- **Prompt used:** PHASE1.md > Run 1D: Rule Registry (packages/rules)
- **What was done:** Created the diagnostic Rule interface and `RuleRegistry` in `@stackdoctor/rules` with strict validation against missing fields and duplicate rule IDs. Implemented two deterministic, evidence-based rules:
  1. `NODE_DEPS_NOT_INSTALLED`: Triggered when `package.json` exists but `node_modules` is missing. Separate facts from hypotheses; tailors remediation (`npm install`, `pnpm install`, `yarn install`, etc.) based on detected lockfile.
  2. `ENV_EXAMPLE_PRESENT_NO_ENV`: Triggered when `.env.example` exists but `.env` is missing. Extracts and reports variable names only, never reading or leaking values.
  Documented both rules with observed evidence, hypotheses, and remediation in `docs/diagnostics.md`. Added comprehensive unit tests covering triggers, non-triggers, duplicate ID rejection, missing field rejection, and strict evidence separation.
- **Files created/changed:** `packages/rules/src/types.ts`, `packages/rules/src/registry.ts`, `packages/rules/src/rules/node-deps-not-installed.ts`, `packages/rules/src/rules/env-example-no-env.ts`, `packages/rules/src/index.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/node-deps.test.ts`, `packages/rules/test/env-example.test.ts`, `docs/diagnostics.md`, `docs/PHASE1.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (49/49 tests across 13 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - Duplicate rule ID is rejected: Verified
  - Both rules have trigger and non-trigger tests: Verified
  - Findings contain evidence and possibleCauses as separate fields: Verified
  - No env values are read or printed: Verified
- **Problems / errors:** None.
- **Decisions made:** Rules strictly isolate hypotheses inside `possibleCauses` and facts inside `evidence`. `extractEnvVarNames` regex ignores comment lines and isolates key identifiers before delimiters.
- **Next step:** Phase 1, Run 1E: CLI, output, README, final verification (apps/cli).
- **Status:** Done

---

### [2026-10-26] Phase 1, Run 1E: CLI, output, README, final verification (apps/cli)
- **Prompt used:** PHASE1.md > Run 1E: CLI + OUTPUT (apps/cli)
- **What was done:** Completed Phase 1 Foundation by building the CLI application in `apps/cli`:
  1. Implemented executable CLI entrypoints (`src/bin.ts`, `src/index.ts`) supporting `stackdoctor scan [path]` and flags `--json`, `--out <file>`, `--no-color`, `--version`, and `--help`.
  2. Implemented terminal output formatter (`src/format.ts`) rendering 10 distinct, structured sections in exact required order: scan summary, detected technologies, environment info, passed checks, warnings, failed checks, observed evidence (`OBSERVED`), probable causes (`POSSIBLE`), recommended next steps, and tool version.
  3. Created fixture `examples/broken-node-project` with `package.json`, `.env.example`, no `node_modules`, and no `.env`.
  4. Verified that running `stackdoctor scan` against `examples/broken-node-project` deterministically triggers both `NODE_DEPS_NOT_INSTALLED` and `ENV_EXAMPLE_PRESENT_NO_ENV` and returns exit code 1.
  5. Verified `--json` outputs schema-validated JSON matching `validateReport`.
  6. Verified `--out <file>` writes valid JSON reports to disk.
  7. Updated `README.md` and `docs/installation.md` with complete installation, usage, and output examples.
  8. Verified all 9 items in the Final Phase 1 checklist passed, and updated `docs/INDEX.md` marking Phase 1 as Done.
- **Files created/changed:** `apps/cli/package.json`, `apps/cli/src/bin.ts`, `apps/cli/src/format.ts`, `apps/cli/src/index.ts`, `apps/cli/test/cli.test.ts`, `examples/broken-node-project/package.json`, `examples/broken-node-project/.env.example`, `docs/installation.md`, `README.md`, `docs/INDEX.md`, `docs/PHASE1.md`, `docs/LOG.md`
- **Verification:**
  - `npm install`: Passed (exit code 0)
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (55/55 tests across 14 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `stackdoctor scan examples/broken-node-project`: Passed (exit code 1, prints formatted report with both sample findings)
  - `stackdoctor scan examples/broken-node-project --json`: Passed (validates against schema)
  - A deliberately failing check does not crash the run: Verified
  - Redaction tests pass: Verified
  - Scanner ignores node_modules/.git and does not follow outside symlinks: Verified
  - README matches what actually exists: Verified
- **Problems / errors:** None.
- **Decisions made:** Strict adherence to exit code standards (0 for clean, 1 for high/critical findings, 2 for tool errors).
- **Next step:** Phase 2: Diagnostic engine (adapters, rules, fixtures).
- **Status:** Done

---

### [2026-10-26] Phase 2, Run 2A: Safe exec, runtime checks, requirement detection
- **Prompt used:** PHASE2.md > Run 2A: Safe exec, runtime checks, requirement detection
- **What was done:** Built the adapters foundation and expanded rules:
  1. Implemented safe command runner `runCommand` in `packages/adapters/src/exec.ts` using `child_process.execFile` with `shell: false`, strict allowlist of executables (`node`, `npm`, `pnpm`, `yarn`, `python`, `python3`, `py`, `git`, `docker`, `docker-compose`), timeouts, output byte limits, output secret redaction, and safe missing binary handling.
  2. Implemented platform abstraction interface `PlatformAdapter` with implementations for `win32`, `linux`, and `darwin`, providing platform-specific executable detection and commands.
  3. Implemented safe runtime check adapters (`checkNodeRuntime`, `checkPackageManagerRuntime`, `checkPythonRuntime`, `checkPythonVenvStatus`, `checkGitRuntime`, `checkDockerRuntime`) that never throw and return valid evidence-backed `CheckResult` objects.
  4. Implemented explicit requirement detection (`detectNodeRequirement`, `evaluateNodeVersion`, `detectPythonRequirement`) reading `engines.node`, `.nvmrc`, `.node-version`, `pyproject.toml`, `.python-version`, and `runtime.txt`. Unparseable semver ranges issue warnings and do not fail the check.
  5. Implemented 3 new rules with full documentation in `docs/diagnostics.md` and registered in default registry: `NODE_VERSION_MISMATCH`, `LOCKFILE_MISSING`, and `PYTHON_VENV_MISSING`.
  6. Added comprehensive test suites across `packages/adapters` and `packages/rules` covering injection prevention, timeouts, buffers, allowlists, requirement evaluation, and rule preconditions/evaluation.
- **Files created/changed:** `packages/adapters/package.json`, `packages/adapters/tsconfig.json`, `packages/adapters/src/exec.ts`, `packages/adapters/src/platform/types.ts`, `packages/adapters/src/platform/win32.ts`, `packages/adapters/src/platform/linux.ts`, `packages/adapters/src/platform/darwin.ts`, `packages/adapters/src/platform/index.ts`, `packages/adapters/src/runtimes.ts`, `packages/adapters/src/requirements.ts`, `packages/adapters/src/index.ts`, `packages/adapters/test/exec.test.ts`, `packages/adapters/test/runtimes.test.ts`, `packages/adapters/test/requirements.test.ts`, `packages/rules/package.json`, `packages/rules/src/rules/node-version-mismatch.ts`, `packages/rules/src/rules/lockfile-missing.ts`, `packages/rules/src/rules/python-venv-missing.ts`, `packages/rules/src/index.ts`, `packages/rules/src/types.ts`, `packages/rules/test/phase2-rules.test.ts`, `packages/rules/test/registry.test.ts`, `apps/cli/test/cli.test.ts`, `docs/diagnostics.md`, `docs/INDEX.md`, `docs/PHASE2.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (97/97 tests across 18 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `shell: true` search: 0 occurrences found
  - Command injection resistance verified with malicious arguments: Passed
  - Process timeout terminates and marks timedOut: true: Passed
  - Output truncation caps at maxOutputBytes: Passed
  - Non-allowlisted binaries rejected: Passed
- **Problems / errors:** Node 20+ Windows `.cmd` execution restriction (`EINVAL` on shell: false) handled cleanly by resolving `npm`, `pnpm`, and `yarn` to Node entrypoints.
- **Decisions made:** Strict linear dependency model `config` -> `schemas` -> `core` -> `adapters` -> `rules` -> `apps/cli` maintained.
- **Next step:** Phase 2, Run 2B: Port and configuration checks.
- **Status:** Done

---

### [2026-10-26] Phase 2, Run 2B: Port and configuration checks
- **Prompt used:** PHASE2.md > Run 2B: Port + configuration checks
- **What was done:** Implemented port checking adapter, static configuration scanner, and 5 diagnostic rules:
  1. Built non-intrusive TCP port check adapter `checkPort` in `packages/adapters/src/ports.ts` with range validation (1-65535) and process identification via platform adapters without side effects (never terminates or signals processes).
  2. Implemented platform-specific listening process identification (`getProcessOnPort`) for Windows (`netstat -ano -p tcp`), Linux (`ss`/`lsof`), and macOS (`lsof`).
  3. Added `netstat`, `ss`, and `lsof` to `ALLOWED_EXECUTABLES` in `packages/adapters/src/exec.ts`.
  4. Implemented static configuration scanner `packages/adapters/src/config-scanner.ts`:
     - Discovers declared ports statically from `package.json` scripts, `vite.config.*`, `.env.example`, and Compose files without executing project code.
     - Compares `.env.example` vs `.env` for variable NAMES ONLY, immediately discarding secret values.
     - Detects conflicting runtime version declarations between `.nvmrc` and `engines.node`.
     - Safely parses Docker Compose YAML files (`yaml` package) and verifies that hostnames/services referenced in app configuration exist in `services:`.
     - Checks localhost backend URL reachability via non-intrusive TCP probe.
  5. Implemented 5 diagnostic rules and documented them in `docs/diagnostics.md`:
     - `PORT_IN_USE`: Flags when a declared port is busy; marks confidence as `confirmed` and evidence as conclusive only if the owning process was identified; otherwise marks confidence as `likely` and notes "not conclusive".
     - `ENV_VAR_NAMES_MISSING`: Flags missing variable names in `.env` without printing secret values.
     - `PORT_INVALID`: Flags non-numeric or out-of-range port declarations as high-severity failures.
     - `RUNTIME_DECLARATIONS_CONFLICT`: Flags conflicting `.nvmrc` and `engines.node` declarations.
     - `COMPOSE_SERVICE_NOT_FOUND`: Flags application configs referencing Compose service names not defined in `docker-compose.yml`.
  6. Added comprehensive test suites across `packages/adapters` and `packages/rules` verifying port checks, config scanning, and all 5 rules. Default rule registry now contains 10 rules.
- **Files created/changed:** `packages/adapters/package.json`, `packages/adapters/src/ports.ts`, `packages/adapters/src/config-scanner.ts`, `packages/adapters/src/platform/types.ts`, `packages/adapters/src/platform/win32.ts`, `packages/adapters/src/platform/linux.ts`, `packages/adapters/src/platform/darwin.ts`, `packages/adapters/src/platform/index.ts`, `packages/adapters/src/exec.ts`, `packages/adapters/src/index.ts`, `packages/adapters/test/ports.test.ts`, `packages/adapters/test/config-scanner.test.ts`, `packages/adapters/test/exec.test.ts`, `packages/rules/src/rules/port-in-use.ts`, `packages/rules/src/rules/env-var-names-missing.ts`, `packages/rules/src/rules/port-invalid.ts`, `packages/rules/src/rules/runtime-declarations-conflict.ts`, `packages/rules/src/rules/compose-service-not-found.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `packages/rules/test/port-rules.test.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/phase2-rules.test.ts`, `docs/diagnostics.md`, `docs/PHASE2.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (119/119 tests across 21 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `shell: true` search: 0 occurrences found
  - Port test never kills or signals a process: Verified
  - Unidentified owner => finding states "not conclusive": Verified
  - .env values never appear in output, JSON, logs, or test snapshots: Verified
  - YAML parsing is safe (no code execution): Verified
  - Invalid ports handled without a crash: Verified
- **Problems / errors:** None.
- **Decisions made:** Strict adherence to secret sanitization (values discarded immediately upon parsing). Added `netstat`, `ss`, and `lsof` strictly for non-intrusive diagnostic process queries.
- **Next step:** Phase 2, Run 2C: Database checks (MongoDB, MySQL).
- **Status:** Done

---

### [2026-10-26] Phase 2, Run 2C: Database checks (MongoDB and MySQL)
- **Prompt used:** PHASE2.md > Run 2C: Database checks (MongoDB and MySQL)
- **What was done:** Implemented staged database connectivity diagnostics and 6 database diagnostic rules:
  1. Built staged connectivity adapter `runStagedDatabaseCheck` in `packages/adapters/src/database.ts`:
     - Stage 1: DNS resolution via `dns.promises.lookup(host)`. Fails with `dns_failure`. Later stages skipped.
     - Stage 2: TCP reachability probe via `net.Socket`. Fails with `connection_refused`, `timeout`, or `unreachable_network`. Later stages skipped.
     - Stage 3: Authenticated connection check (opt-in only via `--db-url-env <VAR>`). Never reads `.env` for credentials. Read-only ping operations (`admin.ping` for MongoDB, `SELECT 1` for MySQL). Zero writes. Classifies `auth_failed`.
  2. Implemented strict secret protection: canary secret testing verified passwords and tokens never appear in any evidence, JSON, or logs.
  3. Added `--db-url-env <ENV_VAR_NAME>` flag to CLI argument parser.
  4. Implemented 6 database diagnostic rules and documented them in `docs/diagnostics.md`:
     - `MONGO_CONNECTION_REFUSED`: Identifies connection refused on MongoDB endpoint; strictly avoids claiming uninstalled.
     - `MONGO_AUTH_FAILED`: Identifies authentication rejection; strictly isolates credential issues from network configuration.
     - `MYSQL_CONNECTION_REFUSED`: Identifies connection refused on MySQL endpoint; avoids claiming uninstalled.
     - `MYSQL_AUTH_FAILED`: Identifies authentication rejection on MySQL.
     - `DB_HOST_NOT_RESOLVED`: Identifies unresolvable database hostnames.
     - `DB_CONNECTION_TIMEOUT`: Identifies TCP socket connection timeouts.
  5. Updated default rule registry to contain all 16 diagnostic rules.
  6. Added comprehensive unit tests in `packages/adapters/test/database.test.ts` and `packages/rules/test/database-rules.test.ts`.
- **Files created/changed:** `packages/adapters/package.json`, `packages/adapters/src/database.ts`, `packages/adapters/src/index.ts`, `packages/adapters/test/database.test.ts`, `packages/adapters/test/ports.test.ts`, `packages/rules/src/rules/mongo-connection-refused.ts`, `packages/rules/src/rules/mongo-auth-failed.ts`, `packages/rules/src/rules/mysql-connection-refused.ts`, `packages/rules/src/rules/mysql-auth-failed.ts`, `packages/rules/src/rules/db-host-not-resolved.ts`, `packages/rules/src/rules/db-connection-timeout.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `packages/rules/test/database-rules.test.ts`, `packages/rules/test/port-rules.test.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/phase2-rules.test.ts`, `apps/cli/src/index.ts`, `docs/diagnostics.md`, `docs/PHASE2.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (134/134 tests across 23 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `shell: true` search: 0 occurrences found
  - Refused, DNS failure, timeout, and auth failure produce four different findings: Verified
  - Canary password never appears in any output, JSON, log, or snapshot: Verified
  - No `.env` file is read for credentials: Verified
  - Stage 3 only runs with `--db-url-env`: Verified
  - No write operation exists in database code: Verified
- **Problems / errors:** Initial network glitch during package install resolved by retry.
- **Decisions made:** Database checks strictly execute read-only ping checks. Secrets sanitized before entering diagnostic report structures.
- **Next step:** Phase 2, Run 2D: Python and Django checks.
- **Status:** Done

---

### [2026-10-26] Phase 2, Run 2D: Python and Django checks
- **Prompt used:** PHASE2.md > Run 2D: Python and Django checks
- **What was done:** Implemented Python dependency inspection, Django environment analysis, and 4 new diagnostic rules:
  1. Built Python dependency analyzer `packages/adapters/src/python-deps.ts`:
     - PEP 503 package name canonicalization (`normalizePythonPackageName`).
     - Safe parsing of `requirements.txt` and `pyproject.toml` dependency declarations without code execution.
     - Installed package enumeration via `python -m pip list --format=json` through the safe runner.
     - PEP 440 compatible version satisfaction checking (`checkPythonVersionSatisfies`).
  2. Built Django diagnostics adapter `packages/adapters/src/django.ts`:
     - `isDjangoProject` strictly requiring positive detection of `django` dependency or `manage.py` (generic `requirements.txt` alone does NOT trigger Django).
     - Static settings module discovery (`discoverDjangoSettings`) from `manage.py` without executing project code.
     - Migration inspection (`checkDjangoMigrations`) strictly gated behind `--allow-project-code` flag using read-only `showmigrations --plan`. When flag is absent, check is reported as "skipped: requires running project code; use --allow-project-code".
     - Banned keyword enforcement: `migrate` appears nowhere in code, findings, or recommendations.
  3. Implemented 4 diagnostic rules and registered them in the default registry (bringing total rules to 20):
     - `PYTHON_PACKAGES_MISSING`: Identifies declared Python packages not installed in the environment.
     - `PYTHON_PACKAGE_VERSION_MISMATCH`: Identifies installed packages that fail declared version specifiers.
     - `DJANGO_SETTINGS_NOT_FOUND`: Identifies missing Django settings files referenced by `DJANGO_SETTINGS_MODULE`.
     - `DJANGO_MIGRATIONS_PENDING`: Identifies unapplied database schema changes without ever running or mentioning `migrate`.
  4. Added `stackdoctor rules` CLI command in `apps/cli/src/index.ts` supporting both human-readable terminal output and machine-readable `--json` output, as well as the `--allow-project-code` flag.
  5. Documented rules 17 through 20 in `docs/diagnostics.md`.
  6. Added comprehensive unit tests in `packages/adapters/test/python-deps.test.ts`, `packages/adapters/test/django.test.ts`, `packages/rules/test/python-django-rules.test.ts`, and `apps/cli/test/cli.test.ts`.
- **Files created/changed:** `packages/adapters/src/python-deps.ts`, `packages/adapters/src/django.ts`, `packages/adapters/src/index.ts`, `packages/adapters/test/python-deps.test.ts`, `packages/adapters/test/django.test.ts`, `packages/rules/src/rules/python-packages-missing.ts`, `packages/rules/src/rules/python-package-version-mismatch.ts`, `packages/rules/src/rules/django-settings-not-found.ts`, `packages/rules/src/rules/django-migrations-pending.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `packages/rules/test/python-django-rules.test.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/phase2-rules.test.ts`, `packages/rules/test/port-rules.test.ts`, `packages/rules/test/database-rules.test.ts`, `apps/cli/src/index.ts`, `apps/cli/test/cli.test.ts`, `docs/diagnostics.md`, `docs/PHASE2.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (155/155 tests across 26 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `shell: true` search: 0 occurrences found
  - `migrate` search: 0 occurrences in source/findings/recommendations (only in test assertions verifying absence)
  - Without `--allow-project-code`, no project code is executed: Verified
  - `requirements.txt` alone does not mean Django: Verified
  - `stackdoctor rules` lists every rule: Verified (all 20 rules listed in terminal table and JSON)
- **Problems / errors:** Unused `let` fixed with `const`; missing `source` field added to rule context types.
- **Decisions made:** Migration check strictly read-only (`showmigrations --plan`) and gated behind `--allow-project-code`.
- **Next step:** Phase 2, Run 2E: Fixtures, integration + security tests, docs, final verification.
- **Status:** Done

---

### [2026-10-26] Phase 2, Run 2E: Fixtures, integration + security tests, docs, final verification
- **Prompt used:** PHASE2.md > Run 2E: Fixtures, integration + security tests, docs, final verification
- **What was done:** Completed Phase 2 (Diagnostic Engine) with end-to-end integration, fixtures, security tests, benchmark evaluation, and cross-platform verification:
  1. Built comprehensive evaluation context collector in `apps/cli/src/collector.ts` wiring all Phase 2 adapters (safe exec, platform adapters, runtime requirements, port probes, config comparisons, compose inspection, staged database checks, python dependencies, and django diagnostics) directly into `RuleEvaluationContext`.
  2. Created 4 comprehensive reference fixtures in `examples/` with dedicated `README.md` and `expected.json` files:
     - `examples/broken-node-project`: Triggers `NODE_DEPS_NOT_INSTALLED`, `LOCKFILE_MISSING`, `NODE_VERSION_MISMATCH`, `ENV_VAR_NAMES_MISSING`, and `PORT_IN_USE`.
     - `examples/broken-django-project`: Triggers `PYTHON_VENV_MISSING`, `PYTHON_PACKAGES_MISSING`, and `DJANGO_SETTINGS_NOT_FOUND`.
     - `examples/broken-database-config`: Triggers `COMPOSE_SERVICE_NOT_FOUND`, `DB_HOST_NOT_RESOLVED`, and `PORT_INVALID`.
     - `examples/healthy-node-project`: Produces exactly 0 findings (verifying 0% false positives).
  3. Built end-to-end fixture integration test suite in `apps/cli/test/integration.test.ts` running the CLI against every fixture and asserting an exact match with `expected.json`.
  4. Implemented `npm run eval` diagnostic accuracy benchmark script in `scripts/eval.js` calculating True Positives, False Negatives, False Positives, Detection Accuracy (100.0%), and False Positive Rate (0.0%).
  5. Implemented comprehensive security test suite in `packages/core/test/security.test.ts` testing canary secret redaction, path traversal and symlink confinement, command injection immunity, malformed file resilience (invalid YAML, binary junk), output truncation, and timeout process termination.
  6. Added GitHub Actions CI matrix workflow in `.github/workflows/ci.yml` running on `ubuntu-latest`, `windows-latest`, and `macos-latest` across Node 20.x and 22.x.
  7. Documented platform support matrix in `docs/installation.md` and security/credentials policy in `docs/security.md`. Updated `README.md` with complete Phase 2 documentation and rules catalog.
  8. Verified all 10 items in the Final Phase 2 checklist passed, and marked Phase 2 as Done in `docs/INDEX.md` and `docs/PHASE2.md`.
- **Files created/changed:** `apps/cli/src/collector.ts`, `apps/cli/src/index.ts`, `apps/cli/test/cli.test.ts`, `apps/cli/test/integration.test.ts`, `packages/core/src/scanner.ts`, `packages/core/test/security.test.ts`, `examples/broken-node-project/package.json`, `examples/broken-node-project/.env`, `examples/broken-node-project/README.md`, `examples/broken-node-project/expected.json`, `examples/broken-django-project/manage.py`, `examples/broken-django-project/requirements.txt`, `examples/broken-django-project/README.md`, `examples/broken-django-project/expected.json`, `examples/broken-database-config/docker-compose.yml`, `examples/broken-database-config/.env`, `examples/broken-database-config/.env.example`, `examples/broken-database-config/README.md`, `examples/broken-database-config/expected.json`, `examples/healthy-node-project/package.json`, `examples/healthy-node-project/package-lock.json`, `examples/healthy-node-project/node_modules/express/package.json`, `examples/healthy-node-project/.env`, `examples/healthy-node-project/.env.example`, `examples/healthy-node-project/README.md`, `examples/healthy-node-project/expected.json`, `scripts/eval.js`, `package.json`, `.github/workflows/ci.yml`, `docs/installation.md`, `docs/security.md`, `README.md`, `docs/INDEX.md`, `docs/PHASE2.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (166/166 tests across 28 test suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm run eval`: Passed (100% accuracy, 0% false positives)
  - `shell: true` search: 0 occurrences found
  - `migrate` search: 0 occurrences found in source/findings
  - Every fixture produces exactly its expected rule IDs: Verified
  - `healthy-node-project` produces zero findings: Verified
  - Canary secrets never appear in outputs or snapshots: Verified
  - Port checks never kill processes: Verified
  - Project code never executed without `--allow-project-code`: Verified
- **Problems / errors:** Local port 8080 in use handled by using high port for healthy fixture; compose port mapping on host removed in broken database fixture to test container network references without host port collision.
- **Decisions made:** Integrated `npm run eval` into CI pipeline to continuously track diagnostic detection accuracy and false positive rates.
- **Next step:** Phase 3: Web platform (dashboard, API, optional report upload).
- **Status:** Done

---

### [2026-10-26] Phase 3, Run 3A: API Foundation (apps/api)
- **Prompt used:** PHASE3.md > Run 3A: API scaffold, MongoDB, authentication
- **What was done:** Scaffolded `apps/api` Express + TypeScript application with MongoDB via Mongoose, strict security middleware, session management, CSRF defense, and authentication endpoints:
  1. Configured `@stackdoctor/api` package with TypeScript project references, Zod-based fail-fast configuration parsing (`NODE_ENV`, `PORT`, `MONGODB_URI`, `SESSION_SECRET`, `CORS_ORIGIN`, `COOKIE_SECURE`), and `apps/api/.env.example`.
  2. Implemented Mongoose database connection lifecycle in `apps/api/src/lib/db.ts` with connection pooling, timeouts, and graceful shutdown handling.
  3. Implemented full security middleware suite: Helmet headers, strict CORS origin matching, 1MB JSON body size limit, `x-request-id` tracing, structured JSON logging with text redaction (never logging request bodies, cookies, or secrets), sliding-window rate limiting on auth endpoints with generic enumeration protection, timing-safe CSRF validation on state-changing cookie requests, and centralized error handling suppressing stack traces in production.
  4. Implemented User model in `apps/api/src/models/user.ts` with normalized unique lowercase email, bcrypt (cost 12) password hashing, and safe object serialization suppressing `passwordHash`.
  5. Implemented versioned `/api/v1/auth` endpoints (`/register`, `/login`, `/logout`, `/me`, `/csrf`) and `/api/v1/health` DB status check. Sessions regenerate on login to eliminate session fixation.
  6. Added comprehensive unit and integration tests in `apps/api/test/config.test.ts` (3 tests) and `apps/api/test/auth.test.ts` (12 tests using `mongodb-memory-server` and `supertest`) covering registration, login, logout, authentication state, duplicate email rejection, generic 401 on bad password and missing email (no enumeration), CSRF enforcement, and 404 routing.
- **Files created/changed:** `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/.env.example`, `apps/api/src/config.ts`, `apps/api/src/lib/db.ts`, `apps/api/src/middleware/request-id.ts`, `apps/api/src/middleware/logger.ts`, `apps/api/src/middleware/error-handler.ts`, `apps/api/src/middleware/rate-limiter.ts`, `apps/api/src/middleware/csrf.ts`, `apps/api/src/models/user.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/test/config.test.ts`, `apps/api/test/auth.test.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `docs/PHASE3.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (181/181 tests across 30 suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - API starts only with valid config; fails fast otherwise: Verified
  - Passwords hashed (bcrypt cost 12), never logged: Verified
  - Login/register rate limited with generic errors (no user enumeration): Verified
  - State-changing cookie requests require CSRF protection: Verified
  - No stack traces leaked in production mode: Verified
- **Problems / errors:** ESLint namespace lint rule on Express.Request augmentation resolved with scoped eslint-disable comment. Mongoose Document generic methods typing resolved cleanly with interface extensions.
- **Decisions made:** Selected `bcryptjs` with cost factor 12 for portable, cross-platform password hashing. Session regeneration on login prevents session fixation. CSRF token validated with timing-safe comparison on state-changing cookie requests while allowing Bearer tokens. Centralized error handling suppresses error stacks in non-development environments.
- **Next step:** Phase 3, Run 3B: Projects, diagnostic runs, rules endpoints, authorization.
- **Status:** Done






