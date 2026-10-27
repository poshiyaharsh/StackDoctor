# StackDoctor: Phase 7 (Post-Launch: Feedback, Triage, v0.2), Living File

**Goal:** Turn real user feedback into a more accurate, more trusted tool. Release v0.1.x fixes and a data-driven v0.2.0.
**Builds on Phases 1 to 6.** Every change here must be justified by evidence from real usage, not by guesses.
Antigravity updates this file after every run. Keep it in the repo root with the other phase files.

## How to use

1. New Antigravity session: paste the **Master Context** from `PHASES.md`.
2. Paste the run prompt. Runs 7A to 7C come first. 7D to 7G are chosen based on what your feedback shows (see "Decision gates").
3. Antigravity follows the **POST-RUN PROTOCOL in PHASE1.md** itself.
4. Do the **Human-only steps** (bottom of this file) yourself.
5. Bring failures or odd findings to Claude.

## Status tracker (Antigravity updates this)

| Run | Focus | Gate | Status | Commit | Date |
|---|---|---|---|---|---|
| 7A | Feedback system, triage routine, labels | none | Done | see git log | 2026-10-27 |
| 7B | Patch-release loop (v0.1.x) and regression-fixture workflow | none | Not started | - | - |
| 7C | Eval expansion from real feedback, per-rule precision/recall | needs real feedback | Not started | - | - |
| 7D | PostgreSQL support | demand gate | Not started | - | - |
| 7E | Next ecosystem or rule pack (chosen by feedback) | demand gate | Not started | - | - |
| 7F | Team workspaces (roles, membership checks) | demand gate | Not started | - | - |
| 7G | v0.2.0 release preparation | after chosen runs | Not started | - | - |

Status values: Not started, In progress, Needs fixes, Done, Skipped (gate not met).

## Decision gates (do not build without evidence)

- **7C** starts only after you have feedback from at least 5 real developers (or 10 real reports/issues).
- **7D PostgreSQL:** build only if at least 3 users or issues asked for it (or you decide it is a priority and record why in the log).
- **7E:** pick the top 1 or 2 requests from `FEEDBACK.md` (framework, database, rule category). If feedback shows no clear winner, mark it Skipped and spend the time on accuracy (7C).
- **7F Workspaces:** build only if teams explicitly ask to share reports. Record the demand in the log first. Per the product principles, the core diagnostics stay free and open source; team features are optional extras.
- Mark any run whose gate is not met as **Skipped** and say why in the log.

## Phase 7 ground rules (apply to every run)

- Evidence before features. Every change links to a feedback entry, issue, or measured eval result.
- Never tune the evaluation set to make numbers look good. Real false positives and misses are added as new cases, and the numbers may go DOWN. Record them honestly.
- Feedback and reports from users are untrusted and private: ask permission before reusing anyone's report, anonymize it, strip paths, names, hostnames, and secrets, and never commit a real user's data. Prefer recreating the failure as a synthetic fixture.
- Every bug fix ships with a regression test and a fixture that reproduces it.
- Patch releases (0.1.x) contain fixes only, no features. Features go to 0.2.0.
- Keep the same safety rules: no secrets in output, no automatic destructive actions, no publishing by Antigravity.
- Do not claim new accuracy numbers unless produced by `npm run eval` on the current set.

---

## Run 7A: Feedback system, triage routine, labels

```
PHASE 7, RUN 7A: FEEDBACK + TRIAGE SYSTEM

1. FEEDBACK.md (repo root, also linked from README): a table log with columns:
   id (FB-001...), date, source (issue link / DM / interview, no personal data), what the user ran
   (OS, Node/Python version, project type), what happened, expected, StackDoctor version, category
   (false_positive | missed_issue | wrong_cause | confusing_output | crash | install_problem |
   feature_request | praise), related rule ids, severity (blocker | high | medium | low), status
   (new | triaged | fixed | wontfix | needs_info), linked issue/PR, fixed in version.
   Include a short "how to add an entry" guide and a privacy note (no personal data or secrets).
2. docs/triage.md: the triage routine: how often to review (weekly), the order of work (1 crash or
   security issue, 2 false positive that could mislead, 3 install problem, 4 missed issue, 5 confusing
   output, 6 feature requests), response-time GOALS (goals, not guarantees), how to reproduce, how to decide
   "bug vs limitation vs feature request", how to close a report with a regression test link.
3. Labels: .github/labels.yml (type, severity, area such as cli/api/web/rules/adapters/docs, status, good
   first issue, help wanted, needs-info, false-positive, missed-issue) plus scripts/sync-labels.md explaining
   how the USER applies them (do not run any GitHub API calls yourself).
4. Update issue templates so reports capture what triage needs: `stackdoctor --version`, OS, the sanitized
   `stackdoctor issue` output, expected vs actual, and a checkbox "I reviewed the report for secrets".
5. A "scorecard" script `npm run scorecard` that reads FEEDBACK.md and prints counts by category, severity,
   status and top rules involved, so priorities come from data. Include tests for the parser.
6. docs/false-positive-policy.md: how false positives are handled (they are the most damaging failure for
   trust): acknowledge, reproduce, add a fixture, fix or downgrade the rule's confidence, add to the eval
   set, note it in the changelog.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] FEEDBACK.md template, triage doc, and false-positive policy exist
- [x] Label definitions exist; nothing was applied to GitHub automatically
- [x] `npm run scorecard` works and is tested
- [x] Issue templates ask for the right details and a secrets-review checkbox

**Run log (Antigravity fills):**
- Files:
  - Created: `FEEDBACK.md`, `docs/triage.md`, `docs/false-positive-policy.md`, `.github/labels.yml`, `scripts/sync-labels.md`, `scripts/scorecard.js`, `packages/core/test/scorecard.test.ts`
  - Modified: `package.json`, `README.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/false_positive.yml`, `docs/PHASE7.md`, `docs/LOG.md`
- Command results:
  - `npm run scorecard`: PASSED (parsed and printed formatted counts from `FEEDBACK.md`)
  - `npx vitest run packages/core/test/scorecard.test.ts`: PASSED (3/3 unit tests passed)
  - `npm run test:docs`: PASSED (52 Markdown files audited, 0 broken links, 3 CLI snippets verified)
  - `npm run check:secrets`: PASSED (0 secrets detected)
  - `npm run check:licenses`: PASSED (100% compliant)
  - `npm run check:pack`: PASSED (145.9 KB tarball, 23 files)
  - `npm run test:install`: PASSED (isolated prefix installation and binary verification)
  - `npm run build`: PASSED (exit code 0)
  - `npm run lint`: PASSED (0 errors)
  - `npm run typecheck`: PASSED (exit code 0)
  - `npm test`: PASSED (59 test suites, 424/424 tests passed)
  - `npm run eval`: PASSED (100.0% accuracy, 0.0% false positives)
  - `npm run eval:ai`: PASSED (18/18, 100%)
- Decisions:
  - Implemented structured feedback tracking in `FEEDBACK.md` with strict privacy requirements.
  - Formulated weekly triage protocol in `docs/triage.md` prioritizing crashes (P0) and false positives (P1).
  - Authored false-positive policy in `docs/false-positive-policy.md` reiterating the 0.0% false positive goal.
  - Created `.github/labels.yml` with type, severity, area, and status taxonomy; provided local application instructions in `scripts/sync-labels.md` without making unauthorized GitHub API calls.
  - Added data-driven scorecard script `scripts/scorecard.js` (`npm run scorecard`) backed by unit tests.
  - Added sanitized `stackdoctor issue` output instructions and required secret-review checkboxes to issue forms.

---

## Run 7B: Patch-release loop and regression-fixture workflow

```
PHASE 7, RUN 7B: FIX LOOP FOR v0.1.x

1. docs/fix-workflow.md: the standard loop for every confirmed bug: (a) reproduce, (b) create a minimal
   synthetic fixture under examples/regressions/<FB-id>-<slug>/ with expected.json, (c) write a failing test,
   (d) fix the root cause, (e) confirm the test passes and no other fixture changes, (f) add to the eval set,
   (g) update FEEDBACK.md status and CHANGELOG, (h) commit referencing the feedback id.
2. Tooling: `npm run new-regression -- --id FB-012 --slug short-name` creates the fixture folder, expected.json
   stub, a test stub, and prints the remaining steps. Tests included for the generator.
3. Ensure the eval runner automatically includes everything under examples/regressions, and prints results
   per fixture and per rule, so regressions are caught.
4. Patch release checklist in docs/patch-release.md (fixes only, run full verification from Phase 6F's
   script, update CHANGELOG, prepare release notes, user performs the release steps). Add
   `npm run verify:release` that runs the full verification chain used in 6F, so one command checks
   everything before any release.
5. Versioning policy in docs/versioning.md: 0.1.x patches, 0.2.0 features, schemaVersion rules
   (breaking report changes bump schemaVersion and are documented), deprecation policy for flags/commands.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] `new-regression` generator works and is tested
- [ ] Eval includes regression fixtures automatically
- [ ] `verify:release` runs the full chain with one command
- [ ] Versioning and patch-release policies documented

**Run log (Antigravity fills):**
- Files:
- Command results:
- Decisions:

---

## Fix prompt for a user-reported bug (use this for every real report)

```
In StackDoctor v[X], user feedback FB-[NNN] reports this problem:
Category: [false_positive | missed_issue | wrong_cause | crash | ...]
What the user ran: [OS, versions, project type, command]
Actual: [exact output / behavior]   Expected: [...]
Related rule ids: [...]

Follow docs/fix-workflow.md exactly: create a minimal SYNTHETIC fixture in examples/regressions/ (do not use
any real user data), write a failing test first, fix the ROOT CAUSE (not a workaround), make sure the finding
wording still separates evidence from hypotheses, run the eval and report any change in numbers honestly,
update FEEDBACK.md and CHANGELOG.md, and do not change unrelated files.
Then follow the POST-RUN PROTOCOL in PHASE1.md (commit message: fix(<area>): <summary> (FB-[NNN])).
```

---

## Run 7C: Eval expansion and per-rule precision/recall

```
PHASE 7, RUN 7C: DATA-DRIVEN ACCURACY (gate: real feedback exists)

1. Expand the curated eval set using ONLY synthetic fixtures derived from real feedback entries and the
   regressions folder. Each case: fixture, expected.json (exact expected rule ids), category, source feedback id.
   Do not remove hard cases to improve numbers.
2. `npm run eval` outputs: overall correct identification rate, false-positive rate, miss rate, plus a
   per-rule table (true positives, false positives, false negatives, precision, recall) and per-OS results
   when run in CI. Save a machine-readable result to eval-results/latest.json (committed only as a summary,
   no sensitive data) and append a dated row to docs/eval-history.md so progress and regressions are visible.
3. CI gate: fail CI if the false-positive rate rises above the documented budget or a previously passing
   case fails; allow an explicit, reviewed baseline update file for intentional changes.
4. Calibration: review each rule's `confidence` and wording against its measured precision. Rules with low
   precision are downgraded (confidence "possible", severity lowered, or wording softened) or fixed; list each
   change with its data in the log and CHANGELOG. Do not upgrade confidence without data.
5. Report the honest results versus the original targets (80% correct identification, under 10% false
   positives) with the real numbers and the size of the test set.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Every new eval case traces to a feedback id or regression
- [ ] Per-rule precision/recall table is produced and history is recorded
- [ ] CI blocks accuracy regressions
- [ ] Any confidence/severity change is backed by numbers in the log
- [ ] Results reported honestly, including misses

**Run log (Antigravity fills):**
- Files:
- Eval numbers (before / after):
- Decisions:

---

## Run 7D: PostgreSQL support (gate: demand)

```
PHASE 7, RUN 7D: POSTGRESQL

Follow exactly the same design as the MongoDB/MySQL work in Phase 2 (Run 2C) and its credentials policy.

1. Staged check: DNS -> TCP -> optional authenticated connection (read-only `SELECT 1`, only with
   --db-url-env, never reading .env for credentials, never printing credentials). Map error categories:
   dns_failure, connection_refused, timeout, tls_error, auth_failed (including password authentication
   failure), authorization_failed (permission denied / role does not exist), database_not_found, unknown.
   Distinguish "database does not exist" and "role does not exist" from network failures.
2. Detection: prisma schema datasource, DATABASE_URL names in .env.example (host/port only from example
   values), docker compose postgres service, Django ENGINE postgresql, common ORM configs (static parse only).
3. Rules (tests + docs): POSTGRES_CONNECTION_REFUSED, POSTGRES_AUTH_FAILED, POSTGRES_DATABASE_NOT_FOUND,
   POSTGRES_SSL_REQUIRED. Refused must not claim "not installed".
4. Fixtures: broken-postgres-config, healthy case; canary password test proving no credential leaks.
5. Update docs, platform matrix, README supported technologies, CHANGELOG (unreleased section).

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Error categories are distinct (network vs auth vs missing database/role)
- [ ] Canary credential never appears anywhere
- [ ] No write operations; credentials only via `--db-url-env`
- [ ] Fixtures, tests, rule docs, and rule-lint all pass

**Run log (Antigravity fills):**
- Files:
- Command results:
- Decisions:

---

## Run 7E: Next ecosystem or rule pack (gate: demand)

```
PHASE 7, RUN 7E: [FILL IN: the 1-2 requests chosen from FEEDBACK.md, e.g. "FastAPI/Flask checks",
"Next.js build-config checks", "pnpm/yarn workspace dependency checks", "Docker Compose deeper checks"]

Context: chosen because FEEDBACK.md entries [FB-ids] requested it. Do not add anything not tied to those entries.

1. Detection with evidence and confidence (never infer a framework from a single weak signal).
2. Adapters collect evidence only; rules interpret it. Static parsing only; do not run project code.
3. 4-8 rules maximum for this run, each with: evidence required, possible causes (separate), recommended
   checks, remediation with risks/undo/verification, docs links from the allowlist, unit tests, docs entry,
   fixtures (broken + healthy), expected.json, and inclusion in the eval set.
4. Run rule-lint, eval, canary/secret tests. Report precision on the new fixtures honestly.
5. Update README supported technologies, platform matrix, docs, CHANGELOG (unreleased).

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Every rule traces to a feedback id
- [ ] Healthy fixtures produce zero findings (no new false positives)
- [ ] Rule-lint, eval, and security tests pass
- [ ] Docs and supported-technology list updated

**Run log (Antigravity fills):**
- Files:
- Eval numbers:
- Decisions:

---

## Run 7F: Team workspaces (gate: demand, optional)

```
PHASE 7, RUN 7F: WORKSPACES (only if teams asked to share reports; record the demand first)

Core diagnostics stay free and local. This run adds OPTIONAL sharing on the hosted/self-hosted platform.

1. Data model: workspaces { name, ownerId, members[{ userId, role: owner|admin|member|viewer }], createdAt,
   updatedAt }, invitations { workspaceId, email, role, tokenHash, expiresAt, usedAt }. Projects and runs
   gain an optional workspaceId. Indexes added.
2. Authorization (the critical part): a central policy module with explicit rules per role and action
   (read, upload, delete, manage members, delete workspace). Every endpoint checks membership and role on the
   resource's workspace; non-members get 404. Invitation tokens are single-use, expiring, stored as hashes.
   Removing a member revokes access immediately (sessions and tokens checked at request time).
3. Sharing is explicit: a run is private to its owner until moved/shared into a workspace by someone allowed;
   show who can see it; unsharing works. Re-run redaction check on share. No public links in this run.
4. Web: workspace switcher, members page (invite, change role, remove), shared project list, audit-style
   activity list (who uploaded/deleted what, no sensitive content). CLI: `stackdoctor upload --workspace <id>`
   with the same preview and confirmation.
5. Tests: full authorization matrix (anonymous, non-member, viewer, member, admin, owner) x every endpoint x
   verb; invitation abuse (reuse, expiry, wrong email); removed member loses access immediately; cross-workspace
   id guessing returns 404; deleting a workspace deletes or detaches its data per documented policy.
6. Docs: docs/workspaces.md (roles table, privacy implications), update docs/security.md and self-hosting.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Authorization matrix tests pass for every role, endpoint, and verb
- [ ] Non-members get 404; removed members lose access immediately
- [ ] Invitations are single-use, expiring, and hashed
- [ ] Sharing is explicit and reversible
- [ ] Basic diagnostics remain fully free and local

**Run log (Antigravity fills):**
- Files:
- Command results:
- Decisions:

---

## Run 7G: v0.2.0 release preparation

```
PHASE 7, RUN 7G: v0.2.0 PREP (do NOT publish, tag, or release anything)

1. Review CHANGELOG (unreleased) and make sure every entry maps to feedback ids or measured results.
2. Run `npm run verify:release` (full chain: clean clone, install, build, lint, typecheck, test, eval,
   check:secrets, check:licenses, check:pack, test:docs, test-install, e2e scripts). Fix failures.
3. Compare eval results against the v0.1.0 numbers in docs/eval-history.md and write an honest summary
   (improved / unchanged / worse, with numbers and test-set size).
4. Write RELEASE_NOTES_0.2.0.md (highlights, fixes with feedback ids, new technologies, accuracy summary,
   known limitations, upgrade notes, deprecations) and update docs/known-limitations.md, ROADMAP.md,
   and the platform matrix.
5. Update docs/release-steps.md for 0.2.0. Bump versions in one place only as the policy in docs/versioning.md
   says, in a commit that the USER can review. Do not push tags.
6. Mark Phase 7 cycle Done in INDEX.md only if verification passed.

Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] `verify:release` passes from a clean clone
- [ ] Every changelog entry is tied to feedback or measured results
- [ ] Eval comparison against v0.1.0 is honest
- [ ] Nothing was published, tagged, or released

**Run log (Antigravity fills):**
- Files:
- Command results:
- Eval comparison:
- Decisions:

---

## Human-only steps (YOU do these)

1. **Collect feedback:** share the tool with developers, ask them to run `stackdoctor issue` and report. Ask permission before using anyone's report. Add entries to `FEEDBACK.md` (or let issues accumulate and summarize weekly).
2. **Apply the labels** using `scripts/sync-labels.md`.
3. **Weekly triage** (30-60 minutes): run `npm run scorecard`, pick the top items using `docs/triage.md`, and use the fix prompt above for each bug.
4. **Decide the gates:** after a few weeks of feedback, decide which of 7D, 7E, 7F to build and record why in the log.
5. **Releases:** perform patch and v0.2.0 releases yourself using the release steps. Antigravity never publishes.
6. **Keep it honest:** if the real accuracy is lower than the targets, say so in the docs and fix it before adding features.

---

## If Antigravity drifts

Send: *"Stop. Revert anything outside the scope of this run and continue only with the listed items. Do not publish, tag, or contact any external service."*
