# Contributing to StackDoctor

Thank you for your interest in contributing to StackDoctor! StackDoctor's mission is:
> **"Find the cause. Fix the environment. Ship the code."**

This guide outlines how to build and contribute new diagnostic rules, improve existing analyzers, and adhere to our strict factual accuracy and privacy guidelines.

---

## Table of Contents
1. [Development Setup](#1-development-setup)
2. [Step-by-Step Rule Authoring](#2-step-by-step-rule-authoring)
3. [Evidence vs. Hypothesis Guide](#3-evidence-vs-hypothesis-guide)
4. [The "Never Overclaim" Checklist](#4-the-never-overclaim-checklist)
5. [Code Style & Best Practices](#5-code-style-best-practices)
6. [Documentation Guidelines & Allowlist](#6-documentation-guidelines-allowlist)
7. [Submitting a Pull Request](#7-submitting-a-pull-request)

---

## 1. Development Setup

StackDoctor is a TypeScript monorepo managed with npm workspaces.

```bash
# Clone the repository
git clone https://github.com/poshiyaharsh/StackDoctor.git
cd StackDoctor

# Install dependencies
npm install

# Run the complete test suite
npm test

# Run typechecking and linting
npm run typecheck
npm run lint

# Run diagnostic accuracy evaluation
npm run eval
```

---

## 2. Step-by-Step Rule Authoring

Adding a diagnostic rule follows a systematic, 6-step lifecycle.

### Step 1: Scaffold the Rule with the Generator

StackDoctor provides an automated generator to scaffold rule boilerplate, tests, and documentation stubs:

```bash
npm run new-rule -- --id <RULE_ID> --tech <tech>
```

- `--id <RULE_ID>`: Must be in strict `UPPER_SNAKE_CASE` (e.g. `NODE_MEMORY_LIMIT_EXCEEDED`, `DJANGO_DEBUG_ENABLED_PRODUCTION`).
- `--tech <tech>`: Target technology stack (`node`, `python`, `django`, `docker`, `mongodb`, `mysql`, `generic`).

This generates:
- `packages/rules/src/rules/<kebab-id>.ts`: The rule implementation file.
- `packages/rules/test/<kebab-id>.test.ts`: The unit test suite.
- `docs/diagnostics.md`: Catalog entry stub.

### Step 2: Implement Preconditions and Evaluation Logic

Open `packages/rules/src/rules/<kebab-id>.ts`. Define:

1. `preconditions(ctx)`: Lightweight guard check (e.g. `ctx.files.hasPackageJson`). Returns `false` to skip evaluation immediately if the technology is absent.
2. `evaluate(ctx)`: Analyzes observed context facts. Returns a `Finding` object if a diagnostic issue is confirmed, or `null` if the environment is healthy.

```typescript
import type { Finding } from "@stackdoctor/schemas";
import type { Rule, RuleEvaluationContext } from "../types.js";

export const myNewRule: Rule = {
  id: "MY_NEW_RULE",
  title: "Clear, factual title in sentence case",
  category: "dependencies",
  description: "Factual explanation of what triggers this finding.",
  technologies: ["Node.js"],
  severity: "high",
  confidence: "confirmed",
  requiredEvidence: ["file_presence"],
  recommendedChecks: [
    "Verify presence of package.json"
  ],
  remediation: [
    {
      problem: "Dependencies missing in node_modules.",
      relevance: "Runtime requires dependencies to resolve imports.",
      commandOrAction: "npm install",
      expectedResult: "node_modules is populated.",
      risks: "Network downloads; requires user approval.",
      undo: "rm -rf node_modules",
      verification: "test -d node_modules"
    }
  ],
  verification: "Verify that node_modules exists after installation.",
  docs: ["https://docs.npmjs.com/cli/v10/commands/npm-install"],

  preconditions(ctx: RuleEvaluationContext): boolean {
    return ctx.files.hasPackageJson;
  },

  evaluate(ctx: RuleEvaluationContext): Finding | null {
    if (ctx.files.hasPackageJson && !ctx.files.hasNodeModules) {
      return {
        ruleId: "MY_NEW_RULE",
        title: "Node.js dependencies not installed",
        category: "dependencies",
        severity: "high",
        confidence: "confirmed",
        status: "failed",
        evidence: [
          {
            id: "ev-my-rule-missing",
            kind: "file_presence",
            description: "Observed package.json without node_modules",
            observed: "package.json exists in root, but node_modules does not exist.",
            source: "filesystem",
            collectedAt: new Date().toISOString()
          }
        ],
        possibleCauses: [
          "The repository was cloned without running npm install.",
          "The node_modules directory was deleted."
        ],
        recommendations: [
          {
            problem: "Node.js dependencies are missing.",
            relevance: "Runtime imports cannot be resolved.",
            commandOrAction: "npm install",
            expectedResult: "node_modules directory is created.",
            risks: "Network download; requires user confirmation.",
            undo: "rm -rf node_modules",
            verification: "test -d node_modules"
          }
        ],
        verificationStatus: "unverified",
        docs: ["https://docs.npmjs.com/cli/v10/commands/npm-install"]
      };
    }
    return null;
  }
};
```

### Step 3: Register the Rule

Register your rule in `packages/rules/src/index.ts`:

1. Import the rule: `import { myNewRule } from "./rules/my-new-rule.js";`
2. Export the rule: `export * from "./rules/my-new-rule.js";`
3. Register in `createDefaultRuleRegistry()`:
   ```typescript
   registry.register(myNewRule);
   ```

### Step 4: Write Unit Tests

Ensure `packages/rules/test/<kebab-id>.test.ts` contains:
1. **Trigger Test**: Asserts finding is produced when preconditions and failure conditions are met.
2. **Schema Test**: Asserts `FindingSchema.safeParse(finding).success` is `true`.
3. **Non-Trigger Test**: Asserts `evaluate()` returns `null` on a healthy environment.
4. **Wording Test**: Verifies evidence contains only factual observations and no hypothesis words (`probably`, `might`, `seems`, etc.).

### Step 5: Document in `docs/diagnostics.md`

Update the entry stub in `docs/diagnostics.md` with:
- Preconditions
- Observed Evidence (Facts)
- Possible Causes (Hypotheses)
- Remediation (Command, Risks, Undo)
- Verification command or check
- Official documentation link

### Step 6: Verify and Lint

```bash
# Run rule linter
npx vitest run packages/rules/test/rule-lint.test.ts

# Run the complete test suite
npm test

# Run accuracy evaluation
npm run eval
```

---

## 3. Evidence vs. Hypothesis Guide

A cornerstone of StackDoctor's design is the **strict separation between Evidence (Facts) and Hypotheses (Causes)**.

### What is Evidence?
Evidence represents raw, objective measurements collected directly from the filesystem, processes, network probes, or exit codes.
- **Rule**: Evidence must be 100% factual and observable.
- **Rule**: Evidence MUST NEVER contain subjective interpretations or hypothesis wording.
- **Forbidden words in Evidence**: `probably`, `might`, `seems`, `maybe`, `could be`, `likely`, `possibly`.

### What is a Hypothesis?
Hypotheses belong exclusively in `possibleCauses`. They represent potential explanations for why the observed evidence occurred.

| Component | Purpose | Permitted Tone | Example |
|---|---|---|---|
| `evidence.observed` | Raw observation | Strictly factual | `"Port 5432 returned ECONNREFUSED within 200ms."` |
| `possibleCauses` | Plausible root causes | Probabilistic / Advisory | `"PostgreSQL service is stopped or not running on port 5432."` |
| `recommendations` | Concrete action steps | Actionable & safe | `commandOrAction: "docker compose up -d db"` |
| `verification` | Proof of resolution | Verifiable check | `"nc -zv 127.0.0.1 5432"` or `"test -d node_modules"` |

---

## 4. The "Never Overclaim" Checklist

Diagnostic tools lose developer trust when they make unverified assumptions or destructive suggestions. Every rule MUST adhere to this checklist:

- [ ] **Never claim a service is dead when a network probe simply timed out.**
  - *Bad*: "Postgres database crashed."
  - *Good*: "TCP connection to localhost:5432 timed out after 3000ms. Service may be starting, firewalled, or stopped."
- [ ] **Never suggest destructive commands without explicit undo steps.**
  - *Bad*: `rm -rf *`
  - *Good*: `rm -rf node_modules` with undo `git checkout node_modules` or `npm install`.
- [ ] **Never output unredacted secrets or machine identifiers.**
  - All passwords, tokens, API keys, home directories, usernames, and hostnames must be redacted.
- [ ] **Never invent documentation links.**
  - Documentation links must come strictly from the official allowlist (`nodejs.org`, `python.org`, `djangoproject.com`, `docker.com`, etc.).
- [ ] **Never run untrusted user code during evaluation.**
  - Preconditions and evaluation should inspect file metadata and safe static markers, not arbitrary script execution.

### Good vs. Bad Examples

#### 1. Rule Identification
- **Bad**: `nodeDepsRule`, `check_node`, `NodeMissingDeps`
- **Good**: `NODE_DEPS_NOT_INSTALLED`, `PORT_IN_USE`, `MONGO_AUTH_FAILED`

#### 2. Evidence
- **Bad**: `"It seems that the developer forgot to run npm install because node_modules is missing."`
- **Good**: `"package.json exists in project root, but node_modules does not exist."`

#### 3. Possible Causes
- **Bad**: `"The computer is broken."`
- **Good**: `"The repository was recently cloned without installing dependencies."`

#### 4. Remediation
- **Bad**: `kill -9 $(lsof -t -i:3000)` (risks killing unintended processes without checking PID identity)
- **Good**: `kill <PID>` with problem, relevance, risks, undo, and verification explained.

---

## 5. Code Style & Best Practices

1. **TypeScript Strictness**:
   - Use TypeScript `5.7+` strict mode.
   - Do not use `any`. Use unknown or explicit Zod-inferred types.
   - All exported functions and interfaces must have explicit return types.
2. **Deterministic Behavior**:
   - Diagnostic findings must be ordered deterministically (`sortFindingsDeterministically` in `@stackdoctor/core`).
   - Do not rely on unstable filesystem iteration order without sorting.
3. **Immutability**:
   - Treat `RuleEvaluationContext` as read-only.
   - Do not mutate global state or modify project files during rule evaluation.

---

## 6. Documentation Guidelines & Allowlist

To protect users against phishing and broken links, documentation references are strictly validated against an HTTPS domain allowlist:

- `nodejs.org`
- `python.org`
- `pip.pypa.io`
- `pypa.io`
- `djangoproject.com`
- `mongodb.com`
- `mysql.com`
- `docker.com`
- `npmjs.com`
- `12factor.net`
- `github.com`
- `stackdoctor.dev`

Any rule containing an HTTP link or a non-allowlisted domain will be rejected by schema and rule-lint validation.

---

## 7. Submitting a Pull Request

Before submitting your PR:
1. Ensure all tests pass: `npm test`
2. Ensure linting passes: `npm run lint`
3. Ensure typecheck passes: `npm run typecheck`
4. Ensure rule linter passes: `npx vitest run packages/rules/test/rule-lint.test.ts`
5. Ensure eval benchmark maintains 100% detection: `npm run eval`
6. Fill out the pull request template completely.
