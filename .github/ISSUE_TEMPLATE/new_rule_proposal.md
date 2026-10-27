---
name: New Rule Proposal
about: Propose a new diagnostic rule for StackDoctor
title: '[RULE PROPOSAL] '
labels: enhancement, rule-proposal
assignees: ''
---

### Proposed Rule Identifier
<!-- Must be in UPPER_SNAKE_CASE, e.g. PYTHON_CIRCULAR_IMPORT, DOCKER_DAEMON_NOT_RUNNING -->
`MY_RULE_ID`

### Target Technology
<!-- Node.js, Python, Django, Docker, MongoDB, MySQL, etc. -->

### Problem Statement
<!-- What developer environment failure does this detect? When does it happen? -->

### Objective Evidence to Observe (Facts Only)
<!-- What exact file, process, network port, or exit code state can be observed on disk?
Note: Evidence must NOT contain subjective speculation. -->
- 

### Possible Causes (Hypotheses)
<!-- What are the common reasons this state occurs? -->
1. 
2. 

### Proposed Remediation
- **Command / Action**: `...`
- **Relevance**: Why does this action address the problem?
- **Risks**: Any potential side-effects or network requirements?
- **Undo**: How to revert this action if needed?
- **Verification**: How can the developer verify that the problem is fixed?

### Official Documentation Reference
<!-- Must be an HTTPS link from official documentation domains (e.g. nodejs.org, python.org, djangoproject.com, docker.com, etc.) -->
- `https://...`
