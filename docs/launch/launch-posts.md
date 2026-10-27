# StackDoctor Launch Posts & Social Announcements

This directory contains launch announcements for Hacker News, Reddit, Dev.to, and LinkedIn/X.

All posts strictly adhere to our factual accuracy guidelines:
- No hyperbolic buzzwords ("revolutionary", "game-changing", "10x").
- Cite only real numbers from `npm run eval`: 100.0% detection accuracy on test fixtures (11/11 true positives), 0.0% false positives, 20 deterministic rules.
- State limitations honestly.
- Keep optional AI features clearly labeled as off-by-default and opt-in.

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

### r/programming
**Title**: StackDoctor: An evidence-first local environment diagnostic engine (MIT)

**Body**:

Hey r/programming,

Local developer environments fail in surprisingly repetitive ways: mismatched runtime versions, locked ports, missing environment variables, and unstarted containers. Most tooling either prints giant stack traces or uses LLMs to hallucinate plausible-sounding explanations.

We built **StackDoctor** (v0.1.0) around strict deterministic fact-gathering:
- Inspects system facts: listening sockets, process trees, package files, and container states.
- Strictly separates `OBSERVED` evidence (e.g. `package.json exists, but node_modules does not`) from `POSSIBLE` hypotheses (e.g. `Dependencies have not yet been installed`).
- Generates actionable remediation commands with expected outcomes, risk levels, and rollback/undo instructions.
- Runs 100% locally with zero external network calls and zero telemetry.

On our benchmark fixtures (`npm run eval`), it achieves 100.0% detection accuracy with 0.0% false positives across 20 built-in rules.

Repo: https://github.com/poshiyaharsh/StackDoctor
Full rule catalog: https://github.com/poshiyaharsh/StackDoctor/blob/main/docs/diagnostics.md

---

## 3. LinkedIn & X (Twitter) Post

**Post Text**:

Local development environments shouldn’t take 45 minutes to troubleshoot.

We just released StackDoctor v0.1.0 (MIT): an open-source, evidence-first diagnostic engine for local web stacks.

Run: `npx stackdoctor scan`

What it does:
🔍 Identifies port locks, missing dependencies, .env drift, and container failures in <20ms
📋 Strictly separates verified facts from possible root causes
🛡️ Zero network calls, zero tracking telemetry, 100% offline
💡 Every fix recommendation includes an undo/rollback command

Built with TypeScript, benchmarked across Ubuntu, macOS, and Windows with 20 built-in rules.

Check out the repo on GitHub:
👉 https://github.com/poshiyaharsh/StackDoctor

#OpenSource #WebDev #NodeJS #DevOps #TypeScript #DeveloperExperience

---

## 4. Technical Article Outline (Dev.to / Hashnode / Blog)

**Article Title**: Why We Built a Deterministic Diagnostics Tool Instead of an AI Wrapper

**Outline**:
1. **The Modern Local Stack Problem**: Microservices, Docker containers, multi-runtime monorepos, and the weekly friction of broken local setups.
2. **The LLM Trap**: Why asking probabilistic models to debug environments leads to hallucinated CLI flags, false assumptions about uninstalled services, and security risks with unredacted credentials.
3. **The Evidence vs. Hypothesis Separation**: How StackDoctor enforces that raw evidence contains only verifiable measurements (`file_presence`, `version_check`, `dns_resolution`, `port_binding`) and isolates speculation into `possibleCauses`.
4. **The Rule Registry Architecture**: How `@stackdoctor/rules` uses pure TypeScript preconditions and evaluation functions for 20ms execution times.
5. **Evaluating Accuracy**: Benchmarking against real healthy and broken repositories with 0% false positives.
6. **Where AI Actually Adds Value**: Using local LLMs solely to explain structured diagnostics to beginners, with automatic secret redaction.
7. **Getting Involved**: Contributing new rules via the rule scaffold generator (`npm run new-rule`).
