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

---

### 6. `PORT_IN_USE`

- **Title**: Required network port is already in use
- **Category**: `network`
- **Severity**: `high`
- **Confidence**: `confirmed` (when owning process is identified) / `likely` (when owning process could not be determined)
- **Technologies**: `*` (All technologies)
- **Description**: Triggered when a required network port declared by the project is already bound by another process or listener on this machine.
- **Preconditions**: At least one declared port test confirms an active listener on the target port.
- **Observed Evidence (Facts)**:
  - Network probe: TCP connection to host:port succeeded (actively listening).
  - Owning process: Process PID and name if identified via OS tools (`netstat`, `ss`, `lsof`). States clearly whether evidence is conclusive (process identified) or not conclusive.
- **Possible Causes (Hypotheses)**:
  - Another instance of the application or a different development server is already running.
  - A background system service or Docker container is bound to the port.
- **Remediation**:
  - Command: Terminate the occupying process or specify an alternate `PORT` in your environment.
  - Risks: Terminating another process may interrupt background services; StackDoctor never auto-terminates processes.
  - Undo: Restart the terminated service or reset PORT configuration.
- **Verification**: Verify that the port is free using TCP probe or netstat.
- **References**: [Node.js EADDRINUSE Documentation](https://nodejs.org/api/errors.html#eaddrinuse)

---

### 7. `ENV_VAR_NAMES_MISSING`

- **Title**: Required environment variable names missing from .env
- **Category**: `configuration`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `*` (All technologies)
- **Description**: Triggered when `.env` is present in the project root, but one or more variable names documented in `.env.example` are missing from `.env`.
- **Preconditions**: Both `.env.example` and `.env` exist.
- **Observed Evidence (Facts)**:
  - Variable names: List of variable names missing from `.env`. (Secret values are never read, stored, or logged).
- **Possible Causes (Hypotheses)**:
  - New configuration keys were added to `.env.example` without updating local `.env`.
  - `.env` was copied from a template before recent features were added.
- **Remediation**:
  - Command: Add missing keys to `.env` with appropriate local values.
  - Risks: Adding keys to `.env` modifies local configuration; never commit `.env` to source control.
  - Undo: Remove added keys from `.env`.
- **Verification**: Re-run scan to confirm all declared keys are present.
- **References**: [The Twelve-Factor App: Config](https://12factor.net/config)

---

### 8. `PORT_INVALID`

- **Title**: Declared network port is invalid or out of range
- **Category**: `configuration`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `*` (All technologies)
- **Description**: Triggered when a network port specified in project configuration or scripts is not a valid TCP port number (must be an integer between 1 and 65535).
- **Preconditions**: At least one statically declared port fails numeric range validation.
- **Observed Evidence (Facts)**:
  - Configuration source: The file and script or setting where the invalid value was detected.
  - Raw value: The invalid string or out-of-range number detected.
- **Possible Causes (Hypotheses)**:
  - A typo or non-numeric placeholder was entered in configuration.
  - An environment variable was assigned an out-of-range port number (e.g. greater than 65535 or negative).
- **Remediation**:
  - Command: Update configuration to specify a valid TCP port number between 1 and 65535.
  - Risks: Modifies configuration; ensure selected port does not conflict with existing services.
  - Undo: Revert configuration change.
- **Verification**: Verify that all declared port numbers are integers in 1-65535.
- **References**: [Port Numbers](https://en.wikipedia.org/wiki/Port_(computer_networking))

---

### 9. `RUNTIME_DECLARATIONS_CONFLICT`

- **Title**: Conflicting runtime version declarations between project files
- **Category**: `configuration`
- **Severity**: `medium`
- **Confidence**: `confirmed`
- **Technologies**: `Node.js`
- **Description**: Triggered when the project contains mutually conflicting runtime version specifications across configuration files (e.g. `.nvmrc` conflicts with `package.json` `engines.node`).
- **Preconditions**: Both `.nvmrc` and `engines.node` are declared and their version ranges do not intersect.
- **Observed Evidence (Facts)**:
  - Version strings: Version declared in `.nvmrc` and semver range declared in `engines.node`.
- **Possible Causes (Hypotheses)**:
  - `.nvmrc` was updated without updating `engines.node` in `package.json` (or vice versa).
  - A version bump was partially completed across repository files.
- **Remediation**:
  - Command: Align `.nvmrc` and `package.json` `engines.node` to target the same compatible Node.js version range.
  - Risks: Modifies version declaration files; harmless to source code.
  - Undo: Revert configuration files.
- **Verification**: Verify that `.nvmrc` satisfies the range specified in `package.json` `engines.node`.
- **References**: [npm package.json engines](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines)

---

### 10. `COMPOSE_SERVICE_NOT_FOUND`

- **Title**: Application references Docker Compose service not defined in compose file
- **Category**: `configuration`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `Docker`, `Docker Compose`
- **Description**: Triggered when an application configuration or environment URL references a service name that does not exist in the project's `docker-compose.yml` services.
- **Preconditions**: Compose file exists and at least one referenced service name is missing from `services:`.
- **Observed Evidence (Facts)**:
  - Referenced service: Name and source of the referenced service.
  - Defined services: List of all valid service names declared under `services:` in compose file.
- **Possible Causes (Hypotheses)**:
  - The service was renamed or removed from `docker-compose.yml`.
  - The application configuration has a typo in the service hostname.
- **Remediation**:
  - Command: Add the service definition to `docker-compose.yml` or update application configuration to reference an existing service.
  - Risks: Modifies compose file or configuration.
  - Undo: Revert compose file or configuration changes.
- **Verification**: Confirm that all referenced hostnames match defined compose services.
- **References**: [Compose File Specification](https://docs.docker.com/compose/compose-file/)

---

### 11. `MONGO_CONNECTION_REFUSED`

- **Title**: MongoDB connection refused on target endpoint
- **Category**: `database`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `MongoDB`
- **Description**: Triggered when a TCP connection to the configured MongoDB host and port is actively refused (ECONNREFUSED).
- **Preconditions**: Staged diagnostic confirms TCP connection to MongoDB endpoint was refused.
- **Observed Evidence (Facts)**:
  - Network probe: Connection refused (ECONNREFUSED) on `host:port`.
- **Possible Causes (Hypotheses)**:
  - MongoDB service or daemon (`mongod`) is not currently running.
  - The configured host or port is incorrect.
  - MongoDB is running inside a Docker container that is stopped or has not forwarded the port.
  - Local firewall or network configuration is blocking connection.
- **Remediation**:
  - Command: Start MongoDB locally (`mongod`), or run `docker compose up -d` if using containers.
  - Risks: Starts database service.
  - Undo: Stop started database service.
- **Verification**: Re-run scan to confirm TCP connection succeeds.
- **References**: [MongoDB Connection Troubleshooting](https://www.mongodb.com/docs/manual/administration/monitoring/)

---

### 12. `MONGO_AUTH_FAILED`

- **Title**: MongoDB authentication failed
- **Category**: `database`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `MongoDB`
- **Description**: Triggered when a network connection to MongoDB succeeds, but authentication is rejected by the database.
- **Preconditions**: Opt-in authenticated check fails with an authentication error.
- **Observed Evidence (Facts)**:
  - Authentication check: Authentication was rejected by MongoDB on `host:port`. (Secret values were not stored or logged).
- **Possible Causes (Hypotheses)**:
  - Username or password specified in connection URL is incorrect.
  - The user was created on a different authentication database (`authSource`).
  - The user lacks permissions or roles for the requested database.
- **Remediation**:
  - Command: Update database credentials in your environment variable to match an authorized MongoDB user.
  - Risks: Credential update in local environment only.
  - Undo: Revert environment variable.
- **Verification**: Re-run scan with `--db-url-env`.
- **References**: [MongoDB User Security](https://www.mongodb.com/docs/manual/core/security-users/)

---

### 13. `MYSQL_CONNECTION_REFUSED`

- **Title**: MySQL connection refused on target endpoint
- **Category**: `database`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `MySQL`
- **Description**: Triggered when a TCP connection to the configured MySQL host and port is actively refused (ECONNREFUSED).
- **Preconditions**: Staged diagnostic confirms TCP connection to MySQL endpoint was refused.
- **Observed Evidence (Facts)**:
  - Network probe: Connection refused (ECONNREFUSED) on `host:port`.
- **Possible Causes (Hypotheses)**:
  - MySQL service (`mysqld`) is not currently running.
  - The configured host or port is incorrect.
  - MySQL is running inside a Docker container that is stopped or has not mapped the port.
  - Local firewall or network configuration is blocking connection.
- **Remediation**:
  - Command: Start MySQL service locally, or run `docker compose up -d` if using containers.
  - Risks: Starts database service.
  - Undo: Stop started database service.
- **Verification**: Re-run scan to confirm TCP connection succeeds.
- **References**: [MySQL Cannot Connect Documentation](https://dev.mysql.com/doc/refman/8.0/en/can-not-connect-to-server.html)

---

### 14. `MYSQL_AUTH_FAILED`

- **Title**: MySQL authentication failed
- **Category**: `database`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `MySQL`
- **Description**: Triggered when a network connection to MySQL succeeds, but user authentication is rejected (Access denied).
- **Preconditions**: Opt-in authenticated check fails with access denied error.
- **Observed Evidence (Facts)**:
  - Authentication check: Access denied by MySQL on `host:port`. (Secret values were not stored or logged).
- **Possible Causes (Hypotheses)**:
  - Username or password specified in connection URL is incorrect.
  - The user account is restricted to a different client host.
  - The user account does not have GRANT privileges on the requested database.
- **Remediation**:
  - Command: Update database credentials in your environment variable to match an authorized MySQL user.
  - Risks: Credential update in local environment only.
  - Undo: Revert environment variable.
- **Verification**: Re-run scan with `--db-url-env`.
- **References**: [MySQL Access Denied Troubleshooting](https://dev.mysql.com/doc/refman/8.0/en/access-denied.html)

---

### 15. `DB_HOST_NOT_RESOLVED`

- **Title**: Database hostname failed DNS resolution
- **Category**: `database`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `MongoDB`, `MySQL`
- **Description**: Triggered when the database hostname configured in project settings cannot be resolved via DNS lookup.
- **Preconditions**: Stage 1 DNS resolution returns `ENOTFOUND` or other lookup failure.
- **Observed Evidence (Facts)**:
  - DNS lookup: Hostname could not be resolved to an IP address.
- **Possible Causes (Hypotheses)**:
  - The hostname has a typo in project configuration or environment variables.
  - The hostname is a container service name but command was run from host outside container network.
  - Local DNS server or network connectivity is down.
- **Remediation**:
  - Command: Update configuration to specify a valid, resolvable hostname or IP address.
  - Risks: Configuration update.
  - Undo: Revert configuration change.
- **Verification**: Confirm hostname resolves via DNS lookup.
- **References**: [Domain Name System](https://en.wikipedia.org/wiki/Domain_Name_System)

---

### 16. `DB_CONNECTION_TIMEOUT`

- **Title**: Database connection timed out
- **Category**: `database`
- **Severity**: `high`
- **Confidence**: `confirmed`
- **Technologies**: `MongoDB`, `MySQL`
- **Description**: Triggered when a TCP connection to the database endpoint times out before establishing a connection.
- **Preconditions**: Stage 2 TCP socket probe times out.
- **Observed Evidence (Facts)**:
  - Network probe: Connection attempt timed out without receiving a TCP response.
- **Possible Causes (Hypotheses)**:
  - A cloud database firewall or IP whitelist (e.g. MongoDB Atlas Network Access) is blocking client IP.
  - A local or corporate firewall is dropping outbound packets to target port.
  - The database server is offline or experiencing network disruption.
- **Remediation**:
  - Command: Whitelist client IP in database cloud management console or inspect network routing.
  - Risks: Security group rules update.
  - Undo: Revert security group rules.
- **Verification**: Verify that connection establishes before timeout expires.
- **References**: [Connection Timeout](https://en.wikipedia.org/wiki/Connection_timeout)


