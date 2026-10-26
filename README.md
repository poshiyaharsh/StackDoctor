# StackDoctor

> Find the cause. Fix the environment. Ship the code.

StackDoctor is an open-source developer environment diagnostics tool designed to help developers identify and fix local configuration, dependency, and runtime issues with clear evidence and actionable remediation.

---

## Phase 1: Foundation Overview

In Phase 1, StackDoctor delivers a fully local, self-contained diagnostic engine and CLI requiring no remote backend and no AI:

- **Local CLI**: `stackdoctor scan [path]` for diagnosing projects.
- **Evidence-Based Diagnostics**: Clearly separates observed facts (`OBSERVED`) from hypotheses (`POSSIBLE`).
- **Security & Secret Redaction**: Automatically redacts API keys, passwords, bearer tokens, AWS keys, JWTs, and private keys from all reports and logs.
- **Shared Schemas**: Strongly typed Zod schemas for reports, checks, findings, evidence, and recommendations.
- **Resilient Engine**: Failing or hanging checks never crash the run; errors are safely captured into the report.

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

## Usage

### Run a diagnostic scan
```bash
# Scan current directory
stackdoctor scan

# Scan a specific project directory
stackdoctor scan ./examples/broken-node-project

# Output formatted JSON report to stdout
stackdoctor scan ./examples/broken-node-project --json

# Save JSON report to a file
stackdoctor scan ./examples/broken-node-project --out report.json

# Disable ANSI colors
stackdoctor scan ./examples/broken-node-project --no-color
```

### Exit Codes
- `0`: Scan completed with no high or critical severity issues.
- `1`: Scan identified environment issues at high or critical severity.
- `2`: Tool error (invalid path, internal schema validation failure).

---

## Example Output

```text
=== StackDoctor Diagnostic Report ===
Project Name : broken-node-project
Status       : COMPLETED WITH WARNINGS
Summary      : 2 checks run | 2 findings detected
               (Critical: 0, High: 1, Medium: 1, Low: 0, Info: 0)

--- Technologies Detected ---
  • Node.js (confirmed)

--- Environment Info ---
  Operating System : win32
  Node Version     : v24.13.0
  Started At       : 2026-10-26T09:22:03.001Z
  Completed At     : 2026-10-26T09:22:03.005Z

--- Passed Checks ---
  None.

--- Warnings ---
  [WARN] Check: Check .env configuration presence (0ms)
  [WARN] [ENV_EXAMPLE_PRESENT_NO_ENV] Environment template present but .env file is missing (medium severity, confirmed)

--- Failed Checks ---
  [FAIL] Check: Check Node.js dependencies installed (0ms)
  [FAIL] [NODE_DEPS_NOT_INSTALLED] Node.js dependencies not installed (high severity, confirmed)

--- Observed Evidence (FACTS ONLY) ---
  Finding: Node.js dependencies not installed (NODE_DEPS_NOT_INSTALLED)
    OBSERVED: package.json exists in the project root, but node_modules does not exist.
    Source  : filesystem [file_presence]
  Finding: Environment template present but .env file is missing (ENV_EXAMPLE_PRESENT_NO_ENV)
    OBSERVED: .env.example exists, but .env is absent. Declared variable names: [PORT, NODE_ENV, DATABASE_URL, SESSION_SECRET]
    Source  : .env.example [file_presence]

--- Probable Causes (POSSIBLE HYPOTHESES) ---
  Finding: Node.js dependencies not installed
    POSSIBLE: Project dependencies have not yet been installed after cloning the repository.
    POSSIBLE: The node_modules directory was cleaned or deleted.
  Finding: Environment template present but .env file is missing
    POSSIBLE: Developer cloned repository but has not copied .env.example to .env.
    POSSIBLE: Local environment variables were not yet configured.

--- Recommended Next Steps ---
  1. Action     : npm install
     Problem    : Node.js dependencies are not installed in node_modules.
     Expected   : node_modules will be created and populated using npm.
     Risks      : Downloads external packages; suggestion only until user approves.
     Undo       : rm -rf node_modules
     Verify     : test -d node_modules
  2. Action     : cp .env.example .env
     Problem    : No .env file found to provide environment variables.
     Expected   : A local .env configuration file will be initialized.
     Risks      : Template values may need adjustment with valid local secrets.
     Undo       : rm -f .env
     Verify     : test -f .env

StackDoctor CLI v0.1.0 | Schema v1.0.0
```

---

## Testing & Quality

```bash
# Run all vitest suites
npm test

# Lint across all workspaces
npm run lint

# Typecheck monorepo
npm run typecheck
```

---

## License

MIT © 2026 Harsh Poshiya and StackDoctor Contributors