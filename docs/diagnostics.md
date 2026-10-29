# StackDoctor Diagnostic Rule Catalog

This catalog is **automatically generated** from the canonical rule registry in `packages/rules`.
To update or verify this document, run:
```bash
npm run docs:rules
```

Total Built-in Rules: **28**

---

## Rule Summary Table

| Rule ID | Category | Severity | Confidence | Technologies | Description |
|---|---|---|---|---|---|
| [`COMPOSE_SERVICE_NOT_FOUND`](#compose-service-not-found) | `configuration` | **high** | `confirmed` | Docker, Docker Compose | An application configuration or environment URL references a service name that does not exist in the project's docker-compose.yml services. |
| [`DB_CONNECTION_TIMEOUT`](#db-connection-timeout) | `database` | **high** | `confirmed` | MongoDB, MySQL | TCP connection to the database endpoint timed out before establishing a socket connection. |
| [`DB_HOST_NOT_RESOLVED`](#db-host-not-resolved) | `database` | **high** | `confirmed` | MongoDB, MySQL | The database hostname configured in project settings could not be resolved to an IP address (ENOTFOUND). |
| [`DJANGO_MIGRATIONS_PENDING`](#django-migrations-pending) | `database` | **medium** | `confirmed` | Django | Django project has unapplied schema changes that have not yet been applied to the database. |
| [`DJANGO_SETTINGS_NOT_FOUND`](#django-settings-not-found) | `configuration` | **high** | `confirmed` | Django | The DJANGO_SETTINGS_MODULE specified in manage.py does not correspond to an existing Python settings file. |
| [`ENV_EXAMPLE_PRESENT_NO_ENV`](#env-example-present-no-env) | `configuration` | **medium** | `confirmed` | * | .env.example exists declaring required environment variables, but no .env file exists. |
| [`ENV_VAR_NAMES_MISSING`](#env-var-names-missing) | `configuration` | **high** | `confirmed` | * | .env file exists, but one or more variable names documented in .env.example are missing. |
| [`JAVA_RUNTIME_MISSING`](#java-runtime-missing) | `runtime` | **high** | `confirmed` | Java | A Java project build file was detected, but no Java executable (java) was found in the environment. |
| [`JAVA_VERSION_MISMATCH`](#java-version-mismatch) | `runtime` | **high** | `confirmed` | Java | The active Java runtime does not satisfy the Java version required in the project build configuration. |
| [`LOCKFILE_MISSING`](#lockfile-missing) | `dependencies` | **low** | `confirmed` | Node.js | package.json is present in the project root, but no lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock) was found. |
| [`MONGO_AUTH_FAILED`](#mongo-auth-failed) | `database` | **high** | `confirmed` | MongoDB | Network connection to MongoDB succeeded, but user authentication failed (invalid username, password, or authSource). |
| [`MONGO_CONNECTION_REFUSED`](#mongo-connection-refused) | `database` | **high** | `confirmed` | MongoDB | TCP connection to the configured MongoDB endpoint was actively refused (ECONNREFUSED). |
| [`MYSQL_AUTH_FAILED`](#mysql-auth-failed) | `database` | **high** | `confirmed` | MySQL | Network connection to MySQL succeeded, but user authentication was rejected (Access denied for user). |
| [`MYSQL_CONNECTION_REFUSED`](#mysql-connection-refused) | `database` | **high** | `confirmed` | MySQL | TCP connection to the configured MySQL endpoint was actively refused (ECONNREFUSED). |
| [`NODE_DEPS_NOT_INSTALLED`](#node-deps-not-installed) | `dependencies` | **high** | `confirmed` | Node.js | package.json exists in the project root, but the node_modules folder is missing. |
| [`NODE_VERSION_MISMATCH`](#node-version-mismatch) | `runtime` | **high** | `confirmed` | Node.js | The active Node.js runtime version does not satisfy the version range explicitly declared by the project. |
| [`PORT_IN_USE`](#port-in-use) | `network` | **high** | `confirmed` | * | A network port required by the application is already bound by another process or listener on this machine. |
| [`PORT_INVALID`](#port-invalid) | `configuration` | **high** | `confirmed` | * | A network port specified in project configuration or scripts is not a valid TCP port number (must be an integer between 1 and 65535). |
| [`POSTGRES_AUTH_FAILED`](#postgres-auth-failed) | `database` | **high** | `confirmed` | PostgreSQL | Network connection to PostgreSQL succeeded, but user authentication was rejected (password authentication failed or role not authorized). |
| [`POSTGRES_CONNECTION_REFUSED`](#postgres-connection-refused) | `database` | **high** | `confirmed` | PostgreSQL | TCP connection to the configured PostgreSQL endpoint was actively refused (ECONNREFUSED). |
| [`POSTGRES_DATABASE_NOT_FOUND`](#postgres-database-not-found) | `database` | **high** | `confirmed` | PostgreSQL | Connected to PostgreSQL and authenticated successfully, but the specified database was not found (error code 3D000: invalid_catalog_name). |
| [`POSTGRES_SSL_REQUIRED`](#postgres-ssl-required) | `database` | **medium** | `confirmed` | PostgreSQL | PostgreSQL server rejected unencrypted connection because SSL/TLS encryption is enforced by server configuration. |
| [`PYTHON_PACKAGE_VERSION_MISMATCH`](#python-package-version-mismatch) | `dependencies` | **high** | `confirmed` | Python, Django | An installed Python package version does not satisfy the parseable version constraint declared in requirements.txt or pyproject.toml. |
| [`PYTHON_PACKAGES_MISSING`](#python-packages-missing) | `dependencies` | **high** | `confirmed` | Python, Django | One or more packages declared in requirements.txt or pyproject.toml are not installed in the active Python environment. |
| [`PYTHON_VENV_MISSING`](#python-venv-missing) | `environment` | **medium** | `confirmed` | Python, Django | Python project detected, but no virtual environment is active in the environment and no local venv directory exists. |
| [`RUNTIME_DECLARATIONS_CONFLICT`](#runtime-declarations-conflict) | `configuration` | **medium** | `confirmed` | Node.js | The project contains mutually conflicting runtime version specifications across configuration files (e.g. .nvmrc conflicts with package.json engines.node). |
| [`SPRING_BOOT_DATASOURCE_MISSING`](#spring-boot-datasource-missing) | `configuration` | **high** | `confirmed` | Spring Boot | Spring Data JPA or JDBC dependencies are present, but no database connection URL (spring.datasource.url) or embedded database is configured. |
| [`SPRING_BOOT_PORT_IN_USE`](#spring-boot-port-in-use) | `network` | **high** | `confirmed` | Spring Boot | The configured Spring Boot server port is actively occupied by another process, which will cause startup failure with PortInUseException. |

---

## Detailed Rule Reference

<a id="compose-service-not-found"></a>
### 1. `COMPOSE_SERVICE_NOT_FOUND`

**Title**: Application references Docker Compose service not defined in compose file

- **Category**: `configuration`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Docker`, `Docker Compose`
- **Evidence Types**: `file_presence`

#### Description
An application configuration or environment URL references a service name that does not exist in the project's docker-compose.yml services.

#### Diagnostic Checks
- Parse docker-compose.yml services definition
- Inspect environment hostnames and URLs referenced in project configuration

#### Remediation Guidance
- **Problem**: Application cannot resolve or connect to the referenced Docker container hostname.
  - **Relevance**: DNS lookup for the missing container hostname fails, leading to ECONNREFUSED or ENOTFOUND errors.
  - **Action**: `Define the missing service in docker-compose.yml or update configuration to reference an existing service.`
  - **Expected Result**: All referenced hostnames correspond to defined Compose services.
  - **Risks**: Update compose configuration; requires restarting compose containers.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that all referenced container hostnames are defined under services in docker-compose.yml.

#### Documentation References
- [https://docs.docker.com/compose/compose-file/](https://docs.docker.com/compose/compose-file/)

---

<a id="db-connection-timeout"></a>
### 2. `DB_CONNECTION_TIMEOUT`

**Title**: Database connection timed out

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `MongoDB`, `MySQL`
- **Evidence Types**: `network_probe`

#### Description
TCP connection to the database endpoint timed out before establishing a socket connection.

#### Diagnostic Checks
- Check network connectivity and routing to target host
- Check cloud database IP access list / security group rules (e.g. MongoDB Atlas, AWS RDS)
- Verify firewall rules permitting outbound connection on target port

#### Remediation Guidance
- **Problem**: Network connection to database host timed out.
  - **Relevance**: Application hangs or crashes after driver connection timeout expires.
  - **Action**: `Add your current IP address to the cloud database IP access list, or check firewall routing.`
  - **Expected Result**: TCP connection establishes within the timeout window.
  - **Risks**: Network and security group configuration.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that TCP connection completes before timeout.

#### Documentation References
- [https://dev.mysql.com/doc/refman/8.0/en/error-lost-connection.html](https://dev.mysql.com/doc/refman/8.0/en/error-lost-connection.html)

---

<a id="db-host-not-resolved"></a>
### 3. `DB_HOST_NOT_RESOLVED`

**Title**: Database hostname failed DNS resolution

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `MongoDB`, `MySQL`
- **Evidence Types**: `dns_resolution`

#### Description
The database hostname configured in project settings could not be resolved to an IP address (ENOTFOUND).

#### Diagnostic Checks
- Verify spelling of hostname in database URL or environment variable
- Check system DNS settings and internet connection
- If hostname is a Docker service name, verify containers are running on the same Docker network

#### Remediation Guidance
- **Problem**: DNS resolution failed for database host.
  - **Relevance**: Client cannot establish network sockets without a resolvable IP address.
  - **Action**: `Correct the database hostname in your configuration or verify local DNS resolution.`
  - **Expected Result**: Hostname resolves to a valid IP address.
  - **Risks**: Configuration update.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify hostname resolves via DNS lookup.

#### Documentation References
- [https://nodejs.org/api/dns.html#error-codes](https://nodejs.org/api/dns.html#error-codes)

---

<a id="django-migrations-pending"></a>
### 4. `DJANGO_MIGRATIONS_PENDING`

**Title**: Unapplied database schema changes detected

- **Category**: `database`
- **Default Severity**: `medium`
- **Confidence**: `confirmed`
- **Target Technologies**: `Django`
- **Evidence Types**: `command_output`

#### Description
Django project has unapplied schema changes that have not yet been applied to the database.

#### Diagnostic Checks
- Run python manage.py showmigrations --plan (requires --allow-project-code)
- Inspect database schema state

#### Remediation Guidance
- **Problem**: Database schema is out of sync with application model definitions.
  - **Relevance**: Missing database columns or tables cause database query exceptions at runtime.
  - **Action**: `Apply pending schema changes using Django management tooling.`
  - **Expected Result**: Database schema is synchronized with application model definitions.
  - **Risks**: Modifies database schema; create a database backup prior to applying changes.
  - **Verification**: `stackdoctor scan --allow-project-code`

#### Verification Principle
Confirm showmigrations --plan reports no unapplied changes.

#### Documentation References
- [https://docs.djangoproject.com/en/stable/topics/migrations/](https://docs.djangoproject.com/en/stable/topics/migrations/)

---

<a id="django-settings-not-found"></a>
### 5. `DJANGO_SETTINGS_NOT_FOUND`

**Title**: Django settings module file not found

- **Category**: `configuration`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Django`
- **Evidence Types**: `file_presence`

#### Description
The DJANGO_SETTINGS_MODULE specified in manage.py does not correspond to an existing Python settings file.

#### Diagnostic Checks
- Read DJANGO_SETTINGS_MODULE declaration in manage.py
- Verify target settings.py file exists at expected path

#### Remediation Guidance
- **Problem**: Django startup fails with ModuleNotFoundError when attempting to import settings.
  - **Relevance**: Django cannot boot without a valid settings module.
  - **Action**: `Create the missing settings file or correct the DJANGO_SETTINGS_MODULE path in manage.py.`
  - **Expected Result**: The settings file exists and can be imported by Django.
  - **Risks**: File creation or configuration change.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify settings file exists at specified path.

#### Documentation References
- [https://docs.djangoproject.com/en/stable/topics/settings/](https://docs.djangoproject.com/en/stable/topics/settings/)

---

<a id="env-example-present-no-env"></a>
### 6. `ENV_EXAMPLE_PRESENT_NO_ENV`

**Title**: Environment template present but .env file is missing

- **Category**: `configuration`
- **Default Severity**: `medium`
- **Confidence**: `confirmed`
- **Target Technologies**: `*`
- **Evidence Types**: `file_presence`

#### Description
.env.example exists declaring required environment variables, but no .env file exists.

#### Diagnostic Checks
- Check for presence of .env.example or template file
- Confirm whether .env file is missing from project root

#### Remediation Guidance
- **Problem**: Application environment configuration file .env is missing.
  - **Relevance**: Application runtime will likely fail when attempting to read declared environment variables.
  - **Action**: `cp .env.example .env`
  - **Expected Result**: .env file will be created based on template variable declarations.
  - **Risks**: Requires manual configuration of appropriate values for this local environment.
  - **Verification**: `test -f .env`

#### Verification Principle
Confirm that .env file exists in project root.

#### Documentation References
- [https://12factor.net/config](https://12factor.net/config)

---

<a id="env-var-names-missing"></a>
### 7. `ENV_VAR_NAMES_MISSING`

**Title**: Required environment variable names missing from .env

- **Category**: `configuration`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `*`
- **Evidence Types**: `file_presence`

#### Description
.env file exists, but one or more variable names documented in .env.example are missing.

#### Diagnostic Checks
- Read variable names declared in .env.example
- Read variable names present in .env (names only, discarding all values)

#### Remediation Guidance
- **Problem**: Missing environment variables can cause runtime ReferenceErrors or unhandled undefined values.
  - **Relevance**: Applications rely on defined environment variables for database URLs, ports, and configuration keys.
  - **Action**: `Add missing variable names to .env with valid local values.`
  - **Expected Result**: .env contains all configuration keys defined in .env.example.
  - **Risks**: Modifies .env file with new keys; harmless if values are appropriate.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Check .env to ensure all expected variable names are present.

#### Documentation References
- [https://12factor.net/config](https://12factor.net/config)

---

<a id="java-runtime-missing"></a>
### 8. `JAVA_RUNTIME_MISSING`

**Title**: Java runtime is not installed or not available on PATH

- **Category**: `runtime`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Java`
- **Evidence Types**: `file_presence`

#### Description
A Java project build file was detected, but no Java executable (java) was found in the environment.

#### Diagnostic Checks
- Verify whether a JDK or JRE is installed on your system
- Ensure the `bin` directory of your Java installation is included in PATH
- Verify `JAVA_HOME` environment variable points to a valid JDK directory

#### Remediation Guidance
- **Problem**: Java executable is not found in PATH.
  - **Relevance**: Cannot compile or execute Java applications without a Java Development Kit.
  - **Action**: `Install a modern JDK via SDKMAN (`sdk install java`), Homebrew (`brew install openjdk`), or download from Adoptium / OpenJDK.`
  - **Expected Result**: `java -version` returns the installed JDK version.
  - **Risks**: Installs JDK software package; does not affect application source files.
  - **Verification**: `java -version && stackdoctor scan`

#### Verification Principle
Verify `java -version` executes successfully.

#### Documentation References
- [https://openjdk.org/install/](https://openjdk.org/install/)

---

<a id="java-version-mismatch"></a>
### 9. `JAVA_VERSION_MISMATCH`

**Title**: Installed Java version does not satisfy project requirement

- **Category**: `runtime`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Java`
- **Evidence Types**: `command_output`

#### Description
The active Java runtime does not satisfy the Java version required in the project build configuration.

#### Diagnostic Checks
- Check your active Java version with `java -version`
- Verify the required Java version declared in pom.xml (<java.version>) or build.gradle (sourceCompatibility)
- If using a version manager, activate the matching JDK (e.g., `sdk use java 17...` or set JAVA_HOME)

#### Remediation Guidance
- **Problem**: Installed Java version is incompatible with project requirements.
  - **Relevance**: Java compilers and frameworks like Spring Boot refuse to build or run when targeting an incompatible JVM.
  - **Action**: `Switch to a matching Java runtime via SDKMAN (`sdk use java <version>`) or update JAVA_HOME to point to an installed JDK of the required version.`
  - **Expected Result**: Active Java version matches or satisfies the project build requirement.
  - **Risks**: Environment variable change; does not modify source code.
  - **Verification**: `java -version && stackdoctor scan`

#### Verification Principle
Verify active Java version satisfies project build configuration.

#### Documentation References
- [https://openjdk.org/projects/jdk/](https://openjdk.org/projects/jdk/)

---

<a id="lockfile-missing"></a>
### 10. `LOCKFILE_MISSING`

**Title**: Package lockfile missing

- **Category**: `dependencies`
- **Default Severity**: `low`
- **Confidence**: `confirmed`
- **Target Technologies**: `Node.js`
- **Evidence Types**: `file_presence`

#### Description
package.json is present in the project root, but no lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock) was found.

#### Diagnostic Checks
- Check for presence of package.json
- Scan project root for package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lockb

#### Remediation Guidance
- **Problem**: No lockfile is present to pin dependency versions.
  - **Relevance**: Builds and installations can become non-deterministic when dependency versions drift.
  - **Action**: `npm install --package-lock-only`
  - **Expected Result**: Generates package-lock.json without modifying code.
  - **Risks**: Pins resolved dependency versions; recommended for version control.
  - **Verification**: `test -f package-lock.json`

#### Verification Principle
Confirm that a lockfile exists in the project root.

#### Documentation References
- [https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json)

---

<a id="mongo-auth-failed"></a>
### 11. `MONGO_AUTH_FAILED`

**Title**: MongoDB authentication failed

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `MongoDB`
- **Evidence Types**: `command_output`

#### Description
Network connection to MongoDB succeeded, but user authentication failed (invalid username, password, or authSource).

#### Diagnostic Checks
- Verify the database username and password in your environment variable
- Verify the authentication database (authSource, default is 'admin')
- Verify user permissions on target database

#### Remediation Guidance
- **Problem**: MongoDB rejected the provided credentials.
  - **Relevance**: Application cannot access collections or execute queries without successful authentication.
  - **Action**: `Verify and update the database username, password, and authSource in your environment variable.`
  - **Expected Result**: MongoDB accepts authentication and authorizes access.
  - **Risks**: Update credentials in local environment variable; never commit secrets to git.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify MongoDB authentication succeeds.

#### Documentation References
- [https://www.mongodb.com/docs/manual/core/security-users/](https://www.mongodb.com/docs/manual/core/security-users/)

---

<a id="mongo-connection-refused"></a>
### 12. `MONGO_CONNECTION_REFUSED`

**Title**: MongoDB connection refused on target endpoint

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `MongoDB`
- **Evidence Types**: `network_probe`

#### Description
TCP connection to the configured MongoDB endpoint was actively refused (ECONNREFUSED).

#### Diagnostic Checks
- Check if MongoDB server or daemon is currently running
- Verify target hostname and port in database configuration
- If using Docker, verify MongoDB container status with `docker compose ps`

#### Remediation Guidance
- **Problem**: MongoDB service is not listening on the configured address and port.
  - **Relevance**: Application crashes on startup when unable to establish connection to MongoDB.
  - **Action**: `Start MongoDB daemon (`mongod`) or start the database container (`docker compose up -d <service>`).`
  - **Expected Result**: MongoDB starts listening on target port and accepts TCP connections.
  - **Risks**: Starts database process or container; harmless to project code.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that TCP connection to MongoDB endpoint succeeds.

#### Documentation References
- [https://www.mongodb.com/docs/manual/administration/monitoring/](https://www.mongodb.com/docs/manual/administration/monitoring/)

---

<a id="mysql-auth-failed"></a>
### 13. `MYSQL_AUTH_FAILED`

**Title**: MySQL authentication failed

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `MySQL`
- **Evidence Types**: `command_output`

#### Description
Network connection to MySQL succeeded, but user authentication was rejected (Access denied for user).

#### Diagnostic Checks
- Verify the database username and password in your environment variable
- Verify host access privileges (e.g. 'user'@'localhost' vs 'user'@'%')
- Verify default database permissions for the user

#### Remediation Guidance
- **Problem**: MySQL server rejected the provided credentials.
  - **Relevance**: Application cannot execute queries or initialize schemas without successful authentication.
  - **Action**: `Update the database credentials in your environment variable with a valid username and password.`
  - **Expected Result**: MySQL accepts authentication and authorizes access.
  - **Risks**: Update credentials in local environment variable; never commit secrets to git.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify MySQL authentication succeeds.

#### Documentation References
- [https://dev.mysql.com/doc/refman/8.0/en/access-denied.html](https://dev.mysql.com/doc/refman/8.0/en/access-denied.html)

---

<a id="mysql-connection-refused"></a>
### 14. `MYSQL_CONNECTION_REFUSED`

**Title**: MySQL connection refused on target endpoint

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `MySQL`
- **Evidence Types**: `network_probe`

#### Description
TCP connection to the configured MySQL endpoint was actively refused (ECONNREFUSED).

#### Diagnostic Checks
- Check if MySQL service or daemon is currently running
- Verify target hostname and port in database configuration
- If using Docker, check container status with `docker compose ps`

#### Remediation Guidance
- **Problem**: MySQL service is not listening on the configured address and port.
  - **Relevance**: Application crashes on startup when unable to establish connection to MySQL.
  - **Action**: `Start MySQL service or start the database container (`docker compose up -d <service>`).`
  - **Expected Result**: MySQL starts listening on target port and accepts TCP connections.
  - **Risks**: Starts database process or container; harmless to project code.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that TCP connection to MySQL endpoint succeeds.

#### Documentation References
- [https://dev.mysql.com/doc/refman/8.0/en/can-not-connect-to-server.html](https://dev.mysql.com/doc/refman/8.0/en/can-not-connect-to-server.html)

---

<a id="node-deps-not-installed"></a>
### 15. `NODE_DEPS_NOT_INSTALLED`

**Title**: Node.js dependencies not installed

- **Category**: `dependencies`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Node.js`
- **Evidence Types**: `file_presence`

#### Description
package.json exists in the project root, but the node_modules folder is missing.

#### Diagnostic Checks
- Verify presence of package.json and absence of node_modules
- Identify available lockfile to select the declared package manager

#### Remediation Guidance
- **Problem**: Node.js application dependencies are not present locally.
  - **Relevance**: Application runtime and build scripts fail immediately without installed packages.
  - **Action**: `npm install`
  - **Expected Result**: Dependencies will be downloaded and linked into node_modules.
  - **Risks**: Network download and build scripts; suggest only with user confirmation.
  - **Verification**: `test -d node_modules`

#### Verification Principle
Verify that node_modules directory exists after installation.

#### Documentation References
- [https://docs.npmjs.com/cli/v10/commands/npm-install](https://docs.npmjs.com/cli/v10/commands/npm-install)

---

<a id="node-version-mismatch"></a>
### 16. `NODE_VERSION_MISMATCH`

**Title**: Installed Node.js version does not satisfy project requirement

- **Category**: `runtime`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Node.js`
- **Evidence Types**: `version_check`

#### Description
The active Node.js runtime version does not satisfy the version range explicitly declared by the project.

#### Diagnostic Checks
- Read declared Node version requirement from package.json engines or .nvmrc
- Inspect installed Node.js version from node -v

#### Remediation Guidance
- **Problem**: Active Node.js runtime version does not satisfy the declared requirement.
  - **Relevance**: Incompatible runtime versions can lead to unsupported syntax, API mismatches, and native dependency build errors.
  - **Action**: `nvm use`
  - **Expected Result**: Active Node.js environment switches to a compatible version.
  - **Risks**: Changes active node version in this terminal session; harmless to code.
  - **Verification**: `node -v`

#### Verification Principle
Run `node -v` to confirm active version satisfies the declared range.

#### Documentation References
- [https://nodejs.org/](https://nodejs.org/)

---

<a id="port-in-use"></a>
### 17. `PORT_IN_USE`

**Title**: Required network port is already in use

- **Category**: `network`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `*`
- **Evidence Types**: `network_probe`

#### Description
A network port required by the application is already bound by another process or listener on this machine.

#### Diagnostic Checks
- Run TCP connection probe against required host and port
- Identify listening process PID using OS netstat/ss/lsof tools

#### Remediation Guidance
- **Problem**: Port collision prevents application server from binding its listening socket.
  - **Relevance**: Starting the service on a busy port results in EADDRINUSE crash.
  - **Action**: `Stop the conflicting application or configure an alternate PORT in your environment.`
  - **Expected Result**: The port becomes free or the application starts on an alternate available port.
  - **Risks**: Stopping another process may terminate background services.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that the port is free using TCP probe or netstat.

#### Documentation References
- [https://nodejs.org/api/errors.html#eaddrinuse](https://nodejs.org/api/errors.html#eaddrinuse)

---

<a id="port-invalid"></a>
### 18. `PORT_INVALID`

**Title**: Declared network port is invalid or out of range

- **Category**: `configuration`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `*`
- **Evidence Types**: `config_value`

#### Description
A network port specified in project configuration or scripts is not a valid TCP port number (must be an integer between 1 and 65535).

#### Diagnostic Checks
- Scan package.json scripts for port arguments
- Scan vite.config and .env.example for PORT values

#### Remediation Guidance
- **Problem**: Invalid port number configuration prevents the server from binding or causes startup crashes.
  - **Relevance**: Operating systems reject socket binding for ports outside 1-65535.
  - **Action**: `Update the configuration to specify a valid TCP port number between 1 and 65535 (e.g. 3000, 8080).`
  - **Expected Result**: Port value is an integer within the 1-65535 range.
  - **Risks**: Modifies configuration; verify the new port does not conflict with existing services.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that all declared port numbers are valid integers in the 1-65535 range.

#### Documentation References
- [https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback](https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback)

---

<a id="postgres-auth-failed"></a>
### 19. `POSTGRES_AUTH_FAILED`

**Title**: PostgreSQL authentication failed

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `PostgreSQL`
- **Evidence Types**: `command_output`

#### Description
Network connection to PostgreSQL succeeded, but user authentication was rejected (password authentication failed or role not authorized).

#### Diagnostic Checks
- Verify the database username and password in your environment variable or connection URL
- Verify pg_hba.conf client authentication records for the host and user
- Verify that the user role exists and has LOGIN privileges

#### Remediation Guidance
- **Problem**: PostgreSQL rejected the provided user credentials.
  - **Relevance**: Application cannot execute queries or initialize schemas without successful authentication.
  - **Action**: `Update the database credentials in your environment variable with a valid username and password.`
  - **Expected Result**: PostgreSQL accepts authentication and authorizes access.
  - **Risks**: Update credentials in local environment variable; never commit secrets to git.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify PostgreSQL authentication succeeds.

#### Documentation References
- [https://www.postgresql.org/docs/current/auth-pg-hba-conf.html](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)

---

<a id="postgres-connection-refused"></a>
### 20. `POSTGRES_CONNECTION_REFUSED`

**Title**: PostgreSQL connection refused on target endpoint

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `PostgreSQL`
- **Evidence Types**: `network_probe`

#### Description
TCP connection to the configured PostgreSQL endpoint was actively refused (ECONNREFUSED).

#### Diagnostic Checks
- Check if PostgreSQL service or daemon is currently running
- Verify target hostname and port in database configuration
- If using Docker, verify PostgreSQL container status with `docker compose ps`

#### Remediation Guidance
- **Problem**: PostgreSQL service is not listening on the configured address and port.
  - **Relevance**: Application crashes on startup when unable to establish connection to PostgreSQL.
  - **Action**: `Start PostgreSQL service locally or start the database container (`docker compose up -d <service>`).`
  - **Expected Result**: PostgreSQL starts listening on target port and accepts TCP connections.
  - **Risks**: Starts database process or container; harmless to project code.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that TCP connection to PostgreSQL endpoint succeeds.

#### Documentation References
- [https://www.postgresql.org/docs/current/server-start.html](https://www.postgresql.org/docs/current/server-start.html)

---

<a id="postgres-database-not-found"></a>
### 21. `POSTGRES_DATABASE_NOT_FOUND`

**Title**: PostgreSQL database does not exist

- **Category**: `database`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `PostgreSQL`
- **Evidence Types**: `command_output`

#### Description
Connected to PostgreSQL and authenticated successfully, but the specified database was not found (error code 3D000: invalid_catalog_name).

#### Diagnostic Checks
- Verify the database name in your connection URL or environment variables
- Check available databases on the PostgreSQL server using `\l` or `SELECT datname FROM pg_database;`
- Ensure database migration or provisioning scripts have been executed

#### Remediation Guidance
- **Problem**: Target PostgreSQL database does not exist on the server.
  - **Relevance**: Application cannot connect or execute schema migrations without the target database.
  - **Action**: `Create the missing database using `createdb <database_name>` or `CREATE DATABASE <database_name>;`.`
  - **Expected Result**: Target database is created and ready for connection.
  - **Risks**: Database creation does not affect existing databases.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that PostgreSQL target database exists and accepts connections.

#### Documentation References
- [https://www.postgresql.org/docs/current/manage-ag-createdb.html](https://www.postgresql.org/docs/current/manage-ag-createdb.html)

---

<a id="postgres-ssl-required"></a>
### 22. `POSTGRES_SSL_REQUIRED`

**Title**: PostgreSQL requires SSL/TLS connection

- **Category**: `database`
- **Default Severity**: `medium`
- **Confidence**: `confirmed`
- **Target Technologies**: `PostgreSQL`
- **Evidence Types**: `command_output`

#### Description
PostgreSQL server rejected unencrypted connection because SSL/TLS encryption is enforced by server configuration.

#### Diagnostic Checks
- Verify whether the PostgreSQL server requires SSL/TLS (e.g. hostssl in pg_hba.conf or cloud database requirement)
- Check if your connection string or client configuration has sslmode specified (e.g., sslmode=require)

#### Remediation Guidance
- **Problem**: PostgreSQL connection rejected due to missing SSL/TLS encryption.
  - **Relevance**: Application cannot communicate with the database when the server requires encrypted connections.
  - **Action**: `Enable SSL in your PostgreSQL connection string by appending `?sslmode=require` or configure SSL options in your database client.`
  - **Expected Result**: PostgreSQL establishes an encrypted TLS connection and accepts commands.
  - **Risks**: Requires valid SSL/TLS certificates or appropriate sslmode setting.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that encrypted SSL/TLS connection to PostgreSQL succeeds.

#### Documentation References
- [https://www.postgresql.org/docs/current/ssl-tcp.html](https://www.postgresql.org/docs/current/ssl-tcp.html)

---

<a id="python-package-version-mismatch"></a>
### 23. `PYTHON_PACKAGE_VERSION_MISMATCH`

**Title**: Installed Python package version does not satisfy requirement

- **Category**: `dependencies`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Python`, `Django`
- **Evidence Types**: `version_check`

#### Description
An installed Python package version does not satisfy the parseable version constraint declared in requirements.txt or pyproject.toml.

#### Diagnostic Checks
- Check declared package version specifiers in requirements.txt
- Inspect installed versions from pip list

#### Remediation Guidance
- **Problem**: Installed package version is incompatible with project code expectations.
  - **Relevance**: Version mismatches lead to API incompatibilities or missing functions.
  - **Action**: `pip install --upgrade -r requirements.txt`
  - **Expected Result**: Package versions in the virtual environment satisfy declared constraints.
  - **Risks**: Upgrades or downgrades packages in active virtual environment.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that installed package versions satisfy declared requirements.

#### Documentation References
- [https://peps.python.org/pep-0440/](https://peps.python.org/pep-0440/)

---

<a id="python-packages-missing"></a>
### 24. `PYTHON_PACKAGES_MISSING`

**Title**: Declared Python dependencies are not installed

- **Category**: `dependencies`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Python`, `Django`
- **Evidence Types**: `command_output`

#### Description
One or more packages declared in requirements.txt or pyproject.toml are not installed in the active Python environment.

#### Diagnostic Checks
- Scan requirements.txt and pyproject.toml for declared packages
- Inspect installed packages via python -m pip list

#### Remediation Guidance
- **Problem**: Missing Python dependencies will cause ModuleNotFoundError or ImportError on startup.
  - **Relevance**: Application runtime depends on third-party libraries declared in dependency manifests.
  - **Action**: `pip install -r requirements.txt`
  - **Expected Result**: All declared packages are installed in the active virtual environment.
  - **Risks**: Installs packages into current Python environment; ensure a virtualenv is active.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify all declared packages are present in pip list.

#### Documentation References
- [https://pip.pypa.io/en/stable/cli/pip_install/](https://pip.pypa.io/en/stable/cli/pip_install/)

---

<a id="python-venv-missing"></a>
### 25. `PYTHON_VENV_MISSING`

**Title**: Python virtual environment missing

- **Category**: `environment`
- **Default Severity**: `medium`
- **Confidence**: `confirmed`
- **Target Technologies**: `Python`, `Django`
- **Evidence Types**: `file_presence`

#### Description
Python project detected, but no virtual environment is active in the environment and no local venv directory exists.

#### Diagnostic Checks
- Check VIRTUAL_ENV environment variable
- Scan project root for .venv or venv directories

#### Remediation Guidance
- **Problem**: No isolated virtual environment is available for project dependencies.
  - **Relevance**: Installing or running Python packages outside a virtual environment can corrupt system Python or cause package version conflicts.
  - **Action**: `python -m venv .venv`
  - **Expected Result**: A clean, isolated virtual environment folder (.venv) is initialized.
  - **Risks**: Creates a local .venv directory; harmless to existing code.
  - **Verification**: `test -d .venv`

#### Verification Principle
Confirm that .venv directory exists or VIRTUAL_ENV is active.

#### Documentation References
- [https://docs.python.org/3/library/venv.html](https://docs.python.org/3/library/venv.html)

---

<a id="runtime-declarations-conflict"></a>
### 26. `RUNTIME_DECLARATIONS_CONFLICT`

**Title**: Conflicting runtime version declarations between project files

- **Category**: `configuration`
- **Default Severity**: `medium`
- **Confidence**: `confirmed`
- **Target Technologies**: `Node.js`
- **Evidence Types**: `version_check`

#### Description
The project contains mutually conflicting runtime version specifications across configuration files (e.g. .nvmrc conflicts with package.json engines.node).

#### Diagnostic Checks
- Read declared engines.node from package.json
- Read version string from .nvmrc and .node-version

#### Remediation Guidance
- **Problem**: Different developers and CI environments may run different and incompatible Node.js versions.
  - **Relevance**: Inconsistent version declarations lead to 'works on my machine' bugs and build failures.
  - **Action**: `Align .nvmrc and package.json engines.node to target the same compatible Node.js version range.`
  - **Expected Result**: .nvmrc and engines.node specify compatible Node versions.
  - **Risks**: Update version declaration files; harmless to code.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify that .nvmrc satisfies the range specified in package.json engines.node.

#### Documentation References
- [https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#engines)

---

<a id="spring-boot-datasource-missing"></a>
### 27. `SPRING_BOOT_DATASOURCE_MISSING`

**Title**: Spring Boot DataSource URL is not configured

- **Category**: `configuration`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Spring Boot`
- **Evidence Types**: `file_content`

#### Description
Spring Data JPA or JDBC dependencies are present, but no database connection URL (spring.datasource.url) or embedded database is configured.

#### Diagnostic Checks
- Check your `src/main/resources/application.properties` or `application.yml` for `spring.datasource.url`
- If using a database, ensure username, password, and driverClassName are also set
- If testing locally without an external database, consider adding an embedded database dependency like H2 (`com.h2database:h2`)

#### Remediation Guidance
- **Problem**: Missing database connection URL for Spring Data auto-configuration.
  - **Relevance**: Spring Boot startup fails with `Failed to configure a DataSource: 'url' attribute is not specified`.
  - **Action**: `Add `spring.datasource.url=jdbc:postgresql://localhost:5432/yourdb` (or corresponding database JDBC URL) to `application.properties`, or add an embedded database dependency (`h2`).`
  - **Expected Result**: Spring Boot successfully initializes DataSource auto-configuration.
  - **Risks**: Configuration change only; harmless to project code.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify `spring.datasource.url` is declared in application properties or environment.

#### Documentation References
- [https://spring.io/guides/gs/accessing-data-jpa](https://spring.io/guides/gs/accessing-data-jpa)

---

<a id="spring-boot-port-in-use"></a>
### 28. `SPRING_BOOT_PORT_IN_USE`

**Title**: Spring Boot server port is already in use by another process

- **Category**: `network`
- **Default Severity**: `high`
- **Confidence**: `confirmed`
- **Target Technologies**: `Spring Boot`
- **Evidence Types**: `network_probe`

#### Description
The configured Spring Boot server port is actively occupied by another process, which will cause startup failure with PortInUseException.

#### Diagnostic Checks
- Check which process is listening on the target port using `netstat -ano` or `lsof -i`
- Verify the `server.port` configured in `src/main/resources/application.properties` or `application.yml`
- Terminate the colliding process or configure an alternative port (e.g., `server.port=8081` or `server.port=0` for random)

#### Remediation Guidance
- **Problem**: Target Spring Boot port is occupied by another process.
  - **Relevance**: Embedded Tomcat, Jetty, or Undertow server fails on startup with `PortInUseException: Web server failed to start. Port was already in use.`
  - **Action**: `Terminate the existing process running on the port or set `server.port=8081` in `application.properties`.`
  - **Expected Result**: Target port is released or application binds to an available alternative port.
  - **Risks**: Port reassignment; harmless to application code.
  - **Verification**: `stackdoctor scan`

#### Verification Principle
Verify target Spring Boot port is free and available.

#### Documentation References
- [https://spring.io/guides/gs/spring-boot](https://spring.io/guides/gs/spring-boot)

---

