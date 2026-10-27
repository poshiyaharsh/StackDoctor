# StackDoctor

> Find the cause. Fix the environment. Ship the code.

StackDoctor is an open-source developer environment diagnostics and remediation tool designed to help developers identify and fix local configuration, dependency, runtime, and database issues with clear evidence and actionable remediation.

---

## Installation

Run directly with npx:
```bash
npx stackdoctor scan .
```

Or install globally:
```bash
npm install -g stackdoctor
stackdoctor scan .
```

---

## Quick Usage

```bash
# Scan current project
stackdoctor scan

# Scan specific folder
stackdoctor scan /path/to/project

# Interactive safe remediation
stackdoctor fix

# Generate sanitized GitHub issue draft
stackdoctor issue

# Output machine-readable JSON
stackdoctor scan --json

# CI mode with exit codes
stackdoctor scan --ci --fail-on high
```

---

## Documentation

Full documentation, architecture, security policies, and rule catalog are available at:
https://github.com/poshiyaharsh/StackDoctor#readme

---

## License

MIT © 2026 Harsh Poshiya and StackDoctor Contributors
