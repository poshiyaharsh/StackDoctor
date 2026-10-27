# GitHub Repository Settings & Metadata Recommendations

This document contains recommendations for the GitHub repository settings (About description, topics, social preview metadata) for the repository maintainer to configure manually in the GitHub web interface.

---

## 1. Repository "About" Section

- **Description (under 350 chars)**:
  `Self-healing diagnostic engine for local web development stacks. Deterministic, evidence-first, 100% offline developer environment troubleshooting with actionable remediation.`
- **Website**:
  `https://github.com/poshiyaharsh/StackDoctor#readme`
- **Include in home page**:
  - [x] Releases
  - [x] Packages
  - [ ] Environments (optional)

---

## 2. GitHub Topics (Tags)

Copy and paste these exact tags into the repository's **Topics** field:

```text
developer-tools
diagnostics
developer-experience
cli
troubleshooting
nodejs
docker
docker-compose
django
mongodb
mysql
self-healing
devtools
offline-first
zero-telemetry
```

---

## 3. Social Preview Card (Open Graph Image)

For the GitHub Social Preview card (1280 x 640 px PNG or JPG):

- **Headline Text**: `StackDoctor`
- **Sub-headline Text**: `Find the cause. Fix the environment. Ship the code.`
- **Badge / Feature Pills**:
  - `Deterministic Rules`
  - `Evidence vs. Hypotheses`
  - `100% Offline & Private`
  - `MIT Licensed`
- **Terminal Snippet Graphic**:
  Include a clean terminal window rendering the `broken-node-project` scan finding:
  ```text
  [FAIL] [ENV_VAR_NAMES_MISSING] 3 environment variable name(s) missing from .env
  [FAIL] [NODE_DEPS_NOT_INSTALLED] Node.js dependencies not installed
  ```
- **Background**: Dark theme (`#0d1117` or `#1e1e2e`) with high contrast text.
