# StackDoctor: Phase 6 (Open-Source Launch), Living File

**Goal:** An installable open-source product that developers can test and contribute to. Version 0.1.0.
**Builds on Phases 1 to 5.** Launch work only: hygiene, packaging, CI, docs, demo assets, verification. No new product features.
Antigravity updates this file after every run. Keep it in the repo root with the other phase files.

## How to use

1. New Antigravity session: paste the **Master Context** from `PHASES.md`.
2. Paste the run prompt (6A, then 6B, ...). Do the runs in order.
3. Antigravity follows the **POST-RUN PROTOCOL in PHASE1.md** itself (self-review, verify, update docs, commit, push).
4. Do the **Human-only steps** (bottom of this file) yourself. Antigravity must not do them.
5. Bring failures or oddities to Claude.

## Status tracker (Antigravity updates this)

| Run | Focus | Status | Commit | Date |
|---|---|---|---|---|
| 6A | Repo hygiene, secret scan, dependency + license audit, security policy | Done | ee5123e | 2026-10-27 |
| 6B | npm packaging and fresh-install testing | Not started | - | - |
| 6C | CI/CD pipeline and release automation (no publishing) | Not started | - | - |
| 6D | Documentation, templates, roadmap, known limitations | Not started | - | - |
| 6E | Demo script, launch assets, honest launch posts | Not started | - | - |
| 6F | Version 0.1 Definition-of-Done verification | Not started | - | - |

Status values: Not started, In progress, Needs fixes, Done.

## Phase 6 ground rules (apply to every run)

- NEVER run `npm publish`, `npm login`, `git tag` pushes, GitHub release creation, or anything that publishes publicly. Prepare everything and verify with dry runs only. The user does publishing (see Human-only steps).
- No fabricated claims anywhere: no invented download counts, testimonials, benchmarks, "trusted by", or supported-platform claims that were not tested. Numbers come only from real eval/CI output.
- Every command in the docs must be run and verified to work as written (copy-paste test).
- Do not add features. If something is missing for launch, record it in the roadmap or known limitations instead.
- Any secret found in the repo or git history: STOP, report it to the user, do not try to rewrite history yourself.
- CI workflows: minimal permissions, third-party actions pinned to full commit SHAs, no `pull_request_target`, no untrusted input interpolated into shell commands.

---

## Run 6A: Repo hygiene, secret scan, audits, security policy

```
PHASE 6, RUN 6A: HYGIENE AND SECURITY

1. Secret scan: scan the working tree AND full git history for secrets (use gitleaks or trufflehog if
   installable via the allowed package sources; otherwise write a scripted scan for common patterns:
   private keys, AWS keys, tokens, passwords, connection strings with credentials, .env files ever
   committed). Report findings. If anything is found in history, STOP and tell the user; do not rewrite
   history or force push.
2. Repo hygiene: remove stray/generated/debug files, check .gitignore covers .env, .stackdoctor/,
   node_modules, dist, coverage, logs. Ensure examples contain no real credentials (only obvious fake
   values). Remove TODOs that are launch-blocking or turn them into tracked roadmap items.
3. Dependency audit: `npm audit` (fix or document every high/critical), remove unused dependencies,
   check for deprecated packages. Generate a dependency license report; flag licenses incompatible with
   the project's MIT license (e.g. strong copyleft in bundled code) and list the result in docs/licenses.md.
4. SECURITY.md: supported versions, how to report a vulnerability privately (placeholder for the
   maintainer's contact/private advisory link, clearly marked for the user to fill), what to include,
   expected response times (stated as goals, not guarantees), disclosure policy, scope (what is in/out).
5. Dependabot config (.github/dependabot.yml): npm and github-actions ecosystems, weekly, grouped minor/patch.
6. LICENSE check (MIT, correct year and holder placeholder for the user to confirm), NOTICE if needed.
7. Add a CODE_OF_CONDUCT.md (Contributor Covenant) with a contact placeholder for the user to fill.
8. Tests/scripts: `npm run check:secrets` and `npm run check:licenses` scripts added to the repo.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] No secrets in tree or history (or user alerted if found)
- [x] `npm audit` has no unaddressed high/critical issues
- [x] License report shows no incompatible licenses (or they are flagged)
- [x] SECURITY.md, CODE_OF_CONDUCT.md, dependabot config exist
- [x] Placeholders the user must fill are clearly marked

**Run log (Antigravity fills):**
- Files:
  - Created: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.github/dependabot.yml`, `scripts/check-secrets.js`, `scripts/check-licenses.js`, `docs/licenses.md`
  - Modified: `.gitignore`, `package.json`, `packages/*/package.json`, `apps/*/package.json`, `docs/INDEX.md`, `docs/PHASE6.md`
- Command results:
  - `npm run check:secrets`: PASSED (0 secrets detected in working tree and git history)
  - `npm run check:licenses`: PASSED (431 packages audited, 100% MIT-compatible, 0 copyleft packages)
  - `npm run build`: PASSED (0 errors)
  - `npm run lint`: PASSED (0 errors)
  - `npm run typecheck`: PASSED (0 errors)
  - `npm test`: PASSED (58 test files passed, 421/421 tests passed)
  - `npm run eval`: PASSED (100.0% accuracy, 0.0% false positives)
  - `npm run eval:ai`: PASSED (18/18, 100%)
- Findings:
  - No secrets found in git history or working tree.
  - Upstream devDependency vulnerabilities (`tinypool` in vitest) and high severity collection parsing in zod documented in `docs/licenses.md` with runtime mitigations verified.
- Decisions:
  - Declared explicit `"license": "MIT"` across all 9 monorepo workspace packages.
  - Added `.stackdoctor/` and `.stackdoctor.json` to `.gitignore`.
  - Added clearly marked maintainer placeholders in `SECURITY.md` and `CODE_OF_CONDUCT.md`.

---

## Run 6B: npm packaging and fresh-install testing

```
PHASE 6, RUN 6B: PACKAGING

1. Prepare the CLI package (apps/cli, name `stackdoctor`) for publishing as 0.1.0:
   - package.json: version 0.1.0, description, keywords, license, repository, bugs, homepage (placeholders
     for the user's real URLs, clearly marked), `bin`, `engines.node`, `files` allowlist (dist, README,
     LICENSE only), `publishConfig` (access public, provenance true), `type`/`exports` correct.
   - The CLI must bundle or correctly depend on the internal @stackdoctor/* packages (use a bundler such as
     tsup/esbuild to produce a single distributable, or publish internal packages; choose the simplest
     that works and document it). Optional heavy parts (database drivers, AI providers) should not break
     install if unused.
   - Shebang and executable bit work on Linux/macOS; `.cmd` shim works on Windows via npm.
2. `npm pack` the CLI and inspect the tarball: no tests, fixtures with credentials, source maps containing
   absolute paths, .env files, or the .stackdoctor folder. Print the file list and size; fail a script
   check if forbidden files are present or size exceeds a documented budget (`npm run check:pack`).
3. Fresh-install test script (scripts/test-install): in a clean temp directory, install the packed tarball
   globally into a temp prefix (and via npx from the tarball), run `stackdoctor --version`, `stackdoctor scan`
   on an example, `--json`, `rules`, `explain <ruleId>`. Verify exit codes and that no files outside the temp
   area are touched.
4. `npm publish --dry-run` output captured in the run log. DO NOT PUBLISH.
5. Version handling: single source of truth for the version, shown by `--version` and written into reports'
   toolVersion.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Tarball contains only intended files and no secrets or absolute paths
- [ ] Fresh install from the tarball works and runs the main commands
- [ ] `--version` matches package version and report toolVersion
- [ ] `npm publish --dry-run` succeeds; nothing was actually published

**Run log (Antigravity fills):**
- Files:
- Pack file list and size:
- Command results:
- Decisions:

---

## Run 6C: CI/CD pipeline and release automation

```
PHASE 6, RUN 6C: CI AND RELEASE WORKFLOWS (do not trigger any release)

1. .github/workflows/ci.yml: on push and pull_request. Matrix: ubuntu-latest, windows-latest, macos-latest
   x supported Node versions (the engines range: test the minimum and the current LTS). Steps: checkout,
   setup-node with npm cache, `npm ci`, build, lint, typecheck, test, `npm run eval` (accuracy), check:secrets,
   check:licenses, check:pack, test-install. `permissions: contents: read`. Concurrency group cancels
   superseded runs. Upload the eval and test reports as artifacts.
2. Security workflows: CodeQL analysis (javascript-typescript) and dependency review on pull requests,
   minimal permissions.
3. .github/workflows/release.yml: triggered MANUALLY (workflow_dispatch) or by a version tag, running the
   full CI first, then building the package and publishing to npm with provenance, ONLY in a protected GitHub
   Environment named `npm-publish` that requires manual approval, using an npm automation token stored as an
   environment secret (user creates it). permissions: contents read, id-token write (for provenance).
   It also drafts GitHub release notes from CHANGELOG.md (as a DRAFT release, never auto-published).
   Do not run it. Document exactly how the user sets up the environment and secret.
4. Pin all third-party actions to full commit SHAs with version comments. No pull_request_target. Inputs
   passed via env vars, never interpolated into run scripts.
5. Add a status badge section to README for CI only (no fake badges).
6. Document the CI in docs/ci-internal.md (what each job checks, how to reproduce locally).
7. Validate workflow syntax locally (actionlint if available, otherwise yaml lint) and report results.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] CI matrix covers Windows, Linux, macOS
- [ ] All actions pinned to commit SHAs; least-privilege permissions
- [ ] Release workflow needs manual approval and was NOT run
- [ ] Workflow files validate (actionlint or equivalent)
- [ ] Release creates a draft, never an automatic public release

**Run log (Antigravity fills):**
- Files:
- Validation results:
- Decisions:

---

## Run 6D: Documentation, templates, roadmap, known limitations

```
PHASE 6, RUN 6D: DOCUMENTATION

1. README.md (the front door): what it is in one paragraph, tagline, the problem, a real example report
   (generated from an actual fixture run, pasted as text), 60-second quick start (install, scan, read the
   report), core principles (evidence first, local-only by default, no automatic dangerous changes),
   what it checks today (generated from the rule registry, not hand-written), optional features
   (dashboard, AI: both off by default), links to docs, contributing, security, license.
   No fake metrics, badges, or claims.
2. docs/installation.md: install via npm, npx, from source; supported-platform matrix (Windows, Linux, macOS
   x Node versions, which checks are skipped on which OS, taken from tested behavior); troubleshooting
   section (command not found, permissions, Node version too old, corporate proxy, antivirus false
   positives, Windows PowerShell execution policy) with real error messages and fixes.
3. docs/diagnostics.md: complete rules reference generated from the registry (script
   `npm run docs:rules` regenerates it; CI fails if it is out of date).
4. docs/privacy.md: exactly what is collected, what is never collected, what leaves the machine and only when,
   retention and deletion for the optional platform.
5. docs/self-hosting.md: running the API, web app, and MongoDB with docker-compose, required environment
   variables (names and purpose only), production hardening checklist (HTTPS, secrets management, backups).
6. docs/faq.md: honest answers (what it does not do, why a refused connection does not prove "not installed",
   why AI is optional, how it differs from a debugger or an AI assistant).
7. ROADMAP.md and docs/known-limitations.md: real limitations found during Phases 1-5 (unsupported
   frameworks, checks skipped on some OS, false-positive risks, no PostgreSQL yet, etc.) and the planned
   next steps (PostgreSQL, more frameworks, more rules, workspaces/team features). Mark everything as planned,
   not promised.
8. Templates: .github/ISSUE_TEMPLATE (bug report, false positive, new rule proposal, feature request with
   config.yml), PULL_REQUEST_TEMPLATE.md, CONTRIBUTING.md (short) linking docs/contributing.md,
   a "good first issue" list in docs/good-first-issues.md derived from real roadmap items.
9. Docs test: a script (`npm run test:docs`) extracts every shell command in a fenced `bash`/`sh`/`powershell`
   block marked as runnable and executes it in a temp directory (read-only commands only), failing on errors;
   also checks all relative links resolve.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Every runnable command in the docs was executed and works
- [ ] Rules reference is generated and CI-checked
- [ ] Platform matrix reflects what was actually tested
- [ ] Known limitations and roadmap are honest
- [ ] No fabricated metrics, badges, or claims anywhere
- [ ] All relative links resolve

**Run log (Antigravity fills):**
- Files:
- Command results:
- Decisions:

---

## Run 6E: Demo script, launch assets, honest launch posts

```
PHASE 6, RUN 6E: LAUNCH ASSETS (text and scripts only; the user records and posts)

1. Demo script: docs/demo/demo-script.md for a 2-3 minute screen recording using the real fixtures:
   scene-by-scene commands to type, what appears on screen, narration lines. Story: clone a broken
   project -> stackdoctor scan -> read evidence vs possible causes -> dry-run fix -> apply with
   confirmation -> verify -> (optional) compare reports -> (optional) issue draft. Include setup steps,
   terminal font/size recommendations, and a scripted reset so the demo is repeatable
   (scripts/demo-reset).
2. Recording guide: how to record with a free tool (asciinema or VHS tape file generating a GIF for the README,
   plus screen-capture suggestions for a video); provide the VHS .tape file if feasible.
3. Example gallery: docs/examples.md showing real output from each fixture (copied from actual runs).
4. Launch post drafts in docs/launch/: Show HN style post, Reddit r/programming-style post, LinkedIn/X
   post, dev.to article outline. Rules: lead with the problem, be modest, state limitations, link to the
   repo, mention optional AI as optional, use ONLY real numbers from `npm run eval` output (cite the exact
   figures and test set size), no hype words, no unverified comparisons to other tools.
5. Repo "About" text, topics list, and social preview image text suggestions in docs/launch/repo-settings.md
   (for the user to apply manually).
6. Landing page final check: all copy matches reality, install command is correct, example report is real,
   sample data is labeled, links work.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Demo script runs end to end on the real fixtures; reset script works
- [ ] All numbers in launch posts come from real eval output
- [ ] Posts state limitations honestly and do not oversell AI
- [ ] Landing page matches actual behavior

**Run log (Antigravity fills):**
- Files:
- Demo run results:
- Decisions:

---

## Run 6F: Version 0.1 Definition-of-Done verification

```
PHASE 6, RUN 6F: FINAL VERIFICATION FOR v0.1.0

1. Walk the Definition of Done for version 0.1 and verify each item with real evidence (command output,
   test names, CI links/logs where available). Write the results into docs/release-checklist.md as a table:
   item, evidence, pass/fail.
   - CLI installs and runs on supported platforms (CI matrix + fresh-install test results)
   - Project detection works against real fixture repositories
   - Every built-in rule has tests and documentation (rule-lint passes)
   - Reports distinguish evidence from hypotheses
   - Known checks have deterministic expected results
   - JSON output conforms to the documented schema
   - Secrets are redacted from reports (canary tests)
   - No destructive operation runs automatically (grep + tests)
   - Installation and troubleshooting docs complete
   - License, security policy, contribution guide exist
2. Measure and record the Success Criteria honestly with `npm run eval`: correct identification rate,
   false-positive rate, report generated when individual checks fail, no secret values in sample reports,
   no unapproved repair execution. If a target is missed, record the real number and the plan; do not tune the
   test set to hit the target.
3. Write CHANGELOG.md entry and RELEASE_NOTES_0.1.0.md: highlights, supported platforms, known limitations,
   upgrade/install instructions, security notes.
4. Run the full verification: clean clone into a temp directory, `npm ci`, build, lint, typecheck, test, eval,
   check:secrets, check:licenses, check:pack, test:docs, test-install, e2e scripts. Paste a summary into the log.
5. Prepare (do NOT execute) the exact release commands for the user in docs/release-steps.md.

Then follow the POST-RUN PROTOCOL in PHASE1.md. Mark Phase 6 Done in INDEX.md only if the checklist below
truly passed.
```

**Final Phase 6 checklist (v0.1.0 release readiness)**
- [ ] Clean-clone verification passes end to end
- [ ] CI is green on Windows, Linux, and macOS
- [ ] Every item of the v0.1 Definition of Done is verified with evidence
- [ ] Success criteria recorded with real numbers
- [ ] No secrets in tree or history
- [ ] `npm publish --dry-run` clean; nothing published yet
- [ ] Docs, README, and landing page match actual behavior
- [ ] Release notes, changelog, roadmap, and known limitations written
- [ ] Everything committed and pushed

**Run log (Antigravity fills):**
- Files:
- Command results:
- Eval numbers:
- Decisions:

---

## Human-only steps (YOU do these, not Antigravity)

1. **GitHub repo settings:** add description and topics (from `docs/launch/repo-settings.md`), enable branch protection on `main` (require PR + passing CI), enable secret scanning and push protection, enable private vulnerability reporting, enable Dependabot alerts.
2. **Fill placeholders:** maintainer contact in SECURITY.md and CODE_OF_CONDUCT.md, copyright holder and year in LICENSE, real repository/homepage/bugs URLs in package.json.
3. **npm account:** enable two-factor authentication, check the package name `stackdoctor` is available (if taken, choose a scoped name like `@yourname/stackdoctor` and ask Claude to update the docs), create an automation token, add it as a secret in the `npm-publish` GitHub Environment (with required reviewers).
4. **Trial run with real people:** ask a few developers to run it on their own projects and send feedback before the public announcement. Record what breaks.
5. **Release:** follow `docs/release-steps.md` yourself (tag, run the release workflow, approve the environment, review and publish the draft GitHub release).
6. **Record the demo** using `docs/demo/demo-script.md`, add the GIF/video to the README.
7. **Post the announcement** only after the install works on a fresh machine from the published package.

---

## Fix prompt (when a run breaks)

```
In StackDoctor Phase 6, Run [X], this problem occurs:
[exact error / unexpected behavior]
Steps to reproduce: [...]
Expected: [...]  Actual: [...]
Fix the root cause (not a workaround), add a regression test, do not change unrelated files.
Then follow the POST-RUN PROTOCOL in PHASE1.md (commit message: fix(...): ...).
```

## If Antigravity drifts

Send: *"Stop. Revert anything outside the scope of this run and continue only with the listed items. Do not publish anything."*
