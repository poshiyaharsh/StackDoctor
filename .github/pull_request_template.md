## Description

<!-- Briefly describe the purpose of this PR and what problem it solves. -->

## Changes Made

- [ ] New diagnostic rule: `<RULE_ID>`
- [ ] Bug fix / diagnostic correction
- [ ] Core engine / adapter improvement
- [ ] CLI / Web platform update
- [ ] Documentation update

## Diagnostic Rule Checklist (if adding/modifying rules)

- [ ] Rule ID is in `UPPER_SNAKE_CASE` (e.g. `NODE_DEPS_NOT_INSTALLED`).
- [ ] Rule is registered in `packages/rules/src/index.ts`.
- [ ] Evidence fields (`observed`, `description`) contain purely factual observations without hypothesis wording (`probably`, `might`, `seems`, etc.).
- [ ] Hypotheses and explanations are placed strictly in `possibleCauses`.
- [ ] Remediation actions include `problem`, `relevance`, `commandOrAction`, `risks`, `verification`, and `undo`.
- [ ] Documentation links are HTTPS and conform to the domain allowlist (`docs.nodejs.org`, `python.org`, etc.).
- [ ] Entry added to `docs/diagnostics.md`.
- [ ] Unit tests pass: trigger, non-trigger, wording, and schema compliance.

## Verification Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm test` passes
- [ ] `npm run eval` maintains 100% detection accuracy
