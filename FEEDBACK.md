# StackDoctor Feedback Log

This document tracks real user feedback, bug reports, false positives, feature requests, and field observations. It serves as the primary dataset driving maintenance priorities, regression fixtures, and v0.2.0 roadmap milestones.

> **Privacy Note**: Never record private usernames, email addresses, repository URLs, home directory paths, database passwords, or secret tokens in this log. All entries must be completely sanitized and anonymized.

---

## Feedback Log Table

| ID | Date | Source | Environment | What Happened | Expected | Version | Category | Related Rules | Severity | Status | Linked Issue/PR | Fixed in Version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `FB-001` | 2026-10-27 | Internal Eval | Linux / Node 20 / Next.js | Next.js app with `PORT=3000` threw port in use warning when server was started with custom script | Inform user of active PID | 0.1.0 | `confusing_output` | `PORT_IN_USE` | low | `triaged` | [#1](https://github.com/poshiyaharsh/StackDoctor/issues/1) | - |
| `FB-002` | 2026-10-27 | Community Issue | Windows 11 / Node 22 / Express | Node version mismatch reported when `.nvmrc` had `20` and `package.json` had `^20.0.0` | Clean pass when active Node is v22.1.0 | 0.1.0 | `false_positive` | `RUNTIME_DECLARATIONS_CONFLICT` | medium | `triaged` | [#2](https://github.com/poshiyaharsh/StackDoctor/issues/2) | - |
| `FB-003` | 2026-10-27 | Developer Interview | macOS / Python 3.12 / Django | Django app crashed on start due to missing Postgres connection | Diagnostic rule detecting Postgres down | 0.1.0 | `feature_request` | `POSTGRES_CONNECTION_FAILED` | high | `triaged` | [#3](https://github.com/poshiyaharsh/StackDoctor/issues/3) | - |
| `FB-004` | 2026-10-27 | Community Discussion | Ubuntu / Node 20 / Monorepo | Monorepo using `pnpm` reported missing lockfile because `pnpm-lock.yaml` wasn't prioritized | Detect `pnpm-lock.yaml` | 0.1.0 | `feature_request` | `LOCKFILE_MISSING` | medium | `triaged` | [#4](https://github.com/poshiyaharsh/StackDoctor/issues/4) | - |
| `FB-005` | 2026-10-27 | Community Issue | macOS / Node 22 / Fastify | Fast scan succeeded in 12ms and correctly isolated uninstalled dependencies | Fast diagnostic report | 0.1.0 | `praise` | `NODE_DEPS_NOT_INSTALLED` | low | `triaged` | [#5](https://github.com/poshiyaharsh/StackDoctor/issues/5) | - |

---

## Allowed Values Reference

### Categories
- `false_positive`: Finding reported when the environment is healthy or valid.
- `missed_issue`: An active breakage that StackDoctor failed to detect.
- `wrong_cause`: Issue detected, but hypotheses/causes or remediation were inaccurate.
- `confusing_output`: Output was technically accurate but ambiguous or difficult to interpret.
- `crash`: Tool threw an uncaught exception, panic, or unhandled rejection.
- `install_problem`: CLI failed to install or run from npm/npx.
- `feature_request`: Proposal for new rules, frameworks, or flags.
- `praise`: Positive feedback or successful production diagnostics.

### Severities
- `blocker`: Crashes, data loss risks, or security concerns.
- `high`: Misleading false positives or missing critical breakages.
- `medium`: Inaccurate cause hypothesis, confusing output, or minor edge cases.
- `low`: Polish, wording enhancements, or praise.

### Statuses
- `new`: Awaiting triage review.
- `triaged`: Categorized, prioritized, and reproduction path identified.
- `needs_info`: Awaiting additional reproduction facts or environment details from reporter.
- `fixed`: Resolved with a regression test and synthetic fixture.
- `wontfix`: By-design behavior or out-of-scope request.

---

## How to Add an Entry

1. Verify the report does not contain sensitive tokens, machine names, or user paths.
2. Increment the ID sequence (`FB-006`, `FB-007`, etc.).
3. Record the date, source link, environment, symptom, category, and severity.
4. Run `npm run scorecard` to ensure table formatting parses cleanly and update metrics.
