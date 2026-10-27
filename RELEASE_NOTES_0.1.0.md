# StackDoctor v0.1.0 Release Notes

**Release Date:** October 27, 2026  
**License:** MIT  
**Package:** `@harshposhiya/stackdoctor@0.1.0` (npm)

---

## Highlights

StackDoctor v0.1.0 is the initial public release of the **self-healing diagnostic engine for local web development stacks**.

- **Deterministic Diagnostics in <20ms**: Evaluates local system facts (filesystem, listening sockets, process trees, and container statuses) across 20 built-in rules without network overhead.
- **Evidence vs. Hypotheses Separation**: Strictly separates verifiable facts (`OBSERVED`) from plausible root causes (`POSSIBLE`), preventing false assumptions.
- **Actionable Remediation with Rollback**: Every finding comes with an exact copy-paste command, problem explanation, expected result, risk assessment, verification command, and undo instructions.
- **100% Offline & Private by Default**: The diagnostic engine collects zero telemetry, includes no analytics SDKs, and performs zero outbound network calls.
- **Canary Secret Redaction**: Multi-layer regex sanitizer redacts database credentials, API keys, auth tokens, passwords, and user paths from all reports and issue drafts.
- **CI/CD Integration**: Supports `--ci` with deterministic exit codes (0 = healthy, 1 = issues at/above threshold) and machine-readable `--json` validated against a published JSON Schema.
- **Optional Web Dashboard & API**: Self-hostable via Docker Compose for team report visualization and scan history tracking.
- **Optional AI Explanations (`stackdoctor explain`)**: Off by default; safely translates diagnostic reports into plain-English explanations using local Ollama or OpenAI/Anthropic keys after secret scrubbing.

---

## Supported Platform Matrix

| Operating System | Node.js Versions | Status | Verified Capabilities |
|---|---|:---:|---|
| **Ubuntu / Debian Linux** | 20.x, 22.x, 24.x | **Tier 1 (Tested)** | Full rule suite, `/proc` PID resolution, TCP connection probes, Docker Compose checks |
| **macOS (Apple Silicon & Intel)** | 20.x, 22.x, 24.x | **Tier 1 (Tested)** | Full rule suite, `lsof` socket inspection, Docker Compose checks |
| **Windows 10 / 11 (PowerShell & CMD)** | 20.x, 22.x, 24.x | **Tier 1 (Tested)** | Full rule suite, `netstat` socket inspection, cross-platform path resolution |

---

## Installation & Quick Start

### Run Instantly with `npx` (No Global Install Required)
```bash
npx @harshposhiya/stackdoctor scan
```

### Install Globally
```bash
npm install -g @harshposhiya/stackdoctor
stackdoctor scan
```

### Run in CI
```bash
stackdoctor scan --ci --fail-on high --format markdown
```

---

## Known Limitations

- **Database Coverage**: Currently includes dedicated rules for MongoDB and MySQL. PostgreSQL rules are planned for v0.2.0.
- **Workspaces**: Optimized for npm workspaces; pnpm virtual store and bun lockfile support are in exploratory planning.
- **Fix Automation**: All remediation commands are displayed for user copy-paste; automatic `--fix` execution is intentionally deferred to v0.3.0 to prioritize safety and developer control.

For complete documentation on limitations and architectural boundaries, see [docs/known-limitations.md](docs/known-limitations.md) and [ROADMAP.md](ROADMAP.md).

---

## Security Notes

- StackDoctor executes all external CLI queries (`node`, `git`, `docker`, `pip`) using explicit argument arrays and fixed allowlists. `shell: true` is strictly prohibited throughout the codebase.
- Reports and issue drafts never capture or transmit secret values.
- Please report any security vulnerabilities responsibly to security@stackdoctor.dev or via our [GitHub Advisory Form](https://github.com/poshiyaharsh/StackDoctor/security/advisories/new) in accordance with `SECURITY.md`.
