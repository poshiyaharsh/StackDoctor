# StackDoctor v0.2.0 Release Notes

**Release Date:** October 29, 2026  
**License:** MIT  
**Package:** `@harshposhiya/stackdoctor@0.2.0` (npm)

---

## Highlights

StackDoctor v0.2.0 is a milestone release delivering major multi-ecosystem expansions driven directly by real developer feedback, doubling the diagnostic rule catalog from 20 to 40 rules while maintaining **100.0% Detection Accuracy** and **0.0% False Positive Rate**.

- **4 New Framework & Language Ecosystems**:
  - **Java & Spring Boot**: Detects Java runtime absence, JDK version mismatches against `pom.xml`/`build.gradle`, unconfigured Spring Boot JPA datasources, and active port conflicts.
  - **PHP & Laravel**: Inspects PHP CLI runtime versions, Composer dependency statuses (`vendor/autoload.php`), and missing Laravel encryption keys (`APP_KEY`) before fatal decryption crashes occur.
  - **.NET, C# & ASP.NET Core**: Inspects `.csproj` target framework monikers (TFMs), un-restored NuGet package references (`obj/project.assets.json`), and `launchSettings.json` application ports.
  - **Broader Database Support**: Comprehensive staged connectivity probing for PostgreSQL, SQLite, and Microsoft SQL Server (MSSQL), distinguishing network failures from authentication rejections and missing databases.
- **Rule Catalog Doubled (20 to 40 Rules)**: Added 20 new production rules across dependencies, runtimes, configurations, and databases.
- **Strict Zero Project Execution Guarantee**: Every new adapter operates purely through static file analysis and staged socket probing. StackDoctor never executes project code, Maven/Gradle tasks, Artisan commands, or .NET builds.
- **Data-Driven Accuracy & Regression Guard**: Benchmarked against 15 synthetic and regression test fixtures with zero false positives.
- **100% Offline & Private**: Zero telemetry, zero analytics SDKs, zero phone-home pings, and strict canary secret redaction.

---

## Feedback-Driven Improvements & Bug Fixes

| Feedback ID | Area | Resolution Summary | Status |
|---|---|---|:---:|
| `FB-002` | Node.js Runtime | Fixed false-positive conflict when `.nvmrc` declares major version and `package.json` declares matching semver range. | Fixed |
| `FB-004` | Package Managers | Added native priority recognition for `pnpm-lock.yaml` in monorepo workspaces. | Fixed |
| `FB-006` / `FB-DRAFT-001` | Java / Spring Boot | Added Java runtime detection, version mismatch checks, Spring Data datasource inspection, and server port checks. | Fixed |
| `FB-007` / `FB-DRAFT-002` | PHP / Laravel | Added PHP CLI checks, Composer package verification, and static Laravel `APP_KEY` detection. | Fixed |
| `FB-008` / `FB-DRAFT-003` | .NET / C# | Added static `.csproj` TargetFramework checks, NuGet restore verification, and ASP.NET Core port conflict detection. | Fixed |
| `FB-009` / `FB-DRAFT-004` | Databases | Added PostgreSQL, SQLite, and Microsoft SQL Server diagnostic rules with granular socket vs. auth error separation. | Fixed |

---

## 40 Production Diagnostic Rules Reference

See the full specification and remediation guide in [docs/diagnostics.md](docs/diagnostics.md).

| Category | Rule ID | Title | Severity |
|---|---|---|:---:|
| **Dependencies** | `NODE_DEPS_NOT_INSTALLED` | Node.js dependencies not installed | High |
| **Dependencies** | `NODE_VERSION_MISMATCH` | Installed Node.js version does not satisfy project requirement | High |
| **Dependencies** | `LOCKFILE_MISSING` | Package lockfile missing | Low |
| **Dependencies** | `PYTHON_VENV_MISSING` | Python virtual environment not found | Medium |
| **Dependencies** | `PYTHON_PACKAGES_MISSING` | Python packages missing from environment | High |
| **Dependencies** | `PYTHON_PACKAGE_VERSION_MISMATCH` | Installed Python package version does not satisfy requirement | Medium |
| **Dependencies** | `JAVA_VERSION_MISMATCH` | Installed Java version does not satisfy project requirement | High |
| **Dependencies** | `JAVA_RUNTIME_MISSING` | Java runtime environment (JRE/JDK) is not installed or not in PATH | High |
| **Dependencies** | `COMPOSER_DEPS_NOT_INSTALLED` | Composer dependencies not installed | High |
| **Dependencies** | `NUGET_PACKAGES_NOT_RESTORED` | NuGet packages not restored | High |
| **Environment** | `ENV_EXAMPLE_PRESENT_NO_ENV` | Environment template exists but .env is missing | High |
| **Environment** | `ENV_VAR_NAMES_MISSING` | Environment variable names missing from .env | High |
| **Environment** | `RUNTIME_DECLARATIONS_CONFLICT` | Conflicting runtime version declarations | Medium |
| **Environment** | `LARAVEL_APP_KEY_MISSING` | Laravel application encryption key missing or empty | High |
| **Network** | `PORT_IN_USE` | Target network port is already in use by another process | High |
| **Network** | `PORT_INVALID` | Configured port number is invalid | High |
| **Network** | `ASPNETCORE_PORT_IN_USE` | ASP.NET Core configured application port is already in use | High |
| **Containers** | `COMPOSE_SERVICE_NOT_FOUND` | Docker Compose service referenced in configuration does not exist | High |
| **Database** | `MONGO_CONNECTION_REFUSED` | MongoDB connection refused | High |
| **Database** | `MONGO_AUTH_FAILED` | MongoDB authentication failed | High |
| **Database** | `MYSQL_CONNECTION_REFUSED` | MySQL connection refused | High |
| **Database** | `MYSQL_AUTH_FAILED` | MySQL authentication failed | High |
| **Database** | `POSTGRES_CONNECTION_REFUSED` | PostgreSQL connection refused | High |
| **Database** | `POSTGRES_AUTH_FAILED` | PostgreSQL authentication failed | High |
| **Database** | `POSTGRES_DATABASE_NOT_FOUND` | PostgreSQL database does not exist | High |
| **Database** | `POSTGRES_SSL_REQUIRED` | PostgreSQL requires SSL/TLS connection | Medium |
| **Database** | `SQLITE_FILE_NOT_FOUND` | SQLite database file or target directory not found | High |
| **Database** | `SQLITE_FILE_CORRUPTED` | SQLite database file is corrupted or not a valid database | High |
| **Database** | `MSSQL_CONNECTION_REFUSED` | Microsoft SQL Server connection refused on target endpoint | High |
| **Database** | `MSSQL_AUTH_FAILED` | Microsoft SQL Server authentication failed | High |
| **Database** | `DB_HOST_NOT_RESOLVED` | Database host could not be resolved | High |
| **Database** | `DB_CONNECTION_TIMEOUT` | Database connection timed out | High |
| **Framework** | `DJANGO_SETTINGS_NOT_FOUND` | Django settings module not found | High |
| **Framework** | `DJANGO_MIGRATIONS_PENDING` | Unapplied Django migrations detected | Medium |
| **Framework** | `SPRING_BOOT_DATASOURCE_MISSING` | Spring Boot datasource configuration missing for Spring Data | High |
| **Framework** | `SPRING_BOOT_PORT_IN_USE` | Spring Boot configured server port is already in use | High |
| **Runtime** | `PHP_VERSION_MISMATCH` | Installed PHP version does not satisfy project requirement | High |
| **Runtime** | `PHP_RUNTIME_MISSING` | PHP CLI runtime is not installed or not in PATH | High |
| **Runtime** | `DOTNET_SDK_MISSING` | .NET SDK is not installed or not available on PATH | High |
| **Runtime** | `DOTNET_TARGET_FRAMEWORK_MISMATCH` | Installed .NET SDK does not support project target framework | High |

---

## Accuracy & Precision Comparison (v0.1.0 vs v0.2.0)

| Metric | v0.1.0 Baseline | v0.2.0 Measured | Change |
|---|---|---|---|
| **Benchmark Fixtures** | 4 fixtures | 15 fixtures | **+275% coverage** |
| **Detection Accuracy (Recall)** | 100.0% | 100.0% | Unchanged (Target: >= 80.0%) |
| **False Positive Rate** | 0.0% | 0.0% | Unchanged (Target: < 10.0%) |
| **Miss Rate** | 0.0% | 0.0% | Unchanged (Target: 0.0%) |
| **Built-In Diagnostic Rules** | 20 rules | 40 rules | **+100% rule count** |

---

## Upgrade Notes & Compatibility

- **Report Schema (`schemaVersion`)**: Remains fully backward-compatible at `1.0.0`. All new findings conform strictly to the published JSON Schema.
- **Zero Breaking CLI Changes**: All command-line arguments, flags (`--ci`, `--fail-on`, `--json`, `--format`), and exit codes behave identically to v0.1.0.
- **Safe Staged Upgrades**: Running `npx @harshposhiya/stackdoctor@0.2.0 scan` in any existing repository runs immediately with no migration or configuration required.
