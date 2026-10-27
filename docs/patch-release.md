# StackDoctor Patch Release Checklist (v0.1.x)

This document outlines the standard release procedure for patch releases (`v0.1.1`, `v0.1.2`, etc.).

> **Patch Release Rule**: Patch releases contain **fixes and accuracy improvements only**. New features, breaking API changes, or new framework ecosystems are reserved for minor releases (`v0.2.0`).

---

## 1. Pre-Release Verification Checklist

Before creating a patch release, run the automated verification chain:

```bash
npm run verify:release
```

This single command executes and validates all 13 critical quality gates:
- [ ] TypeScript monorepo build (`npm run build`)
- [ ] ESLint clean (`npm run lint`)
- [ ] TypeScript strict typecheck (`npm run typecheck`)
- [ ] Complete Vitest test suite (`npm test`)
- [ ] Accuracy benchmark across baseline and regression fixtures (`npm run eval`)
- [ ] AI safety evaluation suite (`npm run eval:ai`)
- [ ] Secret scanner (`npm run check:secrets`)
- [ ] License audit (`npm run check:licenses`)
- [ ] Pack inspection and budget limits (`npm run check:pack`)
- [ ] Fresh installation in clean isolated temp prefix (`npm run test:install`)
- [ ] Documentation link & snippet audit (`npm run test:docs`)
- [ ] Rules catalog synchronization check (`npm run docs:rules -- --check`)
- [ ] Feedback scorecard integrity (`npm run scorecard`)

---

## 2. Release Preparation Steps

### 1. Update Version Numbers
Update the patch version across packages:
- Root `package.json`: `"version": "0.1.x"`
- `apps/cli/package.json`: `"version": "0.1.x"`
- Internal packages if modified: `packages/*/package.json`

### 2. Update Documentation & Logs
- In `CHANGELOG.md`: Move entries from `[Unreleased]` into `[0.1.x] - YYYY-MM-DD`. Cite feedback IDs (e.g. `FB-002`) and pull request numbers.
- In `FEEDBACK.md`: Verify all resolved items have status `fixed` and `Fixed in Version` set to `0.1.x`.
- Run `npm run scorecard` to confirm parsed feedback state.

### 3. Re-run Verification
```bash
npm run verify:release
```

---

## 3. Maintainer Release Execution

Once `npm run verify:release` passes:

```bash
# 1. Commit version bumps and changelog
git commit -m "chore(release): prepare v0.1.x patch release"
git push origin main

# 2. Tag the release
git tag -a v0.1.x -m "Release v0.1.x: patch fixes"
git push origin v0.1.x
```

### 4. Approve GitHub Actions Release
1. Navigate to **Actions > Release Workflow** on GitHub.
2. Approve the deployment to the protected `npm-publish` environment.
3. The release workflow will automatically publish `stackdoctor@0.1.x` to npm with provenance signing and draft GitHub release notes.
