# Good First Issues for New Contributors

Welcome! If you are looking to make your first contribution to StackDoctor, this curated list highlights approachable, well-scoped tasks with clear requirements, testing guidance, and pointer files.

Before starting, please read our [Contributing Guide](contributing.md) to understand our rule authoring lifecycle and factual accuracy guarantees.

---

## 1. Add `ENV_SAMPLE_KEY_MISSING` Diagnostic Rule

- **Difficulty**: Beginner
- **Category**: `environment`
- **Goal**: Detect when `.env.example` or `.env.sample` defines a configuration key that is absent from the local `.env` file.
- **Why It Matters**: Developers onboarding to a repository often run into crashes simply because a newly added environment variable from `.env.example` was never copied to their local `.env`.
- **Files to Touch**:
  - `packages/rules/src/rules/env-sample-key-missing.ts` (new)
  - `packages/rules/src/index.ts` (register rule)
  - `packages/rules/test/env-sample-key-missing.test.ts` (unit tests)
- **Guidance**:
  - Preconditions: Both `.env.example` (or `.env.sample`) and `.env` exist.
  - Evidence: List the exact missing keys (redact values).
  - Remediation: Show the specific key names to add to `.env`.

---

## 2. Add `REDIS_CONNECTION_REFUSED` Diagnostic Rule

- **Difficulty**: Intermediate
- **Category**: `database`
- **Goal**: Detect when an application defines `REDIS_URL` or `CACHE_URL=redis://...` but no service is listening on port 6379 (or the configured Redis port).
- **Why It Matters**: Common cause of local crash loops in web applications using Celery, BullMQ, or session stores.
- **Files to Touch**:
  - `packages/rules/src/rules/redis-connection-refused.ts` (new)
  - `packages/rules/src/index.ts` (register rule)
  - `packages/rules/test/redis-connection-refused.test.ts` (unit tests)
- **Guidance**:
  - Use our existing TCP connection probe mechanism from `@stackdoctor/core`.
  - Distinguish between connection refused vs. timeout (never claim Redis is uninstalled; state the connection attempt failed on the target host/port).
  - Remediation command: `docker compose up -d redis` or `brew services start redis`.

---

## 3. Detect `bun.lockb` and Suggest `bun install`

- **Difficulty**: Beginner
- **Category**: `dependencies`
- **Goal**: When a repository contains `bun.lockb` and `package.json`, ensure dependency remediation commands suggest `bun install` instead of defaulting to `npm install`.
- **Files to Touch**:
  - `packages/core/src/detectors/package-manager.ts`
  - `packages/rules/src/rules/node-deps-not-installed.ts`
  - `packages/rules/test/node-deps-not-installed.test.ts`
- **Guidance**:
  - Check lockfile presence hierarchy: `bun.lockb` -> bun; `pnpm-lock.yaml` -> pnpm; `yarn.lock` -> yarn; `package-lock.json` -> npm.
  - Ensure remediation command reflects the detected package manager.

---

## 4. Add `DOCKER_OOM_EXIT` Diagnostic Rule

- **Difficulty**: Intermediate
- **Category**: `containers`
- **Goal**: Detect when a Docker container exited with code `137` (SIGKILL / Out of Memory killer).
- **Files to Touch**:
  - `packages/rules/src/rules/docker-oom-exit.ts` (new)
  - `packages/rules/src/index.ts` (register rule)
  - `packages/rules/test/docker-oom-exit.test.ts` (unit tests)
- **Guidance**:
  - Read container inspect status facts: `State.ExitCode === 137` and `State.OOMKilled === true`.
  - Evidence: Container name, image, memory limit, and OOM flag.
  - Remediation: Suggest increasing container memory limit in `docker-compose.yml` (`mem_limit`).

---

## 5. Add Shell Auto-Completion Scripts for `stackdoctor` CLI

- **Difficulty**: Beginner
- **Category**: `cli`
- **Goal**: Provide bash, zsh, and fish shell completion scripts for subcommands (`scan`, `rules`, `explain`) and flags (`--json`, `--ci`, `--verbose`, `--port`).
- **Files to Touch**:
  - `apps/cli/src/commands/completion.ts` (new subcommand)
  - `apps/cli/test/completion.test.ts`
- **Guidance**:
  - Output completion definitions to stdout so users can evaluate `eval "$(stackdoctor completion zsh)"`.

---

## How to Claim an Issue

1. Check our [GitHub Issues](https://github.com/poshiyaharsh/StackDoctor/issues) tab.
2. If an issue is already open with the label `good first issue`, comment stating you'd like to work on it.
3. If proposing one of the above tasks, submit a new proposal via the [New Diagnostic Rule Proposal](https://github.com/poshiyaharsh/StackDoctor/issues/new?template=new_rule_proposal.yml) or [Feature Request](https://github.com/poshiyaharsh/StackDoctor/issues/new?template=feature_request.yml) template.
4. Follow the PR template checklist and ensure all checks (`npm test`, `npm run eval`, `npm run test:docs`) pass before submitting your PR!
