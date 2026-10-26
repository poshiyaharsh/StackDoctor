# StackDoctor: Phase 1 (Foundation), Living File

**Goal:** StackDoctor runs locally and produces a valid report.
**This file is updated by Antigravity after every run** (status table, run logs, checklists).
Keep it in the repo root next to `INDEX.md`, `PHASES.md`, `LOG.md`. If you keep them in a different folder, tell Antigravity the path in the first prompt.

## How to use

1. Start a new Antigravity session. Paste the **Master Context** from `PHASES.md`.
2. Paste the **Run prompt** you want (start at Run 0, then 1A, 1B, ...).
3. Antigravity builds it, then follows the **Post-Run Protocol** below by itself: review, verify, update docs, commit, push.
4. Check the result here, tick nothing by hand. Bring any failures or odd behavior to Claude.

Never skip a run or change the order.

---

## Status tracker (Antigravity updates this)

| Run | Focus | Status | Commit | Date |
|---|---|---|---|---|
| 0 | Git + GitHub setup | Done | 563a08d | 2026-10-26 |
| 1A | Scaffold | Done | d4eae7b | 2026-10-26 |
| 1B | Schemas | Done | pending | 2026-10-26 |
| 1C | Core (redaction, scanner, lifecycle) | Not started | - | - |
| 1D | Rules registry | Not started | - | - |
| 1E | CLI + final verification | Not started | - | - |

Status values: Not started, In progress, Needs fixes, Done.

---

## POST-RUN PROTOCOL (Antigravity runs this after EVERY run)

```
POST-RUN PROTOCOL. Do these steps in order after finishing the run's work.

1. SELF-REVIEW THE CODE
   - Review every file created or changed in this run for: bugs, unused code, missing error
     handling, scope creep (anything outside this run's listed items), security problems
     (secret leaks, shell strings built from input, unsafe paths), and missing tests.
   - Fix problems found. Do not add features beyond this run's scope.

2. VERIFY
   - Run: npm run build, npm test, npm run lint, npm run typecheck (whichever exist yet).
   - If anything fails, fix the root cause and re-run. Do not mark the run Done while
     anything fails. If you cannot fix it, set status to "Needs fixes" and describe the
     exact error in this file's run log, then STOP (do not commit broken code).

3. UPDATE THE DOCS (only what this run actually changed)
   - PHASE1.md: set this run's status in the tracker, fill in its Run log (below the
     prompt): files created/changed, command outputs summary, problems, decisions, and tick
     the checklist items that genuinely passed. Never tick an item you did not verify.
   - LOG.md: append one entry using the template in that file.
   - INDEX.md: update the phase status table only if the phase status changed.
   - README.md and docs/*.md: update install, usage, or architecture text ONLY if this run
     changed it. Keep it accurate; do not describe features that do not exist yet.

4. COMMIT AND PUSH
   - Check `git status`. Make sure no .env, secrets, node_modules, dist, or large/generated
     files are staged. If anything suspicious is staged, unstage it and tell me.
   - Commit with a conventional message, one commit per run, for example:
       chore(scaffold): set up npm workspaces monorepo        (Run 1A)
       feat(schemas): add zod report and finding schemas      (Run 1B)
       feat(core): add redaction, scanner and runner          (Run 1C)
       feat(rules): add rule interface, registry, sample rules (Run 1D)
       feat(cli): add stackdoctor scan command                (Run 1E)
   - Then `git push` to the current branch. Rules:
       * Never force push. Never rewrite history. Never push to a branch other than the
         one configured for this project.
       * If no remote is configured, or push fails (auth, network, rejected), do NOT work
         around it. Leave the commit local, record the exact error in the Run log, and tell me.
   - Record the short commit hash in the tracker's Commit column.
   - Make a small follow-up commit ("docs: update phase tracker") for the tracker hash if needed,
     and push it too.

5. REPORT
   - End with a short summary: what was built, files changed, verification results,
     commit hash, push result, and anything I should check or decide.
```

---

## Run 0: Git and GitHub setup (do once, before 1A)

```
PHASE 1, RUN 0: GIT AND GITHUB SETUP

Do not write any project code in this run.

1. Check whether this folder is already a git repository. If not, run `git init` and use
   `main` as the default branch.
2. Check for a configured remote named `origin`. 
   - If missing, STOP and tell me to add it with:
       git remote add origin <YOUR_GITHUB_REPO_URL>
     (I will provide the URL). Do not invent a URL.
3. Make sure git user.name and user.email are set for this repo (ask me if missing).
4. Create .gitignore (node_modules, dist, build, coverage, .env, .env.*, !.env.example,
   *.log, .DS_Store, .idea, .vscode) and a minimal README.md (title + one-line description).
5. Make sure PHASES.md, LOG.md, INDEX.md and PHASE1.md exist in the repo root.
6. Confirm no secrets are tracked. Make an initial commit:
     chore: initial commit with project docs
7. Push to origin main (no force). Report the result.

Then follow the POST-RUN PROTOCOL in PHASE1.md (skip build/test steps that do not exist yet).
```

**Checklist**
- [x] Repo initialized, remote `origin` set
- [x] `.gitignore` excludes `.env` and `node_modules`
- [x] Initial commit pushed

**Run log (Antigravity fills):**
- Files: `.gitignore`, `README.md`, `LICENSE`, `.editorconfig`, `docs/INDEX.md`, `docs/PHASES.md`, `docs/LOG.md`, `docs/PHASE1.md`, `docs/PHASE1_RUNS.md`
- Problems: None. Git repository and remote origin were connected to GitHub on branch `main`.
- Decisions: Configured `.gitignore` with strict exclusion for secrets, node_modules, dist, logs, and IDE folders.

---

## Run 1A: Scaffold

```
PHASE 1, RUN 1A: MONOREPO SCAFFOLD ONLY

Create the monorepo skeleton. Do NOT write any diagnostic logic yet.

1. Root: package.json with npm workspaces ["apps/*", "packages/*"], tsconfig.base.json
   (strict mode, ES2022, NodeNext modules), .editorconfig, LICENSE (MIT).
   Keep the existing .gitignore and README.md.
2. Folders with their own package.json + tsconfig.json + src/index.ts (placeholder export):
   apps/cli, packages/core, packages/rules, packages/adapters, packages/schemas, packages/config
   Package names: @stackdoctor/core, @stackdoctor/rules, @stackdoctor/adapters,
   @stackdoctor/schemas, @stackdoctor/config. CLI package name: stackdoctor.
   Do NOT create apps/api or apps/web yet.
3. packages/config: shared ESLint config and shared tsconfig that others extend.
4. Add vitest at the root with a trivial passing test in each package.
5. Root scripts: build, test, lint, typecheck (all run across workspaces).
6. Empty docs/ (architecture.md, diagnostics.md, security.md, installation.md, contributing.md
   each with a title only), examples/ and scripts/ folders (with .gitkeep).
7. Use project references or a simple build order so packages build in dependency order.

Run npm install, npm run build, npm test, npm run lint, npm run typecheck and fix anything failing.
Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] `npm install` succeeds with no errors
- [x] `npm run build`, `test`, `lint`, `typecheck` all pass
- [x] Packages import each other via `@stackdoctor/...` names (not relative paths)
- [x] No diagnostic logic exists yet

**Run log (Antigravity fills):**
- Files: `package.json`, `package-lock.json`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `apps/cli/*`, `packages/config/*`, `packages/schemas/*`, `packages/rules/*`, `packages/adapters/*`, `packages/core/*`, `docs/architecture.md`, `docs/diagnostics.md`, `docs/security.md`, `docs/installation.md`, `docs/contributing.md`, `examples/.gitkeep`, `scripts/.gitkeep`
- Command results: npm install (0), npm run build (0), npm test (6/6 passed), npm run lint (0), npm run typecheck (0)
- Problems: TS6059 rootDir path resolution in composite projects resolved with explicit rootDir/outDir in package tsconfigs. ESLint no-undef on globals resolved by adding Node + ES2021 globals to eslint configurations.
- Decisions: Monorepo uses npm workspaces and TypeScript project references (composite/references) for deterministic compilation and cross-workspace package resolution.

---

## Run 1B: Schemas

```
PHASE 1, RUN 1B: SHARED SCHEMAS (packages/schemas only)

Use zod. Export both the schemas and inferred TypeScript types.

Define:
- Severity: "info" | "low" | "medium" | "high" | "critical"
- Confidence: "confirmed" | "likely" | "possible"
- CheckStatus: "passed" | "warning" | "failed" | "skipped" | "error"
- Evidence: { id, kind, description, observed (sanitized string), source, collectedAt (ISO) }
  (evidence is OBSERVED FACTS only)
- TechnologyDetection: { name, confidence, evidence: Evidence[] }
- CheckResult: { id, title, category, status, durationMs, evidence: Evidence[], error? }
- Recommendation: { problem, relevance, commandOrAction, expectedResult, risks, undo?, verification }
- Finding: { ruleId, title, category, severity, confidence, status, evidence: Evidence[],
  possibleCauses: string[] (HYPOTHESES, kept separate from evidence),
  recommendations: Recommendation[], verificationStatus, docs: string[] }
- Report: { schemaVersion, toolVersion, operatingSystem, startedAt, completedAt, status
  ("completed"|"completed_with_warnings"|"failed"|"cancelled"), projectName, technologies,
  checks, findings, summary (counts by severity and status) }
- RuleDefinition metadata schema: { id, title, description, technologies, severity,
  confidence, docs }

Rules:
- Evidence strings must have a max length; reports have a max findings count.
- Export a helper validateReport(unknown) that returns a typed result or readable errors.
- Export a JSON Schema file for Report (zod-to-json-schema) to docs/report.schema.json.

Tests: valid report passes; missing fields fail; oversize evidence fails; unknown severity fails;
possibleCauses and evidence cannot be mixed up (separate fields).
Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] Tests for valid and invalid reports pass
- [x] `docs/report.schema.json` is generated
- [x] Evidence and possibleCauses are separate fields
- [x] Other packages can import types from `@stackdoctor/schemas`

**Run log (Antigravity fills):**
- Files: `packages/schemas/package.json`, `packages/schemas/src/enums.ts`, `packages/schemas/src/evidence.ts`, `packages/schemas/src/checks.ts`, `packages/schemas/src/findings.ts`, `packages/schemas/src/rules.ts`, `packages/schemas/src/report.ts`, `packages/schemas/src/json-schema.ts`, `packages/schemas/src/index.ts`, `packages/schemas/test/report.test.ts`, `packages/rules/test/index.test.ts`, `scripts/generate-schema.mjs`, `docs/report.schema.json`
- Command results: npm run build (0), node ./scripts/generate-schema.mjs (0), npm test (12/12 passed across 7 test suites), npm run lint (0), npm run typecheck (0)
- Problems: Missing `CONFIG_SOURCE` re-export fixed in schemas `index.ts`. Explicit typing used in tests to avoid `@typescript-eslint/no-explicit-any` warnings.
- Decisions: Configured string length limits on Evidence (`MAX_EVIDENCE_OBSERVED_LENGTH = 10_000`) and max finding items on Report (`MAX_REPORT_FINDINGS = 1_000`). Used `zod-to-json-schema` to export `docs/report.schema.json`.

---

## Run 1C: Core (redaction, scanner, lifecycle)

```
PHASE 1, RUN 1C: CORE ENGINE (packages/core)

Build three things, each in its own module with tests.

A) Redaction (src/redact.ts)
- redactText(input): masks common secrets: password=..., token=..., api_key=..., secret=...,
  Authorization: Bearer ..., AWS keys, JWT-looking strings, private key blocks, and credentials
  inside URLs (mongodb://user:pass@host -> mongodb://***:***@host).
- redactEnv(obj): keeps variable NAMES, replaces every value with "[REDACTED]".
- Tests with many realistic samples, including false-positive checks (normal text unchanged).

B) Project scanner (src/scanner.ts)
- scanProject(dir): validates dir exists and is a directory; resolves to a real path.
- Walk files with limits: ignore node_modules, .git, dist, build, .next, venv, .venv, __pycache__;
  max depth and max file count; do NOT follow symlinks that resolve outside the project.
- Detect (with confidence + evidence per detection): Node.js (package.json), Vite (vite.config.*),
  Next.js (next.config.*), Django (manage.py AND/OR django in requirements/pyproject; requirements.txt
  alone is NOT proof of Django), Python (requirements.txt, pyproject.toml), npm/pnpm/yarn lockfiles,
  Docker (Dockerfile), Compose (compose.yaml / docker-compose.yml), .env.example.
- Monorepo support: detect technologies in subfolders (apps/*, packages/*) and report their paths.
- Never read .env or private key files; only note .env.example existence.
- Tests using temporary fixture directories: plain Node, Vite, Django, monorepo, empty dir,
  symlink escape attempt, path traversal input.

C) Lifecycle (src/runner.ts)
- runDiagnostics({ dir, rules, adapters?, signal?, timeoutMs }) following: validate dir ->
  apply ignore rules -> detect technologies -> load applicable rules -> run checks with per-check
  timeouts -> normalize to CheckResult -> match rules -> build Report (validated with schemas).
- A check that throws or times out becomes a CheckResult with status "error"; the run continues.
- Support cancellation via AbortSignal (status "cancelled").
- Structured logging via a small logger interface (no secrets in logs).
- Tests: failing check does not crash run; timeout handled; cancellation; report validates.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Redaction masks all sample secrets and leaves normal text alone
- [ ] `requirements.txt` alone does not produce "Django"
- [ ] Symlink-escape and path-traversal tests pass
- [ ] A throwing check and a timing-out check both leave the run completed
- [ ] Output report passes `validateReport`

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 1D: Rules registry

```
PHASE 1, RUN 1D: RULE REGISTRY (packages/rules)

1. Rule interface requires: id, title, description, technologies, preconditions(ctx),
   requiredEvidence, evaluate(evidence) -> Finding | null, severity, confidence,
   recommendedChecks, remediation (list of Recommendation), verification, docs.
2. RuleRegistry: register(rule), get(id), list(), forTechnologies(techs).
   Reject duplicate IDs and rules with missing fields (validate at registration).
3. Two sample rules, deterministic and evidence-based:
   - NODE_DEPS_NOT_INSTALLED: package.json exists but node_modules is absent.
     Evidence only: file presence. Possible causes kept separate. Recommendation: run the
     project's package-manager install (suggestion only, risks + verification included).
   - ENV_EXAMPLE_PRESENT_NO_ENV: .env.example exists but no .env. Report variable NAMES only,
     never contents. Do not read .env values.
4. Each rule must not overclaim (state what was observed vs what might be true).
5. Unit tests per rule: triggers, does not trigger, wording separates facts from hypotheses.
6. Add both rules to docs/diagnostics.md using a documented template.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Duplicate rule ID is rejected
- [ ] Both rules have trigger and non-trigger tests
- [ ] Findings contain evidence and possibleCauses as separate fields
- [ ] No env values are read or printed

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 1E: CLI, output, README, final verification

```
PHASE 1, RUN 1E: CLI + OUTPUT (apps/cli)

1. Command: stackdoctor scan [path] (default: current directory)
   Flags: --json (print JSON to stdout), --out <file> (write JSON report), --no-color,
   --version, --help. Exit codes: 0 no failures, 1 findings at high/critical, 2 tool error.
2. Terminal output sections, in order: scan summary, technologies detected (with confidence),
   environment info (OS, Node version), passed checks, warnings, failed checks,
   evidence per finding (clearly labeled OBSERVED), probable causes (clearly labeled
   POSSIBLE), recommended next steps, tool version. Readable on Windows, Linux, macOS terminals.
3. JSON output must pass validateReport before being printed or written. If it does not,
   exit with code 2 and a clear message.
4. Never scan outside the given path. Print a clear error for a missing/invalid path.
5. Create examples/broken-node-project (package.json, no node_modules, .env.example, no .env)
   so the sample rules trigger.
6. Tests: CLI end-to-end against the example (expected rule IDs appear), --json output validates,
   --out writes a valid file, invalid path error, exit codes.
7. Update README: install (npm link for local use), usage, example output, what Phase 1 covers.

Then run the FULL verification: npm install, build, test, lint, typecheck, and
`stackdoctor scan examples/broken-node-project` plus `--json`. Paste the actual outputs
into this run's log.

Then follow the POST-RUN PROTOCOL in PHASE1.md. Also mark Phase 1 as Done in INDEX.md
only if every item in the Final Phase 1 checklist below truly passed.
```

**Final Phase 1 checklist**
- [ ] `npm install` and `npm run build` succeed from the repo root
- [ ] `stackdoctor scan examples/broken-node-project` prints a readable report with both sample findings
- [ ] `--json` output validates against the schema
- [ ] A deliberately failing check does not crash the run
- [ ] Redaction tests pass
- [ ] Scanner ignores node_modules/.git and does not follow outside symlinks
- [ ] All tests pass
- [ ] README matches what actually exists
- [ ] Everything committed and pushed

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Fix prompt (when a run breaks)

```
In StackDoctor Phase 1, Run [X], this problem occurs:
[exact error / unexpected behavior]
Steps to reproduce: [...]
Expected: [...]  Actual: [...]
Fix the root cause (not a workaround), add a regression test, do not change unrelated files.
Then follow the POST-RUN PROTOCOL in PHASE1.md (commit message: fix(...): ...).
```

## If Antigravity drifts

Send: *"Stop. Revert anything outside the scope of this run and continue only with the listed items."*
