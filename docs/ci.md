# Continuous Integration (CI) with StackDoctor

StackDoctor runs 100% offline in CI environments, diagnosing broken development setups, missing dependencies, version mismatches, and configuration drift before merging code.

## Key CI Guarantees

1. **No External Network Calls**: `stackdoctor scan` runs purely locally and never uploads code, configuration, or reports unless explicitly configured.
2. **Deterministic Output & Exit Codes**: Consistent findings ordering (by severity, then rule ID) and stable exit codes.
3. **Cross-Platform**: Operates on Linux (`ubuntu-latest`), macOS (`macos-latest`), and Windows (`windows-latest`).
4. **Secret Sanitization**: All reports and Markdown summaries automatically redact credentials, API keys, tokens, and local machine identifiers.

---

## Exit Codes Reference

| Exit Code | Meaning | Description |
|:---:|---|---|
| `0` | **Success** | Diagnostic scan passed; no findings at or above the `--fail-on` threshold. |
| `1` | **Issues Found** | Environment findings detected meeting or exceeding `--fail-on` threshold (default: `high`). |
| `2` | **Tool Error** | Non-recoverable diagnostic tool error (e.g., target directory not found, I/O failure). |
| `3` | **Invalid Usage** | CLI syntax error (e.g., unrecognized flag, missing argument value, invalid severity). |

---

## GitHub Actions: Copy-Paste Workflow

Below is a complete, copy-pasteable workflow file (`.github/workflows/stackdoctor.yml`).
All third-party GitHub actions are pinned to **full immutable commit SHAs** with version comments, and permissions are constrained to `contents: read`.

```yaml
name: Environment Diagnostics

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Minimal read-only permissions
permissions:
  contents: read

jobs:
  diagnostics:
    name: StackDoctor Scan
    runs-on: ubuntu-latest

    steps:
      # actions/checkout@v4.2.2
      - name: Checkout repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683

      # actions/setup-node@v4.1.0
      - name: Setup Node.js
        uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
        with:
          node-version: 20

      - name: Install StackDoctor
        run: npm install -g stackdoctor

      - name: Run StackDoctor Scan
        id: scan
        run: |
          # Output Markdown summary to GitHub Actions Step Summary
          stackdoctor scan . --ci --fail-on high --format markdown >> "$GITHUB_STEP_SUMMARY"
          # Also output full structured JSON report to a file
          stackdoctor scan . --ci --format json --out stackdoctor-report.json

      # actions/upload-artifact@v4.6.0
      - name: Upload Diagnostic Report Artifact
        if: always()
        uses: actions/upload-artifact@65c4c4a1ddee5b72f698fdd19549f0f0fb45cf08
        with:
          name: stackdoctor-report
          path: stackdoctor-report.json
          retention-days: 14
```

---

## Using the Reusable Composite Action

Alternatively, use the composite action provided at `action.yml` in this repository:

```yaml
jobs:
  diagnostics:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Run StackDoctor Diagnostics
        uses: poshiyaharsh/StackDoctor@main
        with:
          path: "."
          fail-on: "high"
          upload-artifact: "true"
```

---

## GitLab CI / Other CI Systems

StackDoctor can be integrated into any CI system using standard shell commands:

```yaml
# .gitlab-ci.yml example
stackdoctor-diagnostics:
  image: node:20
  stage: test
  script:
    - npm install -g stackdoctor
    - stackdoctor scan . --ci --fail-on high --format text --out report.json
  artifacts:
    when: always
    paths:
      - report.json
```
