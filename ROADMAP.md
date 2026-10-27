# StackDoctor Roadmap

> **Important**: All items listed on this roadmap are **planned exploratory milestones**, not contractual commitments or delivery promises. Priorities evolve based on community feedback, real-world bug reports, and diagnostic reliability.

StackDoctor's mission is to provide an evidence-first, deterministic self-healing diagnostic engine for local web development stacks.

---

## Current Version: v0.1.0 (Released October 2026)

- Core deterministic diagnostic engine (`@stackdoctor/core`) with 20 rules across Node.js, Python, Docker, MongoDB, and MySQL.
- Cross-platform CLI (`stackdoctor`) with `scan`, `rules`, and `explain` subcommands.
- Deterministic heuristic analysis with explicit evidence vs. hypothesis classification.
- Interactive terminal UI with color-coded severity, confidence levels, and rollback/undo instructions.
- CI/CD integration with machine-readable `--json` and exit-code enforcement (`--ci`).
- Optional local web dashboard (`apps/web`) and ingestion API (`apps/api`).
- Zero-external-dependency local scan mode (zero telemetry, zero phone-home by default).
- Evaluation harness (`npm run eval`) with 100% precision on baseline fixtures.

---

## Planned for v0.2.0 (Milestone 1)

### 1. PostgreSQL Ecosystem Support
- **Issue**: StackDoctor currently inspects MySQL and MongoDB connection strings, services, and ports, but lacks a dedicated PostgreSQL adapter.
- **Planned Work**:
  - Add `POSTGRES_CONNECTION_FAILED`, `POSTGRES_PORT_IN_USE`, `POSTGRES_DATABASE_NOT_FOUND`, and `POSTGRES_AUTH_METHOD_MISMATCH` diagnostic rules.
  - Detect PostgreSQL connection parameters from `.env`, `DATABASE_URL`, and Prisma/TypeORM/Drizzle schema files.
  - Safe TCP/socket probe to verify Postgres availability on default port 5432.

### 2. Workspace & Monorepo Package Manager Support
- **Issue**: Monorepos utilizing `pnpm` (virtual store symlinks) or `bun` (bun.lockb) currently fallback to standard npm scanning patterns.
- **Planned Work**:
  - Parse `pnpm-workspace.yaml` and resolve peer dependencies across workspace packages.
  - Parse `bun.lockb` and handle bun runtime package resolution.
  - Detect hoisting errors and ghost dependencies across nested workspaces.

### 3. Expanded Diagnostic Rule Coverage
- **Next.js & React Ecosystem**:
  - Next.js 14/15 App Router vs. Pages Router environment variable collisions (`NEXT_PUBLIC_*`).
  - Turbopack cache corruption detection (`.next/cache`).
- **Python / Django / FastAPI**:
  - Virtual environment mismatch detection when multiple `python` or `pyenv` binaries are present in PATH.
  - Detect unapplied Alembic and Django database migrations prior to service launch.
- **Redis & In-Memory Stores**:
  - Redis connection failure and maxmemory exhaustion detection.

---

## Planned for v0.3.0 (Milestone 2)

### 1. Interactive Fix Automation ("Fix Engine")
- Currently, StackDoctor provides explicit copy-paste commands with expected outcomes, risk assessments, and rollback/undo steps.
- **Planned Work**:
  - Optional `--fix` flag with interactive confirmation prompts before executing any remediation commands.
  - Automatic rollback checkpoints and pre-fix environment snapshots.
  - Strict sandboxing: remediation actions that modify critical system configurations or delete non-reproducible assets will remain strictly manual.

### 2. Team Diagnostics & Centralized Ingestion
- Real-time team aggregate dashboard: view common failure modes across team developer machines without collecting code or proprietary tokens.
- Secure token-based ingest for self-hosted instances with team-level access control.
- Workspace diagnostic baseline sharing: commit `.stackdoctor.json` to enforce team-wide environment invariants.

### 3. Native IDE Integrations
- VS Code Extension: real-time in-editor gutter diagnostics for environment variables, broken dependencies, and local container health.
- JetBrains plugin prototype.

---

## Under Consideration / Exploratory (No Scheduled Version)

- Native binary packaging (Bun/Pkg single-file executable distribution).
- Windows WSL2 cross-boundary port forwarding diagnostics.
- Linux systemd service status probes for local daemons.
- Language Server Protocol (LSP) interface for diagnostics.

---

## How to Influence the Roadmap

- Propose a new diagnostic rule: open an issue using the [New Rule Proposal template](.github/ISSUE_TEMPLATE/new_rule_proposal.yml).
- Report a false positive or heuristic inaccuracy: file a [False Positive Report](.github/ISSUE_TEMPLATE/false_positive.yml).
- Discuss design ideas: join our [Discussions forum](https://github.com/poshiyaharsh/StackDoctor/discussions).
