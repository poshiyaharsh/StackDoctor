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
