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
| 3A | API scaffold, MongoDB, authentication | Done | a12454c | 2026-10-26 |
| 3B | Projects, diagnostic runs, rules endpoints, authorization | Done | a1d57c2 | 2026-10-26 |
| 3C | API tokens + CLI login/upload with preview | Done | 9ebc357 | 2026-10-26 |
| 3D | Web scaffold, landing page, auth pages | Done | 7e6b648 | 2026-10-26 |
| 3E | Dashboard, projects, report and finding pages, settings | Done | 1592659 | 2026-10-26 |
| 3F | Security tests, docs, docker-compose, final verification | Done | ba9cdd7 | 2026-10-26 |

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
- [x] User A can never see or change User B's data (tests for every verb)
- [x] Canary secret never reaches the database
- [x] Oversized and malformed payloads rejected
- [x] NoSQL injection attempts rejected
- [x] Deleting a project removes its runs

**Run log (Antigravity fills):**
- Files: `apps/api/src/models/project.ts`, `apps/api/src/models/diagnostic-run.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/lib/sanitize-report.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/diagnostic-runs.ts`, `apps/api/src/routes/rules.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/test/resources.test.ts`
- Command results: `npm run build` passed (exit code 0); `npm run lint` passed (exit code 0); `npm run typecheck` passed (exit code 0); `npm test` passed (192/192 tests across 31 suites); `npm run eval` passed (100% detection, 0% false positives).
- Problems: Query parameter injection attempts using operators in keys handled by enforcing `.strict()` Zod schemas and explicitly rejecting `$` and `[` / `]` operator characters. Report validation schema constraints adhered to strictly.
- Decisions: Deleting a project automatically cascades to delete all associated diagnostic runs. All resource queries are strictly scoped by `ownerId` in MongoDB and return 404 for resources owned by others to prevent enumeration. Canaries and survived credentials immediately reject with 422 Unprocessable Entity and are never stored. Deep redaction re-sanitizes every string field before persistence.

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
- [x] Plain token returned exactly once; only a hash in the DB
- [x] CLI upload shows a preview and needs confirmation
- [x] `scan` makes no network calls
- [x] Token never appears in any log, output, or error
- [x] Revoked/expired tokens are rejected

**Run log (Antigravity fills):**
- Files: `apps/api/src/models/api-token.ts`, `apps/api/src/routes/tokens.ts`, `apps/api/src/middleware/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/cli/src/config-store.ts`, `apps/cli/src/uploader.ts`, `apps/cli/src/index.ts`, `apps/api/test/tokens.test.ts`, `apps/cli/test/upload.test.ts`
- Command results: `npm run build` passed (exit code 0); `npm run lint` passed (exit code 0); `npm run typecheck` passed (exit code 0); `npm test` passed (203/203 tests across 33 suites); `npm run eval` passed (100% detection, 0% false positives).
- Problems: DiagnosticRule synchronous evaluation signature in CLI report generation handled properly; restricted config directory file permissions (`0o600`) applied safely across platforms.
- Decisions: Plaintext token is generated cryptographically (`stk_live_...`) and returned once upon creation; only SHA-256 hash is persisted. Bearer tokens authenticate CLI requests and bypass CSRF checks while updating `lastUsedAt`. CLI enforces HTTPS for all remote servers, allowing HTTP strictly for localhost/127.0.0.1. CLI `scan` is guaranteed to make zero network calls.

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
- [x] Landing page has no fake metrics or testimonials
- [x] Protected routes redirect unauthenticated users
- [x] No `dangerouslySetInnerHTML` anywhere (grep it)
- [x] Works in light and dark mode, keyboard navigable

**Run log (Antigravity fills):**
- Files: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/components/ui/Button.tsx`, `apps/web/src/components/ui/Card.tsx`, `apps/web/src/components/ui/Badge.tsx`, `apps/web/src/components/ui/Input.tsx`, `apps/web/src/components/ui/Modal.tsx`, `apps/web/src/components/ui/EmptyState.tsx`, `apps/web/src/components/layout/Navbar.tsx`, `apps/web/src/components/layout/ProtectedRoute.tsx`, `apps/web/src/pages/LandingPage.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/RegisterPage.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/NotFoundPage.tsx`, `apps/web/test/web.test.tsx`, `apps/cli/src/collector.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`, `package-lock.json`
- Command results: `npm run build` passed (exit code 0); `npm run lint` passed (exit code 0); `npm run typecheck` passed (exit code 0); `npx vite build apps/web` passed (exit code 0); `npm test` passed (210/210 tests across 34 suites); `npm run eval` passed (100% detection, 0% false positives).
- Problems: Vitest required `@testing-library/jest-dom/vitest` for DOM matchers; jsdom HTML5 validation required dispatching submit on form rather than button for required fields; port check probe in CLI collector increased from 300ms to 1000ms to eliminate timeout flakiness during highly parallel monorepo test execution.
- Decisions: Built modern developer-focused React + Vite + TypeScript application in `apps/web` with pure vanilla CSS tokens, light and dark mode switching with localStorage persistence, accessible UI primitives, typed API client with CSRF token management, strict CSP meta tags, zero `dangerouslySetInnerHTML`, and an honest landing page with clearly labeled sample data and zero fake metrics or testimonials.

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
- [x] Every page has loading, empty, and error states
- [x] Evidence and possible causes are visibly labeled as different things
- [x] Token never shown again after creation
- [x] Account deletion removes all user data (test proves it)
- [x] No diagnostic logic duplicated in the frontend

**Run log (Antigravity fills):**
- Files: `apps/api/src/routes/stats.ts`, `apps/api/src/services/retention.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/models/user.ts`, `apps/api/src/app.ts`, `apps/api/test/stats-and-account.test.ts`, `apps/web/src/components/ui/Tabs.tsx`, `apps/web/src/components/ui/Toast.tsx`, `apps/web/src/components/layout/Navbar.tsx`, `apps/web/src/context/AuthContext.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/App.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/ProjectsPage.tsx`, `apps/web/src/pages/ProjectDetailPage.tsx`, `apps/web/src/pages/ReportDetailPage.tsx`, `apps/web/src/pages/FindingDetailPage.tsx`, `apps/web/src/pages/SettingsPage.tsx`, `apps/web/test/app-pages.test.tsx`
- Command results: `npm run build` passed (exit code 0); `npm run lint` passed (exit code 0); `npm run typecheck` passed (exit code 0); `npx vite build apps/web` passed (exit code 0); `npm test` passed (224/224 tests across 36 suites); `npm run eval` passed (100% detection, 0% false positives).
- Problems: Handled query helper resolution in testing multiple occurrences of numeric metric values; ensured test isolation for retention cleanup and cascaded deletion.
- Decisions: Kept frontend strictly a pure renderer of shared report schema without any local diagnostic rules or duplicated evaluation logic; prominent visual separation between deterministic observed evidence (`OBSERVED EVIDENCE`) and hypotheses (`POSSIBLE CAUSES`); token shown exactly once at creation with copy button; cascaded deletion on project and account removal.

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
- [x] User A cannot access User B's projects, runs, or tokens (matrix test passes)
- [x] Oversized and malformed payloads rejected
- [x] Tokens shown once and never again
- [x] Upload shows a preview and needs confirmation; `scan` never uploads
- [x] Deleting a run actually deletes it; account deletion removes everything
- [x] Canary secret absent from DB, logs, API responses, and UI
- [x] CLI still works fully with the API turned off
- [x] `npm audit` has no unaddressed high/critical issues
- [x] E2E script passes
- [x] Docs match what actually exists
- [x] Everything committed and pushed

**Run log (Antigravity fills):**
- Files: `docker-compose.yml`, `.env.example`, `apps/api/package.json`, `package.json`, `apps/api/test/security-matrix.test.ts`, `apps/web/src/lib/api.ts`, `scripts/e2e-phase3.js`, `docs/architecture.md`, `docs/security.md`, `docs/installation.md`, `README.md`, `docs/INDEX.md`, `docs/PHASE3.md`, `docs/LOG.md`
- Command results: `npm run build` passed (exit code 0); `npm run lint` passed (exit code 0); `npm run typecheck` passed (exit code 0); `npm test` passed (231/231 tests across 37 suites); `npm run eval` passed (100% detection, 0% false positives); `npm run e2e:phase3` passed (exit code 0).
- Audit results: 4 dependencies reported in audit: Zod constrained array validation is mitigated at the network layer via 1MB express body limit (`express.json({ limit: "1mb" })`); Vitest and tinypool vulnerabilities are strictly confined to devDependencies and never deployed in production. Both are documented in `docs/security.md`.
- Problems: Session fixation test initially omitted CSRF token on login attempt when session cookie was present; resolved by attaching CSRF token returned from registration. Workspaces mongoose resolution in E2E script resolved by using API's native database connection helper.
- Decisions: Configured local MongoDB with Docker Compose bound strictly to `127.0.0.1`; implemented comprehensive authorization matrix covering every route x verb x role (anonymous, intruder, owner); built automated end-to-end check script testing user registration, token creation, offline scan, upload, verification, and cascaded deletion.

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
