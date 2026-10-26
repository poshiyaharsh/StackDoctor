# StackDoctor: Phase 4 (Developer Integrations), Living File

**Goal:** StackDoctor fits into existing development workflows: GitHub issues, CI pipelines, report comparison, and easy rule contributions.
**Builds on Phases 1 to 3.** Extend, do not rewrite. The CLI must keep working fully offline.
Antigravity updates this file after every run. Keep it in the repo root with the other phase files.

## How to use

1. New Antigravity session: paste the **Master Context** from `PHASES.md`.
2. Paste the run prompt (4A, then 4B, ...). Do the runs in order.
3. Antigravity follows the **POST-RUN PROTOCOL in PHASE1.md** itself (self-review, verify, update docs, commit, push).
4. Bring failures or oddities to Claude.

## Status tracker (Antigravity updates this)

| Run | Focus | Status | Commit | Date |
|---|---|---|---|---|
| 4A | GitHub issue draft generation | Done | 5fae252 | 2026-10-26 |
| 4B | CI mode, stable output, GitHub Actions integration | Done | pending | 2026-10-26 |
| 4C | Report comparison (CLI, API, web) | Not started | - | - |
| 4D | Documentation links + contributor rule interface | Not started | - | - |
| 4E | Docs, end-to-end checks, final verification | Not started | - | - |

Status values: Not started, In progress, Needs fixes, Done.

## Phase 4 ground rules (apply to every run)

- Nothing is ever posted, pushed, or sent automatically. StackDoctor only GENERATES text/files; the user posts them.
- Everything that leaves the machine (issue drafts, CI summaries, comparisons) passes through core redaction first, and contains no machine identifiers (hostname, username, home directory paths, IPs). Paths are shown project-relative.
- Output formats are a public contract: versioned, documented, and covered by snapshot tests so changes are deliberate.
- CI behavior must be deterministic: same input gives same output and exit code. No color or prompts in CI mode.
- GitHub Actions: no secrets required for local diagnostics, minimal permissions (`contents: read`), third-party actions pinned to full commit SHAs.
- Documentation links: https only, from an allowlist of domains, never built from untrusted evidence text.

---

## Run 4A: GitHub issue draft generation

```
PHASE 4, RUN 4A: ISSUE DRAFTS

1. Core function buildIssueDraft(report, options) in packages/core returning { title, body, labels }.
   Body is GitHub-flavored markdown with sections: Summary, Environment (OS, runtime versions, tool
   version), Detected technologies, Findings (title, severity, rule id), Evidence (OBSERVED only),
   Possible causes (labeled as hypotheses), Steps already suggested, Steps to reproduce (placeholder for the
   user to fill), Additional context (placeholder). Large reports are truncated with a clear note,
   respecting GitHub's body size limit.
2. Sanitization: run core redaction over the whole body; replace absolute paths and the user's home
   directory with project-relative paths or "<project>"; omit hostname/username/IPs. Findings below a
   chosen severity can be excluded with --min-severity.
3. CLI: `stackdoctor issue [reportFile | path]` with flags --min-severity, --out <file>, --copy
   (clipboard, only if a safe cross-platform method is available; otherwise print), --no-evidence.
   It prints a PREVIEW of exactly what would be shared and states: "Review before posting. Nothing was sent."
   It NEVER calls GitHub or any network API.
4. Web: on the Diagnostic Report page add a "Copy issue draft" button that produces the same draft
   from the stored sanitized report (reuse the core function, do not reimplement).
5. Tests: snapshot test of the draft; canary secret and absolute paths never appear; truncation works;
   --min-severity filters; no network access during `issue` (mock and assert); evidence/hypothesis
   separation preserved.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] Draft contains no secrets, usernames, hostnames, or absolute home paths
- [x] Evidence and possible causes stay in separate, labeled sections
- [x] `issue` makes no network calls
- [x] Web button and CLI produce identical drafts (shared function)

**Run log (Antigravity fills):**
- Files:
  - `packages/core/src/issue-draft.ts`: Core `buildIssueDraft(report, options)` and `sanitizeDraftContent` implementing all required GitHub markdown sections, length truncation at 60,000 chars, path/username/hostname/IP sanitization, and secret redaction.
  - `packages/core/src/redact.ts`: Enhanced key-value secret regex to capture prefixed secret variable names (e.g., `DB_PASSWORD=...`, `APP_SECRET=...`).
  - `packages/core/src/index.ts`: Re-exported `buildIssueDraft` and types.
  - `packages/core/package.json`: Exposed `./issue-draft` subpath export.
  - `packages/core/test/issue-draft.test.ts`: 8 unit tests covering layout snapshots, canary secret redaction, absolute path & username/hostname/IP sanitization, evidence/hypothesis strict separation, `--min-severity` filtering, `--no-evidence`, and body truncation.
  - `apps/cli/src/clipboard.ts`: Safe cross-platform clipboard copy utility for Windows (`clip`), macOS (`pbcopy`), and Linux (`xclip` / `wl-copy`).
  - `apps/cli/src/index.ts`: Added `stackdoctor issue [reportFile | path]` with `--min-severity`, `--out <file>`, `--copy`, and `--no-evidence` flags; prints full preview with disclaimer and guarantees 0 network calls.
  - `apps/cli/test/issue.test.ts`: CLI test suite verifying preview output, 100% offline network isolation (mocking fetch, http, and https), `--no-evidence`, `--min-severity`, `--out`, and error handling.
  - `apps/web/package.json`: Added `@stackdoctor/core` dependency.
  - `apps/web/vite.config.ts`: Aliased `@stackdoctor/core/issue-draft` and `@stackdoctor/core`.
  - `apps/web/src/components/ui/Badge.tsx`: Added variant alias mappings (`danger`, `warning`, `default`).
  - `apps/web/src/pages/ReportDetailPage.tsx`: Added "Copy Issue Draft" button using the shared `buildIssueDraft` core function.
  - `apps/web/test/app-pages.test.tsx`: Verified Copy Issue Draft button copies draft markdown to clipboard.
  - `vitest.config.ts`: Added `@stackdoctor/core/issue-draft` alias.
- Command results:
  - `npm run build`: Exit 0
  - `npm run lint`: Exit 0 (0 errors, 0 warnings)
  - `npm run typecheck`: Exit 0
  - `npm test`: Exit 0 (39/39 suites, 247/247 tests passed)
  - `npm run eval`: Exit 0 (100% detection, 0% false positives)
- Problems:
  - Secret key regex in `redact.ts` missed prefixed variables like `export DB_PASSWORD=...`: Enhanced regex to support `(?:\w*[_-])?(?:password|token|secret|...)`.
  - Badge variant type mismatch: Supported variant aliases `danger`, `warning`, `default` with automatic normalization.
- Decisions:
  - Isomorphic `issue-draft.ts`: Keeps zero runtime Node dependencies so it imports directly into React web app, CLI, and API.
  - Truncation limit: Set to 60,000 characters (comfortably within GitHub's 65,536 limit) with clean boundary cutting and alert banner.

---

## Run 4B: CI mode, stable output, GitHub Actions

```
PHASE 4, RUN 4B: CI INTEGRATION

1. CLI flags for `scan` (additive; existing behavior unchanged):
   --ci (no color, no prompts, no spinners, deterministic ordering, non-interactive),
   --fail-on <info|low|medium|high|critical> (exit code 1 if any finding >= threshold; default high),
   --quiet, and --format <text|json|markdown> (markdown = compact summary for GitHub step summaries).
   Exit codes documented and stable: 0 ok, 1 findings at/above threshold, 2 tool error, 3 invalid usage.
2. JSON report stability: schemaVersion bumped only on breaking changes; add docs/report-format.md
   describing every field, plus a CHANGELOG section for schema changes. Add a snapshot test that fails
   if the JSON shape changes unintentionally. Ordering of findings is deterministic (severity, then rule id).
3. Markdown summary format (--format markdown): counts by severity, table of findings with rule ids,
   collapsed details. Redacted and project-relative paths only.
4. GitHub Actions integration (optional, no secrets needed):
   - docs/ci.md with a copy-paste workflow example: checkout, setup-node, install stackdoctor, run
     `stackdoctor scan --ci --fail-on high --format markdown >> $GITHUB_STEP_SUMMARY` and upload the JSON
     report as an artifact.
   - A reusable composite action at action.yml in the repo root wrapping the same steps, with inputs
     (path, fail-on, upload-artifact). Permissions: contents read only.
   - Pin every third-party action in examples and the composite action to a full commit SHA (with a
     comment naming the version). Do not use `pull_request_target`. Do not echo untrusted input into
     shell commands (pass inputs via env vars, quote them).
   - No upload to the StackDoctor server from CI by default.
5. Tests: exit code matrix for every threshold; --ci output has no ANSI codes or prompts; deterministic
   output across two runs on the same fixture; markdown snapshot; invalid flag => exit 3.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] Exit code matrix tests pass and are documented
- [x] `--ci` output is deterministic with no ANSI codes or prompts
- [x] JSON shape change fails a snapshot test
- [x] Workflow/action use minimal permissions and SHA-pinned actions
- [x] No untrusted input is interpolated into shell commands in the action

**Run log (Antigravity fills):**
- Files:
  - `packages/core/src/runner.ts`: Added deterministic sorting `sortFindingsDeterministically` (by severity descending, then ruleId ascending) to `runDiagnostics`.
  - `apps/cli/src/format.ts`: Added `formatMarkdownReport` formatting compact summaries for `$GITHUB_STEP_SUMMARY` with severity counts, detected issues table, collapsed finding details, and secret/path redaction.
  - `apps/cli/src/index.ts`: Added `--ci`, `--fail-on <severity>`, `--quiet`, `--format <text|json|markdown>` flags to `scan`; added `InvalidUsageError` returning exit code 3 on bad syntax/flags; updated help documentation with exit code contract (0, 1, 2, 3).
  - `docs/report-format.md`: Authored comprehensive JSON report schema documentation describing all top-level and nested fields, enums, stability guarantee, and CHANGELOG.
  - `docs/ci.md`: Comprehensive CI guide with copy-paste GitHub Actions workflow, SHA-pinned dependencies, minimal `contents: read` permissions, exit codes, and GitLab CI example.
  - `action.yml`: Reusable GitHub composite action wrapping StackDoctor scan with safe env-variable input passing and SHA-pinned steps.
  - `packages/schemas/test/report-stability.test.ts`: Snapshot test validating the Report JSON structure against unintentional breaking changes.
  - `apps/cli/test/ci.test.ts`: 14 tests covering exit code matrix (`info`, `low`, `medium`, `high`, `critical`), ANSI code absence in `--ci`, deterministic findings order across runs, markdown snapshot, and exit code 3 on invalid usage.
- Command results:
  - `npm run build`: Exit 0
  - `npm run lint`: Exit 0 (0 errors, 0 warnings)
  - `npm run typecheck`: Exit 0
  - `npm test`: Exit 0 (41/41 suites, 264/264 tests passed)
  - `npm run eval`: Exit 0 (100% detection, 0% false positives)
- Problems:
  - ESLint `no-control-regex` triggered on ANSI test: Replaced regex with `.includes("\x1b[")` to eliminate control characters cleanly.
  - Unused result in schema stability test: Added assertion `expect(result.success).toBe(true)`.
- Decisions:
  - Stable exit codes: 0 = OK, 1 = findings at/above `--fail-on`, 2 = tool error, 3 = invalid usage.
  - Action inputs passed via environment variables (never directly interpolated into shell command strings) to prevent injection.

---

## Run 4C: Report comparison

```
PHASE 4, RUN 4C: COMPARE REPORTS

1. Core function compareReports(base, head) in packages/core, pure and deterministic. Finding identity =
   ruleId + a stable key from the evidence subject (e.g. port number, service name), documented.
   Result: { newFindings, resolvedFindings, unchangedFindings, changedFindings (severity/confidence/status
   changed, with before/after), environmentChanges (OS, runtime versions, tool version),
   technologyChanges, summaryDelta }.
2. CLI: `stackdoctor compare <baseReport.json> <headReport.json>` with --format <text|json|markdown> and
   --fail-on-new <severity> (exit 1 if new findings at/above the threshold; useful in CI). Both files are
   validated with the shared schema; clear errors for invalid or too-large files. Never executes anything
   from the files.
3. API: GET /api/v1/diagnostic-runs/compare?base=<runId>&head=<runId>. Owner-scoped (both runs must belong
   to the caller, otherwise 404), ObjectId validated, uses the same core function.
4. Web: Compare page (pick two runs of a project; side-by-side summary with New / Resolved / Changed
   groups, environment differences). Add a "Compare with previous run" button on the report page.
   Render as plain text; no HTML injection.
5. Tests: new/resolved/changed/unchanged cases; identical reports => empty diff; different tool versions;
   unauthorized access to another user's run returns 404; malformed ids; deterministic ordering;
   CLI exit codes with --fail-on-new.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Comparing a report with itself gives an empty diff
- [ ] Cross-user comparison attempts return 404
- [ ] CLI, API, and web all use the single core function
- [ ] `--fail-on-new` exit codes tested

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 4D: Documentation links and contributor rule interface

```
PHASE 4, RUN 4D: DOC LINKS + CONTRIBUTING RULES

1. Documentation links:
   - Every rule has `docs: string[]` of https URLs from an allowlist of domains (e.g. nodejs.org,
     docs.python.org, docs.djangoproject.com, mongodb.com/docs, dev.mysql.com, docs.docker.com,
     docs.npmjs.com, and the project's own docs). Validation in the schema/registry rejects others.
   - Links come from rule definitions only, never from evidence or project files.
   - CLI: `stackdoctor explain <ruleId>` prints the rule's description, evidence required, possible causes,
     remediation, verification, and doc links. Unknown id => helpful error listing similar ids.
   - Web Finding Details already shows links; make sure it uses the same validated data.
2. Contributor-facing rule interface:
   - docs/contributing.md: how to add a rule step by step (rule file, registration, evidence
     requirements, unit tests, docs entry, fixture if needed), code style, the evidence-vs-hypothesis
     writing guide, and the "never overclaim" checklist with good and bad examples.
   - Generator: `npm run new-rule -- --id MY_RULE_ID --tech node` creates the rule file from a template,
     a test file with trigger / non-trigger / wording tests, and a docs/diagnostics.md entry stub.
   - A rule-lint test that runs over ALL registered rules and fails if any rule: lacks a required field,
     has an id not in UPPER_SNAKE_CASE, has duplicate id, has no docs entry, has no test file, has no
     recommendation verification step, or puts hypothesis wording ("probably", "might") in evidence.
   - CONTRIBUTING.md at repo root (short; links to docs/contributing.md), PR template, and issue
     templates (bug report with the `stackdoctor issue` instructions, new rule proposal, false positive report).
3. Tests: allowlist rejects non-allowlisted and http links; `explain` output snapshot; generator output
   compiles and its generated test passes; rule-lint catches a deliberately bad rule in a test fixture.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Non-allowlisted or http doc links are rejected
- [ ] A new rule can be added using only docs/contributing.md and the generator
- [ ] Rule-lint fails on a deliberately bad rule
- [ ] `explain` works for every built-in rule
- [ ] Issue and PR templates exist

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 4E: Docs, end-to-end checks, final verification

```
PHASE 4, RUN 4E: FINAL VERIFICATION

1. End-to-end script scripts/e2e-phase4: on a fixture project run `scan --ci --format json --out a.json`,
   change the fixture (fix one issue), run again to b.json, then `compare a.json b.json`, `issue a.json`,
   `explain <ruleId>`, and check exit codes and outputs. Also run the compare API path against a local API.
2. Security checks (add missing tests): canary secret and absolute paths never appear in issue drafts,
   markdown summaries, compare output, or CI logs; oversized/malformed report files handled; the composite
   action passes inputs via env vars (grep-based test for unquoted `${{ inputs.* }}` inside run: blocks).
3. Docs: README (new commands: issue, compare, explain, CI flags), docs/ci.md, docs/report-format.md,
   docs/contributing.md, docs/diagnostics.md all match what actually exists. Add a CHANGELOG.md with the
   changes so far.
4. Run the full verification: install, build, lint, typecheck, test, npm audit, e2e scripts for phases 3 and 4.
   Paste outputs here.

Then follow the POST-RUN PROTOCOL in PHASE1.md. Mark Phase 4 Done in INDEX.md only if the Final
Phase 4 checklist truly passed.
```

**Final Phase 4 checklist**
- [ ] Issue drafts contain no secrets, machine identifiers, or absolute paths
- [ ] Exit codes match the documented thresholds
- [ ] Compare correctly shows new, resolved, and changed findings
- [ ] CI mode output is deterministic
- [ ] A new rule can be added by following the guide alone
- [ ] Actions workflow uses minimal permissions, SHA-pinned actions, no unsafe interpolation
- [ ] Nothing is ever posted or sent automatically
- [ ] `npm audit` has no unaddressed high/critical issues
- [ ] All e2e scripts pass
- [ ] Docs match what actually exists
- [ ] Everything committed and pushed

**Run log (Antigravity fills):**
- Files:
- Command results:
- Audit results:
- Problems:
- Decisions:

---

## Fix prompt (when a run breaks)

```
In StackDoctor Phase 4, Run [X], this problem occurs:
[exact error / unexpected behavior]
Steps to reproduce: [...]
Expected: [...]  Actual: [...]
Fix the root cause (not a workaround), add a regression test, do not change unrelated files.
Then follow the POST-RUN PROTOCOL in PHASE1.md (commit message: fix(...): ...).
```

## If Antigravity drifts

Send: *"Stop. Revert anything outside the scope of this run and continue only with the listed items."*
