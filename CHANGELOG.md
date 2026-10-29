# Changelog

All notable changes to StackDoctor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **.NET, C# & ASP.NET Core Ecosystem Support (FB-DRAFT-003 / Run 7E Extension)**:
  - Added .NET SDK runtime (`dotnet --version`), TargetFramework parsing (`net8.0`, `net9.0`, `netcoreapp3.1`, `netstandard2.0`), NuGet package references, project asset verification (`obj/project.assets.json`), and ASP.NET Core launch port inspection (`Properties/launchSettings.json`, `applicationUrl`) static inspection in `@stackdoctor/adapters`.
  - Added static detection for `.NET`, `C#`, and `ASP.NET Core` projects in `@stackdoctor/core`.
  - Added 4 new production-tested diagnostic rules (catalog expanded to 36 rules):
    - `DOTNET_SDK_MISSING`: Detects when `.csproj` or `.sln` files are present but the `dotnet` CLI is not found on PATH.
    - `DOTNET_TARGET_FRAMEWORK_MISMATCH`: Detects when project `<TargetFramework>` major version is higher than the active installed .NET SDK (e.g. targeting `net8.0` with .NET 7 SDK installed), preventing `NETSDK1045` build failures.
    - `NUGET_PACKAGES_NOT_RESTORED`: Statically flags when `.csproj` declares `<PackageReference>` but `obj/project.assets.json` does not exist, catching `NETSDK1004` errors before build.
    - `ASPNETCORE_PORT_IN_USE`: Statically parses configured `applicationUrl` port from `Properties/launchSettings.json` and verifies socket availability before Kestrel starts.
  - Zero project execution guarantee: All .NET and ASP.NET Core diagnostics operate strictly on static file parsing and runtime environment inspections with zero project compilation or code execution.
  - Added allowlisted doc domains for `microsoft.com`, `dotnet.microsoft.com`, and `nuget.org` in `@stackdoctor/schemas`.
  - Added synthetic fixtures `examples/broken-dotnet-project/` and `examples/healthy-dotnet-project/` with full regression benchmarking in `npm run eval`.
- **PHP, Composer & Laravel Ecosystem Support (FB-DRAFT-002 / Run 7E Extension)**:
  - Added PHP CLI runtime (`php -v`), project version constraints (`composer.json`, `.php-version`), Composer dependency status (`vendor/autoload.php`), and Laravel bootstrap configuration (`artisan`, `APP_KEY` in `.env`) static inspection in `@stackdoctor/adapters`.
  - Added static detection for PHP, Composer, and Laravel projects in `@stackdoctor/core`.
  - Added 4 new production-tested diagnostic rules (catalog expanded to 32 rules):
    - `PHP_VERSION_MISMATCH`: Detects when active PHP CLI runtime does not satisfy the version constraint declared in `composer.json` (e.g. `^8.1`, `>=8.2`) or `.php-version`.
    - `PHP_RUNTIME_MISSING`: Detects when PHP project files or `composer.json` are present but the `php` binary cannot be located or executed from PATH.
    - `COMPOSER_DEPS_NOT_INSTALLED`: Detects when `composer.json` declares packages but `vendor/` or `vendor/autoload.php` is missing.
    - `LARAVEL_APP_KEY_MISSING`: Statically detects when a Laravel application has an empty or unconfigured `APP_KEY` in `.env`, preventing fatal bootstrap decryption 500 crashes.
  - Zero project execution guarantee: All PHP and Laravel diagnostics operate strictly on static file and runtime environment inspections without executing project PHP or Artisan code.
  - Added allowlisted doc domains for `php.net`, `getcomposer.org`, and `laravel.com` in `@stackdoctor/schemas`.
  - Added synthetic fixtures `examples/broken-php-project/` and `examples/healthy-php-project/` with full regression benchmarking in `npm run eval`.
- **Java & Spring Boot Ecosystem Support (FB-006 / FB-DRAFT-001 / Run 7E)**:
  - Added Java runtime (`java -version`), project requirement (`pom.xml`, `build.gradle`, `.java-version`), and Spring Boot configuration (`application.properties`, `application.yml`, `application.yaml`) static inspection in `@stackdoctor/adapters`.
  - Added static detection for Java, Maven, Gradle, and Spring Boot projects in `@stackdoctor/core`.
  - Added 4 new production-tested diagnostic rules (catalog expanded to 28 rules):
    - `JAVA_VERSION_MISMATCH`: Detects when active JDK/JRE version does not satisfy project requirements (e.g. `java.version` in `pom.xml`, `sourceCompatibility` in `build.gradle`).
    - `JAVA_RUNTIME_MISSING`: Detects when Java project files are present but Java runtime is not found in `PATH`.
    - `SPRING_BOOT_DATASOURCE_MISSING`: Statically detects when Spring Boot projects depend on `spring-boot-starter-data-jpa` or `spring-boot-starter-jdbc` without configuring a datasource URL or including an embedded database (H2, HSQLDB, Derby).
    - `SPRING_BOOT_PORT_IN_USE`: Statically parses configured `server.port` from `application.properties`/`application.yml` and verifies socket availability before boot.
  - Zero project execution guarantee: All Java and Spring Boot diagnostics are 100% static file/property evaluations with zero JVM or Maven/Gradle command execution.
  - Added allowlisted doc domains for `spring.io`, `openjdk.org`, and `oracle.com` in `@stackdoctor/schemas`.
  - Added synthetic fixtures `examples/broken-java-project/` and `examples/healthy-java-project/` with full regression benchmarking in `npm run eval`.
- **PostgreSQL Support (FB-009 / Run 7D)**:
  - Staged PostgreSQL connectivity adapter (`checkAuthenticatedConnection`) using `pg` client with strict read-only `SELECT 1` ping.
  - Granular error categorization distinguishing network failure (`connection_refused`), authentication rejection (`auth_failed`), role authorization failure (`authorization_failed`), missing target database (`database_not_found`, error `3D000`), and mandatory SSL/TLS enforcement (`ssl_required`).
  - Added 4 new rules: `POSTGRES_CONNECTION_REFUSED`, `POSTGRES_AUTH_FAILED`, `POSTGRES_DATABASE_NOT_FOUND`, and `POSTGRES_SSL_REQUIRED`.
  - Static PostgreSQL technology detection supporting `.env`, `.env.example`, `DATABASE_URL`, `POSTGRES_HOST`, `PGHOST`, Prisma schemas (`schema.prisma`), and Docker Compose services.
  - Synthetic regression fixture `examples/broken-postgres-config/` integrated into `npm run eval` benchmark harness.
  - Zero false-positive guarantee: connection refusal strictly avoids claiming PostgreSQL is not installed.
- **Evaluation & Regression Framework (Run 7C)**:
  - Automated regression fixtures with per-rule precision, recall, and miss-rate reporting in `scripts/eval.js`.
  - Continuous benchmark regression protection in CI against `eval-results/baseline.json`.

---

## [0.1.0] - 2026-10-27

### Added

#### Phase 1: Foundation & Diagnostic Core
- **Monorepo Architecture**: Setup TypeScript npm workspaces for `@stackdoctor/schemas`, `@stackdoctor/rules`, `@stackdoctor/adapters`, `@stackdoctor/core`, `@stackdoctor/cli`, `@stackdoctor/api`, and `@stackdoctor/web`.
- **Diagnostic Schemas**: Zod-validated schemas for `Report`, `Finding`, `Evidence`, `Recommendation`, `Check`, and `RuleMetadata`.
- **Command Runner Adapter**: Sandboxed command runner with command allowlisting, argument arrays, buffer caps, timeouts, and canary secret redaction.
- **Terminal Formatter**: Clean, ANSI-styled terminal output with light/dark contrast and `--no-color` support.
- **Offline Guarantee**: `stackdoctor scan` guaranteed to operate 100% locally with zero remote calls.

#### Phase 2: Diagnostic Engine & Rules Catalog
- **Engine Execution Engine**: Multi-technology project scanner and diagnostic runner in `@stackdoctor/core`.
- **Network & Database Adapters**: Port prober and read-only database connectivity checkers (MongoDB, MySQL, PostgreSQL, Docker Compose).
- **20 Built-In Diagnostic Rules**:
  - `NODE_DEPS_NOT_INSTALLED`: Detects missing `node_modules` when `package.json` is present.
  - `ENV_EXAMPLE_PRESENT_NO_ENV`: Identifies missing `.env` when `.env.example` exists.
  - `NODE_VERSION_MISMATCH`: Verifies active Node.js engine satisfies project requirement.
  - `LOCKFILE_MISSING`: Detects unpinned dependencies without a package lockfile.
  - `PYTHON_VENV_MISSING`: Flags missing active or local virtual environment.
  - `PORT_IN_USE`: Probes target port and detects port conflict before server startup.
  - `ENV_VAR_NAMES_MISSING`: Compares declared template variable keys with active environment.
  - `PORT_INVALID`: Catches non-numeric or out-of-range port configurations (1-65535).
  - `RUNTIME_DECLARATIONS_CONFLICT`: Detects version discrepancy between `package.json` and `.nvmrc`.
  - `COMPOSE_SERVICE_NOT_FOUND`: Flags application references to missing compose services.
  - `MONGO_CONNECTION_REFUSED`: Identifies connection refusal on target MongoDB host/port.
  - `MONGO_AUTH_FAILED`: Detects authentication rejection on target MongoDB server.
  - `MYSQL_CONNECTION_REFUSED`: Identifies connection refusal on target MySQL host/port.
  - `MYSQL_AUTH_FAILED`: Detects authentication rejection on target MySQL server.
  - `DB_HOST_NOT_RESOLVED`: Flags unresolvable database hostnames via DNS lookup.
  - `DB_CONNECTION_TIMEOUT`: Catches connection timeouts on target database ports.
  - `PYTHON_PACKAGES_MISSING`: Detects missing packages from `requirements.txt` or `pyproject.toml`.
  - `PYTHON_PACKAGE_VERSION_MISMATCH`: Detects installed package version conflicts.
  - `DJANGO_SETTINGS_NOT_FOUND`: Validates Django settings module configuration in `manage.py`.
  - `DJANGO_MIGRATIONS_PENDING`: Safe read-only check detecting unapplied database migrations.
- **Benchmark Evaluation**: `npm run eval` test harness achieving 100% detection accuracy and 0% false positives.

#### Phase 3: Web Platform & Team Collaboration
- **Express API Platform (`apps/api`)**:
  - Secure session-based authentication with bcrypt password hashing and CSRF protection.
  - Cryptographically generated API tokens (`stk_live_...`) with SHA-256 storage.
  - Report upload endpoint `POST /api/v1/diagnostic-runs` with canary secret detection and sanitization.
  - Owner-scoped resource queries with complete anti-enumeration returning 404 for foreign tenant resources.
  - Automatic and manual data retention cleanup.
- **React 19 Web Application (`apps/web`)**:
  - Pure vanilla CSS design system with light and dark themes.
  - Interactive Dashboard, Projects, Report Detail, Finding Detail, and Settings pages.
  - Distinct visual presentation separating observed facts (`OBSERVED EVIDENCE`) from hypotheses (`POSSIBLE CAUSES`).
  - Zero `dangerouslySetInnerHTML` usage with strict Content-Security-Policy.
- **Docker Compose Setup**: Local MongoDB service bound strictly to `127.0.0.1:27017`.

#### Phase 4: Integrations & Contributor Rule Interface
- **GitHub Issue Draft Generation**:
  - `stackdoctor issue [reportFile | path]`: Generates structured, sanitized markdown issue drafts.
  - Automatic masking of usernames (`<user>`), hostnames (`<host>`), home directories (`~`), and IPs (`[REDACTED_IP]`).
  - Strict 60,000 character length cap respecting GitHub issue limits.
  - "Copy Issue Draft" button on Web Report page sharing isomorphic core logic.
- **CI Mode & GitHub Actions**:
  - `stackdoctor scan --ci --fail-on <severity> --format <text|json|markdown>`.
  - Deterministic finding ordering (severity descending, then rule ID ascending).
  - Stable exit code contract: `0` = OK, `1` = findings at/above threshold, `2` = tool error, `3` = invalid usage.
  - Reusable composite action `action.yml` using minimal `contents: read` permissions and SHA-pinned dependencies.
- **Report Comparison (Diff Engine)**:
  - Isomorphic `compareReports(base, head)` finding identity `${ruleId}::${subjectKey}`.
  - Detects `newFindings`, `resolvedFindings`, `unchangedFindings`, and `changedFindings`.
  - CLI `stackdoctor compare <base.json> <head.json>` with `--fail-on-new <severity>`.
  - API endpoint `GET /api/v1/diagnostic-runs/compare?base=<id>&head=<id>` with multi-tenant isolation.
  - Web Compare page with interactive project and run dropdown selectors.
- **Documentation Links & Rule Interface**:
  - HTTPS domain allowlist validation (`ALLOWED_DOC_DOMAINS`) enforced in schema and registry.
  - CLI `stackdoctor explain <ruleId>` with formatted output, JSON export, and Levenshtein typo suggestions.
  - Automated rule generator: `npm run new-rule -- --id <RULE_ID> --tech <tech>`.
  - Automated rule linter `packages/rules/test/rule-lint.test.ts` verifying all rules and failing on bad fixtures.
  - Contributor documentation `docs/contributing.md` and GitHub issue / pull request templates.

#### Phase 5: AI-Assisted Explanations & Safe Remediation
- **Safe-by-Default AI Package (`@stackdoctor/ai`)**:
  - Multi-provider architecture supporting OpenAI, Anthropic, and local OpenAI-compatible endpoints (Ollama, vLLM, LM Studio) alongside local mock provider.
  - 100% optional, disabled by default, making zero unsolicited external network calls.
  - Automated pre-transmission redaction scrubbing keys, tokens, paths, connection strings, emails, and IPs.
  - Strict payload size bounding capped at 16 KB (`maxInputBytes`).
  - Structured output parsing and Zod schema enforcement (`AiExplanationSchema`).
  - Rigorous grounding engine (`validateGrounding`) catching fabricated versions, ungrounded filenames, ungrounded services, and overclaims.
  - Automated command quarantine (`sanitizeCommands`) isolating dangerous shell commands (`sudo`, `rm -rf`, `curl | bash`, `kill`, `iptables`).
  - Deterministic rule fallback engine (`buildFallbackExplanation`).
- **Web Platform AI & BYOK Integration**:
  - Bring-Your-Own-Key (BYOK) architecture with AES-256-GCM encryption at rest in MongoDB.
  - Write-only API endpoints with key masking (`***MASKED***`) and zero logging.
  - Interactive payload preview modal and consent gating before transmission.
  - AI Explanation view with confidence badges, grounded facts, hypotheses, and safe checklists.
- **CLI AI & Safe Remediation Commands**:
  - `stackdoctor explain <path | reportFile> [--preview-payload] [--confirm]`: Local preview, consent prompt, and formatted AI explanation.
  - Allowlisted remediation registry in `@stackdoctor/adapters` strictly limited to 4 operations: `NODE_INSTALL_DEPENDENCIES`, `PYTHON_CREATE_VENV`, `PYTHON_INSTALL_REQUIREMENTS`, `COPY_ENV_EXAMPLE`.
  - `stackdoctor fix <ruleId | operationId> [path] [--apply]`: Dry-run by default, typed user confirmation, strict refusal in CI mode, and audit logging to `.stackdoctor/fix-history.json`.
- **AI Safety Evaluation Suite & Parity**:
  - 18 safety evaluation fixtures in `scripts/eval-ai.js` and `packages/ai/test/evals.test.ts` achieving 100% pass rate across Hallucinations, Overclaims, Prompt Injections, and Unsafe Commands.
  - No-AI parity test suite in `packages/ai/test/no-ai-parity.test.ts` verifying exact deterministic offline output for all fixtures without AI.
  - Complete architecture documentation in `docs/ai.md` and AI threat model in `docs/security.md`.
