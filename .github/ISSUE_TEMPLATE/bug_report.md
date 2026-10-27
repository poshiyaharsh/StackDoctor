---
name: Bug report
about: Create a report to help us improve StackDoctor
title: '[BUG] '
labels: bug
assignees: ''
---

### Generate a Sanitized Issue Draft (Recommended)

If this bug relates to a project scan, rule trigger, or diagnostic report, StackDoctor can automatically generate a sanitized GitHub issue draft offline:

```bash
# Generate issue draft to terminal
stackdoctor issue .

# Or copy directly to your clipboard
stackdoctor issue . --copy
```

*(StackDoctor operates 100% offline and automatically redacts all secrets, passwords, usernames, hostnames, and machine paths).*

---

### Describe the Bug

A clear and concise description of what the bug is.

### Steps to Reproduce

1. Run command: `stackdoctor ...`
2. In project: `...`
3. See error: `...`

### Expected Behavior

A clear and concise description of what you expected to happen.

### Actual Behavior / Output

```text
Paste terminal output or error log here
```

### Environment Information

- StackDoctor version (`stackdoctor -v`):
- Node.js version (`node -v`):
- OS / Platform (`Windows`, `macOS`, `Linux`):
- Terminal / Shell (`bash`, `zsh`, `PowerShell`):

### Additional Context

Add any other context about the problem here.
