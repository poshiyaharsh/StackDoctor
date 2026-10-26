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
# Scan current working directory
stackdoctor scan

# Scan a specific target directory
stackdoctor scan ./examples/broken-node-project

# Print machine-readable JSON to stdout
stackdoctor scan ./examples/broken-node-project --json

# Save JSON report to a file
stackdoctor scan ./examples/broken-node-project --out report.json

# Disable ANSI colors in terminal output
stackdoctor scan ./examples/broken-node-project --no-color

# Opt-in to authenticated database checks using a named environment variable
stackdoctor scan --db-url-env MONGO_URL

# Allow safe, read-only project code execution for framework diagnostics
stackdoctor scan --allow-project-code
```

#### 2. List Diagnostic Rules
```bash
# List all 20 registered rules in terminal format
stackdoctor rules

# Export rules as JSON array
stackdoctor rules --json
```

### Command Flags

| Flag | Description |
|------|-------------|
| `--json` | Outputs schema-validated JSON report to stdout. |
| `--out <file>` | Writes JSON report directly to specified file. |
| `--no-color` | Disables ANSI color escapes in terminal formatting. |
| `--db-url-env <VAR>` | Opt-in to authenticated Stage 3 database reachability testing using named env var. |
| `--allow-project-code` | Opt-in to safe, read-only inspection commands that execute framework management code. |
| `--version`, `-v` | Prints StackDoctor version. |
| `--help`, `-h` | Prints help and usage instructions. |

### Exit Codes
- `0`: Scan passed with no high or critical severity issues.
- `1`: Scan identified environment issues at high or critical severity.
- `2`: Tool error (invalid target directory, internal schema failure).

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
# Run test suite
npm test

# Run diagnostic accuracy evaluation across fixtures
npm run eval

# Run linter and typecheck
npm run lint
npm run typecheck
```

---

## Documentation

- [Diagnostic Rules Reference](docs/diagnostics.md)
- [Installation & Platform Support Matrix](docs/installation.md)
- [Security & Credentials Policy](docs/security.md)
- [Development Log](docs/LOG.md)