# StackDoctor False Positive Policy

In developer tooling, **false positives are the single most destructive failure mode**. When a linter, compiler, or diagnostic tool cries wolf on a healthy codebase, developers lose confidence and disable the tool entirely.

StackDoctor's core design commitment is:
> **0.0% False Positive Rate on Healthy Environments.**
> Verified facts take precedence over speculative theories.

---

## 1. What Qualifies as a False Positive?

A false positive occurs when:
1. StackDoctor produces a `high` or `critical` severity finding on a local environment that compiles, boots, and operates normally.
2. An `OBSERVED` evidence string makes an assertion that is factually false (e.g. claiming a port is in use when no process is listening).
3. A recommendation suggests a destructive or unnecessary fix that could break a functioning setup.

---

## 2. The 5-Step False Positive Response Procedure

When a false positive is reported:

### Step 1: Immediate Acknowledgment & Logging
- Validate that the issue contains no confidential secrets or tokens.
- Add an entry to [FEEDBACK.md](../FEEDBACK.md) with category `false_positive`.
- Apply the GitHub label `type: false-positive` and prioritize it as P1.

### Step 2: Isolated Reproduction
- Isolate the edge case that deceived the rule's preconditions or detector.
- Common causes of false positives:
  - Custom environment loaders or non-standard configuration filenames.
  - Multi-interface socket bindings (e.g., IPv4 `127.0.0.1` vs IPv6 `::1`).
  - Container-internal DNS names evaluated outside the bridge network.
  - Development tools or daemons using transient ephemeral ports.

### Step 3: Create Synthetic Regression Fixture
- Create a minimal fixture under `examples/regressions/<FB-id>-<slug>/`.
- Define an `expected.json` with `[]` (asserting zero findings on this healthy structure).
- Add the fixture to the evaluation suite in `scripts/eval.js`.

### Step 4: Fix or Downgrade the Rule
- **Preferred Resolution**: Strengthen preconditions or fact gathering so the rule accurately recognizes the healthy state.
- **Interim Downgrade**: If an immediate factual check is technically infeasible across all platforms, downgrade the rule's default confidence from `confirmed` to `possible`, or downgrade its default severity from `high` to `low`/`info`.

### Step 5: Document and Publish
- Add an explicit entry in `CHANGELOG.md` under the next patch version (`v0.1.x`).
- Re-run `npm run eval` to verify the accuracy metric remains at 100.0% and the false positive rate is 0.0%.
- Close the issue with a link to the merged PR and regression test.
