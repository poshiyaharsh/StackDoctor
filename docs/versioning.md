# StackDoctor Versioning & Deprecation Policy

StackDoctor follows [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`) with explicit policies governing CLI subcommands, diagnostic findings, and the machine-readable report schema.

---

## 1. Version Number Semantics

### Patch Releases (`0.1.x`)
- **Scope**: Bug fixes, false-positive corrections, wording clarifications, and documentation updates.
- **Guarantees**:
  - Strictly backward-compatible.
  - Zero new flags, subcommands, or breaking behavioral changes.
  - No new diagnostic rules that alter baseline exit codes without opt-in.

### Minor Releases (`0.x.0` / `1.x.0`)
- **Scope**: New features, new diagnostic rules, additional technology adapters (e.g. PostgreSQL, Redis), and workspace management.
- **Guarantees**:
  - Backward-compatible CLI interface and flags.
  - Any new rule introduced will default to non-breaking severities unless explicitly configured via `--fail-on`.

### Major Releases (`1.0.0`, `2.0.0`)
- **Scope**: General availability, production stability guarantees, breaking CLI flag removals, or major architectural overhauls.

---

## 2. Report Schema Versioning (`schemaVersion`)

StackDoctor reports (`--json` output) include a top-level `schemaVersion` attribute:

```json
{
  "schemaVersion": "1.0.0",
  "toolVersion": "0.1.0",
  "status": "completed",
  "findings": []
}
```

### Schema Stability Rules
1. **Additive Changes (`1.x.0`)**:
   - Adding optional fields to `Finding`, `Evidence`, or `Recommendation` objects increments the schema minor version.
   - Downstream consumers parsing JSON must ignore unrecognized fields.
2. **Breaking Changes (`2.0.0`)**:
   - Renaming existing fields, removing fields, or changing enum values (e.g. altering `Severity` or `ReportStatus` literals) requires bumping `schemaVersion` to the next major version.
   - All breaking schema changes must be documented in `docs/report-format.md` with migration guides for CI consumers.

---

## 3. Flag and Subcommand Deprecation Policy

When an existing CLI flag or subcommand is slated for retirement or replacement:

1. **Deprecation Notice**:
   - The flag/command is marked as deprecated in CLI `--help` output and documentation.
   - When invoked, the CLI prints a non-intrusive warning to `stderr` explaining the replacement flag.
2. **Grace Period**:
   - Deprecated flags remain functional for **at least one minor release cycle** before being removed.
3. **Removal**:
   - Complete removal occurs only in the subsequent minor or major version bump, with clear mention in `CHANGELOG.md`.
