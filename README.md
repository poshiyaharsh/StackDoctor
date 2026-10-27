# StackDoctor

> Find the cause. Fix the environment. Ship the code.

StackDoctor is an open-source developer environment diagnostics tool designed to help developers identify and fix local configuration, dependency, and runtime issues with clear evidence and actionable remediation.

---

## Features

- **100% Local & Self-Contained**: Operates locally with no remote backend, no tracking, and no AI hallucination.
- **Evidence-Based Diagnostics**: Strictly separates verified facts (`OBSERVED`) from possible causes (`POSSIBLE`).
- **20 Built-In Diagnostic Rules**: Comprehensive coverage across Node.js, Python, Django, Docker Compose, MongoDB, MySQL, and environment variables.
- **Security-First Execution**: Fixed executable allowlists, direct parameter arrays (zero `shell: true`), timeouts, output caps, and automated canary secret redaction.
- **Non-Intrusive**: Never installs packages, kills processes, modifies files, or writes to databases without explicit permission.
- **Benchmarked Accuracy**: 100% detection accuracy on test fixtures with 0% false positives.

---

## Installation & Setup

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Local Setup
```bash
# Clone repository
git clone https://github.com/poshiyaharsh/StackDoctor.git
cd StackDoctor

# Install dependencies across all workspaces
npm install

# Build all TypeScript packages
npm run build

# Link CLI globally for local use
npm link --workspace apps/cli
```

---

## CLI Usage

### Commands

#### 1. Scan a project
```bash
# Scan current working directory (100% offline)
stackdoctor scan

# Scan a specific target directory
stackdoctor scan ./examples/broken-node-project

# Run in deterministic CI mode with exit codes (0 = pass, 1 = findings at/above threshold)
stackdoctor scan --ci --fail-on high --format markdown

# Print machine-readable JSON to stdout
stackdoctor scan --format json

# Save JSON report to a file
stackdoctor scan --out report.json

# Disable ANSI colors in terminal output
stackdoctor scan --no-color

# Opt-in to authenticated database checks using a named environment variable
stackdoctor scan --db-url-env MONGO_URL

# Allow safe, read-only project code execution for framework diagnostics
stackdoctor scan --allow-project-code
```

#### 2. Generate Sanitized GitHub Issue Drafts (100% Offline)
```bash
# Generate a sanitized issue draft for current directory
stackdoctor issue .

# Copy issue draft directly to clipboard
stackdoctor issue . --copy

# Filter findings by minimum severity and save to markdown file
stackdoctor issue report.json --min-severity high --out issue.md
```

#### 3. Compare Diagnostic Reports (Offline Diff)
```bash
# Compare two reports and print terminal diff (New / Resolved / Changed)
stackdoctor compare base-report.json head-report.json

# Fail with exit code 1 in CI if new findings meet or exceed severity threshold
stackdoctor compare base-report.json head-report.json --fail-on-new high

# Output structured JSON or Markdown diff
stackdoctor compare base.json head.json --format markdown --out diff.md
```

#### 4. Explain Diagnostic Rules
```bash
# Explain rule evidence requirements, possible causes, remediation, and docs
stackdoctor explain NODE_DEPS_NOT_INSTALLED

# Output rule metadata in machine-readable JSON format
stackdoctor explain PORT_IN_USE --json
```

#### 5. Author New Rules with the Generator
```bash
# Scaffold a new diagnostic rule, passing tests, and docs catalog entry
npm run new-rule -- --id NODE_HEAP_LIMIT_EXCEEDED --tech node
```

#### 6. Upload Reports & Team Collaboration (Phase 3 Web Platform)
```bash
# Log in to your StackDoctor server instance
stackdoctor login --server http://localhost:3000

# Inspect and upload your local diagnostic report (shows interactive preview)
stackdoctor upload

# Non-interactive upload for CI/CD pipelines
stackdoctor upload --yes

# Clear stored credentials
stackdoctor logout
```

---

## GitHub Actions & CI Integration

StackDoctor integrates seamlessly into GitHub Actions workflows to catch environment regressions before code is merged:

```yaml
name: "Environment Diagnostics"
on: [pull_request, push]

permissions:
  contents: read

jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run StackDoctor Diagnostics
        uses: poshiyaharsh/StackDoctor@main
        with:
          path: "."
          fail-on: "high"
```

For complete CI guides and custom pipelines, see [docs/ci.md](docs/ci.md).

---

## Web Platform & Architecture

StackDoctor includes an optional web platform featuring an interactive dashboard, project history, report comparisons, and rich diagnostic report viewers:

```
+-------------------------------------------------------------------------+
|  🩺 StackDoctor Web Platform                                            |
|                                                                         |
|  [Total Runs: 12]   [Projects: 3]   [Failed: 4]   [Passed: 8]          |
|                                                                         |
|  Recent Diagnostic Runs:                                                |
|  - API Gateway        FAILED    2 findings   Node 20.x, Docker Compose |
|  - Auth Service       PASSED    0 findings   Python 3.12, PostgreSQL   |
|                                                                         |
|  Report View:                                                           |
|  🔍 OBSERVED EVIDENCE (Deterministic facts, probes, exact logs)         |
|  💡 POSSIBLE CAUSES   (Hypotheses, version conflicts, missing files)   |
|  🛠️ RECOMMENDED FIX   (Exact copyable commands, risks, verification)   |
|  ⚖️ COMPARE RUNS      (Side-by-side diff: New, Resolved, Changed)       |
+-------------------------------------------------------------------------+
```

### Core Architecture Principles
1. **Local-First & Offline-by-Default**: `stackdoctor scan`, `issue`, `compare`, and `explain` make zero network calls and never transmit source code or secrets.
2. **Explicit User Uploads**: Reports are uploaded only when developers explicitly run `stackdoctor upload` and confirm via interactive preview.
3. **Multi-Pass Redaction**: All credentials, tokens, environment variable assignments, and canary secrets are sanitized before leaving the machine and re-redacted on the server.
4. **Strict Isolation**: Multi-tenant database design with owner-scoped aggregation and zero cross-tenant visibility.

---

## Diagnostic Rules Catalog (20 Rules)

| Rule ID | Severity | Category | Description |
|---------|----------|----------|-------------|
| `NODE_DEPS_NOT_INSTALLED` | High | dependencies | `package.json` exists but `node_modules` is missing |
| `ENV_EXAMPLE_PRESENT_NO_ENV` | Medium | configuration | `.env.example` exists but `.env` is absent |
| `NODE_VERSION_MISMATCH` | High | runtime | Active Node.js runtime does not satisfy declared requirement |
| `LOCKFILE_MISSING` | Low | dependencies | `package.json` exists without a lockfile |
| `PYTHON_VENV_MISSING` | Medium | runtime | Python project detected without an active or local virtual environment |
| `PORT_IN_USE` | High | network | Declared network port is already in use by another process |
| `ENV_VAR_NAMES_MISSING` | High | configuration | Required environment variable names from template missing from `.env` |
| `PORT_INVALID` | High | network | Declared network port is invalid or out of range (1-65535) |
| `RUNTIME_DECLARATIONS_CONFLICT` | Medium | runtime | Conflicting Node.js versions between `package.json` and `.nvmrc` |
| `COMPOSE_SERVICE_NOT_FOUND` | High | configuration | Application references Docker Compose service not defined in compose file |
| `MONGO_CONNECTION_REFUSED` | High | database | MongoDB connection refused on target endpoint (never claims uninstalled) |
| `MONGO_AUTH_FAILED` | High | database | MongoDB authentication rejected by target server |
| `MYSQL_CONNECTION_REFUSED` | High | database | MySQL connection refused on target endpoint (never claims uninstalled) |
| `MYSQL_AUTH_FAILED` | High | database | MySQL authentication rejected by target server |
| `DB_HOST_NOT_RESOLVED` | High | database | Database hostname failed DNS resolution |
| `DB_CONNECTION_TIMEOUT` | High | database | Database TCP socket connection timed out |
| `PYTHON_PACKAGES_MISSING` | High | dependencies | Declared dependencies in `requirements.txt` or `pyproject.toml` not installed |
| `PYTHON_PACKAGE_VERSION_MISMATCH` | High | dependencies | Installed Python package version does not satisfy requirement |
| `DJANGO_SETTINGS_NOT_FOUND` | High | configuration | Django settings module file specified in `manage.py` not found |
| `DJANGO_MIGRATIONS_PENDING` | Medium | database | Unapplied database schema changes detected via safe read-only inspection |

---

## Verification & Accuracy

```bash
# Run complete test suite across monorepo (48 test suites, 320+ tests)
npm test

# Run diagnostic accuracy evaluation across test fixtures
npm run eval

# Run end-to-end integration verifications
npm run e2e:phase3
npm run e2e:phase4

# Run linter and typecheck
npm run lint
npm run typecheck
```

---

## Documentation

- [System Architecture](docs/architecture.md)
- [Security & Credentials Policy](docs/security.md)
- [CI & GitHub Actions Guide](docs/ci.md)
- [JSON Report Format Specification](docs/report-format.md)
- [Contributor Rule Authoring Guide](docs/contributing.md)
- [Installation & Local Setup](docs/installation.md)
- [Diagnostic Rules Catalog](docs/diagnostics.md)
- [Changelog](CHANGELOG.md)
- [Development Log](docs/LOG.md)