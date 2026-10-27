---
name: False Positive Report
about: Report a diagnostic finding triggered incorrectly on a healthy project
title: '[FALSE POSITIVE] '
labels: bug, false-positive
assignees: ''
---

### Triggered Rule Identifier
<!-- e.g. PORT_IN_USE, LOCKFILE_MISSING, DB_HOST_NOT_RESOLVED -->
`RULE_ID`

### Context & Project Setup
<!-- Describe your project structure, frameworks, or environment configuration -->

### Why is this a False Positive?
<!-- Why is the flagged condition actually expected or safe in your project? -->

### Observed Evidence
<!-- Paste the evidence block from `stackdoctor scan` or `stackdoctor issue` -->
```text
```

### Steps to Reproduce
1. In a project with:
2. Run: `stackdoctor scan`
3. Observe finding: `...`

### Expected Behavior
<!-- e.g. Rule preconditions should check for custom config X, or finding should not trigger when Y -->

### Potential Fix / Suggestions
<!-- If you have an idea of how the rule preconditions or evaluation could be refined -->
