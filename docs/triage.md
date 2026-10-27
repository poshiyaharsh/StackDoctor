# StackDoctor Triage Routine & Issue Workflow

This guide details the maintenance and triage routine for the StackDoctor project. The goal of triage is to turn incoming user reports, false positives, and questions into reproducible fixes, regression tests, and clear documentation.

---

## 1. Cadence & Response Goals

- **Cadence**: Maintenance triage is conducted **weekly** (or immediately upon a security/crash report).
- **Response Goals** (targets, not contractual SLAs):
  - **Crashes / Security Reports**: Initial response within 24–48 hours.
  - **False Positives**: Triaged within 3 business days; reproduction attempted.
  - **General Issues / PRs**: Triaged within 5 business days.

---

## 2. Priority Hierarchy

When reviewing incoming issues and pull requests, work in this strict order:

1. **P0: Crashes & Security Vulnerabilities**
   - Uncaught exceptions, infinite loops, process aborts, or potential secret leakage.
   - Handled immediately via private advisory if security-related (see [SECURITY.md](../SECURITY.md)).
2. **P1: False Positives That Could Mislead**
   - A healthy environment reported as broken, or incorrect advice that risks system damage.
   - High priority because false positives destroy developer trust (see [docs/false-positive-policy.md](false-positive-policy.md)).
3. **P2: Installation & Runtime Environment Problems**
   - Errors running `npx stackdoctor scan` on supported operating systems (Node version incompatibilities, binary permission errors, missing dependencies).
4. **P3: Missed Issues**
   - Legitimate environment breakage that StackDoctor failed to flag.
5. **P4: Confusing Output & Wording Improvements**
   - Finding is technically accurate, but user misinterpreted the message or recommendations were unclear.
6. **P5: Feature Requests & Ecosystem Expansion**
   - Requests for new rules, frameworks, database drivers, or CLI options. Triaged into [ROADMAP.md](../ROADMAP.md) or tagged `good first issue`.

---

## 3. How to Classify Incoming Reports

Use this decision matrix when triaging an issue:

| Scenario | Classification | Action |
|---|---|---|
| Command crashes or exits unexpectedly with stack trace | **Bug (`crash`)** | Reproduce in isolated test, patch root cause, add unit test. |
| Rule flags a finding when project runs without issues | **False Positive (`false_positive`)** | Check rule preconditions, reproduce in synthetic fixture, adjust rule confidence or logic. |
| Tool runs cleanly, but fails to identify an active breakage | **Missed Issue (`missed_issue`)** | Check if rule exists; if yes, inspect detector logic; if no, evaluate for rule proposal. |
| Report asks for unsupported database (e.g. Postgres, Cassandra) | **Limitation / Roadmap (`feature_request`)** | Label `enhancement`, link to `ROADMAP.md` milestone. |
| Reporter lacks required reproduction details | **Needs Info (`needs-info`)** | Request minimal reproduction repo or sanitized `stackdoctor issue` output. |

---

## 4. Reproduction & Verification Workflow

Every confirmed bug or false positive must follow this 5-step reproduction cycle:

1. **Verify Sanitization**: Confirm the issue report contains no secrets, tokens, or private paths.
2. **Log to [FEEDBACK.md](../FEEDBACK.md)**: Assign a unique identifier (e.g., `FB-006`).
3. **Build Synthetic Fixture**: Create a minimal reproducing project under `examples/regressions/<FB-id>-<slug>/` with an `expected.json` file.
4. **Write Failing Test**: Write a unit or integration test reproducing the exact failure mode.
5. **Close with Regression Evidence**: When merging the fix, link both the feedback entry and the regression test in the PR description.

---

## 5. Issue Labels

StackDoctor uses standard labels defined in [.github/labels.yml](../.github/labels.yml). Maintainers should apply:
- **Type**: `type: bug`, `type: false-positive`, `type: feature-request`, `type: docs`.
- **Severity**: `severity: blocker`, `severity: high`, `severity: medium`, `severity: low`.
- **Area**: `area: cli`, `area: core`, `area: rules`, `area: adapters`, `area: web`, `area: api`.
- **Status**: `status: needs-info`, `status: triaged`, `status: in-progress`.
