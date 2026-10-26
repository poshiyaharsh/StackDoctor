# StackDoctor: Phase 3 (Web Platform), Living File

**Goal:** Users can optionally upload sanitized reports and review their history online.
**Builds on Phases 1 and 2.** The CLI must keep working fully offline. Do not move diagnostic logic into the API or web app.
Antigravity updates this file after every run. Keep it in the repo root with the other phase files.

## How to use

1. New Antigravity session: paste the **Master Context** from `PHASES.md`.
2. Paste the run prompt (3A, then 3B, ...). Do the runs in order.
3. Antigravity follows the **POST-RUN PROTOCOL in PHASE1.md** itself (self-review, verify, update docs, commit, push).
4. Bring failures or oddities to Claude.

## Status tracker (Antigravity updates this)

| Run | Focus | Status | Commit | Date |
|---|---|---|---|---|
| 3A | API scaffold, MongoDB, authentication | Done | pending | 2026-10-26 |
| 3B | Projects, diagnostic runs, rules endpoints, authorization | Not started | - | - |
| 3C | API tokens + CLI login/upload with preview | Not started | - | - |
| 3D | Web scaffold, landing page, auth pages | Not started | - | - |
| 3E | Dashboard, projects, report and finding pages, settings | Not started | - | - |
| 3F | Security tests, docs, docker-compose, final verification | Not started | - | - |

Status values: Not started, In progress, Needs fixes, Done.

## Phase 3 ground rules (apply to every run)

- The server never trusts the client. Every uploaded report is re-validated against the shared zod schema and re-redacted with core's redaction on the server, even though the CLI already did it.
- Never store raw environment variables, `.env` contents, credentials, or machine identifiers (hostname, username, MAC, IP of the user's machine).
- Every route checks authentication AND ownership. Return 404 (not 403) for other users' resources so existence is not leaked.
- Validate every id (ObjectId format) and every payload with zod. Reject unknown fields. Never pass request bodies directly into Mongo queries (NoSQL injection).
- Never fetch, clone, or open a repositoryUrl on the server. It is stored as untrusted text only.
- Secrets and tokens: hashed at rest, shown once at creation, never logged.
- The web app renders report data as text only (no `dangerouslySetInnerHTML`, no markdown-to-HTML of evidence).
- Local-only stays the default. Upload is always explicit.

---

## Run 3A: API scaffold, MongoDB, authentication

```
PHASE 3, RUN 3A: API FOUNDATION (apps/api)

1. Express + TypeScript app in apps/api. Structure: src/app.ts (build app), src/server.ts (listen),
   src/config.ts (env parsing with zod; fail fast on missing/invalid config), src/routes/,
   src/middleware/, src/models/, src/lib/. Config comes from environment variables only;
   add apps/api/.env.example with NAMES and safe placeholder values.
2. MongoDB via mongoose (or the native driver) with schema validation. Connection with timeouts and
   graceful shutdown. Health endpoint GET /api/v1/health (no sensitive info).
3. Security middleware: helmet, strict CORS (allowlist from config), JSON body size limit,
   request-id, structured logging with redaction (never log bodies, cookies, auth headers, passwords),
   centralized error handler that never leaks stack traces in production.
4. Users collection: email (unique, normalized lowercase), passwordHash, displayName, createdAt, updatedAt.
   Passwords hashed with argon2id (or bcrypt cost >= 12). Never store or log plaintext.
5. Auth endpoints (versioned /api/v1/auth): register, login, logout, me.
   - Cookie sessions: httpOnly, secure in production, sameSite=lax, server-side session store in MongoDB
     (connect-mongo or equivalent) with expiry. Regenerate session on login.
   - CSRF protection for cookie-authenticated state-changing requests.
   - Rate limiting on register/login (per IP and per account), generic error messages
     (do not reveal whether an email exists). Password policy: min length 12, max length enforced.
6. Tests (vitest + supertest + mongodb-memory-server or a test container):
   register/login/logout/me happy paths, wrong password, duplicate email, rate limit, CSRF rejection,
   invalid payloads, no plaintext password anywhere in DB, no sensitive data in logs.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [x] API starts only with valid config; fails fast otherwise
- [x] Passwords hashed, never logged
- [x] Login/register rate limited with generic errors
- [x] State-changing cookie requests require CSRF protection
- [x] No stack traces leaked in production mode

**Run log (Antigravity fills):**
- Files: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/.env.example`, `apps/api/src/config.ts`, `apps/api/src/lib/db.ts`, `apps/api/src/middleware/request-id.ts`, `apps/api/src/middleware/logger.ts`, `apps/api/src/middleware/error-handler.ts`, `apps/api/src/middleware/rate-limiter.ts`, `apps/api/src/middleware/csrf.ts`, `apps/api/src/models/user.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/test/config.test.ts`, `apps/api/test/auth.test.ts`
- Command results: `npm run build` passed (exit code 0); `npm run lint` passed (exit code 0); `npm run typecheck` passed (exit code 0); `npm test` passed (181/181 tests across 30 suites); `npm run eval` passed (100% detection, 0% false positives).
- Problems: ESLint namespace lint rule on Express.Request augmentation resolved with scoped eslint-disable comment. Mongoose Document generic methods typing resolved cleanly with interface extensions.
- Decisions: Used `bcryptjs` with cost factor 12 for portable, cross-platform password hashing. Session regeneration on login prevents session fixation. CSRF token validated with timing-safe comparison on state-changing cookie requests while allowing Bearer tokens. Centralized error handling suppresses error stacks in non-development environments.

---

## Run 3B: Projects, diagnostic runs, rules endpoints

```
PHASE 3, RUN 3B: CORE API RESOURCES

1. Collections with schema validation and indexes:
   - projects: ownerId, name, repositoryUrl (optional, validated as http/https URL, stored as text only),
     detectedTechnologies[], createdAt, updatedAt. Index: (ownerId, createdAt).
   - diagnosticRuns: projectId, ownerId, toolVersion, operatingSystem, startedAt, completedAt, status
     (completed | completed_with_warnings | failed | cancelled), summary, findings[], createdAt.
     Index: (ownerId, createdAt), (projectId, createdAt).
2. Endpoints (all require auth, all versioned /api/v1):
   - Projects: GET list (paginated), POST, GET :projectId, PATCH :projectId, DELETE :projectId
     (deleting a project deletes its runs).
   - Diagnostic runs: POST /diagnostic-runs (body = Report from @stackdoctor/schemas; project is
     matched/created by name for this owner, or by projectId), GET list (paginated, filter by
     project, status, severity, date), GET :runId, DELETE :runId.
   - Rules: GET /rules, GET /rules/:ruleId (metadata from @stackdoctor/rules registry).
3. POST /diagnostic-runs hardening:
   - Max body size (e.g. 1 MB) and max findings/evidence counts from the shared schema.
   - Validate with validateReport, then re-run core redaction over every string field before storing.
   - Strip any field not in the schema. Reject reports containing obvious secret patterns that
     survived (respond 422, store nothing).
   - Do not store machine identifiers.
4. Authorization: a helper that loads resources scoped by ownerId in the query itself.
   Other users' ids return 404. Validate ObjectId format before querying.
5. Pagination limits enforced server-side. Sort fields allowlisted.
6. Tests: full CRUD; user A cannot read/update/delete user B's projects or runs (all verbs);
   malformed ids; oversized payload; report with a canary secret ("CANARY_SECRET_123") is rejected or
   redacted and never stored; NoSQL operator injection attempts ({"$ne": null}) are rejected.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] User A can never see or change User B's data (tests for every verb)
- [ ] Canary secret never reaches the database
- [ ] Oversized and malformed payloads rejected
- [ ] NoSQL injection attempts rejected
- [ ] Deleting a project removes its runs

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 3C: API tokens and CLI upload

```
PHASE 3, RUN 3C: API TOKENS + CLI UPLOAD

1. API tokens (for the CLI, separate from browser sessions):
   - Collection apiTokens: ownerId, name, tokenHash (SHA-256 of a high-entropy random token),
     prefix (first 8 chars for display), createdAt, lastUsedAt, expiresAt (optional), revokedAt.
   - Endpoints: POST /api/v1/tokens (returns the plain token ONCE), GET list (never returns the token or hash),
     DELETE :tokenId (revoke). Authorization header "Bearer <token>" accepted on diagnostic-run endpoints.
   - Token-authenticated requests do not need CSRF (not cookie-based). Rate limit them too.
2. CLI commands (apps/cli), additive only, `scan` unchanged:
   - `stackdoctor login --server <url>`: prompts for a token (hidden input) and stores it in the user's
     config directory with file permissions restricted (0600 where supported). Never echo or log the token.
     Also support the STACKDOCTOR_TOKEN environment variable.
   - `stackdoctor logout`: deletes the stored token.
   - `stackdoctor upload [reportFile | path]`: builds or loads a report, validates it, then shows a
     REPORT PREVIEW (what will be uploaded: project name, OS, tool version, finding titles, counts)
     and asks for explicit confirmation (y/N). Flag --yes for CI. Uploads over HTTPS only
     (allow http only for localhost). Redacts again before sending. Clear errors for 401, 422, network failures.
   - `stackdoctor scan` must never upload anything.
3. Tests: token created shows plain value once and never again; hash stored only; revoked token rejected;
   CLI upload requires confirmation; --yes works; http to non-localhost refused; token never appears in
   output, logs, or error messages; scan makes zero network calls (test with a mocked network).

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Plain token returned exactly once; only a hash in the DB
- [ ] CLI upload shows a preview and needs confirmation
- [ ] `scan` makes no network calls
- [ ] Token never appears in any log, output, or error
- [ ] Revoked/expired tokens are rejected

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 3D: Web scaffold, landing page, auth pages

```
PHASE 3, RUN 3D: WEB FOUNDATION (apps/web)

1. React + Vite + TypeScript in apps/web. React Router, a typed API client (uses shared types from
   @stackdoctor/schemas), TanStack Query for data, a small design system (CSS variables, light/dark,
   accessible components: Button, Card, Badge, Input, Modal, Tabs, Toast, EmptyState).
   Calm, professional developer-tool look. Keyboard accessible, readable contrast.
2. Dev proxy to the API. No secrets in the frontend bundle. Auth state from /auth/me; cookie-based
   with CSRF token handling in the API client.
3. Pages:
   - Landing: hero ("Find the cause. Fix the environment. Ship the code."), problem statement,
     3-step workflow, supported technologies, an EXAMPLE report (clearly labeled sample data),
     security and privacy explanation, installation instructions, GitHub link placeholder,
     contribution guide link. No fake metrics, testimonials, or unsupported claims.
   - Register, Login, Logout flows with validation and clear error states.
   - Protected route wrapper; 404 page.
4. Security: no dangerouslySetInnerHTML, a strict Content-Security-Policy header in the API/static
   serving config, all external links rel="noopener noreferrer".
5. Tests (vitest + Testing Library): route protection, login form validation, landing renders
   without fabricated metrics, API client attaches CSRF token.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Landing page has no fake metrics or testimonials
- [ ] Protected routes redirect unauthenticated users
- [ ] No `dangerouslySetInnerHTML` anywhere (grep it)
- [ ] Works in light and dark mode, keyboard navigable

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 3E: Dashboard, projects, report, finding, settings

```
PHASE 3, RUN 3E: APPLICATION PAGES (apps/web)

Render the shared report schema only. Do NOT implement a second diagnostic engine in the frontend.

1. Dashboard: total runs, projects scanned, failed checks, most common issue categories, recent reports,
   latest scan statuses (add GET /api/v1/stats in the API, owner-scoped aggregation). Empty state explains
   how to install the CLI, log in, and upload the first report (with copy buttons for the commands).
2. Projects: list (name, technologies, OS, last scan date, latest result, finding count) and a project
   detail page with scan history.
3. Diagnostic Report page: overall summary, findings grouped by severity, check statuses, expandable
   evidence per finding (labeled OBSERVED), probable causes (labeled POSSIBLE), recommended fix,
   verification instructions. Copy buttons for safe commands and for sanitized report JSON.
   Filtering by severity/status. Delete report with confirmation.
4. Finding Details page: rule id, title, severity, confidence, observed evidence, potential causes,
   recommended checks, suggested remediation (risks, undo, verification), verification status,
   documentation links (open with rel="noopener noreferrer").
5. Settings: profile, change password, privacy preferences, report retention setting, API tokens
   (create shows the token once in a modal with a copy button, list shows prefix/created/last used,
   revoke), delete account and all data (with re-authentication). An "AI explanations" section shown
   as disabled/coming later (no provider fields yet).
6. API additions needed: GET /stats, retention setting + a scheduled cleanup job that deletes runs older
   than the owner's retention, DELETE /auth/account (deletes user, projects, runs, tokens, sessions).
7. Tests: each page renders loading, empty, error, and data states; token shown once; severity grouping;
   delete flows; retention job deletes only the owner's expired runs; account deletion removes all data.

Run build, tests, lint, typecheck. Then follow the POST-RUN PROTOCOL in PHASE1.md.
```

**Checklist**
- [ ] Every page has loading, empty, and error states
- [ ] Evidence and possible causes are visibly labeled as different things
- [ ] Token never shown again after creation
- [ ] Account deletion removes all user data (test proves it)
- [ ] No diagnostic logic duplicated in the frontend

**Run log (Antigravity fills):**
- Files:
- Command results:
- Problems:
- Decisions:

---

## Run 3F: Security tests, docs, docker-compose, final verification

```
PHASE 3, RUN 3F: HARDENING + DOCS + FINAL VERIFICATION

1. docker-compose.yml: MongoDB for local development only (bound to 127.0.0.1, named volume,
   credentials from environment, no default password committed). Add npm scripts: dev:api, dev:web, dev.
2. Security test pass (add missing tests): authorization matrix for EVERY endpoint x verb x (anonymous,
   owner, other user); CSRF; rate limits; NoSQL injection; oversized/malformed reports; canary secret
   across DB, logs, and responses; session fixation; token revocation; XSS payloads inside evidence
   strings are rendered as inert text in the web app.
3. Dependency audit: run `npm audit`, fix or document every high/critical finding. Pin versions sensibly.
4. Docs: docs/architecture.md (CLI, API, web, data flow, what is uploaded), docs/security.md (threat model
   summary, auth, token handling, data retention, what is never stored), docs/installation.md (running
   the API and web locally), update README with the optional platform and the privacy statement.
5. End-to-end check script (scripts/e2e-phase3): start Mongo + API, register a user, create a token,
   run `stackdoctor scan` on a fixture, `stackdoctor upload --yes`, fetch the run via API, delete it.
6. Run the full verification (install, build, lint, typecheck, test, audit, e2e) and paste outputs here.

Then follow the POST-RUN PROTOCOL in PHASE1.md. Mark Phase 3 Done in INDEX.md only if the
Final Phase 3 checklist truly passed.
```

**Final Phase 3 checklist**
- [ ] User A cannot access User B's projects, runs, or tokens (matrix test passes)
- [ ] Oversized and malformed payloads rejected
- [ ] Tokens shown once and never again
- [ ] Upload shows a preview and needs confirmation; `scan` never uploads
- [ ] Deleting a run actually deletes it; account deletion removes everything
- [ ] Canary secret absent from DB, logs, API responses, and UI
- [ ] CLI still works fully with the API turned off
- [ ] `npm audit` has no unaddressed high/critical issues
- [ ] E2E script passes
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
In StackDoctor Phase 3, Run [X], this problem occurs:
[exact error / unexpected behavior]
Steps to reproduce: [...]
Expected: [...]  Actual: [...]
Fix the root cause (not a workaround), add a regression test, do not change unrelated files.
Then follow the POST-RUN PROTOCOL in PHASE1.md (commit message: fix(...): ...).
```

## If Antigravity drifts

Send: *"Stop. Revert anything outside the scope of this run and continue only with the listed items."*
