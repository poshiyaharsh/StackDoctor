# StackDoctor

[![CI](https://github.com/poshiyaharsh/StackDoctor/actions/workflows/ci.yml/badge.svg)](https://github.com/poshiyaharsh/StackDoctor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Self-healing diagnostic engine for local web development stacks**

StackDoctor is an open-source, evidence-first diagnostic tool that identifies why your local web development stack failed to start, connects the dots across your runtime, containers, environment variables, and databases, and provides concrete, copy-pasteable remediation steps with built-in rollback instructions.

---

## The Problem

Every developer knows the frustration of running `npm run dev`, `docker compose up`, or `python manage.py runserver` only to be greeted by a wall of cryptic errors:
- `ECONNREFUSED 127.0.0.1:5432` — Is PostgreSQL not installed, crashed, stopped, or listening on a different port?
- `EADDRINUSE :::3000` — Which hidden process or orphaned container is holding the port hostage?
- `ERR_MODULE_NOT_FOUND` — Are dependencies missing, is the Node.js version incompatible, or did a package lockfile drift?
- Silent runtime crashes caused by environment variables added to `.env.example` that were never propagated to local `.env`.

Developers spend hours digging through process trees, reading outdated StackOverflow answers, and running random `sudo kill -9` or `rm -rf node_modules` commands that make the breakage worse. StackDoctor eliminates this trial-and-error by deterministically inspecting your local system facts, isolating the root cause, and presenting an actionable fix plan with zero guesswork.

---

## Real Example Report

Here is an actual report produced by running `stackdoctor scan` against a broken Node.js development environment:

```text
=== StackDoctor Diagnostic Report ===
Project Name : broken-node-project
Status       : COMPLETED WITH WARNINGS
Summary      : 1 checks run | 4 findings detected
               (Critical: 0, High: 3, Medium: 0, Low: 1, Info: 0)

--- Technologies Detected ---
  • Node.js (confirmed)

--- Environment Info ---
  Operating System : win32
  Node Version     : v24.13.0
  Started At       : 2026-10-27T12:44:57.859Z
  Completed At     : 2026-10-27T12:44:57.872Z

--- Warnings ---
  [WARN] [LOCKFILE_MISSING] Package lockfile missing (low severity, confirmed)

--- Failed Checks ---
  [FAIL] Check: Check Node.js dependencies installed (0ms)
  [FAIL] [ENV_VAR_NAMES_MISSING] 3 environment variable name(s) missing from .env (high severity, confirmed)
  [FAIL] [NODE_DEPS_NOT_INSTALLED] Node.js dependencies not installed (high severity, confirmed)
  [FAIL] [NODE_VERSION_MISMATCH] Installed Node.js version does not satisfy project requirement (high severity, confirmed)

--- Observed Evidence (FACTS ONLY) ---
  Finding: 3 environment variable name(s) missing from .env (ENV_VAR_NAMES_MISSING)
    OBSERVED: The following variable name(s) defined in .env.example are missing from .env: PORT, DATABASE_URL, SESSION_SECRET. (Secret values were not read or stored).
    Source  : .env.example -> .env [file_presence]
  Finding: Node.js dependencies not installed (NODE_DEPS_NOT_INSTALLED)
    OBSERVED: package.json exists in the project root, but node_modules does not exist.
    Source  : filesystem [file_presence]
  Finding: Installed Node.js version does not satisfy project requirement (NODE_VERSION_MISMATCH)
    OBSERVED: Active Node.js version is "24.13.0", but package.json (engines.node) specifies requirement "^12.0.0".
    Source  : package.json (engines.node) [version_check]
  Finding: Package lockfile missing (LOCKFILE_MISSING)
    OBSERVED: package.json exists in the project root, but no lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb) was detected.
    Source  : filesystem [file_presence]

--- Probable Causes (POSSIBLE HYPOTHESES) ---
  Finding: 3 environment variable name(s) missing from .env
    POSSIBLE: New configuration keys were added to .env.example without updating local .env.
    POSSIBLE: .env was copied from a template before recent features were added.
  Finding: Node.js dependencies not installed
    POSSIBLE: Project dependencies have not yet been installed after cloning the repository.
    POSSIBLE: The node_modules directory was cleaned or deleted.
  Finding: Installed Node.js version does not satisfy project requirement
    POSSIBLE: Active Node.js runtime version (24.13.0) does not satisfy declared requirement (^12.0.0).
    POSSIBLE: Version manager (nvm, fnm, or volta) has a different default version selected.
  Finding: Package lockfile missing
    POSSIBLE: Project was initialized or modified without generating a lockfile.
    POSSIBLE: The lockfile was excluded by .gitignore or not checked into source control.

--- Recommended Next Steps ---
  1. Action     : Add missing key(s) to .env: PORT, DATABASE_URL, SESSION_SECRET
     Problem    : Missing configuration variables in local environment.
     Expected   : All expected environment keys are declared in .env.
     Risks      : Add keys only; never commit .env to source control.
     Verify     : stackdoctor scan
  2. Action     : npm install
     Problem    : Node.js dependencies are not installed in node_modules.
     Expected   : node_modules will be created and populated using npm.
     Risks      : Downloads external packages; suggestion only until user approves.
     Undo       : rm -rf node_modules
     Verify     : test -d node_modules
  3. Action     : nvm install "^12.0.0" && nvm use "^12.0.0"
     Problem    : Active Node.js runtime is incompatible with declared requirements.
     Expected   : Switches to Node.js matching ^12.0.0.
     Risks      : Installs a Node.js version via nvm; suggestion only.
     Undo       : nvm use system
     Verify     : node -v
  4. Action     : npm install --package-lock-only
     Problem    : Missing dependency lockfile.
     Expected   : Generates a package-lock.json file pinning exact dependency versions.
     Risks      : Harmless file creation; does not modify source code.
     Undo       : rm -f package-lock.json
     Verify     : test -f package-lock.json
```

---

## 60-Second Quick Start

No global installation required. Run directly in your project root using `npx`:

```bash
# 1. Navigate to your project directory
cd /path/to/your/project

# 2. Run diagnostic scan (100% offline)
npx stackdoctor scan

# 3. Read the report and follow recommended remediation steps
```

### Or Install Globally

```bash
npm install -g stackdoctor
stackdoctor scan
```

---

## Core Principles

1. **Evidence First, Hypotheses Second**: StackDoctor strictly separates verified facts (`OBSERVED`) from plausible explanations (`POSSIBLE`). We will never tell you a database is dead when the only fact is a refused socket connection.
2. **Local-Only by Default**: The diagnostic engine runs 100% on your machine. Zero outbound network calls, zero tracking telemetry, zero analytics, and zero phone-home behavior.
3. **No Automatic Dangerous Changes**: StackDoctor diagnoses and recommends; it never mutates files, installs packages, drops tables, or kills processes behind your back. Every recommendation includes an explanation, expected result, risk assessment, verification command, and undo instructions.
4. **Determinism over Hallucination**: Diagnostic findings are produced by deterministic, unit-tested TypeScript rules — not probabilistic language models. Output is stable, reproducible, and benchmarked against real fixtures.

---

## Diagnostic Rules Catalog (20 Built-In Rules)

StackDoctor includes 20 production-tested diagnostic rules across modern web stacks. For full rule specifications, see the [Complete Diagnostics Reference](docs/diagnostics.md).

| Category | Rule ID | Title | Severity |
|---|---|---|:---:|
| **Dependencies** | `NODE_DEPS_NOT_INSTALLED` | Node.js dependencies not installed | High |
| **Dependencies** | `NODE_VERSION_MISMATCH` | Installed Node.js version does not satisfy project requirement | High |
| **Dependencies** | `LOCKFILE_MISSING` | Package lockfile missing | Low |
| **Dependencies** | `PYTHON_VENV_MISSING` | Python virtual environment not found | Medium |
| **Dependencies** | `PYTHON_PACKAGES_MISSING` | Python packages missing from environment | High |
| **Dependencies** | `PYTHON_PACKAGE_VERSION_MISMATCH` | Installed Python package version does not satisfy requirement | Medium |
| **Environment** | `ENV_EXAMPLE_PRESENT_NO_ENV` | Environment template exists but .env is missing | High |
| **Environment** | `ENV_VAR_NAMES_MISSING` | Environment variable names missing from .env | High |
| **Environment** | `RUNTIME_DECLARATIONS_CONFLICT` | Conflicting runtime version declarations | Medium |
| **Network** | `PORT_IN_USE` | Target network port is already in use by another process | High |
| **Network** | `PORT_INVALID` | Configured port number is invalid | High |
| **Containers** | `COMPOSE_SERVICE_NOT_FOUND` | Docker Compose service referenced in configuration does not exist | High |
| **Database** | `MONGO_CONNECTION_REFUSED` | MongoDB connection refused | High |
| **Database** | `MONGO_AUTH_FAILED` | MongoDB authentication failed | High |
| **Database** | `MYSQL_CONNECTION_REFUSED` | MySQL connection refused | High |
| **Database** | `MYSQL_AUTH_FAILED` | MySQL authentication failed | High |
| **Database** | `DB_HOST_NOT_RESOLVED` | Database host could not be resolved | High |
| **Database** | `DB_CONNECTION_TIMEOUT` | Database connection timed out | High |
| **Framework** | `DJANGO_SETTINGS_NOT_FOUND` | Django settings module not found | High |
| **Framework** | `DJANGO_MIGRATIONS_PENDING` | Unapplied Django migrations detected | Medium |

*(Regenerate this table automatically using `npm run docs:rules`).*

---

## Optional Features (All Off by Default)

- **AI Diagnostic Assistant (`stackdoctor explain`)**:
  - **Status**: Disabled by default.
  - **How it works**: Uses an LLM (OpenAI, Anthropic, or local Ollama) to translate complex multi-variable diagnostics into conversational explanations.
  - **Privacy**: Requires explicit user consent and an explicit API key or local endpoint. Secret values, environment variables, and proprietary code files are automatically redacted prior to prompt generation.
- **Web Dashboard & Ingestion API (`apps/web`, `apps/api`)**:
  - **Status**: Disabled by default.
  - **How it works**: Optional self-hosted team platform for visualizing historical scans and sharing team diagnostics.
  - **Privacy**: Runs on your own infrastructure via Docker Compose; data stays entirely within your network. See [Self-Hosting Guide](docs/self-hosting.md).
- **Telemetry & Tracking**:
  - **Status**: **ZERO TELEMETRY**. StackDoctor contains no analytics packages, no error-reporting SDKs (e.g. Sentry/Segment), and no phone-home pings.

---

## Documentation

- **[Installation Guide](docs/installation.md)**: Platform support matrix, npx/npm/source installation, and troubleshooting common setup issues.
- **[Diagnostics Reference](docs/diagnostics.md)**: In-depth documentation for all 20 rules, preconditions, evidence sources, and remediation steps.
- **[CI/CD Guide](docs/ci.md)**: Running StackDoctor in GitHub Actions, GitLab CI, or local pre-commit hooks with deterministic exit codes.
- **[Privacy & Data Handling](docs/privacy.md)**: Full disclosure on secret redaction, local execution, and optional platform retention.
- **[Self-Hosting Guide](docs/self-hosting.md)**: Deploying the web dashboard and API with Docker Compose.
- **[FAQ](docs/faq.md)**: Honest answers to common technical questions.
- **[Known Limitations](docs/known-limitations.md)**: Transparent account of current platform limits, skipped checks, and false-positive boundaries.
- **[Roadmap](ROADMAP.md)**: Planned exploratory milestones (PostgreSQL, pnpm/bun workspaces, fix automation).
- **[Good First Issues](docs/good-first-issues.md)**: Curated tasks for new contributors.
- **[Contributing Guide](CONTRIBUTING.md)**: Development setup, rule authoring lifecycle, and guidelines.
- **[Security Policy](SECURITY.md)**: Vulnerability disclosure procedure and security guarantees.

---

## License

StackDoctor is open-source software licensed under the [MIT License](LICENSE).