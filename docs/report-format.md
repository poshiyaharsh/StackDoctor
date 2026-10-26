# StackDoctor Diagnostic Report Format

This document specifies the exact JSON schema and data structures produced by the StackDoctor CLI and consumed by the StackDoctor API and Web platform.

## Stability Guarantee

The StackDoctor Diagnostic Report format is a **public contract**.
- `schemaVersion` is bumped following semantic versioning (`MAJOR.MINOR.PATCH`).
- Breaking changes (field removal, field renaming, type changes) bump the `MAJOR` version.
- Backwards-compatible additions (optional fields) bump the `MINOR` version.
- Bug fixes or documentation corrections bump the `PATCH` version.
- The schema structure is covered by automated snapshot tests in `@stackdoctor/schemas`.

---

## Top-Level Schema (`Report`)

```json
{
  "schemaVersion": "1.0.0",
  "toolVersion": "0.1.0",
  "operatingSystem": "linux",
  "startedAt": "2026-10-26T12:00:00.000Z",
  "completedAt": "2026-10-26T12:00:02.500Z",
  "status": "completed_with_warnings",
  "projectName": "my-service",
  "technologies": [],
  "checks": [],
  "findings": [],
  "summary": {}
}
```

### Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | `string` | The version of the report schema (e.g. `"1.0.0"`). |
| `toolVersion` | `string` | The version of the StackDoctor tool that generated the report. |
| `operatingSystem` | `string` | The platform OS where diagnostics were executed (`"win32"`, `"darwin"`, `"linux"`). |
| `startedAt` | `string` (ISO 8601) | UTC timestamp marking when diagnostic execution began. |
| `completedAt` | `string` (ISO 8601) | UTC timestamp marking when diagnostic execution finished. |
| `status` | `ReportStatus` | Overall report execution status: `"completed"`, `"completed_with_warnings"`, `"failed"`, `"cancelled"`. |
| `projectName` | `string` | Name of the evaluated project directory. |
| `technologies` | `TechnologyDetection[]` | List of detected technologies and signatures. |
| `checks` | `CheckResult[]` | Individual low-level check executions. |
| `findings` | `Finding[]` | Deterministically sorted diagnostic findings (by severity descending, then rule ID). |
| `summary` | `ReportSummary` | Aggregate check and finding counts. |

---

## Sub-Schemas

### 1. `TechnologyDetection`

Represents detected software stacks, runtimes, and frameworks.

```json
{
  "name": "Node.js",
  "confidence": "confirmed",
  "evidence": []
}
```

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Technology name (e.g. `"Node.js"`, `"Django"`, `"MongoDB"`). |
| `confidence` | `Confidence` | Detection confidence level: `"confirmed"`, `"likely"`, `"possible"`. |
| `evidence` | `Evidence[]` | Supporting probe observations that triggered detection. |

---

### 2. `CheckResult`

Represents a low-level diagnostic check executed against the environment.

```json
{
  "id": "check_node_modules",
  "title": "Check Node.js dependencies installed",
  "category": "runtime",
  "status": "failed",
  "durationMs": 12,
  "evidence": [],
  "error": "node_modules does not exist"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique check identifier (e.g. `"check_node_modules"`). |
| `title` | `string` | Human-readable title of the check. |
| `category` | `string` | Category grouping (e.g. `"runtime"`, `"database"`, `"network"`). |
| `status` | `CheckStatus` | Execution outcome: `"passed"`, `"warning"`, `"failed"`, `"skipped"`, `"error"`. |
| `durationMs` | `number` | Time taken by check in milliseconds. |
| `evidence` | `Evidence[]` | Low-level evidence collected by this probe. |
| `error` | `string` (optional) | Error message if execution encountered an exception. |

---

### 3. `Finding`

Represents an identified environment issue synthesized from diagnostic checks.

```json
{
  "ruleId": "NODE_DEPS_NOT_INSTALLED",
  "title": "Dependencies not installed in node_modules",
  "category": "dependency",
  "severity": "high",
  "confidence": "confirmed",
  "status": "failed",
  "evidence": [],
  "possibleCauses": [
    "Fresh git clone before running package manager install"
  ],
  "recommendations": [
    {
      "problem": "Cannot run or test without installed dependencies",
      "relevance": "Required to execute application code",
      "commandOrAction": "npm install",
      "expectedResult": "node_modules created",
      "risks": "None",
      "verification": "test -d node_modules"
    }
  ],
  "verificationStatus": "unverified",
  "docs": [
    "https://docs.npmjs.com/cli/install"
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `ruleId` | `string` | Machine-readable rule ID (e.g. `"NODE_DEPS_NOT_INSTALLED"`). |
| `title` | `string` | Human-readable finding summary. |
| `category` | `string` | Diagnostic category. |
| `severity` | `Severity` | Severity level: `"critical"`, `"high"`, `"medium"`, `"low"`, `"info"`. |
| `confidence` | `Confidence` | Diagnostic confidence: `"confirmed"`, `"likely"`, `"possible"`. |
| `status` | `CheckStatus` | Associated check status (`"failed"` or `"warning"`). |
| `evidence` | `Evidence[]` | **OBSERVED FACTS ONLY**: raw collected outputs, sanitized of secrets. |
| `possibleCauses` | `string[]` | **HYPOTHESES ONLY**: potential causes based on diagnostic heuristics. |
| `recommendations` | `Recommendation[]` | Safe, verifiable remediation steps. |
| `verificationStatus` | `VerificationStatus` | Remediation verification status: `"unverified"`, `"verified"`, `"failed"`. |
| `docs` | `string[]` | Approved HTTPS documentation URLs. |

---

### 4. `Evidence`

Factual, uninterpreted probe observations.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique evidence entry ID. |
| `kind` | `string` | Type of evidence (`"file"`, `"command"`, `"network"`, `"filesystem"`). |
| `description` | `string` | Human summary of what was inspected. |
| `observed` | `string` | Exact observed output, exit code, or content (redacted). |
| `source` | `string` | Source command, file path, or probe target. |
| `collectedAt` | `string` (ISO 8601) | Collection timestamp. |

---

### 5. `Recommendation`

Concrete, safe, and verifiable remediation steps.

| Field | Type | Description |
|---|---|---|
| `problem` | `string` | Why this action is needed. |
| `relevance` | `string` | Impact on developer workflow. |
| `commandOrAction` | `string` | Command or concrete action to resolve the issue. |
| `expectedResult` | `string` | What success looks like. |
| `risks` | `string` | Any side effects or risks of running the action. |
| `undo` | `string` (optional) | Command to revert the action if applicable. |
| `verification` | `string` | Verification check to confirm resolution. |

---

### 6. `ReportSummary`

Summary counts for quick aggregation and CI evaluation.

| Field | Type | Description |
|---|---|---|
| `totalChecks` | `number` | Total number of diagnostic checks evaluated. |
| `totalFindings` | `number` | Total number of findings detected. |
| `bySeverity` | `Record<Severity, number>` | Count of findings per severity level (`critical`, `high`, `medium`, `low`, `info`). |
| `byStatus` | `Record<CheckStatus, number>` | Count of checks per status (`passed`, `warning`, `failed`, `skipped`, `error`). |

---

## Schema Change Policy & CHANGELOG

### Versioning Rules
1. **Never mutate existing fields without a major bump.**
2. **Never change the semantic meaning of enum values.**
3. **Always keep evidence (observed facts) strictly separated from possible causes (hypotheses).**

### CHANGELOG

#### `1.0.0` (2026-10-26)
- Initial stable report format specification.
- Added strict multi-tenant isolation, secret redaction, and deterministic finding ordering (`severity` descending, `ruleId` ascending).
