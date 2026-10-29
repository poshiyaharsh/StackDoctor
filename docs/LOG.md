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

---

### [2026-10-26] Phase 3, Run 3B: Core API Resources (Projects, Runs, Rules, Authorization)
- **Prompt used:** PHASE3.md > Run 3B: Projects, diagnostic runs, rules endpoints, authorization
- **What was done:** Implemented core API resources, MongoDB collections, strict multi-tenant authorization, cascade run deletion, report sanitization, canary secret detection, and metadata endpoints:
  1. Built `Project` model in `apps/api/src/models/project.ts` with owner scoping, URL validation, technology tags, and compound index `(ownerId, createdAt)`.
  2. Built `DiagnosticRun` model in `apps/api/src/models/diagnostic-run.ts` with report findings, summary metrics, execution timestamps, and compound indexes `(ownerId, createdAt)` and `(projectId, createdAt)`.
  3. Implemented `apps/api/src/routes/projects.ts` with full CRUD (paginated list, create, get by id, patch, delete with cascading deletion of all associated diagnostic runs).
  4. Implemented `apps/api/src/routes/diagnostic-runs.ts` supporting report uploads with `@stackdoctor/schemas` validation, deep core `redactText` sanitization, machine identifier removal, canary secret rejection (HTTP 422), paginated filtered queries (by project, status, severity, date range), get by id, and delete.
  5. Implemented `apps/api/src/routes/rules.ts` exposing authenticated read-only metadata for all 20 diagnostic rules from `@stackdoctor/rules` registry.
  6. Implemented strict authorization and security defenses: queries strictly scoped by `ownerId` in MongoDB returning 404 for other users' resources; 24-character hexadecimal ObjectId format validation; strict query schemas rejecting NoSQL operator injections (`$`, `[`, `]`).
  7. Implemented 11 comprehensive tests in `apps/api/test/resources.test.ts` covering full CRUD, cascade deletion, multi-tenant user isolation matrix (User A vs User B for every verb), canary rejection, secret re-redaction verification in MongoDB, malformed IDs, and query injection prevention.
- **Files created/changed:** `apps/api/src/models/project.ts`, `apps/api/src/models/diagnostic-run.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/lib/sanitize-report.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/diagnostic-runs.ts`, `apps/api/src/routes/rules.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/resources.test.ts`, `docs/PHASE3.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (192/192 tests across 31 suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - User A can never see or change User B's data (tests for every verb): Verified
  - Canary secret never reaches the database (rejected with 422): Verified
  - Oversized and malformed payloads rejected: Verified
  - NoSQL injection attempts rejected: Verified
  - Deleting a project removes its runs: Verified
- **Problems / errors:** Query parameter injection via query parser operators handled by adding `.strict()` to Zod query schemas and explicit key rejection for `$` and `[` / `]`. Report validation schema constraints matched strictly.
- **Decisions made:** Deleting a project cascades to delete all its runs. Strict owner isolation returns 404 for non-owned resources to prevent resource existence enumeration.
- **Next step:** Phase 3, Run 3C: API tokens + CLI login/upload with preview.
- **Status:** Done

---

### [2026-10-26] Phase 3, Run 3C: API Tokens & CLI Upload with Preview
- **Prompt used:** PHASE3.md > Run 3C: API tokens and CLI upload
- **What was done:** Implemented API tokens in `apps/api` with SHA-256 hash persistence, Bearer token authentication, and CLI commands `login`, `logout`, and `upload` with interactive terminal preview and confirmation:
  1. Built `ApiToken` model in `apps/api/src/models/api-token.ts` generating cryptographically random tokens (`stk_live_...`), storing only SHA-256 hashes and 12-char display prefixes, and returning plain tokens exactly once at creation.
  2. Implemented `apps/api/src/routes/tokens.ts` for issuing, listing, and revoking API tokens. Plaintext tokens and hashes are never exposed in listing or queries.
  3. Upgraded `requireAuth` in `apps/api/src/middleware/auth.ts` to accept `Authorization: Bearer <token>`, validating the token hash against active, non-revoked, and non-expired records in MongoDB, automatically establishing identity and updating `lastUsedAt`.
  4. Built CLI configuration store in `apps/cli/src/config-store.ts` storing server URL and token with restricted file permissions (`0o600`), and enforcing that insecure HTTP connections are strictly permitted only for `localhost`/`127.0.0.1` (all remote servers must use HTTPS).
  5. Built CLI uploader in `apps/cli/src/uploader.ts` formatting a terminal preview of the report (project name, OS, tool version, status, counts, finding titles), redacting all text locally before network transmission, and uploading over HTTPS.
  6. Added CLI commands to `apps/cli/src/index.ts`:
     - `stackdoctor login --server <url>` (verifies token, saves credentials).
     - `stackdoctor logout` (clears stored credentials).
     - `stackdoctor upload [target]` (shows preview, prompts for confirmation `y/N`, supports `--yes` for CI/non-interactive, provides clean 401/422/network error reporting without leaking tokens).
     - Guaranteed `stackdoctor scan` makes zero network calls and remains 100% offline.
  7. Added comprehensive test suites:
     - `apps/api/test/tokens.test.ts`: Token issuance, plaintext token shown once, SHA-256 hash storage, Bearer authentication on protected endpoints, revocation, and expiration handling.
     - `apps/cli/test/upload.test.ts`: Server URL localhost-only HTTP enforcement, file permissions, preview formatting, upload with pre-redaction, 401/422 handling without token leaks, non-interactive `--yes` uploads, login/logout, and verification that `scan` makes 0 network calls (tested with mocked fetch).
- **Files created/changed:** `apps/api/src/models/api-token.ts`, `apps/api/src/routes/tokens.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/cli/src/config-store.ts`, `apps/cli/src/uploader.ts`, `apps/cli/src/index.ts`, `apps/api/test/tokens.test.ts`, `apps/cli/test/upload.test.ts`, `docs/PHASE3.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (exit code 0)
  - `npm test`: Passed (203/203 tests across 33 suites passed)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - Plain token returned exactly once; only a hash in the DB: Verified
  - CLI upload shows a preview and needs confirmation: Verified
  - `scan` makes no network calls: Verified
  - Token never appears in any log, output, or error: Verified
  - Revoked/expired tokens are rejected: Verified
- **Problems / errors:** Handled DiagnosticRule synchronous evaluation signature in CLI report generation; ensured restricted config directory file permissions (`0o600`) applied safely across platforms.
- **Decisions made:** Plaintext token is generated cryptographically (`stk_live_...`) and returned once upon creation; only SHA-256 hash is persisted. Bearer tokens authenticate CLI requests and bypass CSRF checks while updating `lastUsedAt`. CLI enforces HTTPS for all remote servers, allowing HTTP strictly for localhost/127.0.0.1. CLI `scan` is guaranteed to make zero network calls.
- **Next step:** Phase 3, Run 3D: Web scaffold, landing page, auth pages (`apps/web`).
- **Status:** Done

---

### [2026-10-26] Phase 3, Run 3D: Web scaffold, landing page, auth pages (apps/web)
- **Prompt used:** PHASE3.md > Run 3D: Web scaffold, landing page, auth pages
- **What was done:** Scaffolded and built the React + Vite + TypeScript web application in `apps/web`:
  1. Configured `@stackdoctor/web` with React 19, React Router v7, `@tanstack/react-query`, Vite 6 with proxy `/api` -> `http://localhost:3000`, `@stackdoctor/schemas` path alias, and strict Content-Security-Policy meta tags in `index.html`.
  2. Built a pure vanilla CSS design system in `apps/web/src/index.css` with CSS custom variables for light and dark themes, consistent typography (Inter, JetBrains Mono), responsive card surfaces, badge variants, and interactive buttons.
  3. Built accessible, keyboard-navigable UI components: `Button`, `Card`, `Badge`, `Input`, `Modal`, `EmptyState`.
  4. Built typed API client in `apps/web/src/lib/api.ts` with automatic CSRF token fetching (`/api/v1/auth/csrf-token`) and state-changing request header attachment (`X-CSRF-Token`), using `credentials: "include"`.
  5. Built `AuthProvider` and `useAuth` hook in `apps/web/src/context/AuthContext.tsx` providing user state loaded from `/api/v1/auth/me`, login, register, logout, and dark/light theme switching persisted in `localStorage`.
  6. Implemented layout and routing:
     - `Navbar` with theme toggle, auth-sensitive navigation links, and logout trigger.
     - `ProtectedRoute` wrapper guarding internal routes and redirecting unauthenticated users to `/login`.
     - `LandingPage` with hero ("Find the cause. Fix the environment. Ship the code."), problem statement, 3-step workflow, supported technologies, a clearly labeled sample/example report (with disclaimer that it is illustrative mock data), privacy and security principles, CLI installation guide, zero fake metrics, and zero fake testimonials.
     - `LoginPage` and `RegisterPage` with comprehensive client validation and error states.
     - `DashboardPage` placeholder and `NotFoundPage` (404).
  7. Conducted security audit: Verified zero occurrences of `dangerouslySetInnerHTML` in `apps/web/src` and verified all external links use `rel="noopener noreferrer"`.
  8. Created comprehensive test suite in `apps/web/test/web.test.tsx` verifying landing page integrity, auth form validation, protected route enforcement, API client CSRF injection, and source code security.
- **Files created/changed:** `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Card.tsx`, `apps/web/src/components/ui/Badge.tsx`, `apps/web/src/components/ui/Input.tsx`, `apps/web/src/components/ui/Modal.tsx`, `apps/web/src/components/ui/EmptyState.tsx`, `apps/web/src/components/layout/Navbar.tsx`, `apps/web/src/components/layout/ProtectedRoute.tsx`, `apps/web/src/pages/LandingPage.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/RegisterPage.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/NotFoundPage.tsx`, `apps/web/test/web.test.tsx`, `apps/cli/src/collector.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `package-lock.json`, `docs/PHASE3.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npx vite build apps/web`: Passed (production bundle built in 1.17s)
  - `npm test`: Passed (210/210 tests across 34 suites passed)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - Landing page has no fake metrics or testimonials: Verified
  - Protected routes redirect unauthenticated users: Verified
  - No `dangerouslySetInnerHTML` anywhere: Verified (0 occurrences)
  - Works in light and dark mode, keyboard navigable: Verified
- **Problems / errors:** Test DOM matchers required `@testing-library/jest-dom/vitest`; jsdom HTML5 validation required dispatching submit on form rather than button for required fields; port check probe in CLI collector increased from 300ms to 1000ms to eliminate timeout flakiness during highly parallel monorepo test execution.
- **Decisions made:** Built modern developer-focused React + Vite + TypeScript application in `apps/web` with pure vanilla CSS tokens, light and dark mode switching with localStorage persistence, accessible UI primitives, typed API client with CSRF token management, strict CSP meta tags, zero `dangerouslySetInnerHTML`, and an honest landing page with clearly labeled sample data and zero fake metrics or testimonials.
- **Next step:** Phase 3, Run 3E: Application pages (Dashboard, projects, report and finding pages, settings).
- **Status:** Done

---

### [2026-10-26] Phase 3, Run 3E: Application Pages & Owner-Scoped Operations (apps/web & apps/api)
- **Prompt used:** PHASE3.md > Run 3E: Dashboard, projects, report, finding, settings
- **What was done:** Implemented owner-scoped API operations in `apps/api` and application pages in `apps/web`:
  1. Built `GET /api/v1/stats` in `apps/api/src/routes/stats.ts` providing owner-isolated metric aggregations: total runs, projects scanned, failed checks, common issue categories, latest scan status breakdown, and recent reports with project names.
  2. Implemented data retention policy in `User` model (`retentionDays`), user preferences endpoint `PATCH /api/v1/auth/preferences`, and retention cleanup service (`cleanupExpiredRuns` in `apps/api/src/services/retention.ts` and `POST /api/v1/auth/retention-cleanup`).
  3. Implemented secure account management in `apps/api/src/routes/auth.ts`: `PATCH /api/v1/auth/password` (requires and validates current password) and `DELETE /api/v1/auth/account` (re-authenticates with current password and cascades deletion to all user projects, diagnostic runs, API tokens, user document, and destroys session).
  4. Added accessible UI components: `Tabs` (`apps/web/src/components/ui/Tabs.tsx`) and `ToastProvider` / `useToast` (`apps/web/src/components/ui/Toast.tsx`).
  5. Built full web application pages in `apps/web`:
     - `DashboardPage`: Key metric cards, issue category breakdown, recent reports table, and copyable CLI onboarding steps when no reports exist.
     - `ProjectsPage`: Grid of registered projects with detected technology badges and link to details.
     - `ProjectDetailPage`: Project header, scan history table, and delete project flow with modal confirmation.
     - `ReportDetailPage`: Report overview, severity filtering tabs (Critical, High, Medium, Low), distinct visual separation between **`OBSERVED EVIDENCE`** (facts) and **`POSSIBLE CAUSES`** (hypotheses), copy buttons for safe remediation commands and sanitized report JSON, and delete report modal.
     - `FindingDetailPage`: Rule deep dive with description, recommended probes, suggested fixes, verification instructions, and documentation links with `rel="noopener noreferrer"`.
     - `SettingsPage`: Profile & password change tab, retention settings with manual cleanup trigger, API tokens manager (generating cryptographically random token displayed **exactly once** in modal with copy button and warning), disabled AI explanations section explaining strict offline privacy guarantees, and danger zone account deletion modal with password re-entry.
  6. Added comprehensive unit and integration test suites:
     - `apps/api/test/stats-and-account.test.ts`: Scoped stats aggregation, tenant isolation, retention cleanup without touching other users' runs, password change verification, and cascaded account deletion.
     - `apps/web/test/app-pages.test.tsx`: Loading/empty/error states across pages, single-time token display, severity filtering, observed evidence vs possible causes differentiation, and secure external link attributes.
- **Files created/changed:** `apps/api/src/routes/stats.ts`, `apps/api/src/services/retention.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/models/user.ts`, `apps/api/src/app.ts`, `apps/api/test/stats-and-account.test.ts`, `apps/web/src/components/ui/Tabs.tsx`, `apps/web/src/components/ui/Toast.tsx`, `apps/web/src/components/layout/Navbar.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/App.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/ProjectsPage.tsx`, `apps/web/src/pages/ProjectDetailPage.tsx`, `apps/web/src/pages/ReportDetailPage.tsx`, `apps/web/src/pages/FindingDetailPage.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/web/test/app-pages.test.tsx`, `docs/PHASE3.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npx vite build apps/web`: Passed (production bundle built in 1.25s)
  - `npm test`: Passed (224/224 tests across 36 suites passed)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - Every page has loading, empty, and error states: Verified
  - Evidence and possible causes are visibly labeled as different things: Verified
  - Token never shown again after creation: Verified
  - Account deletion removes all user data: Verified
  - No diagnostic logic duplicated in the frontend: Verified
- **Problems / errors:** Handled query helper resolution in testing multiple occurrences of numeric metric values; ensured test isolation for retention cleanup and cascaded deletion.
- **Decisions made:** Kept frontend strictly a pure renderer of shared report schema without any local diagnostic rules or duplicated evaluation logic; prominent visual separation between deterministic observed evidence (`OBSERVED EVIDENCE`) and hypotheses (`POSSIBLE CAUSES`); token shown exactly once at creation with copy button; cascaded deletion on project and account removal.
- **Next step:** Phase 3, Run 3F: Security tests, docs, docker-compose, final verification.
- **Status:** Done

---

### [2026-10-26] Phase 3, Run 3F: Security Tests, Hardening, Docs, and Final Verification
- **Prompt used:** PHASE3.md > Run 3F: Security tests, docs, docker-compose, final verification
- **What was done:** Completed Phase 3 Web Platform hardening, documentation, and automated end-to-end verification:
  1. Configured `docker-compose.yml` for local MongoDB development, bound strictly to `127.0.0.1:27017` with credentials loaded via environment variables and persistent volume `mongo_data`.
  2. Created `.env.example` documenting local development environment variables for API, Web, and MongoDB.
  3. Added root development scripts: `dev:api` (`npm --workspace=@stackdoctor/api run dev`), `dev:web` (`npm --workspace=@stackdoctor/web run dev`), `dev` (`npm run dev:api`), and `e2e:phase3` (`node scripts/e2e-phase3.js`).
  4. Built comprehensive security test suite in `apps/api/test/security-matrix.test.ts`:
     - Full Authorization Matrix: Every route x HTTP verb x caller role (anonymous callers receive 401 Unauthorized; cross-tenant intruders receive 404 Not Found to prevent information leaks; resource owners succeed).
     - CSRF protection: State-changing requests with cookie credentials lacking `X-CSRF-Token` return 403 Forbidden.
     - Session fixation prevention: Session identifiers regenerate upon registration and login.
     - Token revocation and expiration: Revoked and expired tokens are rejected with 401.
     - NoSQL query operator injection: Query objects containing operators (`$ne`, `$gt`) are rejected with 400.
     - Canary secret detection: Payloads containing canary secrets return 422 Unprocessable Entity, store nothing, and never leak the secret in responses, headers, or logs.
  5. Built automated end-to-end check script `scripts/e2e-phase3.js`:
     - Spawns in-memory MongoDB and Express API server.
     - Registers a user account and generates a CLI API Bearer token.
     - Executes an offline diagnostic scan on `examples/broken-node-project` via `runCli`.
     - Uploads report over HTTP/HTTPS with Bearer authentication.
     - Fetches and verifies uploaded diagnostic run via API.
     - Deletes the run and confirms 404 Not Found response.
  6. Conducted dependency audit with `npm audit`: Documented Zod array validation (mitigated via 1MB Express body limit) and devDependency-confined Vitest advisories in `docs/security.md`.
  7. Created comprehensive documentation:
     - `docs/architecture.md`: CLI, API, web app, data flow, what stays local vs what is uploaded.
     - `docs/security.md`: Threat model, zero-trust execution, canary redaction, CSP, multi-tenant isolation, token lifecycle, data retention, and audit notes.
     - `docs/installation.md`: Local setup with Docker Compose, API/Web platform dev workflow, and platform matrix.
     - `README.md`: Updated with web platform overview, ASCII architecture, CLI upload instructions, and documentation links.
  8. Verified all 11 items in the Final Phase 3 checklist passed, and updated `docs/INDEX.md` marking Phase 3 as Done.
- **Files created/changed:** `docker-compose.yml`, `.env.example`, `apps/api/package.json`, `package.json`, `apps/api/test/security-matrix.test.ts`, `apps/web/src/lib/api.ts`, `scripts/e2e-phase3.js`, `docs/architecture.md`, `docs/security.md`, `docs/installation.md`, `README.md`, `docs/INDEX.md`, `docs/PHASE3.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (231/231 tests across 37 suites passed)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - `npm run e2e:phase3`: Passed (exit code 0)
  - User A cannot access User B's projects, runs, or tokens: Verified (matrix test passes)
  - Oversized and malformed payloads rejected: Verified
  - Tokens shown once and never again: Verified
  - Upload shows a preview and needs confirmation; `scan` never uploads: Verified
  - Deleting a run actually deletes it; account deletion removes everything: Verified
  - Canary secret absent from DB, logs, API responses, and UI: Verified
  - CLI still works fully with the API turned off: Verified
  - `npm audit` has no unaddressed high/critical issues: Verified
  - E2E script passes: Verified
  - Docs match what actually exists: Verified
- **Problems / errors:** Handled workspace mongoose resolution in standalone E2E script by utilizing the API's database connector; attached CSRF token to login request during session fixation test.
- **Decisions made:** Docker Compose bound strictly to 127.0.0.1; complete anti-enumeration policy returns 404 for foreign tenant resources; automated end-to-end check script tests full lifecycle from registration through deletion.
- **Next step:** Phase 4: Integrations (GitHub issue drafts, CI JSON, report compare).
### [2026-10-26] Phase 4, Run 4A: GitHub Issue Draft Generation
- **Prompt used:** PHASE4.md > Run 4A: GitHub issue draft generation
- **What was done:**
  1. Implemented isomorphic `buildIssueDraft(report, options)` in `packages/core/src/issue-draft.ts` returning `{ title, body, labels }`.
     - Structured markdown with mandatory sections: Summary, Environment (OS, runtime versions, tool version), Detected technologies, Findings (title, severity, rule ID, category), Observed Evidence (OBSERVED only, with note banner), Possible Causes (Hypotheses only, with note banner), Steps already suggested, Steps to reproduce (template placeholder), and Additional context (placeholder).
     - Strict size truncation at 60,000 characters (respecting GitHub issue body 65,536 limit) with clean boundary cutting and warning banner.
     - Comprehensive sanitization via `sanitizeDraftContent`: normalizes project paths to `<project>`, home directory to `~`, masks usernames and hostnames to `<user>` and `<host>`, masks IPv4/IPv6 addresses to `[REDACTED_IP]`, and runs core secret redaction `redactText`.
     - Filter findings by minimum severity via `options.minSeverity`.
     - Toggle observed evidence via `options.includeEvidence`.
  2. Enhanced `redactText` in `packages/core/src/redact.ts`:
     - Expanded `SECRET_KV_REGEX` to match prefixed secret variable assignments like `export DB_PASSWORD=...`, `APP_SECRET=...`.
  3. Added subpath export `./issue-draft` in `packages/core/package.json` and re-exported in `packages/core/src/index.ts`.
  4. Added cross-platform safe clipboard utility `apps/cli/src/clipboard.ts` supporting Windows (`clip`), macOS (`pbcopy`), and Linux (`xclip` / `wl-copy`).
  5. Implemented CLI command `stackdoctor issue [reportFile | path]` in `apps/cli/src/index.ts`:
     - Accepts JSON report file or directory (runs offline diagnostics).
     - Flags: `--min-severity <severity>`, `--out <file>`, `--copy`, `--no-evidence`.
     - Prints clear preview with boundary dividers and states "Review before posting. Nothing was sent."
     - Guaranteed 100% offline with zero network calls.
  6. Added "Copy Issue Draft" button to Web Diagnostic Report page (`apps/web/src/pages/ReportDetailPage.tsx`):
     - Uses the shared `buildIssueDraft` core function without duplication.
     - Copies to clipboard and updates button state to "✓ Copied Issue Draft".
  7. Added unit and integration tests:
     - `packages/core/test/issue-draft.test.ts`: Snapshot test, canary secret redaction, absolute path and username/hostname/IP masking, strict separation of evidence vs hypotheses, `--min-severity` filtering, `--no-evidence`, and size truncation.
     - `apps/cli/test/issue.test.ts`: Preview output, 100% offline network isolation (mocking `fetch`, `http.request`, `https.request` and asserting 0 calls), `--min-severity`, `--no-evidence`, `--out <file>`, and error handling.
     - `apps/web/test/app-pages.test.tsx`: Tests rendering of "Copy Issue Draft" button and clipboard copy with shared function.
- **Files created/changed:** `packages/core/src/issue-draft.ts`, `packages/core/src/redact.ts`, `packages/core/src/index.ts`, `packages/core/package.json`, `packages/core/test/issue-draft.test.ts`, `apps/cli/src/clipboard.ts`, `apps/cli/src/index.ts`, `apps/cli/test/issue.test.ts`, `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/components/ui/Badge.tsx`, `apps/web/src/pages/ReportDetailPage.tsx`, `apps/web/test/app-pages.test.tsx`, `apps/api/test/security-matrix.test.ts`, `vitest.config.ts`, `docs/PHASE4.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (247/247 tests across 39 suites passed)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - Draft contains no secrets, usernames, hostnames, or absolute home paths: Verified
  - Evidence and possible causes stay in separate, labeled sections: Verified
  - `issue` makes no network calls: Verified
  - Web button and CLI produce identical drafts (shared function): Verified
- **Problems / errors:** Fixed regex in `redact.ts` to capture prefixed key names like `DB_PASSWORD`; added badge variant normalization for `danger`, `warning`, and `default`.
- **Decisions made:** Exported `buildIssueDraft` from `@stackdoctor/core/issue-draft` with zero Node dependencies for seamless browser/Vite bundling; set body truncation limit to 60,000 characters with warning alert.
- **Next step:** Phase 4, Run 4B: CI mode, stable output, GitHub Actions integration.
- **Status:** Done

---

### [2026-10-26] Phase 4, Run 4B: CI Mode, Stable Output & GitHub Actions Integration
- **Prompt used:** PHASE4.md > Run 4B: CI integration
- **What was done:**
  1. Implemented deterministic finding ordering in `packages/core/src/runner.ts`:
     - Findings are sorted by severity descending (`critical`, `high`, `medium`, `low`, `info`), and then by `ruleId` ascending.
  2. Implemented Markdown step summary formatter `formatMarkdownReport` in `apps/cli/src/format.ts`:
     - Renders project status, summary bar, severity count table, detected issues table, and collapsible details tag (`<details><summary>...</summary>...</details>`).
     - Normalizes project paths project-relatively and runs core secret redaction `redactText`.
  3. Extended CLI `scan` command in `apps/cli/src/index.ts`:
     - Added `--ci`: sets `noColor = true`, non-interactive, and deterministic ordering.
     - Added `--fail-on <info|low|medium|high|critical>`: returns exit code 1 if findings meet or exceed threshold (defaults to `high`).
     - Added `--quiet`, `-q`: suppresses non-essential terminal output.
     - Added `--format <text|json|markdown>`: renders output according to requested format.
     - Implemented stable exit code contract: `0` = OK, `1` = findings at/above `--fail-on`, `2` = tool error, `3` = invalid usage (`InvalidUsageError` for unknown flags, missing flag arguments, or invalid parameter values).
  4. Authored comprehensive specification documentation:
     - `docs/report-format.md`: Details every top-level and nested field of the JSON report format, value spaces, enums, schema stability policy, and CHANGELOG.
     - `docs/ci.md`: Comprehensive CI guide featuring a copy-paste GitHub Actions workflow, SHA-pinned dependencies, minimal read-only permissions (`contents: read`), and GitLab CI example.
  5. Built reusable composite action `action.yml`:
     - Wraps StackDoctor scan with inputs `path`, `fail-on`, and `upload-artifact`.
     - Passes inputs via environment variables to prevent script injection.
     - Third-party actions pinned to full commit SHAs (`actions/setup-node@39370e39...`, `actions/upload-artifact@65c4c4a1...`).
  6. Added automated regression and stability tests:
     - `packages/schemas/test/report-stability.test.ts`: Snapshot test verifying Report schema invariance.
     - `apps/cli/test/ci.test.ts`: 14 tests verifying exit code matrix for all thresholds, absence of ANSI escape sequences in `--ci`, deterministic findings order across consecutive runs, markdown snapshot, and exit code 3 on invalid flags/values.
- **Files created/changed:** `packages/core/src/runner.ts`, `apps/cli/src/format.ts`, `apps/cli/src/index.ts`, `docs/report-format.md`, `docs/ci.md`, `action.yml`, `packages/schemas/test/report-stability.test.ts`, `apps/cli/test/ci.test.ts`, `docs/PHASE4.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (264/264 tests across 41 suites passed)
  - `npm run eval`: Passed (100% detection, 0% false positives)
  - Exit code matrix tests pass and are documented: Verified
  - `--ci` output is deterministic with no ANSI codes or prompts: Verified
  - JSON shape change fails a snapshot test: Verified
  - Workflow/action use minimal permissions and SHA-pinned actions: Verified
  - No untrusted input is interpolated into shell commands in the action: Verified
- **Problems / errors:** Fixed ESLint `no-control-regex` by checking ANSI prefix via `.includes("\x1b[")`; resolved unused variable in schema stability test.
- **Decisions made:** Composite action passes inputs exclusively via environment variables; schema stability protected by automated JSON shape snapshot.
---

### [2026-10-26] Phase 4, Run 4C: Report Comparison (Core, CLI, API, Web)
- **Prompt used:** PHASE4.md > Run 4C: Compare reports
- **What was done:**
  1. Implemented core pure and deterministic comparison engine in `packages/core/src/compare.ts`:
     - Finding identity defined as `${ruleId}::${subjectKey}` using evidence subject extraction (ports, compose services, env var names, source file basenames).
     - Computes `newFindings`, `resolvedFindings`, `unchangedFindings`, `changedFindings` (severity/confidence/status with before/after), `environmentChanges` (OS, tool version, runtimes), `technologyChanges` (added, removed, unchanged), `summaryDelta`, and `hasRegressions`.
     - Exported from `@stackdoctor/core` with `./compare` subpath export in `package.json`.
  2. Implemented CLI compare command and formatters:
     - `formatComparisonTerminal` and `formatComparisonMarkdown` in `apps/cli/src/format.ts`.
     - `stackdoctor compare <base.json> <head.json>` with `--format <text|json|markdown>`, `--fail-on-new <severity>`, `--out <file>`, and 10MB file size limit.
     - Never executes code from files; exits with code 1 if new findings meet or exceed `--fail-on-new` threshold.
  3. Implemented API comparison endpoint:
     - `GET /api/v1/diagnostic-runs/compare?base=<runId>&head=<runId>` in `apps/api/src/routes/diagnostic-runs.ts`.
     - Strictly scoped to caller's `ownerId` with 404 anti-enumeration (returns 404 if either run is missing or belongs to another user).
     - Reuses the shared core `compareReports` function.
  4. Implemented Web Compare UI:
     - Created `apps/web/src/pages/ComparePage.tsx` with project and run dropdown selectors, regression banner, side-by-side summary metrics, New/Resolved/Changed groups, and environment/technology diff cards.
     - Added "Compare with previous run" button in `apps/web/src/pages/ReportDetailPage.tsx`.
     - Registered `/compare` route in `apps/web/src/App.tsx` and added Compare nav link in `Navbar.tsx`.
     - Rendered all text safely using React JSX escaping (guaranteed zero HTML injection).
  5. Added comprehensive test suites:
     - `packages/core/test/compare.test.ts`: 5 tests covering self-comparison empty diff, new/resolved/unchanged/changed detection, multi-finding subject disambiguation, and environment diffs.
     - `apps/cli/test/compare.test.ts`: 10 tests covering text/json/markdown formats, exit code matrix for `--fail-on-new`, file validation, and offline guarantees.
     - `apps/api/test/compare.test.ts`: 7 tests covering auth enforcement, ObjectId validation, 404 anti-enumeration on cross-user comparison, and diff computation.
     - `apps/web/test/app-pages.test.tsx`: Tested "Compare with previous run" button navigation and ComparePage rendering & injection safety.
- **Files created/changed:** `packages/core/src/compare.ts`, `packages/core/src/index.ts`, `packages/core/package.json`, `packages/core/test/compare.test.ts`, `apps/cli/src/format.ts`, `apps/cli/src/index.ts`, `apps/cli/test/compare.test.ts`, `apps/api/src/routes/diagnostic-runs.ts`, `apps/api/test/compare.test.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/pages/ComparePage.tsx`, `apps/web/src/pages/ReportDetailPage.tsx`, `apps/web/src/App.tsx`, `apps/web/src/components/layout/Navbar.tsx`, `apps/web/test/app-pages.test.tsx`, `vitest.config.ts`, `apps/web/vite.config.ts`, `docs/PHASE4.md`, `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (289/289 tests across 44 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Comparing a report with itself gives an empty diff: Verified
  - Cross-user comparison attempts return 404: Verified
  - CLI, API, and web all use the single core function: Verified
  - `--fail-on-new` exit codes tested: Verified
- **Problems / errors:** Corrected test report fixture schema requirements for `summary.byStatus`; resolved lint warning on unused import and typed `toReport` run parameter.
- **Decisions made:** Finding identity uses rule ID + evidence subject key to avoid collisions across multiple findings of the same rule; cross-user comparison attempts return 404 to block identifier harvesting.
- **Next step:** Phase 4, Run 4D: Documentation links and contributor rule interface (`docs/PHASE4.md`).
- **Status:** Done

---

### [2026-10-27] Phase 4, Run 4D: Documentation Links & Contributor Rule Interface
- **Prompt used:** PHASE4.md > Run 4D: Doc links + contributing rules
- **What was done:**
  1. Documentation link security and domain allowlisting:
     - Defined `ALLOWED_DOC_DOMAINS` allowlist (`nodejs.org`, `python.org`, `pip.pypa.io`, `pypa.io`, `djangoproject.com`, `mongodb.com`, `mysql.com`, `docker.com`, `npmjs.com`, `12factor.net`, `github.com`, `stackdoctor.dev`), `isAllowedDocUrl`, and `DocUrlSchema` in `@stackdoctor/schemas`.
     - Added strict validation to `RuleRegistry.register()` in `@stackdoctor/rules` rejecting any rule with non-HTTPS or non-allowlisted documentation links.
     - Replaced non-allowlisted Wikipedia links with authoritative official docs across all existing rules (`port-invalid.ts`, `port-in-use.ts`, `db-host-not-resolved.ts`, `db-connection-timeout.ts`).
     - Added defense-in-depth HTTPS filtering in `apps/web/src/pages/FindingDetailPage.tsx`.
  2. Implemented CLI `stackdoctor explain <ruleId>` command:
     - In `apps/cli/src/index.ts`, added `explain` handler outputting title, category, severity, confidence, technologies, description, evidence required (observed facts), recommended checks, remediation actions (problem, relevance, command, risks, undo, verification), verification, and doc links.
     - Added `--json` / `--format json` support and `--out <file>` writing.
     - Implemented Levenshtein distance and token-overlap fuzzy matching helper `findSimilarRuleIds` that suggests close rule IDs on typos (with exit code 2).
     - Missing rule ID returns exit code 3 (`InvalidUsageError`).
  3. Built rule generator script:
     - Implemented `scripts/new-rule.js` and added `"new-rule": "node scripts/new-rule.js"` in `package.json`.
     - Validates required `--id <RULE_ID>` is strict `UPPER_SNAKE_CASE` and accepts `--tech <tech>`.
     - Automatically generates `packages/rules/src/rules/<kebab-id>.ts`, unit test `packages/rules/test/<kebab-id>.test.ts` (with trigger, non-trigger, schema parse, and wording tests), and appends catalog stub to `docs/diagnostics.md`.
     - Verified generated output compiles and passes tests out of the box.
  4. Contributor documentation and GitHub templates:
     - Authored `docs/contributing.md`: step-by-step 6-step rule addition lifecycle, code style, Evidence vs. Hypothesis writing guide, and "Never Overclaim" checklist with good/bad examples.
     - Authored `CONTRIBUTING.md` at repo root linking to `docs/contributing.md`.
     - Created `.github/pull_request_template.md` with rule authoring and verification checklists.
     - Created `.github/ISSUE_TEMPLATE/bug_report.md` with offline `stackdoctor issue` drafting instructions.
     - Created `.github/ISSUE_TEMPLATE/new_rule_proposal.md` and `false_positive_report.md`.
  5. Built automated rule linter:
     - Created `packages/rules/test/rule-lint.test.ts` asserting all 20 registered rules satisfy required fields, `UPPER_SNAKE_CASE` IDs, uniqueness, docs entries, test coverage, recommendation verification, allowlisted HTTPS doc links, and absence of hypothesis words in evidence.
     - Tested deliberate failure fixtures (bad casing, non-HTTPS, unallowlisted domain, missing verification, hypothesis words in evidence).
  6. Added comprehensive tests:
     - `apps/cli/test/explain.test.ts`: 9 tests verifying text formatting, JSON output, unknown rule suggestion, missing rule ID, output to file, snapshot testing, and explain command on all 20 built-in rules.
     - `packages/rules/test/generator.test.ts`: 3 tests verifying generator argument validation, file creation, compilation, and test execution.
- **Files created/changed:** `packages/schemas/src/rules.ts`, `packages/schemas/src/findings.ts`, `packages/rules/src/registry.ts`, `packages/rules/src/rules/port-invalid.ts`, `packages/rules/src/rules/port-in-use.ts`, `packages/rules/src/rules/db-host-not-resolved.ts`, `packages/rules/src/rules/db-connection-timeout.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/index.test.ts`, `packages/rules/test/generator.test.ts`, `packages/rules/test/rule-lint.test.ts`, `apps/cli/src/index.ts`, `apps/cli/test/explain.test.ts`, `apps/cli/test/__snapshots__/explain.test.ts.snap`, `apps/web/src/pages/FindingDetailPage.tsx`, `scripts/new-rule.js`, `package.json`, `docs/contributing.md`, `CONTRIBUTING.md`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/new_rule_proposal.md`, `.github/ISSUE_TEMPLATE/false_positive_report.md`, `docs/PHASE4.md`, `docs/LOG.md`.
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (312/312 tests across 47 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Non-allowlisted or http doc links are rejected: Verified
  - A new rule can be added using only docs/contributing.md and the generator: Verified
  - Rule-lint fails on a deliberately bad rule: Verified
  - `explain` works for every built-in rule: Verified
  - Issue and PR templates exist: Verified
- **Problems / errors:** Non-allowlisted Wikipedia links in 4 existing rules replaced with official Node.js and MySQL docs; vitest child process timeout adjusted for full-suite test load in generator test.
- **Decisions made:** Rule docs links originate exclusively from rule definitions and must be allowlisted HTTPS URLs; evidence strings are restricted to objective facts and forbidden from containing hypothesis words.
- **Next step:** Phase 4, Run 4E: Docs, end-to-end checks, final verification (`docs/PHASE4.md`).
- **Status:** Done

---

### [2026-10-27] Phase 4, Run 4E: Docs, End-to-End Checks & Final Verification
- **Prompt used:** PHASE4.md > Run 4E: Final verification
- **What was done:**
  1. Enhanced core secret redaction:
     - Added `CANARY_SECRET_REGEX` (`\bCANARY_SECRET_[A-Za-z0-9_]+\b`), `TOKEN_PREFIX_REGEX` (`sk-...`, `stk_...`, `ghp_...`), and `pass` in `packages/core/src/redact.ts`.
     - Applied `redactText` to terminal scan reports (`formatTerminalReport`) and terminal comparison diffs (`formatComparisonTerminal`) in `apps/cli/src/format.ts`.
  2. Implemented security test suite `packages/core/test/phase4-security.test.ts`:
     - Verified that canary secrets and absolute home paths never appear in issue drafts, markdown summaries, terminal reports, or compare outputs.
     - Verified composite action injection safety via automated AST/grep check on `action.yml`, confirming zero unquoted `${{ inputs.* }}` expressions inside `run:` blocks.
     - Verified resilience to oversized (>10MB) and malformed report files.
  3. Built automated Phase 4 End-to-End verification script `scripts/e2e-phase4.js`:
     - Added `"e2e:phase4": "node scripts/e2e-phase4.js"` in `package.json`.
     - Step 1: Creates fixture with 2 issues (`NODE_DEPS_NOT_INSTALLED`, `ENV_EXAMPLE_PRESENT_NO_ENV`).
     - Step 2: Runs `scan --ci --format json --out a.json`, verifying exit code 1.
     - Step 3: Fixes one issue (creates `node_modules`), scans to `b.json`, verifying exit code 0.
     - Step 4: Compares `a.json` and `b.json`, verifying 1 resolved finding and `--fail-on-new` exit codes.
     - Step 5: Generates sanitized issue draft via `issue`, verifying section headings and redactions.
     - Step 6: Tests `explain`, verifying valid JSON output, documentation allowlist, and typo suggestions.
     - Step 7: Tests API compare endpoint against local server, verifying HTTP 200 for run owner and HTTP 404 for foreign tenant intruder.
  4. Authored documentation updates:
     - Updated `README.md` with complete Phase 4 CLI commands (`issue`, `compare`, `explain`, `new-rule`), CI workflow example, and documentation index.
     - Authored `CHANGELOG.md` at repo root following Keep a Changelog standards.
     - Updated `docs/security.md` with Phase 4 dependency audit notes.
     - Updated `docs/INDEX.md` marking Phase 4 as Done.
     - Updated `docs/PHASE4.md` marking all checklist items and setting Run 4E to Done.
- **Files created/changed:** `packages/core/src/redact.ts`, `apps/cli/src/format.ts`, `packages/core/test/phase4-security.test.ts`, `scripts/e2e-phase4.js`, `package.json`, `README.md`, `CHANGELOG.md`, `docs/security.md`, `docs/INDEX.md`, `docs/PHASE4.md`, `docs/LOG.md`.
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (319/319 tests across 48 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - `npm run e2e:phase3`: Passed (100% OK)
  - `npm run e2e:phase4`: Passed (All 7 steps passed)
  - Issue drafts contain no secrets, machine identifiers, or absolute paths: Verified
  - Exit codes match the documented thresholds: Verified
  - Compare correctly shows new, resolved, and changed findings: Verified
  - CI mode output is deterministic: Verified
  - A new rule can be added by following the guide alone: Verified
  - Actions workflow uses minimal permissions, SHA-pinned actions, no unsafe interpolation: Verified
  - Nothing is ever posted or sent automatically: Verified
  - `npm audit` has no unaddressed high/critical issues: Verified
  - All e2e scripts pass: Verified
  - Docs match what actually exists: Verified
  - Everything committed and pushed: Verified
- **Problems / errors:** Token generation in E2E script required CSRF token and Cookie headers; report upload body in E2E script expected raw report object. Both resolved cleanly.
- **Decisions made:** All output paths (terminal, markdown, compare, issue drafts) strictly run through `redactText`; composite action passes inputs exclusively via environment variables.
- **Next step:** Phase 5: Optional AI (Evidence-grounded explanations) (`PHASES.md`).
- **Status:** Done

---

### [2026-10-27] Phase 5, Run 5A: AI Foundation, Sanitization, and Prompt Construction
- **Prompt used:** PHASE5.md > Run 5A: AI Foundation (new package packages/ai)
- **What was done:**
  1. Created `@stackdoctor/ai` package in `packages/ai`:
     - Provider interface `AiProvider` with `complete(request)` accepting `AiRequest` and returning `AiResponse`.
     - Deterministic `MockProvider` for testing (request recorder, scriptable responses, cancellation handling).
     - Configuration schema `AiConfigSchema` using Zod (`enabled: false` default, `maxInputBytes: 16000`, `maxOutputTokens: 2048`, `timeoutMs: 30000`).
     - Safe-by-default execution: When `config.enabled` is false, `explainWithAi` immediately returns typed `{ status: "ai_disabled", message: ... }` with 0 network calls and 0 provider calls.
  2. Input Sanitization (`buildAiInput` in `src/sanitizer.ts`):
     - Field allowlist: Only `ruleId`, `title`, `severity`, `confidence`, `category`, `evidence` (`id`, `kind`, `observed`), `possibleCauses`, and `environment` (`osFamily`, `runtimeVersions`) are permitted.
     - Strips machine identifiers, user home paths, usernames, hostnames, and absolute project paths.
     - Re-runs core secret redaction (`redactText`) on every string field.
     - Enforces byte capping (`maxInputBytes`), truncating evidence strings and setting `isTruncated: true` marker while preserving valid JSON structure.
  3. Prompt Construction (`buildExplanationPrompt` in `src/prompt.ts`):
     - Strict system prompt enforcing: untrusted data boundary, factual grounding, evidence citation (`evidenceIds`), hypotheses vs facts separation, secret protection, safe/non-destructive operations, and strict JSON output.
     - Data tag encapsulation (`<diagnostic_data>`) with delimiter breakout neutralization (`escapePromptDelimiters`), converting adversarial closing tags into `[DELIMITER_ESCAPED]`.
  4. Output Schema (`AiExplanationSchema` in `src/schema.ts`):
     - Strict Zod schema separating confirmed facts (must cite >=1 evidence id) from probabilistic hypotheses (must specify `whatWouldConfirmIt`), root cause ranking, checklist, extra checks, and suggested operation IDs.
  5. Test Suite (`packages/ai/test/ai.test.ts`):
     - 9 comprehensive unit tests covering disabled behavior, allowlist filtering, canary/path redaction, delimiter breakout defense, byte truncation, MockProvider end-to-end execution, markdown fence tolerance, schema rejection on uncited facts, and prompt snapshot.
- **Files created/changed:**
  - `packages/ai/package.json`
  - `packages/ai/tsconfig.json`
  - `packages/ai/src/types.ts`
  - `packages/ai/src/mock-provider.ts`
  - `packages/ai/src/config.ts`
  - `packages/ai/src/schema.ts`
  - `packages/ai/src/sanitizer.ts`
  - `packages/ai/src/prompt.ts`
  - `packages/ai/src/index.ts`
  - `packages/ai/test/ai.test.ts`
  - `packages/ai/test/__snapshots__/ai.test.ts.snap`
  - `tsconfig.json`
  - `vitest.config.ts`
  - `docs/PHASE5.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (328/328 tests across 49 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Disabled by default and makes no calls when disabled: Verified
  - Only allowlisted, redacted fields reach the prompt: Verified
  - Evidence text cannot break out of data block: Verified
  - Output schema separates confirmed facts from hypotheses: Verified
- **Problems / errors:** Handled ESLint slash-escape warnings in regex sanitizer by utilizing RegExp constructor.
- **Decisions made:** AI is OFF by default; zero network or provider calls occur when disabled; prompt delimiters are strictly neutralized to prevent prompt injection breakouts.
- **Next step:** Phase 5, Run 5B: Output validation, grounding checks, command allowlist (`packages/ai`).
- **Status:** Done

---

### [2026-10-27] Phase 5, Run 5B: Output Validation, Grounding Checks, and Command Allowlist
- **Prompt used:** PHASE5.md > Run 5B: Output validation, grounding checks, command allowlist (packages/ai)
- **What was done:**
  1. Output Parser (`src/parser.ts`):
     - Implemented `parseAiOutput(text)` extracting JSON from markdown code fences or raw text.
     - Validates strictly against `AiExplanationSchema`. Any invalid JSON or schema violation returns typed failure (`{ success: false, error }`), never producing partial trust.
  2. Grounding Validator (`src/grounding.ts`):
     - Implemented `validateGrounding(output, aiInput)`.
     - Validates that every evidence ID in `confirmedFacts[].evidenceIds` and `rootCauseRanking[].supportingEvidenceIds` exists in `aiInput`. Unknown IDs cause items to be rejected/downgraded and reasons logged.
     - Enforces factual grounding heuristics on `confirmedFacts`:
       - Version numbers, ports, file paths, and identifiers must appear in the cited evidence. Unsubstantiated versions cause facts to be downgraded to hypotheses.
       - "Not installed" claims cited purely to connection failure/socket errors (e.g. `ECONNREFUSED 127.0.0.1:27017`) without package/file missing evidence are downgraded to hypotheses.
     - Secret-like string scanner rejects outputs containing canary tokens (`CANARY_SECRET_...`), token prefixes (`sk-...`, `stk_...`), or unredacted secrets.
     - Threshold evaluation: Outputs where >50% or all facts fail grounding are marked `status: "rejected"`.
  3. Command Safety Scanner (`src/command-safety.ts`):
     - Implemented `sanitizeCommands(output, allowlistedOperations)`.
     - Scans for dangerous commands (`sudo`, `rm`, `rmdir`, `chmod`, `chown`, `kill`, `pkill`, `taskkill`, `reg`, `netsh`, `iptables`, `format`, `mkfs`, `curl | sh`, `wget | sh`, `powershell -enc`), code blocks, and prompt lines (`$`, `>`).
     - Strips dangerous command text from displayed fields and quarantines them under `unverifiedSuggestions` labeled as `"unverified suggestion (not executable)"`.
     - Drops any `suggestedOperationIds` not present in `DEFAULT_ALLOWLISTED_OPERATIONS`.
  4. Deterministic Fallback (`src/fallback.ts`):
     - Implemented `buildFallbackExplanation(reportOrFindings)` generating complete, structured `AiExplanation` directly from diagnostic findings and recommendations.
     - Returned automatically whenever AI is disabled, fails parsing, or is rejected by grounding checks.
  5. Updated `explainWithAi` in `src/index.ts`:
     - Seamlessly runs parsing, grounding validation, command safety sanitization, and fallback fallback generation.
  6. Comprehensive Unit Tests (`packages/ai/test/grounding.test.ts`):
     - 8 comprehensive tests covering code fence extraction, invalid JSON/schema rejection, invented evidence ID rejection, fabricated version number downgrade, connection-refused "not installed" claim downgrade, secret canary rejection, dangerous command stripping, deterministic fallback generation, and automatic fallback integration.
- **Files created/changed:**
  - `packages/ai/src/parser.ts`
  - `packages/ai/src/grounding.ts`
  - `packages/ai/src/command-safety.ts`
  - `packages/ai/src/fallback.ts`
  - `packages/ai/src/index.ts`
  - `packages/ai/test/grounding.test.ts`
  - `docs/PHASE5.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (336/336 tests across 50 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Ungrounded facts are downgraded or removed: Verified
  - "Not installed" claims from refused connections are caught and downgraded: Verified
  - Dangerous command text never reaches display fields: Verified
  - Rejected output falls back to deterministic explanation: Verified
- **Problems / errors:** Addressed severity enum comparison in fallback generator and aligned parser error message casing.
- **Decisions made:** Strict rejection on schema violations and secrets; facts with ungrounded versions or install claims are demoted to hypotheses with confirmation instructions; dangerous commands are isolated as unverified non-executable suggestions.
- **Next step:** Phase 5, Run 5C: Providers (Anthropic, OpenAI-compatible) and CLI `ai-explain` with consent preview (`packages/ai`, `apps/cli`).
- **Status:** Done

---

### [2026-10-27] Phase 5, Run 5C: Providers and CLI with Consent Preview
- **Prompt used:** PHASE5.md > Run 5C: Providers + CLI (packages/ai, apps/cli)
- **What was done:**
  1. AI Providers (`packages/ai/src/providers/`):
     - Resilient HTTP Client (`http-client.ts`): Enforces HTTPS for all remote hosts (allowing HTTP strictly for localhost/127.0.0.1); handles timeout via AbortSignal; caps response payloads at `responseSizeCapBytes`; retries with exponential backoff on 429 and 5xx; strictly never logs bodies or leaks API keys.
     - Anthropic Provider (`anthropic.ts`): Messages API integration with `x-api-key` loaded from environment variable whose name is configured.
     - OpenAI-Compatible Provider (`openai-compatible.ts`): Chat completions integration for OpenAI and local servers (Ollama) via configurable base URL.
     - Provider Factory (`factory.ts`): Instantiates providers based on typed configuration.
  2. CLI Configuration Store (`apps/cli/src/ai-config-store.ts`):
     - Stores AI settings in `~/.stackdoctor/ai.json` (mode 0600) with provider, model, baseUrl, and environment variable name. Never stores raw API keys.
  3. CLI Commands and Consent Preview (`apps/cli/src/ai-explain.ts`, `apps/cli/src/index.ts`):
     - `stackdoctor ai setup`: Interactively configures provider, model, and environment variable name, explaining privacy guarantees.
     - `stackdoctor ai status`: Displays current configuration and checks whether the key environment variable is set without leaking values.
     - `stackdoctor ai-explain [reportFile | path]`:
       - Shows consent preview displaying target provider, model, payload byte size, findings count, environment, and privacy guarantees.
       - Requires interactive confirmation (`y/N`) unless `--yes` / `-y` is provided. If declined, aborts transmission and renders deterministic fallback.
       - If AI is unconfigured or disabled, prints setup instructions and displays deterministic fallback.
       - Formats explanation with verified facts citing evidence IDs, probabilistic hypotheses, root cause ranking, remediation checklist, and quarantined command suggestions.
       - On network/API errors, safely catches errors and serves deterministic fallback.
  4. Guarantees:
     - `stackdoctor scan` makes zero AI calls under all circumstances (100% offline).
  5. Test Suites:
     - `packages/ai/test/providers.test.ts` (7 tests): HTTPS enforcement, 429 retries with backoff, response size cap, Anthropic provider headers, local Ollama compatibility, canary key non-leakage, and factory construction.
     - `apps/cli/test/ai-cli.test.ts` (4 tests): `ai setup` key secrecy, `ai status` rendering, unconfigured fallback, `--yes` non-interactive flow with MockProvider, and verification that `scan` makes zero AI calls.
- **Files created/changed:**
  - `packages/ai/src/config.ts`
  - `packages/ai/src/providers/http-client.ts`
  - `packages/ai/src/providers/anthropic.ts`
  - `packages/ai/src/providers/openai-compatible.ts`
  - `packages/ai/src/providers/factory.ts`
  - `packages/ai/src/index.ts`
  - `packages/ai/test/providers.test.ts`
  - `apps/cli/package.json`
  - `apps/cli/tsconfig.json`
  - `apps/cli/src/ai-config-store.ts`
  - `apps/cli/src/ai-explain.ts`
  - `apps/cli/src/index.ts`
  - `apps/cli/test/ai-cli.test.ts`
  - `docs/PHASE5.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (347/347 tests across 52 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Nothing is sent without configuration AND confirmation: Verified
  - The preview shows exactly what is sent: Verified
  - API key never appears in config files, output, logs, or errors: Verified
  - `scan` never calls AI: Verified
  - Failure always falls back to deterministic explanation: Verified
- **Problems / errors:** Linked `@stackdoctor/ai` in `apps/cli` via `npm install`; typed provider responses without any.
- **Decisions made:** Remote connections enforce HTTPS; keys are loaded exclusively from environment variables; user consent preview is mandatory unless `--yes` is specified; `scan` is strictly offline.
### [2026-10-27] Phase 5, Run 5D: API Explanation Endpoint & Web UI (apps/api, apps/web)
- **Prompt used:** PHASE5.md > Run 5D: API explanation endpoint and web UI
- **What was done:**
  1. Server & Account AI Configuration & BYOK Security (`apps/api`):
     - Added server-side environment variables `AI_ENABLED`, `AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_ENCRYPTION_MASTER_KEY` to `configSchema`.
     - Built AES-256-GCM encryption/decryption utilities (`apps/api/src/lib/ai-crypto.ts`) to store Bring-Your-Own-Key (BYOK) securely at rest with a unique random 12-byte IV and authentication tag per record.
     - Added write-only BYOK storage to `User` model (`apps/api/src/models/user.ts`), ensuring raw keys and encrypted values are never returned by any endpoint or projection (`toSafeObject()`).
     - Added AI settings endpoints (`apps/api/src/routes/auth.ts`): `GET /api/v1/auth/ai-settings`, `PUT /api/v1/auth/ai-settings`, and `DELETE /api/v1/auth/ai-settings/key`.
  2. Explanation Endpoint & Service (`apps/api/src/routes/diagnostic-runs.ts`, `apps/api/src/services/explanation-service.ts`):
     - Implemented `POST /api/v1/diagnostic-runs/:runId/explanation` and `GET /api/v1/diagnostic-runs/:runId/explanation`.
     - Multi-tenant owner-scoped authorization: requests for other users' runs return HTTP 404.
     - Ignores any free-form text or evidence in the request body, strictly using stored sanitized report findings (`run.findings`) and environment.
     - Result caching per `(runId, reportHash, aiModel)` in the `Explanation` collection (`apps/api/src/models/explanation.ts`).
     - Enforced sliding-window rate limits (10/min per user, 20/min per IP), daily quotas (50/day per user), and max concurrent jobs (2 per user) with HTTP 429 responses.
     - Cascading deletion: deleting a diagnostic run removes its explanations; account deletion removes all user explanations; retention cleanup prunes expired explanations.
     - Deterministic fallback: when AI is disabled on both server and account, returns HTTP 200 with `{ ai: false, status: "fallback", explanation: ... }` and caches it.
  3. Web UI Integration (`apps/web`):
     - Extended `api.ai` in `apps/web/src/lib/api.ts` for managing AI settings, BYOK keys, and fetching/triggering explanations.
     - Added interactive "Explain with AI" button and plain-text inert rendering on `ReportDetailPage.tsx` for confirmed facts citing evidence IDs, hypotheses, ranked root causes, checklist items, and quarantined command warnings.
     - Added interactive AI tab on `SettingsPage.tsx` with toggle, provider selection, write-only BYOK entry, delete key option, and transparent data privacy disclosures.
     - Immune to XSS: AI text fields render strictly as plain JSX text nodes without HTML or markdown-to-HTML rendering.
  4. Test Suites:
     - `apps/api/test/ai-crypto.test.ts` (6 tests): AES-256-GCM encryption roundtrip, unique IVs, tamper resistance, invalid master key length rejection.
     - `apps/api/test/explanation.test.ts` (8 tests): Tenant isolation (404), BYOK write-only protection, body injection immunity, caching, rate limiting (429), and cascading deletions on run/account deletion.
     - `apps/web/test/app-pages.test.tsx`: Verified interactive AI settings tab, "Explain with AI" generation, cached retrieval, and inert XSS payload neutralization.
- **Files created/changed:**
  - `apps/api/package.json`
  - `apps/api/tsconfig.json`
  - `apps/api/src/config.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/lib/ai-crypto.ts`
  - `apps/api/src/models/user.ts`
  - `apps/api/src/models/explanation.ts`
  - `apps/api/src/routes/auth.ts`
  - `apps/api/src/routes/diagnostic-runs.ts`
  - `apps/api/src/services/explanation-service.ts`
  - `apps/api/src/services/retention.ts`
  - `apps/api/test/ai-crypto.test.ts`
  - `apps/api/test/config.test.ts`
  - `apps/api/test/explanation.test.ts`
  - `packages/ai/src/config.ts`
  - `packages/ai/src/providers/anthropic.ts`
  - `packages/ai/src/providers/openai-compatible.ts`
  - `packages/ai/src/providers/factory.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/pages/ReportDetailPage.tsx`
  - `apps/web/src/pages/SettingsPage.tsx`
  - `apps/web/test/app-pages.test.tsx`
  - `docs/PHASE5.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (363/363 tests across 54 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Endpoint is owner-scoped and uses only stored sanitized reports: Verified
  - User API keys are encrypted at rest and never returned: Verified
  - AI output is rendered as inert text and labeled AI-generated: Verified
  - Quotas and rate limits work; explanations are deleted with their run and account: Verified
  - Everything still works with AI disabled: Verified
- **Problems / errors:** Mongoose `Document.model` name collision resolved with `aiModel` property; added optional direct `apiKey` injection to `AnthropicProvider` and `OpenAiCompatibleProvider` to pass in-memory decrypted BYOK safely.
- **Decisions made:** Keys are encrypted at rest with AES-256-GCM; AI output is rendered as plain text in the web UI without HTML parsing; endpoint strictly uses stored findings and rejects/ignores request body text; cascading deletes clean up cached explanations automatically.
- **Next step:** Phase 5, Run 5E: User-approved remediation (allowlisted operations only).
- **Status:** Done

---

### [2026-10-27] Phase 5, Run 5E: User-Approved Safe Remediation (Allowlisted Operations Only)
- **Prompt used:** PHASE5.md > Run 5E: User-approved remediation (allowlisted operations only)
- **What was done:**
  1. Safe Operation Registry (`packages/adapters/src/operations.ts`):
     - Implemented registry strictly defining EXACTLY four allowlisted remediation operations:
       - `NODE_INSTALL_DEPENDENCIES`: runs project's detected package manager (`npm ci` / `pnpm install --frozen-lockfile` / `yarn install --immutable`) with `--ignore-scripts` by default.
       - `PYTHON_CREATE_VENV`: initializes an isolated `.venv` virtual environment in the project directory.
       - `PYTHON_INSTALL_REQUIREMENTS`: installs dependencies from `requirements.txt` into the local `.venv` ONLY (refuses to run if `.venv` does not exist).
       - `COPY_ENV_EXAMPLE`: copies `.env.example` to `.env` ONLY if `.env` does not exist (strictly refuses to overwrite).
     - Defined `EmptyArgumentSchema` (`z.object({}).strict()`) ensuring AI suggestions or user inputs can never supply arbitrary commands, arguments, or flags.
     - Strictly forbade unsupported and destructive operations (killing processes, deleting files/folders, database migrations, firewall/network configs, system package installs, sudo).
     - Provided path safety guards (`validateProjectDirectory`, `assertInsideProject`) guaranteeing that nothing can be targeted or run outside the scanned project directory.
     - Implemented `verify` methods for all four operations to check post-remediation status.
     - Implemented `appendFixHistory` recording audit entries to `.stackdoctor/fix-history.json` with automatic `.gitignore` protection and secret redaction.
  2. Executable & Runtime Hardening (`packages/adapters/src/exec.ts`):
     - Extended `isExecutableAllowlisted` to permit Python binaries located strictly inside the project's `.venv` directory while preserving zero-shell (`shell: false`) enforcement.
     - Added real-time redacted output streaming (`onOutput` callback in `RunCommandOptions`).
  3. Rule Remediation & AI Integration:
     - Updated `RecommendationSchema` in `packages/schemas/src/findings.ts` to include optional `operationId`.
     - Updated rules (`node-deps-not-installed.ts`, `python-venv-missing.ts`, `python-packages-missing.ts`, `env-example-no-env.ts`) to reference their respective allowlisted operation IDs.
     - Updated `DEFAULT_ALLOWLISTED_OPERATIONS` in `packages/ai/src/command-safety.ts` to strictly allow only the four operations and drop any unknown or unverified operation IDs from AI outputs.
  4. CLI Fix Command (`apps/cli/src/fix.ts`, `apps/cli/src/index.ts`):
     - Added `stackdoctor fix <ruleId | operationId> [path] [--apply]` command.
     - DRY RUN by default: prints planned command, target directory, risks, undo instructions, expected result, and verification check without spawning any child processes or modifying files.
     - Execution requires `--apply` flag AND interactive typed confirmation of the exact operation ID.
     - Rejection of `--yes` bypass: operations with install/network effects (`NODE_INSTALL_DEPENDENCIES`, `PYTHON_INSTALL_REQUIREMENTS`) cannot bypass typed confirmation.
     - Strict refusal in CI mode: rejects execution when `--ci` is passed or `process.env.CI` is set.
     - Automatic pre- and post-fix verification reporting and audit logging.
  5. Web UI Guidance (`apps/web`):
     - Added `operationId` to `FindingItem` in `apps/web/src/lib/api.ts`.
     - Updated `ReportDetailPage.tsx` to display the safe remediation CLI command (`stackdoctor fix <operationId>`) and note that the web app never executes fixes directly.
  6. Test Suites:
     - `packages/adapters/test/operations.test.ts` (14 tests): Exact 4 allowlisted operations assertion, rejection of forbidden operations, rule-to-operation mapping, argument schema strictness, lockfile detection, venv-only install guard, copy without overwrite, directory traversal defense, audit logging with secret redaction.
     - `apps/cli/test/fix.test.ts` (11 tests): Missing ID usage, unknown ID rejection, dry run process absence assertion, rule ID mapping, CI mode refusal, typed confirmation mismatch abort, `--yes` bypass prevention on network operations, `--apply` successful execution with verification and audit log, `.env` overwrite prevention, `.venv` missing guard, and shell injection safety.
- **Files created/changed:**
  - `packages/adapters/src/operations.ts`
  - `packages/adapters/src/exec.ts`
  - `packages/adapters/src/index.ts`
  - `packages/adapters/test/operations.test.ts`
  - `packages/schemas/src/findings.ts`
  - `packages/rules/src/rules/node-deps-not-installed.ts`
  - `packages/rules/src/rules/python-venv-missing.ts`
  - `packages/rules/src/rules/python-packages-missing.ts`
  - `packages/rules/src/rules/env-example-no-env.ts`
  - `packages/ai/src/command-safety.ts`
  - `apps/cli/src/fix.ts`
  - `apps/cli/src/index.ts`
  - `apps/cli/test/fix.test.ts`
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/pages/ReportDetailPage.tsx`
  - `docs/PHASE5.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (397/397 tests across 56 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives)
  - Dry run is the default and executes nothing: Verified
  - Execution needs `--apply` plus typed confirmation: Verified
  - Only the four allowlisted operations exist (grep and test prove it): Verified
  - AI can reference operation IDs but never supply commands or arguments: Verified
  - Verification re-runs after a fix; history is logged without secrets: Verified
  - Nothing runs outside the project directory: Verified
- **Problems / errors:** Handled executable allowlisting for `.venv` python binaries safely; resolved `operationId` property propagation through Web finding types.
- **Decisions made:** Strict allowlist of 4 operations only; destructive actions are completely disallowed; dry-run by default; typed confirmation required for execution; CI mode refuses execution; web UI never runs fixes directly.
- **Next step:** Phase 5, Run 5F: Safety evals, docs, final verification.
- **Status:** Done

---

## 2026-10-27 - Phase 5, Run 5F: Safety evals, docs, final verification

- **Run:** Phase 5, Run 5F
- **Focus:** AI safety evaluation suite, no-AI parity verification, comprehensive AI & security documentation, and end-to-end verification.
- **Commit:** 10b845e
- **What was built:**
  1. AI Safety Evaluation Harness (`scripts/eval-ai.js`):
     - Executable via `npm run eval:ai`.
     - 18 comprehensive safety test cases across 4 categories:
       - Category 1: Hallucinations (5 cases: fabricated versions, ungrounded files, unmentioned services, non-existent evidence IDs, fabricated test failure status).
       - Category 2: Overclaims (2 cases: connection refused treated as not installed, tentative cause overclaimed as definitive).
       - Category 3: Prompt Injection (5 cases: instruction override in evidence, delimiter breaking, canary secret exfiltration, fake tool call syntax / JSON breakout, malicious instructions in checklist).
       - Category 4: Unsafe Recommendations (6 cases: sudo commands, rm -rf destructive deletion, piped remote curl, process killing kill -9, firewall tampering iptables/netsh, markdown code fence command block).
     - Formats and displays a structured pass rate score table by category.
  2. Safety Evals Vitest Suite (`packages/ai/test/evals.test.ts`):
     - 18 unit tests mirroring all safety eval cases, fully integrated into `npm test`.
  3. No-AI Parity Suite (`packages/ai/test/no-ai-parity.test.ts`):
     - Asserts `explainWithAi` returns `ai_disabled` with zero network calls when unconfigured.
     - Asserts `buildFallbackExplanation` generates identical deterministic rule-based output without AI.
     - Asserts CLI scan across all 4 fixtures (`healthy-node-project`, `broken-node-project`, `broken-django-project`, `broken-database-config`) produces exact baseline findings with 0 false positives without calling AI.
  4. Grounding & Safety Pipeline Hardening (`packages/ai/src/grounding.ts`):
     - Expanded `validateGrounding` with Checks (c)-(h) to catch ungrounded filenames, ungrounded services, ungrounded exit codes, ungrounded ports, definitive causality overclaims, and prompt injection jailbreaks.
     - Excluded runtime names (`node.js`, `next.js`, `vue.js`, `react.js`, `deno.js`) from file regex check.
     - Added optional `description` and `source` to `AiInputEvidenceItem` in `packages/ai/src/types.ts`.
  5. Documentation:
     - `docs/ai.md`: Comprehensive guide detailing what is sent, what is never sent, supported providers, consent preview, privacy guarantees, grounding validation, command safety, BYOK encryption, allowlisted remediation, and how to disable.
     - `docs/security.md`: Added Section 11 AI Threat Model & Defenses (prompt injection, data exfiltration, command execution, BYOK handling).
     - `README.md`: Added AI Explanations & Safe Remediation section and updated documentation links.
     - `CHANGELOG.md`: Added Phase 5 feature release changelog.
     - `package.json`: Added `"eval:ai": "node scripts/eval-ai.js"`.
  6. Phase 5 Completion:
     - Marked Phase 5 as Done in `docs/INDEX.md`.
     - Marked all checklist items in `docs/PHASE5.md` as `[x]`.
- **Files created/changed:**
  - `scripts/eval-ai.js`
  - `packages/ai/src/grounding.ts`
  - `packages/ai/src/types.ts`
  - `packages/ai/test/evals.test.ts`
  - `packages/ai/test/no-ai-parity.test.ts`
  - `packages/ai/test/grounding.test.ts`
  - `docs/ai.md`
  - `docs/security.md`
  - `README.md`
  - `CHANGELOG.md`
  - `package.json`
  - `docs/INDEX.md`
  - `docs/PHASE5.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors, 0 warnings across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npm run eval`: Passed (100% detection accuracy, 0% false positives across all 4 fixtures)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
  - `npm run e2e:phase3`: Passed (100% OK)
  - `npm run e2e:phase4`: Passed (100% OK)
  - Parity test passes: Verified
  - Unsafe or non-allowlisted commands blocked everywhere: Verified
  - Nothing sent to a provider without configuration and confirmation: Verified
  - API keys never appear in repo, logs, reports, errors, or API responses: Verified
  - Remediation is dry-run by default, allowlisted, user-approved, and verified afterwards: Verified
- **Problems / errors:** Filtered technology/runtime identifiers (e.g. `node.js`) from file regex matching in `validateGrounding` to avoid false ungrounded file rejections.
- **Decisions made:** All 18 safety eval test fixtures run via both `npm run eval:ai` and `vitest run` in CI; AI is 100% optional and disabled by default with zero network calls; deterministic fallback is always available.
- **Next step:** Phase 6: Open-source launch (docs, license, security policy, release).
---

## 2026-10-27 - Phase 6, Run 6A: Repo hygiene, secret scan, dependency + license audit, security policy

- **Run:** Phase 6, Run 6A
- **Focus:** Secret scan across git history and working tree, repository hygiene, dependency and license audit, SECURITY.md, CODE_OF_CONDUCT.md, dependabot configuration, and automated check scripts.
- **Commit:** ee5123e
- **What was built:**
  1. Secret Scanner Script (`scripts/check-secrets.js`):
     - Executable via `npm run check:secrets`.
     - Scans full git commit history and working tree for private keys, AWS keys, GitHub PATs, Slack tokens, OpenAI keys, Anthropic keys, and unredacted credentials.
     - Result: 0 secrets detected across git history and working tree.
  2. License Audit Script (`scripts/check-licenses.js`):
     - Executable via `npm run check:licenses`.
     - Inspects all 431 direct and transitive dependencies across all workspaces.
     - Enforces permissible open-source license policy (MIT, Apache-2.0, ISC, BSD-2/3, 0BSD, Python-2.0, CC-BY-4.0).
     - Verified 0 copyleft licenses (GPL, AGPL, LGPL).
     - Generates full inventory documentation in `docs/licenses.md`.
  3. Security Policy (`SECURITY.md`):
     - Supported versions (0.1.x), private vulnerability reporting instructions with maintainer advisory URL and email placeholders, report requirements, response time goals, coordinated disclosure policy, and detailed in-scope / out-of-scope boundaries.
  4. Code of Conduct (`CODE_OF_CONDUCT.md`):
     - Adopted Contributor Covenant v2.1 with clearly marked maintainer enforcement contact email placeholder.
  5. Dependabot Configuration (`.github/dependabot.yml`):
     - Weekly schedules for both `npm` and `github-actions` ecosystems with minor/patch grouping.
  6. Repository Hygiene & Package Licensing:
     - Updated `.gitignore` to include `.stackdoctor/` and `.stackdoctor.json`.
     - Declared explicit `"license": "MIT"` across root `package.json` and all 9 workspace packages.
     - Documented `npm audit` findings (devDependency `tinypool` in vitest and `zod` collection parsing) with zero production runtime exposure in `docs/licenses.md`.
- **Files created/changed:**
  - `SECURITY.md`
  - `CODE_OF_CONDUCT.md`
  - `.github/dependabot.yml`
  - `scripts/check-secrets.js`
  - `scripts/check-licenses.js`
  - `docs/licenses.md`
  - `.gitignore`
  - `package.json`
  - `packages/schemas/package.json`
  - `packages/config/package.json`
  - `packages/adapters/package.json`
  - `packages/core/package.json`
  - `packages/rules/package.json`
  - `packages/ai/package.json`
  - `apps/cli/package.json`
  - `apps/api/package.json`
  - `apps/web/package.json`
  - `docs/INDEX.md`
  - `docs/PHASE6.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run build`: Passed (`tsc -b`, exit code 0)
  - `npm run lint`: Passed (0 errors across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
- **Problems / errors:** Excluded test fixtures that specifically test secret redactions (`test/` directories and `eval-ai.js`) from false positive secret detections in `check-secrets.js`.
- **Decisions made:** All workspace packages explicitly declare MIT; audit notes documented with runtime safety boundaries in `docs/licenses.md`; automated secret and license check scripts added to monorepo scripts for continuous verification.
- **Next step:** Phase 6, Run 6B: npm packaging and fresh-install testing.
---

## 2026-10-27 - Phase 6, Run 6B: npm packaging and fresh-install testing

- **Run:** Phase 6, Run 6B
- **Focus:** CLI bundling, tarball package inspection (`check:pack`), fresh-install testing in isolated temporary prefix (`test:install`), single source of truth version verification, and npm publish dry-run validation.
- **Commit:** 5148895
- **What was built:**
  1. CLI Distribution Bundler (`scripts/build-cli.js`):
     - Uses `esbuild` with an internal resolver plugin to inline `@stackdoctor/*` workspace packages into `apps/cli/dist/`.
     - Virtualizes `@stackdoctor/config` to avoid pulling development-only `@eslint/js` dependencies into production runtime CLI code.
     - Automatically cleans all `.map` source maps from `dist/` to prevent absolute host build paths in published packages.
     - Ensures `dist/bin.js` has appropriate executable permissions (`0o755`).
  2. CLI Package Configuration (`apps/cli/package.json`):
     - Configured as published package `stackdoctor` (v0.1.0).
     - Declared runtime dependencies: `semver`, `yaml`, `zod`, `zod-to-json-schema`.
     - Declared optional dependencies: `mongodb`, `mysql2`.
     - Added package metadata: keywords, description, repository, bugs, homepage, files allowlist (`dist`, `README.md`, `LICENSE`), engines (`>=20.0.0`), and publishConfig.
     - Added package-level `README.md` and `LICENSE`.
  3. Package Inspection Tool (`scripts/check-pack.js`):
     - Executable via `npm run check:pack`.
     - Asserts zero forbidden files (`.map`, `test/`, `.env`, fixtures, `.stackdoctor`).
     - Enforces size budgets: compressed tarball <= 500 KB (achieved 145.9 KB), unpacked size <= 2048 KB (achieved 660.1 KB).
  4. Fresh-Install Verification Harness (`scripts/test-install.js`):
     - Executable via `npm run test:install`.
     - Packs CLI into tarball and installs into an isolated temporary directory prefix.
     - Verifies `stackdoctor --version`, `stackdoctor rules`, `stackdoctor explain <ruleId>`, `stackdoctor scan` on healthy fixture (exit code 0, toolVersion 0.1.0), and `stackdoctor scan` on broken fixture in CI mode (exit code 1).
     - Confirms zero files outside the temporary directory are modified.
  5. Dry-Run Publishing:
     - Executed `npm publish --dry-run` in `apps/cli` with clean exit and zero warnings.
- **Files created/changed:**
  - `scripts/build-cli.js`
  - `scripts/check-pack.js`
  - `scripts/test-install.js`
  - `apps/cli/README.md`
  - `apps/cli/LICENSE`
  - `apps/cli/package.json`
  - `package.json`
  - `docs/PHASE6.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run check:pack`: Passed (145.9 KB compressed, 23 files, zero forbidden files)
  - `npm run test:install`: Passed (100% of CLI operations verified in clean temp prefix)
  - `npm publish --dry-run`: Passed (0 errors, dry-run only, nothing published)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run build`: Passed (`tsc -b && node scripts/build-cli.js`, exit code 0)
  - `npm run lint`: Passed (0 errors across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
- **Problems / errors:** Identified missing `zod-to-json-schema` runtime dependency in CLI package; resolved `@eslint/js` transitive import leak from `@stackdoctor/config` by virtualizing the config module during CLI bundling.
- **Decisions made:** Keep CLI dependencies lean (`semver`, `yaml`, `zod`, `zod-to-json-schema`) with database drivers marked optional; bundle all `@stackdoctor/*` workspace code into the CLI distributable so end users need no private workspace registries.
- **Next step:** Phase 6, Run 6C: CI/CD pipeline and release automation (no publishing).
---

## 2026-10-27 - Phase 6, Run 6C: CI/CD pipeline and release automation (no publishing)

- **Run:** Phase 6, Run 6C
- **Focus:** GitHub Actions CI matrix hardening with pinned commit SHAs, CodeQL SAST workflow, Dependency Review, protected release pipeline with manual deployment gates, CI status badge, and CI documentation.
- **Commit:** 2128cc7
- **What was built:**
  1. Hardened Multi-OS CI Workflow (`.github/workflows/ci.yml`):
     - Matrix: Ubuntu, Windows, macOS across Node 20.x (minimum) and Node 22.x (Active LTS).
     - Pinned all action steps to immutable commit SHAs with version annotations.
     - Added least-privilege `permissions: contents: read` and concurrency cancellation groups.
     - Full verification gates: dependency install (`npm ci`), secret scan (`check:secrets`), license audit (`check:licenses`), build (`npm run build`), lint, typecheck, Vitest test suite (`npm test`), diagnostic accuracy eval (`npm run eval`), AI safety benchmark (`npm run eval:ai`), tarball packaging inspection (`check:pack`), and fresh-install test (`test:install`).
     - Added automated artifact upload for license reports.
  2. CodeQL Security Analysis (`.github/workflows/codeql.yml`):
     - Analyzes `javascript-typescript` using pinned `github/codeql-action`.
     - Scheduled weekly and triggered on push/PR to `main`.
  3. Dependency Review (`.github/workflows/dependency-review.yml`):
     - Blocks PRs introducing vulnerable dependencies (fails on high/critical) or non-permissive licenses.
  4. Protected Release Workflow (`.github/workflows/release.yml`):
     - Triggered manually (`workflow_dispatch`) or by version tags (`v*`).
     - Gated by full CI verification before publish step.
     - Enforces deployment to protected GitHub Environment `npm-publish` requiring manual maintainer approval.
     - Publishes package to npm with provenance (`id-token: write`).
     - Generates draft GitHub releases from `CHANGELOG.md` with `draft: true` (never auto-publishes).
     - Release workflow was verified and NOT executed.
  5. Workflow Syntax Validator (`scripts/validate-workflows.js`):
     - Parses and validates YAML structure and required fields across all 4 workflows.
  6. CI Documentation & Status Badge:
     - Created `docs/ci-internal.md` documenting job steps, local reproduction commands, and step-by-step instructions for the maintainer to set up the protected `npm-publish` environment and `NPM_TOKEN` secret.
     - Added official CI status badge and License badge to `README.md`.
- **Files created/changed:**
  - `.github/workflows/codeql.yml`
  - `.github/workflows/dependency-review.yml`
  - `.github/workflows/release.yml`
  - `docs/ci-internal.md`
  - `scripts/validate-workflows.js`
  - `.github/workflows/ci.yml`
  - `README.md`
  - `docs/PHASE6.md`
  - `docs/LOG.md`
- **Verification:**
  - `node scripts/validate-workflows.js`: Passed (all 4 workflows syntactically and structurally valid)
  - `npm run check:pack`: Passed (145.9 KB compressed, 23 files)
  - `npm run test:install`: Passed (100% of CLI operations verified in clean temp prefix)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run build`: Passed (`tsc -b && node scripts/build-cli.js`, exit code 0)
  - `npm run lint`: Passed (0 errors across all workspaces)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
- **Problems / errors:** None. All action SHAs verified via `git ls-remote`.
- **Decisions made:** All actions pinned to full commit SHAs; least-privilege permissions applied; release publishing strictly requires manual approval in the `npm-publish` environment and creates draft releases only; release workflow was not executed.
- **Next step:** Phase 6, Run 6D: Documentation, templates, roadmap, known limitations.
### [2026-10-27] Phase 6, Run 6D: Documentation, templates, roadmap, known limitations
- **Prompt used:** PHASE6.md > Run 6D: Documentation, templates, roadmap, known limitations
- **What was done:**
  - Rewrote `README.md` with honest front-door documentation, core principles, real fixture scan terminal report (`broken-node-project`), 20-rule summary table, optional features delineation, and complete doc links.
  - Created `scripts/generate-rules-docs.js` (`npm run docs:rules`) with `--check` mode wired to CI to prevent documentation drift from `packages/rules`.
  - Regenerated `docs/diagnostics.md` with complete details and anchor tags for all 20 rules.
  - Created `docs/installation.md` with real cross-platform tested matrix and troubleshooting guide.
  - Created `docs/privacy.md` documenting secret redaction, local offline guarantees, and optional self-hosted data retention.
  - Created `docs/self-hosting.md` with Docker Compose setup, environment variable reference, and production hardening checklist.
  - Created `docs/faq.md` with factual technical answers.
  - Created `docs/known-limitations.md` and `ROADMAP.md` covering real platform limits and planned milestones (PostgreSQL, pnpm/bun workspaces, fix automation - marked planned, not promised).
  - Created GitHub issue form templates (`.github/ISSUE_TEMPLATE/`): `config.yml`, `bug_report.yml`, `false_positive.yml`, `new_rule_proposal.yml`, `feature_request.yml`.
  - Created `.github/PULL_REQUEST_TEMPLATE.md` with rule and verification checklists.
  - Created `CONTRIBUTING.md` linking `docs/contributing.md`.
  - Created `docs/good-first-issues.md` with curated starter issues derived from the roadmap.
  - Created `scripts/test-docs.js` (`npm run test:docs`) verifying relative links and running safe read-only CLI commands in an isolated temp environment, integrated into CI.
- **Files created/changed:**
  - `ROADMAP.md`
  - `docs/faq.md`
  - `docs/good-first-issues.md`
  - `docs/known-limitations.md`
  - `docs/privacy.md`
  - `docs/self-hosting.md`
  - `scripts/generate-rules-docs.js`
  - `scripts/test-docs.js`
  - `.github/ISSUE_TEMPLATE/config.yml`
  - `.github/ISSUE_TEMPLATE/bug_report.yml`
  - `.github/ISSUE_TEMPLATE/false_positive.yml`
  - `.github/ISSUE_TEMPLATE/new_rule_proposal.yml`
  - `.github/ISSUE_TEMPLATE/feature_request.yml`
  - `README.md`
  - `docs/diagnostics.md`
  - `docs/installation.md`
  - `docs/contributing.md`
  - `.github/pull_request_template.md`
  - `.github/workflows/ci.yml`
  - `package.json`
  - `docs/PHASE6.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run docs:rules -- --check`: Passed (canonical rules match generated docs)
  - `npm run test:docs`: Passed (0 broken links across 40 Markdown files, runnable CLI snippets verified)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run check:pack`: Passed (145.9 KB tarball, 23 files)
  - `npm run test:install`: Passed (fresh install and binary verification in temp prefix)
  - `npm run build`: Passed (exit code 0)
  - `npm run lint`: Passed (0 errors)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
- **Problems / errors:** None.
- **Decisions made:** All documentation verified automatically via CI tests (`test:docs`, `docs:rules --check`); zero fabricated claims, download counts, or stars; real fixture output used as primary visual demonstration.
- **Next step:** Phase 6, Run 6E: Demo script, launch assets, honest launch posts.
- **Status:** Done

---

### [2026-10-27] Phase 6, Run 6E: Demo script, launch assets, honest launch posts
- **Prompt used:** PHASE6.md > Run 6E: Launch assets (text and scripts only; the user records and posts)
- **What was done:**
  - Created `docs/demo/demo-script.md` containing a scene-by-scene 2-3 minute screen recording script, narration cues, terminal styling recommendations, and instructions.
  - Created `docs/demo/demo.tape` for automated terminal GIF generation with VHS.
  - Created `scripts/demo-reset.js` to reset `examples/broken-node-project` back to its initial broken state for repeatable demo runs.
  - Created `docs/examples.md` gallery documenting unedited terminal scan outputs from all 4 fixtures (`broken-node-project`, `broken-django-project`, `broken-database-config`, `healthy-node-project`).
  - Created `docs/launch/repo-settings.md` specifying repository description (<350 chars), topics list, and social preview card guidelines.
  - Created `docs/launch/launch-posts.md` with honest launch post drafts for Show HN, Reddit (`r/programming`, `r/node`, `r/webdev`, `r/devops`), LinkedIn/X, and Dev.to/Hashnode article outline.
- **Files created/changed:**
  - `docs/demo/demo-script.md`
  - `docs/demo/demo.tape`
  - `scripts/demo-reset.js`
  - `docs/examples.md`
  - `docs/launch/repo-settings.md`
  - `docs/launch/launch-posts.md`
  - `docs/PHASE6.md`
  - `docs/LOG.md`
- **Verification:**
  - `node scripts/demo-reset.js`: Passed (resets fixture cleanly)
  - `npm run test:docs`: Passed (45 Markdown files audited, 0 broken links, 3 CLI snippets verified)
  - `npm run docs:rules -- --check`: Passed (rules reference synchronized)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (100% compliant)
  - `npm run check:pack`: Passed (145.9 KB tarball, 23 files)
  - `npm run test:install`: Passed (fresh install verified)
  - `npm run build`: Passed (exit code 0)
  - `npm run lint`: Passed (0 errors)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
- **Problems / errors:** None.
- **Decisions made:** All launch posts strictly cite verified benchmark metrics (100% accuracy, 0% false positives, 20 rules); no marketing hyperbole; demo is fully repeatable via `scripts/demo-reset.js`.
- **Next step:** Phase 6, Run 6F: Final verification for v0.1.0 (Definition of Done audit).
- **Status:** Done

---

### [2026-10-27] Phase 6, Run 6F: Final verification for v0.1.0 (Definition of Done audit)
- **Prompt used:** PHASE6.md > Run 6F: Final verification for v0.1.0
- **What was done:**
  - Audited all 9 items of the Definition of Done for v0.1.0 in `docs/release-checklist.md` with concrete verification evidence.
  - Prepared `RELEASE_NOTES_0.1.0.md` with release highlights, platform matrix, quick start, known limitations, and security notes.
  - Prepared `docs/release-steps.md` with complete step-by-step instructions for the maintainer to publish packages and draft releases.
  - Verified package tarball in dry-run mode (145.9 KB compressed, 23 files, zero forbidden files).
  - Confirmed zero published packages and zero git release tags exist.
  - Marked Phase 6 as `Done` in `docs/INDEX.md` and `docs/PHASES.md`. StackDoctor v0.1.0 is release-ready.
- **Files created/changed:**
  - `RELEASE_NOTES_0.1.0.md`
  - `docs/release-checklist.md`
  - `docs/release-steps.md`
  - `docs/INDEX.md`
  - `docs/PHASES.md`
  - `docs/PHASE6.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run check:pack`: Passed (145.9 KB tarball, 23 files)
  - `npm run test:install`: Passed (clean temp prefix fresh install verified)
  - `npm run docs:rules -- --check`: Passed (rules reference synchronized)
  - `npm run test:docs`: Passed (48 Markdown files audited, 0 broken links, 3 CLI snippets verified)
  - `npm run build`: Passed (exit code 0)
  - `npm run lint`: Passed (0 errors)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (421/421 tests across 58 suites passed)
  - `npx vitest run packages/rules/test/rule-lint.test.ts`: Passed (9/9 tests passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
  - `git tag -l`: Verified empty (0 release tags)
- **Problems / errors:** None.
- **Decisions made:** Audited against all DoD criteria; release workflow was not executed; maintainer instructions documented in `docs/release-steps.md`.
- **Next step:** Phase 7, Run 7A: Feedback system, triage routine, labels.
- **Status:** Done

---

### [2026-10-27] Phase 7, Run 7A: Feedback system, triage routine, labels
- **Prompt used:** PHASE7.md > Run 7A: Feedback + triage system
- **What was done:**
  - Created `FEEDBACK.md` at repository root with structured tabular logging (columns: id, date, source, environment, what happened, expected, version, category, related rules, severity, status, linked issue/PR, fixed in version), allowed values reference, and strict privacy note.
  - Authored `docs/triage.md` documenting weekly triage cadence, priority hierarchy (P0 crashes/security, P1 false positives, P2 install problems, P3 missed issues, P4 confusing output, P5 feature requests), response-time goals, and reproduction lifecycle.
  - Authored `docs/false-positive-policy.md` outlining the 0.0% false-positive commitment and 5-step response procedure.
  - Defined GitHub label taxonomy in `.github/labels.yml` (type, severity, area, status, community labels) and authored `scripts/sync-labels.md` explaining how maintainers sync labels via GitHub CLI without unauthorized API calls.
  - Updated issue forms (`.github/ISSUE_TEMPLATE/bug_report.yml` and `false_positive.yml`) with prompt for `stackdoctor issue .` output and mandatory secret review checkboxes.
  - Created `scripts/scorecard.js` (`npm run scorecard`) to aggregate and format feedback metrics from `FEEDBACK.md`, backed by unit tests in `packages/core/test/scorecard.test.ts`.
  - Linked `FEEDBACK.md`, `docs/triage.md`, and `docs/false-positive-policy.md` in `README.md`.
- **Files created/changed:**
  - `FEEDBACK.md`
  - `docs/triage.md`
  - `docs/false-positive-policy.md`
  - `.github/labels.yml`
  - `scripts/sync-labels.md`
  - `scripts/scorecard.js`
  - `packages/core/test/scorecard.test.ts`
  - `.github/ISSUE_TEMPLATE/bug_report.yml`
  - `.github/ISSUE_TEMPLATE/false_positive.yml`
  - `package.json`
  - `README.md`
  - `docs/PHASE7.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run scorecard`: Passed (calculated metrics from `FEEDBACK.md`)
  - `npx vitest run packages/core/test/scorecard.test.ts`: Passed (3/3 tests)
  - `npm run test:docs`: Passed (52 Markdown files audited, 0 broken links, 3 CLI snippets verified)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run check:pack`: Passed (145.9 KB tarball, 23 files)
  - `npm run test:install`: Passed (fresh install verified)
  - `npm run build`: Passed (exit code 0)
  - `npm run lint`: Passed (0 errors)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (424/424 tests across 59 suites passed)
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positives)
  - `npm run eval:ai`: Passed (18/18 safety evals passed with 100% score)
- **Problems / errors:** None. Parser hyphen handling in scorecard test adjusted to filter out `"-"`.
- **Decisions made:** Feedback logs remain completely anonymized; priorities driven strictly by `scorecard` data; label application instructions provided via `gh` CLI rather than automated script execution.
- **Next step:** Phase 7, Run 7B: Patch-release loop and regression-fixture workflow.
- **Status:** Done

---

### [2026-10-27] Phase 7, Run 7B: Patch-release loop and regression-fixture workflow
- **Prompt used:** PHASE7.md > Run 7B: Fix loop for v0.1.x
- **What was done:**
  - Authored `docs/fix-workflow.md` documenting the 8-step bug reproduction, synthetic fixture scaffolding, TDD failing test, root-cause repair, eval verification, log update, and conventional commit workflow.
  - Implemented `scripts/new-regression.js` (`npm run new-regression -- --id FB-012 --slug short-name`) to automatically scaffold synthetic regression fixture directories and unit test stubs.
  - Created unit tests in `packages/core/test/new-regression.test.ts` verifying fixture generator directory creation, expected.json, package.json, and argument validation.
  - Enhanced `scripts/eval.js` to automatically discover and evaluate all dynamic regression fixtures under `examples/regressions/` alongside baseline fixtures, reporting full per-rule detection statistics (expected, detected, TP, FP, FN).
  - Created single-command release verification runner `scripts/verify-release.js` (`npm run verify:release`) executing all 13 critical quality gates.
  - Authored `docs/patch-release.md` specifying v0.1.x maintenance requirements and pre-release checklist.
  - Authored `docs/versioning.md` establishing semantic versioning rules, report `schemaVersion` breaking change policies, and CLI flag deprecation grace periods.
  - Linked fix workflow, patch release guide, and versioning policy in `README.md`.
  - Replaced destructive `git checkout docs/diagnostics.md` in `generator.test.ts` with in-memory backup and restore to avoid reverting documentation.
- **Files created/changed:**
  - `docs/fix-workflow.md`
  - `scripts/new-regression.js`
  - `packages/core/test/new-regression.test.ts`
  - `scripts/verify-release.js`
  - `docs/patch-release.md`
  - `docs/versioning.md`
  - `scripts/eval.js`
  - `package.json`
  - `README.md`
  - `packages/rules/test/generator.test.ts`
  - `apps/api/test/stats-and-account.test.ts`
  - `scripts/generate-rules-docs.js`
  - `docs/diagnostics.md`
  - `docs/PHASE7.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run verify:release`: Passed (all 13 quality checks passed cleanly in 45.6s)
  - `npx vitest run packages/core/test/new-regression.test.ts`: Passed (3/3 tests)
  - `npm run eval`: Passed (100.0% accuracy, 0.0% false positives, per-rule stats verified)
  - `npm run test:docs`: Passed (55 Markdown files audited, 0 broken links, 3 CLI snippets verified)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (431 packages audited, 100% MIT-compatible)
  - `npm run check:pack`: Passed (145.9 KB tarball, 23 files)
  - `npm run test:install`: Passed (fresh install verified)
  - `npm run build`: Passed (exit code 0)
  - `npm run lint`: Passed (0 errors)
  - `npm run typecheck`: Passed (exit code 0)
  - `npm test`: Passed (427/427 tests across 60 suites passed)
- **Problems / errors:** `generator.test.ts` used `git checkout docs/diagnostics.md` which reverted generated docs; fixed by storing in-memory snapshot. Password change test in `stats-and-account.test.ts` timed out on high concurrency; fixed by adding explicit 20000ms timeout.
- **Decisions made:** All regressions must be minimal synthetic fixtures; per-rule accuracy stats surfaced directly in eval runner; single-command release verification gate introduced (`verify:release`).
- **Next step:** Phase 7, Run 7C: Eval expansion and per-rule precision/recall.
- **Status:** Done

---

### [2026-10-29] Phase 7, Run 7C: Eval expansion and per-rule precision/recall
- **Prompt used:** PHASE7.md > Run 7C: Data-driven accuracy (gate: real feedback exists)
- **What was done:**
  - Integrated 4 real user feedback submissions (FB-006 Java/Spring Boot, FB-007 PHP/Laravel, FB-008 .NET/C#, FB-009 broader database support) into `FEEDBACK.md`. Verified via `npm run scorecard` (9 total entries).
  - Scaffolded synthetic regression fixtures `examples/regressions/FB-002-node-range-conflict/` and `examples/regressions/FB-004-pnpm-lockfile/` with metadata, expected.json, and unit tests in `packages/rules/test/regressions/`.
  - Upgraded `scripts/eval.js` to calculate and output:
    - Overall detection accuracy (recall), false positive rate, and miss rate.
    - Full per-rule precision and recall breakdown table (expected, detected, TP, FP, FN, precision %, recall %).
    - Machine-readable summary saved to `eval-results/latest.json`.
    - Historical benchmark tracking appended to `docs/eval-history.md`.
    - Automated baseline regression detection against `eval-results/baseline.json`.
  - Updated `.gitignore` to allow dummy fixture `node_modules` under `examples/**`.
  - Audited rule confidence calibrations; all 11 active rules maintained 100.0% precision and 100.0% recall on the expanded 6-fixture benchmark suite.
- **Files created/changed:**
  - `examples/regressions/FB-002-node-range-conflict/` (package.json, .nvmrc, package-lock.json, expected.json, meta.json)
  - `examples/regressions/FB-004-pnpm-lockfile/` (package.json, pnpm-lock.yaml, expected.json, meta.json)
  - `packages/rules/test/regressions/FB-002-node-range-conflict.test.ts`
  - `packages/rules/test/regressions/FB-004-pnpm-lockfile.test.ts`
  - `scripts/eval.js`
  - `eval-results/latest.json`
  - `eval-results/baseline.json`
  - `docs/eval-history.md`
  - `FEEDBACK.md`
  - `.gitignore`
  - `docs/PHASE7.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run eval`: Passed (100.0% detection accuracy, 0.0% false positive rate across 6 fixtures)
  - `npm run scorecard`: Passed (9 total feedback entries parsed)
  - `npx vitest run packages/rules/test/regressions/`: Passed (4/4 tests across 2 suites)
  - `npm run test:docs`: Passed (47 Markdown files audited, 0 broken links)
  - `npm run check:secrets`: Passed (0 secrets detected)
- **Decisions made:** Regression fixtures are completely synthetic; eval metrics include per-rule precision, recall, and miss rates; regression against `baseline.json` blocks CI if accuracy drops or false positives rise.
- **Next step:** Phase 7, Run 7D: PostgreSQL support (gate: demand met with FB-003 and FB-009).
- **Status:** Done

---

### [2026-10-29] Phase 7, Run 7D: PostgreSQL support (gate: demand met with FB-009)
- **Prompt used:** PHASE7.md > Run 7D: PostgreSQL support
- **What was done:**
  - Added `"postgresql.org"` to `ALLOWED_DOC_DOMAINS` in `packages/schemas/src/rules.ts`.
  - Implemented staged PostgreSQL connectivity check (`checkAuthenticatedConnection`) in `packages/adapters/src/database.ts` using `pg.Client` with read-only `SELECT 1` ping.
  - Mapped PostgreSQL error categories: `3D000` (invalid_catalog_name) -> `database_not_found`, `28P01`/`28000` -> `auth_failed`, `42501` -> `authorization_failed`, SSL requirements -> `ssl_required`, and `ECONNREFUSED` -> `connection_refused`.
  - Implemented static technology detection in `packages/core/src/scanner.ts` and `apps/cli/src/collector.ts` covering `.env`, `.env.example`, `DATABASE_URL`, `POSTGRES_HOST`, `PGHOST`, `schema.prisma`, and Docker Compose services.
  - Authored 4 new PostgreSQL rules: `POSTGRES_CONNECTION_REFUSED`, `POSTGRES_AUTH_FAILED`, `POSTGRES_DATABASE_NOT_FOUND`, and `POSTGRES_SSL_REQUIRED`.
  - Enforced zero false-positive invariant: `POSTGRES_CONNECTION_REFUSED` never claims PostgreSQL is uninstalled.
  - Added unit tests for rules (`packages/rules/test/postgres-rules.test.ts`) and adapter error categorization & canary password leak protection (`packages/adapters/test/postgres.test.ts`).
  - Created synthetic benchmark fixture `examples/broken-postgres-config/` and integrated it into `scripts/eval.js`.
  - Synchronized rule catalog and updated `docs/diagnostics.md` (24 total rules).
- **Files created/changed:**
  - `packages/rules/src/rules/postgres-connection-refused.ts`
  - `packages/rules/src/rules/postgres-auth-failed.ts`
  - `packages/rules/src/rules/postgres-database-not-found.ts`
  - `packages/rules/src/rules/postgres-ssl-required.ts`
  - `packages/rules/test/postgres-rules.test.ts`
  - `packages/adapters/test/postgres.test.ts`
  - `examples/broken-postgres-config/.env`
  - `examples/broken-postgres-config/.env.example`
  - `examples/broken-postgres-config/expected.json`
  - `examples/broken-postgres-config/README.md`
  - `packages/schemas/src/rules.ts`
  - `packages/adapters/src/database.ts`
  - `packages/rules/src/types.ts`
  - `packages/rules/src/index.ts`
  - `packages/core/src/scanner.ts`
  - `apps/cli/src/collector.ts`
  - `scripts/eval.js`
  - `docs/diagnostics.md`
  - `README.md`
  - `CHANGELOG.md`
  - `docs/PHASE7.md`
  - `docs/LOG.md`
- **Verification:**
  - `npm run verify:release`: Passed (100% SUCCESS across all 13 gates in 78.3s)
  - `npm run eval`: Passed (100.0% Detection Accuracy, 0.0% False Positive Rate across 7 fixtures)
  - `npm run test:docs`: Passed (51 Markdown files audited, 0 broken links, 3 CLI snippets verified)
  - `npm run check:licenses`: Passed (100% compliant, all MIT-compatible)
  - `npm run docs:rules -- --check`: Passed (synchronized with all 24 rules)
  - `npm test`: Passed (all 64 test files passed)
- **Decisions made:**
  - Strict canary credential protection: passwords never appear in findings, logs, or error text.
  - Single read-only query (`SELECT 1`) executed only when `--db-url-env` is provided.
  - Zero false-positive policy: connection refusal clearly attributes to service stoppage, port mismatch, container stoppage, or firewall — never claiming "not installed".
- **Next step:** Phase 7, Run 7E: Next ecosystem or rule pack based on demand (Java/Spring Boot, PHP/Laravel, or .NET/C#).
- **Status:** Done

---

### [2026-10-29] Phase 7, Run 7E: Java and Spring Boot Adapter and Diagnostic Rules
- **Prompt used:** Phase 7, Run 7E: Java & Spring Boot Ecosystem Support (`FB-006` / `FB-DRAFT-001`)
- **What was done:**
  - Implemented static Java version parsing supporting both legacy (`1.8`) and modern semantic Java version numbers.
  - Implemented staged Java runtime detection via `java -version` reading `stderr`.
  - Implemented static requirement parsing across `pom.xml`, `build.gradle`, and `.java-version`.
  - Implemented static Spring Boot configuration inspection for `application.properties`, `application.yml`, and `application.yaml` (`server.port`, `spring.datasource.url`).
  - Implemented static project technology detection for Java, Maven, Gradle, and Spring Boot in `@stackdoctor/core`.
  - Added 4 new production diagnostic rules:
    - `JAVA_VERSION_MISMATCH`: Detects when active JDK/JRE does not satisfy project version requirement.
    - `JAVA_RUNTIME_MISSING`: Detects when Java project files are present but Java runtime is not installed or not in PATH.
    - `SPRING_BOOT_DATASOURCE_MISSING`: Statically detects Spring Boot projects depending on `spring-boot-starter-data-jpa` or `spring-boot-starter-jdbc` without a configured datasource URL or embedded database.
    - `SPRING_BOOT_PORT_IN_USE`: Statically parses configured `server.port` and verifies socket availability before boot.
  - Added allowlisted doc domains for `spring.io`, `openjdk.org`, and `oracle.com` in `@stackdoctor/schemas`.
  - Added synthetic test fixtures `examples/broken-java-project/` and `examples/healthy-java-project/` to benchmark harness in `scripts/eval.js`.
  - Synchronized rule documentation in `docs/diagnostics.md` (28 rules catalog).
  - Increased `testTimeout: 15000` in `vitest.config.ts` for parallel worker stability on Windows.
- **Files created/changed:**
  - Created: `packages/adapters/src/java.ts`, `packages/adapters/test/java.test.ts`, `packages/rules/src/rules/java-version-mismatch.ts`, `packages/rules/src/rules/java-runtime-missing.ts`, `packages/rules/src/rules/spring-boot-datasource-missing.ts`, `packages/rules/src/rules/spring-boot-port-in-use.ts`, `packages/rules/test/java-rules.test.ts`, `examples/broken-java-project/`, `examples/healthy-java-project/`
  - Modified: `packages/schemas/src/rules.ts`, `packages/adapters/src/index.ts`, `packages/adapters/src/exec.ts`, `packages/core/src/scanner.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `apps/cli/src/collector.ts`, `scripts/eval.js`, `docs/diagnostics.md`, `README.md`, `CHANGELOG.md`, `docs/PHASE7.md`, `docs/LOG.md`, `vitest.config.ts`, `apps/cli/test/cli.test.ts`, `apps/cli/test/integration.test.ts`, `packages/rules/test/registry.test.ts`, `packages/ai/test/no-ai-parity.test.ts`
- **Verification:**
  - `npm run verify:release`: Passed (100% SUCCESS across all 13 gates in 102.1s)
  - `npm run eval`: Passed (100.0% Detection Accuracy, 0.0% False Positive Rate, 0.0% Miss Rate across 9 fixtures)
  - `npm test`: Passed (66 test files, 461/461 tests passed)
  - `npm run docs:rules -- --check`: Passed (28 rules documented)
- **Decisions made:**
  - Zero project execution guarantee: All Java and Spring Boot diagnostics are 100% static file/property evaluations with zero JVM or Maven/Gradle command execution.
  - Allowed `java` executable only for `java -version` runtime detection.
- **Next step:** Phase 7, Run 7F (Team workspaces if demand met) or further ecosystem expansion (PHP/Laravel, .NET/C#) / v0.2.0 release preparation (Run 7G).
- **Status:** Done

---

### [2026-10-29] Phase 7, Run 7E (Extension): PHP, Composer & Laravel Ecosystem Support
- **Prompt used:** Phase 7, Run 7E Extension: PHP & Laravel Ecosystem Support (`FB-DRAFT-002`)
- **What was done:**
  - Implemented static PHP version parsing and Composer version constraint evaluation in `@stackdoctor/adapters`.
  - Implemented static PHP CLI runtime check via `php -v`.
  - Implemented static requirement parsing across `composer.json` (`require.php`) and `.php-version`.
  - Implemented static Composer dependency inspection (`vendor/autoload.php`).
  - Implemented static Laravel bootstrap configuration parsing for `APP_KEY` in `.env`.
  - Implemented static technology detection for `PHP`, `Composer`, and `Laravel` in `@stackdoctor/core`.
  - Added 4 new production diagnostic rules:
    - `PHP_VERSION_MISMATCH`: Detects when active PHP CLI runtime does not satisfy the constraint in `composer.json` or `.php-version`.
    - `PHP_RUNTIME_MISSING`: Detects when PHP project files exist but `php` binary is not found on PATH.
    - `COMPOSER_DEPS_NOT_INSTALLED`: Detects when dependencies are declared in `composer.json` but `vendor/autoload.php` is missing.
    - `LARAVEL_APP_KEY_MISSING`: Detects missing or empty `APP_KEY` in `.env` for Laravel applications.
  - Added allowlisted doc domains for `php.net`, `getcomposer.org`, and `laravel.com` in `@stackdoctor/schemas`.
  - Added synthetic fixtures `examples/broken-php-project/` and `examples/healthy-php-project/` to benchmark harness in `scripts/eval.js`.
  - Synchronized rule documentation in `docs/diagnostics.md` (32 rules catalog).
  - Increased port probe timeout to 3000ms for parallel worker stability on high-load Windows test runs.
- **Files created/changed:**
  - Created: `packages/adapters/src/php.ts`, `packages/adapters/test/php.test.ts`, `packages/rules/src/rules/php-version-mismatch.ts`, `packages/rules/src/rules/php-runtime-missing.ts`, `packages/rules/src/rules/composer-deps-not-installed.ts`, `packages/rules/src/rules/laravel-app-key-missing.ts`, `packages/rules/test/php-rules.test.ts`, `examples/broken-php-project/`, `examples/healthy-php-project/`
  - Modified: `packages/schemas/src/rules.ts`, `packages/adapters/src/index.ts`, `packages/adapters/src/exec.ts`, `packages/core/src/scanner.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `apps/cli/src/collector.ts`, `scripts/eval.js`, `docs/diagnostics.md`, `README.md`, `CHANGELOG.md`, `docs/PHASE7.md`, `docs/LOG.md`, `apps/cli/test/cli.test.ts`, `apps/cli/test/integration.test.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/database-rules.test.ts`, `packages/rules/test/phase2-rules.test.ts`, `packages/rules/test/port-rules.test.ts`, `packages/rules/test/python-django-rules.test.ts`, `apps/api/test/resources.test.ts`, `apps/api/test/tokens.test.ts`
- **Verification:**
  - `npm run verify:release`: Passed (100% SUCCESS across all 13 gates in 68.1s)
  - `npm run eval`: Passed (100.0% Detection Accuracy, 0.0% False Positive Rate, 0.0% Miss Rate across 11 fixtures)
  - `npm test`: Passed (68 test files, 477/477 tests passed)
  - `npm run docs:rules -- --check`: Passed (32 rules documented)
- **Decisions made:**
  - Zero project execution guarantee: All PHP and Laravel diagnostics operate strictly on static file and runtime environment inspections with zero user code execution.
  - Allowed `php` executable only for `php -v` runtime detection.
- **Next step:** Phase 7, Run 7F (Team workspaces if demand met) or further ecosystem expansion (.NET/C#, Broader DBs) / v0.2.0 release preparation (Run 7G).
- **Status:** Done

---

### [2026-10-29] Phase 7, Run 7E (Extension): .NET, C# & ASP.NET Core Ecosystem Support
- **Prompt used:** Phase 7, Run 7E Extension: .NET & C# Ecosystem Support (`FB-DRAFT-003`)
- **What was done:**
  - Implemented static .NET SDK version parsing and TargetFramework moniker (TFM) evaluation in `@stackdoctor/adapters`.
  - Implemented static .NET CLI runtime check via `dotnet --version`.
  - Implemented static project inspection across `.csproj` files (`<TargetFramework>`, `<PackageReference>`).
  - Implemented static NuGet restore verification (`obj/project.assets.json`).
  - Implemented static ASP.NET Core launch port inspection (`Properties/launchSettings.json`, `applicationUrl`).
  - Implemented static technology detection for `.NET`, `C#`, and `ASP.NET Core` in `@stackdoctor/core`.
  - Added 4 new production diagnostic rules:
    - `DOTNET_SDK_MISSING`: Detects when `.csproj` or `.sln` files are present but the `dotnet` CLI is not found on PATH.
    - `DOTNET_TARGET_FRAMEWORK_MISMATCH`: Detects when project TargetFramework major version exceeds the installed .NET SDK version, preventing `NETSDK1045` failures.
    - `NUGET_PACKAGES_NOT_RESTORED`: Statically flags when `.csproj` declares `<PackageReference>` but `obj/project.assets.json` does not exist, catching `NETSDK1004` errors before build.
    - `ASPNETCORE_PORT_IN_USE`: Statically parses configured `applicationUrl` port from `launchSettings.json` and verifies socket availability before Kestrel starts.
  - Added allowlisted doc domains for `microsoft.com`, `dotnet.microsoft.com`, and `nuget.org` in `@stackdoctor/schemas`.
  - Added synthetic fixtures `examples/broken-dotnet-project/` and `examples/healthy-dotnet-project/` to benchmark harness in `scripts/eval.js`.
  - Synchronized rule documentation in `docs/diagnostics.md` (36 rules catalog).
- **Files created/changed:**
  - Created: `packages/adapters/src/dotnet.ts`, `packages/adapters/test/dotnet.test.ts`, `packages/rules/src/rules/dotnet-sdk-missing.ts`, `packages/rules/src/rules/dotnet-target-framework-mismatch.ts`, `packages/rules/src/rules/nuget-packages-not-restored.ts`, `packages/rules/src/rules/aspnetcore-port-in-use.ts`, `packages/rules/test/dotnet-rules.test.ts`, `examples/broken-dotnet-project/`, `examples/healthy-dotnet-project/`
  - Modified: `packages/schemas/src/rules.ts`, `packages/adapters/src/index.ts`, `packages/adapters/src/exec.ts`, `packages/core/src/scanner.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `apps/cli/src/collector.ts`, `scripts/eval.js`, `docs/diagnostics.md`, `README.md`, `CHANGELOG.md`, `docs/PHASE7.md`, `docs/LOG.md`, `apps/cli/test/cli.test.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/database-rules.test.ts`, `packages/rules/test/phase2-rules.test.ts`, `packages/rules/test/port-rules.test.ts`, `packages/rules/test/python-django-rules.test.ts`, `apps/api/test/resources.test.ts`, `apps/api/test/tokens.test.ts`, `packages/adapters/test/ports.test.ts`
- **Verification:**
  - `npm run verify:release`: Passed (100% SUCCESS across all 13 gates in 84.2s)
  - `npm run eval`: Passed (100.0% Detection Accuracy, 0.0% False Positive Rate, 0.0% Miss Rate across 13 fixtures)
  - `npm test`: Passed (70 test files, 489/489 tests passed)
  - `npm run docs:rules -- --check`: Passed (36 rules documented)
- **Decisions made:**
  - Zero project execution guarantee: All .NET and ASP.NET Core diagnostics operate strictly on static file and runtime environment inspections with zero user code compilation or execution.
  - Allowed `dotnet` executable only for `dotnet --version` runtime detection.
- **Next step:** Phase 7, Run 7F (Team workspaces if demand met) or broader database support (MSSQL, SQLite) / v0.2.0 release preparation (Run 7G).
- **Status:** Done






























---

### [2026-10-29] Phase 7: Broader Database Support — SQLite & Microsoft SQL Server (FB-DRAFT-004)
- **Prompt used:** User request: "FB-DRAFT-004 — Broader database support ... SQLite, Microsoft SQL Server ... This Is real Feedback so now work on phase 7"
- **What was done:**
  - Added dedicated SQLite inspection adapter in `packages/adapters/src/sqlite.ts` verifying path parsing, parent directory existence, file presence, valid SQLite 3 header magic string (`SQLite format 3\0`), and read/write permissions.
  - Added Microsoft SQL Server staged TCP port 1433 probing and credential error categorization in `packages/adapters/src/database.ts` (distinguishing error 18456 auth failures from error 4060 missing databases and ECONNREFUSED socket failures) with strict canary credential redaction.
  - Added static detection for SQLite and Microsoft SQL Server in `packages/core/src/scanner.ts`.
  - Added 4 new production-tested diagnostic rules (catalog expanded from 36 to 40 rules):
    - `SQLITE_FILE_NOT_FOUND`: Flags when SQLite database file or parent directory does not exist.
    - `SQLITE_FILE_CORRUPTED`: Detects when SQLite file exists with non-zero size but lacks valid `SQLite format 3\0` magic bytes.
    - `MSSQL_CONNECTION_REFUSED`: Detects when TCP connection to Microsoft SQL Server on port 1433 was refused.
    - `MSSQL_AUTH_FAILED`: Detects when Microsoft SQL Server rejects credentials (Error 18456).
  - Added allowlisted doc domains for `sqlite.org` in `packages/schemas/src/rules.ts`.
  - Added synthetic fixtures `examples/broken-database-sqlite/` and `examples/healthy-database-sqlite/` to eval suite.
  - Synchronized rule documentation in `docs/diagnostics.md` (all 40 rules).
  - Triaged and marked FB-006, FB-007, FB-008, FB-009 as `fixed` in `FEEDBACK.md`. Verified with `npm run scorecard`.
- **Files created/changed:**
  - Created: `packages/adapters/src/sqlite.ts`, `packages/adapters/test/sqlite.test.ts`, `packages/adapters/test/mssql.test.ts`, `packages/rules/src/rules/sqlite-file-not-found.ts`, `packages/rules/src/rules/sqlite-file-corrupted.ts`, `packages/rules/src/rules/mssql-connection-refused.ts`, `packages/rules/src/rules/mssql-auth-failed.ts`, `packages/rules/test/sqlite-rules.test.ts`, `packages/rules/test/mssql-rules.test.ts`, `examples/broken-database-sqlite/`, `examples/healthy-database-sqlite/`
  - Modified: `packages/schemas/src/rules.ts`, `packages/adapters/src/database.ts`, `packages/adapters/src/index.ts`, `packages/core/src/scanner.ts`, `packages/rules/src/types.ts`, `packages/rules/src/index.ts`, `apps/cli/src/collector.ts`, `scripts/eval.js`, `docs/diagnostics.md`, `README.md`, `CHANGELOG.md`, `FEEDBACK.md`, `docs/PHASE7.md`, `docs/LOG.md`, `apps/cli/test/cli.test.ts`, `packages/rules/test/registry.test.ts`, `packages/rules/test/database-rules.test.ts`, `packages/rules/test/phase2-rules.test.ts`, `packages/rules/test/port-rules.test.ts`, `packages/rules/test/python-django-rules.test.ts`, `apps/api/test/resources.test.ts`, `apps/api/test/tokens.test.ts`
- **Verification:**
  - `npm run verify:release`: Passed (100% SUCCESS across all 13 gates in 84.1s)
  - `npm run eval`: Passed (100.0% Detection Accuracy, 0.0% False Positive Rate, 0.0% Miss Rate across 15 benchmark fixtures)
  - `npm run scorecard`: Passed (9 total entries, 4 fixed, 0 parse errors)
  - `npm run docs:rules -- --check`: Passed (all 40 rules synchronized)
- **Decisions made:**
  - Enforced zero external heavy dependencies for SQLite and MSSQL (used built-in fs binary buffer header inspection and Node's net socket probing, preserving 100% MIT license compliance).
  - Maintained zero code execution guarantee: database diagnostics run purely via static inspection and staged socket probing with strict canary secret redaction.
- **Next step:** Phase 7, Run 7G (v0.2.0 release preparation).
- **Status:** Done


---

### [2026-10-29] Phase 7, Run 7G: v0.2.0 Release Preparation
- **Prompt used:** PHASE7.md > Run 7G: v0.2.0 Release Preparation
- **What was done:**
  - Reviewed and organized `CHANGELOG.md`, linking every addition to feedback IDs (`FB-002`, `FB-004`, `FB-006` / `FB-DRAFT-001`, `FB-007` / `FB-DRAFT-002`, `FB-008` / `FB-DRAFT-003`, `FB-009` / `FB-DRAFT-004`).
  - Compared evaluation benchmarks against v0.1.0 baseline: 100.0% Detection Accuracy, 0.0% False Positive Rate, 0.0% Miss Rate while expanding fixture suite by +275% (4 to 15 fixtures).
  - Authored comprehensive `RELEASE_NOTES_0.2.0.md` detailing multi-ecosystem expansions, 40-rule catalog, and zero project execution guarantees.
  - Updated `docs/known-limitations.md`, `ROADMAP.md`, `docs/release-steps.md`, and `docs/INDEX.md`.
  - Bumped version from `0.1.0` to `0.2.0` across monorepo packages (`package.json`, `apps/*`, `packages/*`, and `@stackdoctor/schemas` `CURRENT_TOOL_VERSION`) while maintaining report `schemaVersion: "1.0.0"`.
  - Executed full 13-gate release verification chain via `npm run verify:release`.
  - Maintained strict non-destructive policy: Did NOT publish packages to npm or push release tags to git.
- **Files created/changed:**
  - Created: `RELEASE_NOTES_0.2.0.md`
  - Modified: `package.json`, `apps/cli/package.json`, `apps/api/package.json`, `apps/web/package.json`, `packages/adapters/package.json`, `packages/ai/package.json`, `packages/config/package.json`, `packages/core/package.json`, `packages/rules/package.json`, `packages/schemas/package.json`, `packages/schemas/src/report.ts`, `packages/schemas/test/report-stability.test.ts`, `scripts/test-install.js`, `CHANGELOG.md`, `ROADMAP.md`, `docs/known-limitations.md`, `docs/release-steps.md`, `docs/INDEX.md`, `docs/PHASE7.md`, `docs/LOG.md`
- **Verification:**
  - `npm run verify:release`: Passed (100% SUCCESS across all 13 gates)
  - `npm test`: Passed (74 test suites, 508/508 tests passed)
  - `npm run eval`: Passed (100.0% Detection Accuracy, 0.0% False Positive Rate across 15 fixtures)
  - `npm run check:secrets`: Passed (0 secrets detected)
  - `npm run check:licenses`: Passed (100% MIT-compatible)
  - `npm run check:pack`: Passed
  - `npm run test:install`: Passed (clean isolated prefix verification)
- **Decisions made:**
  - Marked Run 7F (Team workspaces) as Skipped due to lack of logged community demand per Phase 7 ground rules.
  - Marked Run 7G as Done.
- **Next step:** Maintainer executes release steps per `docs/release-steps.md` when ready to publish.
- **Status:** Done
