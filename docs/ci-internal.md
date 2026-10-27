# CI/CD & Release Pipeline Documentation

This document describes StackDoctor's GitHub Actions continuous integration, automated security scanning, and protected release pipelines.

---

## Workflows Overview

| Workflow | File | Triggers | Purpose |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | Push & PR to `main` | Multi-OS & multi-Node test matrix, lint, typecheck, accuracy evals, license audit, secret scan, tarball verification. |
| **CodeQL** | `.github/workflows/codeql.yml` | Push & PR to `main`, weekly cron | Static application security testing (SAST) for JavaScript/TypeScript. |
| **Dependency Review** | `.github/workflows/dependency-review.yml` | PR to `main` | Blocks introduction of vulnerable dependencies or non-permissive licenses. |
| **Release** | `.github/workflows/release.yml` | Manual (`workflow_dispatch`) or tag `v*` | Protected release pipeline. Runs full verification gate, publishes package to npm with provenance, drafts GitHub release. |

---

## 1. CI Workflow Matrix (`ci.yml`)

The CI workflow tests all changes across 6 distinct environments:
- **Operating Systems**: Ubuntu (`ubuntu-latest`), Windows (`windows-latest`), macOS (`macos-latest`)
- **Node.js Versions**: Node `20.x` (minimum engine), Node `22.x` (Active LTS)

### Job Steps & Verification Gates
1. **Checkout & Caching**: Clones repo and caches `~/.npm` dependencies.
2. **Runtime Setup**: Installs Node.js matrix version and Python 3.11.
3. **Secret Scan (`npm run check:secrets`)**: Scans git history and tree for credentials.
4. **License Audit (`npm run check:licenses`)**: Ensures 100% MIT-compatible dependencies with zero copyleft.
5. **Build (`npm run build`)**: Compiles TypeScript monorepo and bundles CLI.
6. **Linter & Typecheck (`npm run lint`, `npm run typecheck`)**: Enforces code style and type safety.
7. **Test Suite (`npm test`)**: Runs all 58 Vitest test suites (421+ tests).
8. **Diagnostic Accuracy Evaluation (`npm run eval`)**: Benchmarks detection accuracy across all 4 reference fixtures (requires >= 80% accuracy, < 10% false positives).
9. **AI Safety Benchmark (`npm run eval:ai`)**: Tests against 18 safety scenarios covering hallucinations, overclaims, prompt injections, and unsafe recommendations.
10. **Tarball Integrity (`npm run check:pack`)**: Validates npm pack contents, forbidding source maps, credentials, or oversized bundles.
11. **Fresh-Install Test (`npm run test:install`)**: Performs a fresh installation of the generated tarball into an isolated prefix and executes all CLI subcommands.

### Reproducing CI Checks Locally

To run the complete verification suite locally before pushing:

```bash
# 1. Clean build
npm run build

# 2. Quality checks
npm run lint
npm run typecheck

# 3. Security & compliance audits
npm run check:secrets
npm run check:licenses

# 4. Tests & evaluation benchmarks
npm test
npm run eval
npm run eval:ai

# 5. Packaging & fresh install tests
npm run check:pack
npm run test:install
```

---

## 2. Release Workflow Setup (`release.yml`)

The release workflow is strictly automated yet **requires manual maintainer approval** via GitHub Environments before any package is published.

### Human Setup Instructions (One-time)

To enable npm publishing for the repository owner:

1. **Create an npm Automation Token**:
   - Log into [npmjs.com](https://www.npmjs.com) -> **Access Tokens** -> **Generate New Token**.
   - Select **Automation** (or Granular Access Token with Read and Write permissions for `stackdoctor`).
   - Copy the token string.

2. **Configure Protected GitHub Environment**:
   - In the GitHub repository, navigate to **Settings** -> **Environments**.
   - Click **New environment** and name it exactly: `npm-publish`.
   - Under **Deployment protection rules**, enable **Required reviewers** and add your GitHub username. (This prevents any unapproved automated deploy).
   - Under **Environment secrets**, click **Add secret**:
     - Name: `NPM_TOKEN`
     - Value: `<paste your npm automation token>`
   - Save the secret.

### Running a Release (Human-Only)

1. Ensure all CI checks are green on `main`.
2. Update version in `apps/cli/package.json` and `packages/schemas/src/report.ts` if cutting a new release.
3. Update `CHANGELOG.md` with release notes.
4. In GitHub Actions, select the **Release** workflow:
   - Click **Run workflow**.
   - Choose `dry_run: true` first to verify without pushing.
   - For a real release, set `dry_run: false`.
   - When prompted in the GitHub Actions UI, approve the deployment to `npm-publish`.
5. Once complete, check the drafted GitHub release, edit if desired, and publish the draft.
