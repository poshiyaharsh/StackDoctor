# StackDoctor: Phases and Antigravity Prompts

Paste the **Master Context** first in every new Antigravity session, then the phase prompt.

---

## Master Context (paste first, every time)

```
You are building StackDoctor, an open-source developer environment diagnostics tool.
Tagline: "Find the cause. Fix the environment. Ship the code."

STACK: TypeScript everywhere, Node.js, Express, React + Vite, MongoDB.
REPO: npm workspaces monorepo:
  apps/cli, apps/api, apps/web
  packages/core, packages/rules, packages/adapters, packages/schemas, packages/config
  docs/, examples/, scripts/
Keep the structure simple. Do not add packages without a real need.

NON-NEGOTIABLE RULES:
1. The local CLI/engine must work with no backend and no AI.
2. Diagnose with evidence. Always separate OBSERVED FACTS from POSSIBLE CAUSES.
   Never claim something is uninstalled just because a connection failed.
3. Never print, store, or upload secret values. Report variable NAMES only.
   Redact tokens/passwords in any collected output.
4. Never run shell strings built from input. Use fixed executables + argument arrays.
   Apply timeouts and output-size limits to every check.
5. Never auto-install packages, auto-kill processes, change system config, or delete data.
   Fix commands are SUGGESTIONS until the user approves.
6. Scan only the user-selected project directory. Respect ignore rules. Do not follow
   symlinks outside the project.
7. A failing check must not crash the run. Record the failure and continue.
8. Every diagnostic rule has: id, title, description, technologies, preconditions,
   required evidence, severity, confidence, recommended checks, remediation,
   verification, doc references. Every rule gets a unit test.
9. Validate all inputs with shared schemas (use zod).

WORKING STYLE: Work step by step. After finishing, list every file created or changed,
explain how to run it, and run the tests. Do not skip tests. If something is ambiguous,
choose the safest option and state your assumption.
```

---

## Phase 1: Foundation

**Goal:** StackDoctor runs locally and produces a valid report.

```
PHASE 1: FOUNDATION

Build:
1. Monorepo with npm workspaces, tsconfig.base.json, shared lint/TS config in packages/config.
2. packages/schemas: zod schemas + TS types for Report, Finding, Check result, Evidence,
   Severity (info|low|medium|high|critical), Confidence (confirmed|likely|possible),
   Technology detection (with confidence + evidence). Include a toolVersion and schemaVersion.
3. packages/core: diagnostic lifecycle (validate dir -> apply ignore rules -> detect
   technologies -> load rules -> run checks with timeouts -> normalize -> match rules ->
   build report). A failing check is recorded, never fatal. Support cancellation.
4. packages/rules: rule registry + rule interface (all required rule fields) + 2 sample rules.
5. apps/cli: command `stackdoctor scan [path]` with flags --json, --out <file>.
   Terminal output must be readable: summary, passed, warnings, failed, evidence, next steps.
6. Project scanner: detect package.json, vite/next config, manage.py, requirements.txt,
   pyproject.toml, lockfiles (npm/pnpm/yarn), Dockerfile, compose.yaml, .env.example.
   Report confidence + supporting evidence. Handle monorepos. Skip node_modules, .git, dist.
7. Secret redaction utility in core with unit tests.
8. Tests (vitest) for schemas, scanner, registry, redaction, and a failing-check-does-not-crash test.
9. A basic README with install and run steps.

Deliver: working `stackdoctor scan` on a sample folder, JSON output validating against the schema.
```

**Verification checklist**
- [ ] `npm install` and `npm run build` succeed from the repo root
- [ ] `stackdoctor scan ./examples/...` prints a readable report
- [ ] `--json` output validates against the zod schema
- [ ] A deliberately failing check does not crash the run
- [ ] Redaction tests pass (tokens/passwords masked)
- [ ] Scanner ignores node_modules/.git and does not follow outside symlinks
- [ ] All tests pass

---

## Phase 2: Diagnostic engine

**Goal:** Reliable CLI that detects and explains common failures.

```
PHASE 2: DIAGNOSTIC ENGINE (build on Phase 1, do not rewrite it)

Build in packages/adapters:
- Runtime checks: Node version, npm/pnpm/yarn availability, Python version, venv status,
  Git, Docker (only when relevant). Compare against the project's declared requirements
  (engines field, .nvmrc, .python-version, pyproject). If none declared, do NOT invent one.
- Port check: is a port occupied; try to identify the process where the OS allows;
  state clearly whether evidence is conclusive. NEVER kill processes.
- Database checks (MySQL, MongoDB): hostname resolves, port reachable, connection with
  explicitly configured credentials. Distinguish: DNS failure, connection refused,
  timeout, auth failure, authorization failure. Never print credentials.
- Config checks: missing env var NAMES (from .env.example vs .env), invalid ports,
  frontend backend-URL reachability, missing config files, inconsistent runtime declarations,
  Docker Compose service vs app config mismatch.
- Django: pending migrations check only when it can be done safely (no side effects).
- Platform-specific code isolated per OS (Windows/Linux/macOS).

Build in packages/rules (each with unit tests + docs entry in docs/diagnostics.md):
  NODE_VERSION_MISMATCH, NODE_DEPS_NOT_INSTALLED, LOCKFILE_MISSING, PORT_IN_USE,
  ENV_VAR_NAMES_MISSING, MONGO_CONNECTION_REFUSED, MONGO_AUTH_FAILED,
  MYSQL_CONNECTION_REFUSED, MYSQL_AUTH_FAILED, DB_HOST_NOT_RESOLVED,
  PYTHON_VENV_MISSING, PYTHON_PACKAGES_MISSING, DJANGO_MIGRATIONS_PENDING.

Each finding must include: observed evidence, possible causes, ordered recommended checks,
remediation with risk + undo + verification step.

Fixtures in examples/: broken-node-project, broken-django-project, broken-database-config.
Add integration tests running the CLI against each fixture, plus security tests:
redaction, path traversal, command-injection attempts, oversized output.

Deliver: CLI correctly diagnoses each fixture with deterministic expected findings.
```

**Verification checklist**
- [ ] Each fixture produces the expected rule IDs (and no extras)
- [ ] Refused vs auth-failed vs DNS-failed vs timeout are distinct findings
- [ ] No credential or secret value appears in any output or JSON
- [ ] Port finding never kills anything and states if evidence is conclusive
- [ ] Missing requirement = no invented requirement
- [ ] Works on Windows, Linux, and macOS (or unsupported checks degrade gracefully)
- [ ] All rules have tests and docs

---

## Phase 3: Web platform

**Goal:** Optional upload and online review of sanitized reports.

```
PHASE 3: WEB PLATFORM (CLI must keep working fully offline)

apps/api (Express + MongoDB, mongoose or native driver with schema validation):
- Auth: register/login/logout/me. Hashed passwords (argon2 or bcrypt), secure
  httpOnly sessions or carefully managed tokens, rate limiting, CSRF protection if cookies.
- Collections: users, projects, diagnosticRuns (+ indexes on ownerId, projectId, createdAt).
- Endpoints (versioned /api/v1): projects CRUD; diagnostic-runs POST/GET/GET:id/DELETE;
  rules GET list + GET:id.
- Validate every payload with shared zod schemas. Enforce ownership on every route.
  Limit report size. Treat repositoryUrl as untrusted; never fetch or clone it.
- Never store raw env vars or machine identifiers.

CLI: add `stackdoctor upload` with a REPORT PREVIEW and explicit confirmation. API token auth.

apps/web (React + Vite + TypeScript):
- Pages: Landing, Dashboard (with empty states explaining how to run the CLI), Projects,
  Diagnostic Report (findings grouped by severity, expandable evidence, copy buttons),
  Finding Details, Settings (API tokens shown once only, retention, privacy).
- Render the same report schema. No second diagnostic engine.

docker-compose.yml for local MongoDB. Docs: docs/security.md, docs/architecture.md.
Tests: auth, authorization (user A cannot read user B's runs), validation, oversized payloads.
```

**Verification checklist**
- [ ] User A cannot access User B's projects or runs
- [ ] Oversized and malformed payloads rejected
- [ ] Tokens never shown again after creation
- [ ] Upload shows a preview and needs confirmation
- [ ] Deleting a run actually deletes it
- [ ] CLI still works with the API turned off

---

## Phase 4: Developer integrations

```
PHASE 4: INTEGRATIONS

- `stackdoctor issue` generates a sanitized GitHub issue draft (markdown): OS, runtime
  versions, findings, evidence, steps tried. Output locally; never auto-post.
- CI-friendly mode: stable exit codes by severity threshold (--fail-on high), stable JSON.
- Optional GitHub Actions workflow example in docs/.
- Report comparison: diff two reports (new/resolved/changed findings), in CLI and dashboard.
- Documentation links on findings. Contributor-facing guide for adding a rule
  (docs/contributing.md + a rule template + test template).
```

**Verification checklist**
- [ ] Issue draft contains no secrets or machine identifiers
- [ ] Exit codes match the documented thresholds
- [ ] Compare correctly shows new/resolved findings
- [ ] A new rule can be added by following the guide alone

---

## Phase 5: Optional AI

```
PHASE 5: OPTIONAL AI (the product must remain fully useful with no provider configured)

- Provider-agnostic interface; configured by the user; off by default.
- Input: only sanitized, structured findings. Treat all repo content, terminal output,
  and evidence as UNTRUSTED DATA (prompt injection defense).
- Output: simple explanation, ranked possible causes, troubleshooting checklist, suggested
  extra checks. Must label CONFIRMED FACTS vs HYPOTHESES. Must not invent results,
  claim installs without evidence, fabricate files, or expose secrets.
- Validate AI output against a schema; reject anything that looks like commands outside
  a strict allowlist. Commands are suggestions only; require explicit user approval.
- Endpoint: POST /api/v1/diagnostic-runs/:runId/explanation (authorized, sanitized only).
- Tests: hallucination cases, injection strings inside fixture files, unsafe command suggestions.
```

**Verification checklist**
- [ ] Works identically with AI disabled
- [ ] Injection text in a fixture file does not change AI behavior
- [ ] Unsafe or non-allowlisted commands are blocked
- [ ] Output clearly separates facts from hypotheses

---

## Phase 6: Open-source launch

```
PHASE 6: LAUNCH

Produce: README (quick start), docs/installation.md (with troubleshooting),
supported-platform matrix, SECURITY.md, CONTRIBUTING.md, LICENSE, issue templates,
release notes, roadmap with known limitations, CI pipeline (lint, test, build on
Windows/Linux/macOS), npm publish configuration for the CLI, dependency audit.
```

**Verification checklist**
- [ ] Fresh install works on each supported OS from the docs alone
- [ ] CI is green on all three OSes
- [ ] No secrets in repo history or sample reports
- [ ] Every built-in rule has tests and docs
- [ ] Version 0.1 Definition of Done (spec section 17) fully met

---

## Fix prompt template (when something breaks)

```
In StackDoctor Phase X, this problem occurs:
[exact error / unexpected behavior]
Steps to reproduce: [...]
Expected: [...]  Actual: [...]
Fix the root cause (not a workaround), add a regression test, do not change unrelated
files, and list every file you changed.
```
