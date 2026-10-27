# StackDoctor Demo Script & Recording Guide

This document provides a scene-by-scene director's script for a 2-3 minute screen recording of StackDoctor v0.1.0 using real repository fixtures. It includes terminal styling recommendations, commands to type, narration lines, and instructions for capturing the demo with free tools ([VHS](https://github.com/charmbracelet/vhs) or [asciinema](https://asciinema.org/)).

---

## 1. Recording Setup & Recommendations

### Terminal Configuration
- **Terminal**: Alacritty, iTerm2, WezTerm, or Windows Terminal.
- **Font**: JetBrains Mono, Fira Code, or SF Mono (Size: 16pt or 18pt for crisp readability at 1080p).
- **Theme**: High-contrast dark theme (e.g., Catppuccin Mocha, Tokyo Night, or Dracula).
- **Dimensions**: 120 columns x 36 rows (aspect ratio ~ 16:9).
- **Prompt**: Clean, minimal prompt (e.g. `❯ ` or `~/dev/broken-node-project $`).

### Repeatable Demo Reset
Before starting or between takes, reset the fixture environment:
```bash
node scripts/demo-reset.js
```

---

## 2. Scene-by-Scene Director's Script

### Scene 1: The Broken State (0:00 - 0:30)
- **Setting**: You just cloned an onboarding project or switched branches, and the app refuses to run.
- **Action**:
  ```bash
  cd examples/broken-node-project
  npm start
  ```
- **On-Screen Result**:
  Terminal prints a crash stack trace (`Error: Cannot find module 'express'`).
- **Narration Line**:
  > *"We've all been there: you clone a project, run start, and hit a confusing error. Is it missing packages? An incompatible Node version? Missing environment keys? Instead of guessing or searching forums, let's run StackDoctor."*

---

### Scene 2: The Diagnostic Scan (0:30 - 1:15)
- **Action**:
  ```bash
  npx stackdoctor scan
  ```
- **On-Screen Result**:
  StackDoctor's terminal report prints instantly (under 20ms).
  - Highlights 4 findings (Missing dependencies, Node version mismatch, missing .env keys, missing lockfile).
  - Highlights **OBSERVED (Facts Only)**: `package.json exists, but node_modules does not exist`, `PORT, DATABASE_URL, SESSION_SECRET missing from .env`.
  - Highlights **POSSIBLE (Probable Causes)** without confusing facts and hypotheses.
- **Narration Line**:
  > *"In less than twenty milliseconds, StackDoctor audits the environment 100% offline. Notice how it strictly separates observed evidence from possible causes. It doesn't make assumptions—it shows verified facts, from missing .env variables to runtime version discrepancies."*

---

### Scene 3: Actionable Remediation (1:15 - 1:55)
- **Setting**: The Recommended Next Steps section.
- **Action**:
  Point out or scroll down to the Recommended Next Steps:
  1. Add missing keys to `.env`.
  2. Run `npm install`.
  3. Install correct Node version.
- **Action**: Execute the safe fixes:
  ```bash
  # Copy missing keys from template
  echo "PORT=3000" >> .env
  echo "DATABASE_URL=postgres://localhost:5432/dev" >> .env
  echo "SESSION_SECRET=dev-secret-key" >> .env

  # Install packages
  npm install
  ```
- **Narration Line**:
  > *"Every single recommendation includes an explanation, expected result, risk assessment, verification command, and undo instructions. StackDoctor never makes destructive changes behind your back; you remain in total control."*

---

### Scene 4: Verification Scan (1:55 - 2:20)
- **Action**:
  ```bash
  npx stackdoctor scan
  ```
- **On-Screen Result**:
  The report shows unresolved issues resolved or down to only the Node version check.
- **Narration Line**:
  > *"A quick re-scan confirms the environment state. The missing dependency and configuration findings have cleared."*

---

### Scene 5: Offline Issue Drafting & CI Mode (2:20 - 2:45)
- **Action**:
  ```bash
  npx stackdoctor scan --ci --fail-on high
  ```
- **On-Screen Result**:
  Exits cleanly with deterministic exit code (0 or 1 depending on threshold).
- **Action**:
  ```bash
  npx stackdoctor issue .
  ```
- **On-Screen Result**:
  Prints a GitHub Issue draft formatted in Markdown with system facts and redacted secrets.
- **Narration Line**:
  > *"StackDoctor also integrates directly into CI pipelines with machine-readable exit codes, and can generate sanitized, shareable GitHub issue drafts with zero telemetry or network calls. Give it a spin with npx stackdoctor scan!"*

---

## 3. Automated Recording with VHS

We provide a ready-to-run [VHS](https://github.com/charmbracelet/vhs) tape file (`docs/demo/demo.tape`). VHS allows programmatic recording of terminal sessions directly into `.gif` or `.mp4` without human timing errors.

### Prerequisites
Install VHS:
```bash
# macOS / Linux
brew install charmbracelet/vhs/vhs

# Windows (via scoop or winget)
scoop install vhs
```

### Run Recording
```bash
# Reset environment
node scripts/demo-reset.js

# Record demo GIF
vhs docs/demo/demo.tape
```
This generates `docs/demo/stackdoctor-demo.gif`.
