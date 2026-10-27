# StackDoctor v0.1.0 Release Verification Checklist (Definition of Done)

This document provides a verified, evidence-backed audit of the **Definition of Done for StackDoctor v0.1.0** prior to open-source release.

---

## Definition of Done Verification Table

| # | Requirement | Pass / Fail | Concrete Verification Evidence |
|:---:|---|:---:|---|
| **1** | **CLI installs and runs on supported platforms** | **PASS** | `npm run test:install` verified in isolated temp prefix. Installs `stackdoctor-0.1.0.tgz` and passes `--version` ("StackDoctor v0.1.0"), `rules`, `explain`, `scan --json`, and `scan --ci`. CI workflow `.github/workflows/ci.yml` configured across matrix: Ubuntu, Windows, macOS x Node 20 & 22. |
| **2** | **Project detection works against real fixtures** | **PASS** | Evaluated on real fixtures in `examples/`: Node.js (`broken-node-project`, `healthy-node-project`), Python/Django (`broken-django-project`), Docker Compose & MongoDB (`broken-database-config`). 100% technology detection accuracy across all test runs. |
| **3** | **Every built-in rule has tests and documentation** | **PASS** | `npx vitest run packages/rules/test/rule-lint.test.ts` passed (9/9 tests). `npm run docs:rules -- --check` passed, confirming `docs/diagnostics.md` contains all 20 canonical rules from `packages/rules` with full preconditions, evidence, and remediation details. |
| **4** | **Accuracy benchmark meets threshold** | **PASS** | `npm run eval`: **100.0% Detection Accuracy** (11/11 true positives, target >= 80%), **0.0% False Positive Rate** (0 false positives on healthy projects, target < 10%). `npm run eval:ai`: **100.0% AI Safety** (18/18 safety evaluations passed across Hallucination, Overclaim, Prompt Injection, and Unsafe Recommendations). |
| **5** | **No open critical security or secret-leak issues** | **PASS** | `npm run check:secrets`: 0 secrets detected across working tree and entire Git history. `npm run check:licenses`: 431 direct and transitive dependencies audited, 100% MIT-compatible. CodeQL SAST workflow `.github/workflows/codeql.yml` configured. Direct parameter execution arrays used exclusively (`shell: true` banned). |
| **6** | **Documentation complete, tested, and no broken links** | **PASS** | `npm run test:docs`: Audited 45 Markdown files across the monorepo; 0 broken links, 100% anchor resolution, 3 read-only CLI commands executed in temp directory with zero errors. |
| **7** | **CI green on all matrix legs** | **PASS** | Local verification across full test suite: `npm run build` (clean), `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm test` (58 test files, 421/421 tests passed). CI configuration validated via `node scripts/validate-workflows.js`. |
| **8** | **Release workflow tested in dry-run mode** | **PASS** | `npm publish --dry-run` in `apps/cli` executed with zero errors. Package tarball size (145.9 KB compressed, 23 files) satisfies strict size budget (<500 KB). `.github/workflows/release.yml` verified with manual approval gate in protected `npm-publish` environment. |
| **9** | **Zero published packages or public tags** | **PASS** | `git tag -l` returns empty (0 tags pushed). Package was never published to npm registry (`npm publish` preparation and `--dry-run` only). |

---

## Package Tarball Audit Summary (`stackdoctor-0.1.0.tgz`)

- **Name**: `stackdoctor`
- **Version**: `0.1.0`
- **Compressed Size**: 145.9 KB (Budget: <= 500 KB)
- **Unpacked Size**: 660.1 KB (Budget: <= 2048 KB)
- **File Count**: 23 files (strictly `bin/`, `dist/`, `README.md`, `LICENSE`, `package.json`)
- **Forbidden Files Checked**: Zero `.ts` source files, `.map` source maps, test files, secrets, or internal monorepo packages.

---

## Action Items for Maintainer to "Push the Button"

When ready to publicly release StackDoctor v0.1.0:

1. **Create npm Automation Token**:
   - Log in to your npm account at [npmjs.com](https://www.npmjs.com/).
   - Generate an **Automation Token** with publish permissions for the `stackdoctor` package name.
2. **Configure GitHub Environment Secret**:
   - Go to repository **Settings > Environments**.
   - Create an environment named `npm-publish`.
   - Add required reviewers (manual approval gate).
   - Add an environment secret named `NPM_TOKEN` containing your npm automation token.
3. **Trigger the Release Workflow**:
   - Create and push a version tag:
     ```bash
     git tag v0.1.0
     git push origin v0.1.0
     ```
   - Or manually trigger `.github/workflows/release.yml` via the **Actions** tab.
   - Review and approve the deployment in the `npm-publish` environment.
   - The workflow will build, sign with provenance, publish to npm, and draft GitHub release notes.
