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
