# Contributing to StackDoctor

We welcome contributions to StackDoctor! Whether you want to add support for a new technology, author a new diagnostic rule, or fix a bug, this repository follows a structured, factual approach to diagnostics.

## Quick Links

- **Rule Authoring & Lifecycle Guide**: [docs/contributing.md](docs/contributing.md)
- **Diagnostic Rules Catalog**: [docs/diagnostics.md](docs/diagnostics.md)
- **Report Schema & Format Specification**: [docs/report-format.md](docs/report-format.md)
- **CI / GitHub Actions Guide**: [docs/ci.md](docs/ci.md)

## Fast Track: Adding a Diagnostic Rule

1. Scaffold your rule using our automated generator:
   ```bash
   npm run new-rule -- --id MY_NEW_RULE --tech node
   ```
2. Implement preconditions and evaluation logic in `packages/rules/src/rules/my-new-rule.ts`.
3. Register the rule in `packages/rules/src/index.ts`.
4. Run tests and linting:
   ```bash
   npm test
   npm run lint
   npm run typecheck
   npm run eval
   ```

## Ground Rules

- **Facts in Evidence**: Raw observed evidence must be 100% factual measurements. Speculation belongs exclusively in `possibleCauses`.
- **Never Overclaim**: Never assume a service is dead when a network check times out; never suggest destructive commands without undo steps.
- **Strict HTTPS Allowlist**: Documentation links must use HTTPS and belong to our official allowlist.
- **Privacy & Redaction**: Diagnostics never leak machine identifiers, usernames, or secrets.

For full details, please read [docs/contributing.md](docs/contributing.md).
