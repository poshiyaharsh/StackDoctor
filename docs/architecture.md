# StackDoctor Architecture

## Overview

StackDoctor is an open-source, deterministic developer environment diagnostics platform ("Find the cause. Fix the environment. Ship the code.").

The platform is designed around strict separation of concerns and an offline-first philosophy:
1. **CLI (`apps/cli`)**: Operates 100% offline. Scans codebases, probes local runtimes, inspects ports, verifies database accessibility, checks configuration files, and outputs actionable reports without making any network calls.
2. **Core Packages (`packages/*`)**: Shared engine, schema definitions, non-intrusive adapters, and rule registry used across the CLI and API.
3. **API Server (`apps/api`)**: High-performance Express server providing authentication, project management, report ingestion, owner-isolated telemetry, and token lifecycle management.
4. **Web Platform (`apps/web`)**: React + Vite + TypeScript web application providing an interactive dashboard, project history, expandable diagnostic reports, finding deep-dives, and account settings.

---

## Monorepo Layout

```
StackDoctor/
├── apps/
│   ├── cli/             # @stackdoctor/cli: Offline scanner, terminal formatter, upload client
│   ├── api/             # @stackdoctor/api: Express API, MongoDB models, auth, CSRF, rate-limiting
│   └── web/             # @stackdoctor/web: React 19 + Vite web dashboard and report viewer
├── packages/
│   ├── schemas/         # Shared Zod schemas (Report, Finding, Evidence, Project, Rule)
│   ├── core/            # Diagnostic orchestrator, report builder, multi-pass redaction engine
│   ├── adapters/        # Safe execFile runner, port prober, config scanner, database checkers
│   ├── rules/           # Diagnostic rule implementations and default rule registry
│   └── config/          # Global constants, defaults, and shared environment configuration
├── docs/                # Comprehensive architectural, security, and usage documentation
├── examples/            # Canonical diagnostic fixtures (Node, Django, PostgreSQL, healthy)
└── scripts/             # Diagnostic accuracy evaluation harness (scripts/eval.js)
```

---

## Data Flow & Lifecycles

```
[Local Workspace]
       │
       ▼
[CLI: stackdoctor scan] ──────(100% Offline)──────► [Terminal Report / JSON]
       │
       ▼ (Optional explicit user upload: stackdoctor upload)
[CLI Interactive Preview] ──(Requires user confirmation [y/N])──┐
       │                                                         │
       ▼ (HTTPS Only)                                            │
[Local Pre-Redaction]                                            │
       │                                                         ▼
       └──────────────────────────────────────────► [API Server: Ingestion]
                                                         │
                                                         ├─► [Schema Validation]
                                                         ├─► [Canary Secret Rejection]
                                                         ├─► [Server Re-Redaction]
                                                         ├─► [Owner Isolation Verification]
                                                         └─► [MongoDB Storage]
                                                                 │
                                                                 ▼
                                                        [Web Dashboard]
```

### 1. Local Diagnostic Scan (`stackdoctor scan`)
- Invoked in the local terminal.
- Discovers project configuration statically (`package.json`, `.env.example`, `docker-compose.yml`, `requirements.txt`).
- Probes non-intrusively: executes allowlisted binaries (`node -v`, `npm -v`, `python -V`) with timeouts and byte caps; probes TCP ports without terminating processes.
- Evaluates registered diagnostic rules deterministically against gathered evidence.
- Multi-pass redaction strips passwords, API keys, bearer tokens, AWS credentials, and connection strings.
- **Zero network calls are made.**

### 2. Optional Report Upload (`stackdoctor upload`)
- Triggered solely by explicit developer action.
- Generates an interactive terminal preview detailing project name, operating system, finding counts, and rule IDs.
- Requires explicit interactive confirmation (`Upload report to server? [y/N]`) unless `--yes` is specified for CI pipelines.
- Strictly validates server URL: permits HTTP strictly for `localhost`/`127.0.0.1` and forces HTTPS for all remote hosts.
- Authenticates via Bearer API token (`Authorization: Bearer stk_live_...`).

### 3. Server Ingestion & Multi-Tenant Isolation
- The server never trusts client-redacted data.
- The request body is strictly capped at 1MB to prevent memory exhaustion.
- Re-validates the payload against `@stackdoctor/schemas`.
- Scans for canary secrets: any report containing known canary credentials is immediately rejected with HTTP 422 and discarded without storing.
- Re-redacts all findings, titles, descriptions, and observed strings using `@stackdoctor/core`'s redaction engine.
- Binds the report strictly to the authenticated `ownerId`.
- Never stores raw `.env` files, actual environment variable values, hostnames, usernames, MAC addresses, or IP addresses.

---

## What Stays Local vs What Is Uploaded

| Data Element | Stays Local | Uploaded (If User Confirms) | Stored in DB |
|---|:---:|:---:|:---:|
| Source code files | Yes (100%) | No | No |
| `.env` file contents & secrets | Yes (100%) | No | No |
| Machine Hostname & Username | Yes (100%) | No | No |
| MAC Address & Local IP | Yes (100%) | No | No |
| Project Name | No | Yes | Yes |
| Detected Technologies (e.g. Node, Docker) | No | Yes | Yes |
| Diagnostic Rule IDs & Statuses | No | Yes | Yes |
| Factual Observed Evidence (sanitized) | No | Yes | Yes |
| Remediation commands & recommendations | No | Yes | Yes |
| Pass/Fail Check Counts | No | Yes | Yes |
