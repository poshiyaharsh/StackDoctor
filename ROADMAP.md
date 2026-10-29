# StackDoctor Roadmap

> **Important**: All items listed on this roadmap are **planned exploratory milestones**, not contractual commitments or delivery promises. Priorities evolve based on community feedback, real-world bug reports, and diagnostic reliability.

StackDoctor's mission is to provide an evidence-first, deterministic self-healing diagnostic engine for local web development stacks.

---

## Current Version: v0.2.0 (Released October 2026)

- Expanded multi-ecosystem diagnostic engine (`@stackdoctor/core`) with 40 rules across Node.js, Python, Java, PHP, .NET, Docker, MongoDB, MySQL, PostgreSQL, SQLite, and Microsoft SQL Server.
- Full support for Java/Spring Boot (Maven/Gradle), PHP/Laravel (Composer), and C#/.NET (ASP.NET Core).
- Staged connectivity probing for PostgreSQL, SQLite, and Microsoft SQL Server with strict canary credential protection.
- Data-driven accuracy benchmark harness (`npm run eval`) with 100.0% accuracy across 15 fixtures and regression cases (`FB-002`, `FB-004`).
- Single-command release verification chain (`npm run verify:release`) enforcing 13 quality gates.

---

## Planned for v0.3.0 (Milestone 2)

### 1. Interactive Fix Automation ("Fix Engine")
- Currently, StackDoctor provides explicit copy-paste commands with expected outcomes, risk assessments, and rollback/undo steps.
- **Planned Work**:
  - Optional `--fix` flag with interactive confirmation prompts before executing any remediation commands.
  - Automatic rollback checkpoints and pre-fix environment snapshots.
  - Strict sandboxing: remediation actions that modify critical system configurations or delete non-reproducible assets will remain strictly manual.

### 2. Deep Monorepo Workspace Topology
- **Planned Work**:
  - Parse `pnpm-workspace.yaml`, Lerna, and Bun workspaces.
  - Detect phantom dependencies, hoisting issues, and version drift across monorepo packages.

### 3. Redis & Cache Diagnostics
- **Planned Work**:
  - Direct Redis PING/PONG socket probe.
  - Next.js Turbopack cache corruption detection (`.next/cache`).
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
