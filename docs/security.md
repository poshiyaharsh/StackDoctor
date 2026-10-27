# Security Policy & Architecture

StackDoctor is an open-source local diagnostic tool designed around a "Security-First, Zero-Trust" architecture. Because StackDoctor inspects repositories that may contain untrusted code, outdated dependencies, or misconfigured environments, it operates under non-negotiable security boundaries.

---

## 1. Safe Command Execution Policy

StackDoctor strictly regulates all external process invocations via the safe runner (`packages/adapters/src/exec.ts`).

- **No Shell Execution**: `shell: true` is strictly prohibited throughout the entire codebase. Child processes are launched via `child_process.execFile` directly using fixed executable names and explicit argument arrays.
- **Strict Binary Allowlist**: Only explicitly allowlisted executables may be invoked:
  `node`, `npm`, `pnpm`, `yarn`, `python`, `python3`, `py`, `git`, `docker`, `docker-compose`.
  Any attempt to invoke arbitrary binaries, system utilities, or repository-supplied scripts is immediately rejected before spawn.
- **Command Injection Immunity**: Because arguments are passed directly to OS system calls as array elements without shell interpretation, shell metacharacters (`;`, `&&`, `|`, `` ` ``, `$()`) are treated as harmless literal string data.
- **Process Timeouts**: Every command execution is bound by a strict timeout (default 5,000ms). Processes exceeding the timeout are terminated immediately, preventing hanging diagnostics.
- **Output Truncation**: Standard output and error buffers are capped at `maxOutputBytes` (default 256KB) to prevent Denial of Service via buffer exhaustion or memory bloat.

---

## 2. Credentials and Secrets Policy

StackDoctor enforces strict privacy and credential isolation to ensure credentials never leak into terminal logs, error reports, or serialized files.

- **Never Read Secrets from `.env`**: StackDoctor never parses, stores, or extracts values from `.env` files. When comparing environment configurations (e.g. `.env.example` vs `.env`), only **variable names** are examined. All assignment values are discarded immediately upon parsing.
- **Canary Redaction Engine**: All text entering diagnostic findings, command logs, or evidence payloads is processed through `redactText()`. Standard patterns for passwords, JWTs, AWS access keys, GitHub tokens, Bearer authorization headers, and database connection strings are replaced with `[REDACTED]`.
- **Database Credentials Policy**:
  - By default, database checks perform network reachability tests only (Stage 1 DNS and Stage 2 TCP socket reachability). No credentials are read or tested.
  - Stage 3 authenticated connection testing requires explicit, active opt-in via the `--db-url-env <ENV_VAR_NAME>` command-line flag, reading exclusively from the active process environment.
  - Stored evidence contains only the host, port, scheme, and error classification. Passwords, connection URIs, and credentials are never included.
- **Read-Only Operations**: Database adapters only perform non-intrusive, read-only ping operations (`admin.ping` for MongoDB, `SELECT 1` for MySQL). Zero write, update, or mutation commands exist anywhere in the code.

---

## 3. Project Code Execution Gating

Inspecting a repository must never inadvertently trigger arbitrary or malicious user code.

- **Zero Project Code Execution by Default**: StackDoctor statically parses project manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `.env.example`, `docker-compose.yml`, `manage.py`) using safe AST and regex analyzers. It never executes `npm run`, `python script.py`, or imported modules.
- **Explicit Project Code Gating**: Certain advanced framework diagnostics (such as Django schema state) require running framework management utilities. Such checks are strictly gated behind the explicit command-line flag `--allow-project-code`.
  - Without `--allow-project-code`, the check is reported as `"skipped: requires running project code; use --allow-project-code"`.
  - Under no circumstances is `migrate` or any state-modifying command executed.

---

## 4. Non-Intrusive Network and Process Diagnostics

- **Never Kill Processes**: When a required network port is occupied by another process, StackDoctor diagnoses the conflict and reports the owning process PID and name where permitted. It never issues `kill`, `taskkill`, or signals to terminate any process.
- **Honest Conclusiveness**: If diagnostic permissions prevent identifying the process owner, StackDoctor honestly marks the check as `conclusive: false` and explicitly notes that the owner could not be identified.

---

## 5. Filesystem and Traversal Confinement

- **Confinement to Target Directory**: Scans are strictly confined to the validated target directory.
- **Symlink Protection**: Directory traversal routines ignore directory junctions and symlinks pointing outside the project root to prevent symlink escape and information leakage from host file systems.
- **Ignored Directories**: Sensitive and heavy directories (`node_modules`, `.git`, `.venv`, `dist`, `coverage`) are excluded by default from deep traversal.

---

## 6. Web & API Security Architecture (Phase 3)

The StackDoctor API (`apps/api`) and Web Platform (`apps/web`) operate under strict defense-in-depth principles:

### Content-Security-Policy (CSP) & XSS Defenses
- Strict CSP headers applied via Helmet in the API server and declared in `index.html`.
- Zero occurrences of `dangerouslySetInnerHTML` in the web application codebase.
- Evidence strings, log traces, and command suggestions are rendered strictly as inert text nodes.
- All external links open with `target="_blank"` and `rel="noopener noreferrer"`.

### Request Hygiene & Injection Prevention
- **Payload Size Cap**: Request bodies are capped at 1MB (`express.json({ limit: "1mb" })`) to prevent memory exhaustion DoS.
- **NoSQL Injection Immunity**: Request parameters and bodies are validated against strict Zod schemas and checked with `rejectNoSqlOperators()`. Any payload containing query operators (`$ne`, `$gt`, `$where`, etc.) is immediately rejected with HTTP 400.
- **Strict ObjectId Validation**: Hexadecimal 24-character ObjectIds are validated with regex prior to query execution. Malformed IDs return HTTP 400.

### CSRF & Session Security
- Cookie sessions are marked `httpOnly: true`, `sameSite: "lax"`, and dynamically require `secure: true` in production.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) with cookie credentials enforce `X-CSRF-Token` header verification.
- **Session Fixation Prevention**: Session identifiers are regenerated upon registration and successful authentication.
- API Bearer tokens bypass CSRF checks while maintaining independent authentication and ownership verification.

---

## 7. Multi-Tenant Isolation & Anti-Enumeration

- **Strict Owner Scoping**: Every resource (`Project`, `DiagnosticRun`, `ApiToken`) is bound to `ownerId`.
- **404 Anti-Enumeration Policy**: When a user attempts to access or modify a resource owned by another user, the server returns **HTTP 404 Not Found** (never 403 Forbidden). This prevents malicious users from probing the existence of private projects or runs.
- **Credential Validation Anti-Enumeration**: Authentication endpoints return identical generic error messages (`"Invalid email or password"`) for both missing email accounts and invalid passwords with equivalent timing.

---

## 8. API Tokens Lifecycle

- **Cryptographic Generation**: CLI API tokens are generated using `crypto.randomBytes(24)` with prefix `stk_live_`.
- **Single-Time Display**: Plaintext tokens are returned **exactly once** upon creation. They are never displayed again, logged, or returned in list queries.
- **Hash Persistence**: Only the SHA-256 hash (`crypto.createHash("sha256")`) and a 12-character display prefix are stored in MongoDB.
- **Revocation & Expiration**: Tokens can be revoked at any time. Revoked or expired tokens are immediately rejected with HTTP 401.
- **Secure CLI Storage**: CLI credentials are saved with restricted filesystem permissions (`0o600` on POSIX / private directories).
- **HTTPS Enforcement**: Insecure HTTP communication is permitted strictly for `localhost` and `127.0.0.1`. Remote servers must use HTTPS.

---

## 9. Data Retention & Account Deletion

- **Configurable Retention**: Users can configure report retention periods (30, 60, 90, 180, 365 days, or indefinite).
- **Scheduled & Manual Cleanup**: Runs exceeding the configured retention threshold are pruned automatically without touching other tenants' records.
- **Complete Account Removal**: Account deletion re-authenticates with current password and cascades deletion to all user projects, diagnostic runs, API tokens, user document, and destroys active sessions.

---

## 10. Dependency Security Audit Notes

As of Phase 4 (Run 4E), an audit of dependencies was conducted via `npm audit`:
- **Zod (`<4.6.6`)**: An advisory exists regarding oversized constrained array validation (GHSA-mrhx-c7xc-m3w5). In StackDoctor, this risk is mitigated at the network layer because `apps/api` enforces a strict 1MB body limit (`express.json({ limit: "1mb" })`) and CLI enforces a 10MB file limit before data reaches Zod parsing.
- **Vitest & Tinypool (`vitest <= 4.1.10`)**: Developer-only test runner dependencies in devDependencies (`@vitest/mocker`, `tinypool`). They are never bundled into production releases or deployed on production servers, and only run trusted repository test suites locally.

