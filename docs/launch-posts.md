# StackDoctor Launch Posts Drafts

This document contains publication-ready announcement drafts for Hacker News, Reddit, and technical blogging platforms (Dev.to / Hashnode / personal blog).

**Guiding Principles for Launch Communication:**
- **Honest language only**: No "revolutionary", no "10x faster", no fake quotes, no invented star metrics.
- **Respect developer time**: Lead immediately with technical details, architectural tradeoffs, what is unsupported, and links to source code.
- **Request constructive criticism**: Explicitly ask for edge cases, false-positive reports, and architecture feedback.

---

## 1. Hacker News (Show HN)

**Title**: Show HN: StackDoctor – Self-healing diagnostic engine for local dev stacks

**URL**: https://github.com/poshiyaharsh/StackDoctor

**Body**:

Hey HN,

I built StackDoctor because I was tired of spending 45 minutes diagnosing why a local development stack failed to boot after switching git branches or cloning a new repo.

Usually, you run `npm run dev` or `docker compose up` and get hit with a wall of cryptic errors:
- `ECONNREFUSED 127.0.0.1:5432` — Is PostgreSQL not installed, stopped, crashing on boot, or listening on another interface?
- `EADDRINUSE :::3000` — Which phantom process or forgotten background container is holding the port?
- Missing `.env` variables that were added to `.env.example` in a PR three days ago, causing silent runtime crashes.

Many developers respond by blindly running `sudo kill -9` or deleting `node_modules`. I wanted a deterministic tool that looks at the facts and tells you exactly what broke and how to fix it without guessing.

### How it works

You run `npx stackdoctor scan` in your project root. In ~20ms, it evaluates a suite of deterministic TypeScript diagnostic rules against observed system facts (filesystem, listening ports, process tables, container statuses, and connection probes).

Key principles we designed around:
1. **Evidence vs. Hypothesis separation**: A core failure mode of diagnostic tools is jumping to conclusions. If a TCP probe to port 5432 fails, StackDoctor reports `ECONNREFUSED` under `OBSERVED` (facts only). Under `POSSIBLE`, it lists plausible explanations (service stopped, wrong port, firewall). It never tells you a database is uninstalled when the only evidence is a closed port.
2. **100% Local and Offline**: The core diagnostic engine makes zero outbound network calls, collects zero telemetry, has no analytics, and does not phone home.
3. **No automatic destructive mutations**: StackDoctor provides concrete copy-paste commands with expected outcomes, risk assessments, verification commands, and undo steps. It will never kill a process or modify files without explicit permission.
4. **Deterministic rules, not an LLM wrapper**: 20 built-in rules written in strict TypeScript. We do have an optional AI explainer (`stackdoctor explain`), but it is off by default, requires an explicit user key or local Ollama endpoint, and runs after secret redaction.

### Limitations today
- We support Node.js, Python/Django, Docker Compose, MongoDB, and MySQL. PostgreSQL and Redis rules are planned for v0.2.0 but not implemented yet.
- It tests local environments, not remote Kubernetes clusters.
- Windows port process lookup relies on `netstat`/PowerShell, which can be slower than `/proc` or `lsof` on Linux/macOS.

The code is MIT-licensed, tested across Ubuntu, macOS, and Windows on Node 20 & 22:
https://github.com/poshiyaharsh/StackDoctor

I would love your brutally honest feedback on the diagnostic output format, edge cases you encounter, and what rules would save you the most time.

---

## 2. Reddit Announcements

### r/node
**Post Title**: Built an open-source local stack diagnostic tool (npx stackdoctor scan) – deterministic checks for missing deps, version drift, port conflicts, and .env drift

**Post Body**:

Hey r/node,

One of the most common friction points when collaborating on Node projects or onboarding developers is environment discrepancies:
- Running `node v24` when `package.json` specifies `engines.node: "^20.0.0"`.
- Missing `.env` keys that exist in `.env.example`.
- Orphaned node processes hanging onto port 3000 or 8080.
- Missing `package-lock.json` leading to non-deterministic dependency resolution.

I built **StackDoctor** (`npx stackdoctor scan`) as an MIT-licensed, zero-network-call diagnostic engine that runs in your terminal in under 20ms.

It inspects your project root, checks running ports, validates `.env` against templates, and checks dependencies. It strictly separates verified facts (`OBSERVED`) from plausible causes (`POSSIBLE`), and gives you exact remediation commands with undo steps.

No telemetry, no tracking, no auto-installs behind your back.

GitHub repo: https://github.com/poshiyaharsh/StackDoctor
Diagnostics catalog: https://github.com/poshiyaharsh/StackDoctor/blob/main/docs/diagnostics.md

Feedback on what Node checks we should add next (e.g. pnpm virtual store or bun lockfiles) is welcome!

---

### r/webdev
**Post Title**: Open Source Tool: StackDoctor – diagnose broken local dev stacks in 20ms

**Post Body**:

Hey r/webdev,

When a local web project fails to start, we often spend 20 minutes triaging whether it's a port conflict, an unmigrated database, or a missing environment variable.

I built **StackDoctor**, an open-source CLI that scans your project root and system state to find the root cause of local development issues:
- Finds what process has your dev port locked (`PORT_IN_USE`).
- Catches missing keys between `.env.example` and `.env`.
- Checks container state for Docker Compose services.
- Detects uninstalled dependencies or mismatched engine versions.

It runs 100% offline with zero telemetry. It doesn't use AI to guess; it uses deterministic, unit-tested rules that present verified evidence and actionable fixes with undo instructions.

Try it in any project:
`npx stackdoctor scan`

Repo: https://github.com/poshiyaharsh/StackDoctor

Would love to hear how it performs on your projects and what false positives or edge cases you run into.

---

### r/devops
**Post Title**: StackDoctor: Deterministic local environment diagnostic engine with CI gate mode

**Post Body**:

Hey r/devops,

While we invest heavily in observability for staging and production, local developer environments often remain an unmonitored source of developer toil and support tickets.

We open-sourced **StackDoctor** (v0.1.0), an evidence-first diagnostic tool that runs locally or as a pre-commit / CI gate:

- **Deterministic exit codes**: `stackdoctor scan --ci --fail-on high` returns exit code 1 if critical/high configuration drift or broken environments are found.
- **Machine-readable JSON**: `--json` output conforming to a published JSON Schema (`docs/report.schema.json`).
- **Canary secret redaction**: Built-in regex filters redact API keys, database credentials, tokens, and home directory usernames before output.
- **Evidence-first philosophy**: Explicit separation of raw observations from speculative hypotheses.

Repo: https://github.com/poshiyaharsh/StackDoctor
CI Guide: https://github.com/poshiyaharsh/StackDoctor/blob/main/docs/ci.md

Interested in thoughts on using this as a standardized local developer onboarding healthcheck.

---

## 3. Technical Blog Post (Dev.to / Hashnode / Blog)

**Title**: Why We Built a Deterministic Diagnostics Tool Instead of an AI Wrapper

**Cover Tagline**: How evidence-first architecture, strict fact separation, and unit-tested rule registries keep developer diagnostics at 0% false positives.

### The Temptation of the "AI Debugger"
Over the past two years, dozens of tools have promised to "fix your broken code with AI." You paste an error message into an LLM, and it spits back a confident explanation.

Sometimes it works. But all too often:
1. It hallucinates: It invents configuration flags that don't exist in your framework version.
2. It overclaims: A `connect ECONNREFUSED 127.0.0.1:27017` becomes *"MongoDB is corrupted, reinstall it"*, when in reality the Docker container simply hadn't finished initializing.
3. It suggests destructive actions: *"Run `chmod -R 777 .`"* or *"Delete your database volume"*.
4. It leaks secrets: Sending `.env` files or system logs to cloud API endpoints without sanitization.

Developers don't need another probabilistic guesser. Developers need **verified facts**.

### Enter StackDoctor
We designed StackDoctor around four non-negotiable architectural principles:

#### 1. Evidence First, Hypotheses Second
Every diagnostic finding in StackDoctor is split into two distinct tiers:
- **`OBSERVED`**: Objective, indisputable facts collected directly from the filesystem, sockets, or process table. (e.g., `Active Node.js version is "24.13.0", but package.json specifies requirement "^18.0.0"`).
- **`POSSIBLE`**: Plausible hypotheses explaining why those facts occurred.

By keeping subjective words (`maybe`, `probably`, `likely`) strictly out of the evidence layer, developer trust is never compromised.

#### 2. Deterministic Rule Registry
Instead of prompting an LLM to identify errors, StackDoctor maintains a compiled registry of rules written in TypeScript. Each rule defines:
- **Preconditions**: Lightweight checks to skip evaluation if the technology is absent (e.g., `package.json` does not exist).
- **Evaluation**: Precise inspection logic returning a structured `Finding` or `null`.
- **Remediation**: Copy-pasteable commands, risk assessments, verification commands, and rollback (`undo`) instructions.

#### 3. Privacy & Zero-Phone-Home
The core CLI has zero telemetry, zero analytics SDKs, and zero external network calls. Diagnostic scans execute in under 20 milliseconds completely offline.

#### 4. The 0% False Positive Goal
In our evaluation harness (`npm run eval`), StackDoctor runs against real broken and healthy test fixtures. In healthy repositories, it returns 0 findings with 0% false positives.

### Where AI Actually Belongs
We did include an AI component (`stackdoctor explain`), but strictly as an optional layer:
- It is disabled by default.
- It requires an explicit user-provided API key or local Ollama endpoint.
- All secrets, tokens, and system paths are scrubbed by a multi-layer canary redaction engine before the prompt is formatted.
- The LLM is restricted to explaining verified findings; it never discovers findings on its own.

### Getting Started
You can try StackDoctor in your project in 60 seconds:
```bash
npx stackdoctor scan
```

Read our full rule catalog and documentation on GitHub:
https://github.com/poshiyaharsh/StackDoctor
