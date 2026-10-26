# Diagnostics

This document catalog describes each diagnostic rule implemented in StackDoctor, including the observed evidence, hypotheses, and remediation steps.

---

## Diagnostic Rules Catalog

### 1. `NODE_DEPS_NOT_INSTALLED`

- **Title**: Node.js dependencies not installed
- **Category**: `dependencies`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `Node.js`
- **Description**: Triggered when a `package.json` file is present in the project root or subproject, but the `node_modules` directory does not exist.
- **Preconditions**: `package.json` exists in project root.
- **Observed Evidence (Facts)**:
  - File presence: `package.json` was located.
  - Directory absence: `node_modules` is not present.
- **Possible Causes (Hypotheses)**:
  - The repository was recently cloned or checked out without running dependency installation.
  - The `node_modules` directory was manually cleaned or deleted.
- **Remediation**:
  - Command: `npm install` (or `pnpm install`, `yarn install`, `bun install` matching detected lockfile).
  - Risks: Downloads packages from external registries; requires user approval.
  - Undo: `rm -rf node_modules`
- **Verification**: Verify that `node_modules` directory exists after running the command.
- **References**: [npm install documentation](https://docs.npmjs.com/cli/v10/commands/npm-install)

---

### 2. `ENV_EXAMPLE_PRESENT_NO_ENV`

- **Title**: Environment template present but .env file is missing
- **Category**: `configuration`
- **Severity**: `medium`
- **Confidence**: `confirmed`
- **Technologies**: `*` (All technologies)
- **Description**: Triggered when an environment variable template file (such as `.env.example` or `.env.sample`) exists, but no corresponding `.env` file exists.
- **Preconditions**: `.env.example` exists.
- **Observed Evidence (Facts)**:
  - File presence: `.env.example` exists.
  - File absence: `.env` does not exist.
  - Variable names: List of variable names declared in `.env.example` (variable values are never read or stored).
- **Possible Causes (Hypotheses)**:
  - The repository was cloned but the environment template has not yet been copied to `.env`.
  - Local configuration was not initialized for this environment.
- **Remediation**:
  - Command: `cp .env.example .env`
  - Risks: Created file requires manual inspection to supply valid local secrets.
  - Undo: `rm -f .env`
- **Verification**: Verify that `.env` file exists in project root.
- **References**: [The Twelve-Factor App: Config](https://12factor.net/config)

---

### 3. `NODE_VERSION_MISMATCH`

- **Title**: Installed Node.js version does not satisfy project requirement
- **Category**: `runtime`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `Node.js`
- **Description**: Triggered when the active Node.js runtime version does not satisfy the version range explicitly declared in `package.json` (`engines.node`), `.nvmrc`, or `.node-version`.
- **Preconditions**: Project explicitly declares a Node version requirement and active Node runtime version is available.
- **Observed Evidence (Facts)**:
  - Active version: Clean semantic version from `node -v`.
  - Declared range: Target version range and source file location.
- **Possible Causes (Hypotheses)**:
  - Active Node.js runtime version does not satisfy declared requirement.
  - Version manager (nvm, fnm, or volta) has a different default version selected.
- **Remediation**:
  - Command: `nvm install "<range>" && nvm use "<range>"`
  - Risks: Installs or switches the active Node version for this terminal session.
  - Undo: `nvm use system`
- **Verification**: Run `node -v` to confirm active version satisfies the declared range.
- **References**: [Node.js Documentation](https://nodejs.org/)

---

### 4. `LOCKFILE_MISSING`

- **Title**: Package lockfile missing
- **Category**: `dependencies`
- **Severity**: `low`
- **Confidence**: `confirmed`
- **Technologies**: `Node.js`
- **Description**: Triggered when `package.json` is present in the project root, but no lockfile (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`) exists.
- **Preconditions**: `package.json` exists in project root.
- **Observed Evidence (Facts)**:
  - File presence: `package.json` exists in project root.
  - File absence: No supported lockfile found in project root.
- **Possible Causes (Hypotheses)**:
  - Project was initialized or modified without generating a lockfile.
  - The lockfile was excluded by `.gitignore` or not checked into source control.
- **Remediation**:
  - Command: `npm install --package-lock-only`
  - Risks: Pins resolved dependency versions; recommended for version control.
  - Undo: `rm -f package-lock.json`
- **Verification**: Confirm that a lockfile exists in project root.
- **References**: [npm package-lock.json documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)

---

### 5. `PYTHON_VENV_MISSING`

- **Title**: Python virtual environment missing
- **Category**: `environment`
- **Severity**: `medium`
- **Confidence**: `confirmed`
- **Technologies**: `Python`, `Django`
- **Description**: Triggered when a Python project is detected, but no virtual environment is active in the environment (`VIRTUAL_ENV` not set) and no local venv directory (`.venv`, `venv`) exists.
- **Preconditions**: Python or Django technology detected.
- **Observed Evidence (Facts)**:
  - File absence: Neither active `VIRTUAL_ENV` nor local `.venv`/`venv` folder found.
- **Possible Causes (Hypotheses)**:
  - A Python virtual environment has not yet been created for this project.
  - A virtual environment exists elsewhere but has not been activated in this shell session.
- **Remediation**:
  - Command: `python -m venv .venv`
  - Risks: Creates a local `.venv` directory; harmless to existing code.
  - Undo: `rm -rf .venv`
- **Verification**: Confirm that `.venv` directory exists or `VIRTUAL_ENV` is active.
- **References**: [Python venv documentation](https://docs.python.org/3/library/venv.html)
