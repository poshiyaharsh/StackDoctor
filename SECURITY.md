# Security Policy

StackDoctor takes the security of developer environments, credential handling, and diagnostics execution seriously. This policy outlines supported versions, reporting procedures, and security scope.

---

## Supported Versions

Only the latest active minor release receives security updates and vulnerability patches.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security issues privately using one of the following methods:

1. **GitHub Private Vulnerability Advisory (Recommended)**:
   Navigate to the repository's **Security** tab -> **Advisories** -> **Report a vulnerability**, or use the direct link:
   <!-- PLACEHOLDER_MAINTAINER_ADVISORY_URL: Fill in repository advisory URL -->
   `https://github.com/poshiyaharsh/StackDoctor/security/advisories/new`

2. **Security Contact Email**:
   <!-- PLACEHOLDER_SECURITY_EMAIL: Fill in maintainer private security email -->
   Send an encrypted or plain email to: `harshposhiya92@gmail.com` with subject line `[SECURITY] StackDoctor Vulnerability Report`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please include:
- Description of the vulnerability and its potential security impact.
- Affected component(s) (e.g. `apps/cli`, `packages/core`, `apps/api`, `packages/ai`).
- Clear, step-by-step proof-of-concept (PoC) or reproduction script.
- Operating system, Node.js version, and StackDoctor version.
- Any proposed remediation, patch, or mitigation if available.

### Response Timelines & Goals

Security reports are triaged by project maintainers with the following target response goals (stated as goals, not contractual guarantees):
- **Initial acknowledgment**: Within 48 hours of receipt.
- **Triage & severity assessment**: Within 5 business days.
- **Fix development & validation**: Dependent on severity (aiming for within 14 days for high/critical findings).
- **Security Release**: Coordinated with the reporter before public disclosure.

---

## Disclosure Policy

- StackDoctor follows **coordinated vulnerability disclosure**.
- We request that reporters keep vulnerability details confidential until a fix has been released and a public security advisory published.
- Security advisories will credit the finder unless anonymity is requested.

---

## Scope

### In Scope
- Secret leakage or failure in credential sanitization (`packages/core/src/redact.ts`, `apps/cli/src/collector.ts`).
- Command injection or unsafe process execution outside allowlists (`packages/adapters`, `packages/ai/src/remediation.ts`).
- Prompt injection bypasses that trick AI into disclosing canary secrets or system instructions (`packages/ai`).
- Authentication or authorization flaws in the API server (`apps/api`).
- Arbitrary file writes, traversal, or code execution during scanning or reporting.

### Out of Scope
- Vulnerabilities requiring root/physical access to the user's local machine.
- Social engineering attacks against maintainers or contributors.
- Denial of Service (DoS) attacks on self-hosted local development instances.
- Vulnerabilities in third-party runtime dependencies that are already tracked by public CVEs unless a viable exploit vector exists in StackDoctor itself.
