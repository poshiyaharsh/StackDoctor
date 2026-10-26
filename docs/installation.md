# Installation & Platform Matrix

## Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

## Getting Started

```bash
# Clone the repository
git clone https://github.com/poshiyaharsh/StackDoctor.git
cd StackDoctor

# Install dependencies
npm install

# Build the monorepo packages
npm run build

# Link the CLI locally
npm link --workspace apps/cli
```

Once linked, the `stackdoctor` command is available in your shell:

```bash
# Scan and diagnose target directory
stackdoctor scan [path]

# List all available diagnostic rules
stackdoctor rules
```

---

## Platform Support Matrix

StackDoctor is designed to be cross-platform, running seamlessly on Windows, Linux, and macOS without requiring elevated privileges. When platform-specific diagnostic utilities are not present or access is restricted, checks degrade gracefully to `"skipped"` or report honest uncertainty (`"not conclusive"`).

| Diagnostic Check / Feature | Windows | Linux | macOS | Fallback Behavior When Tool / OS Unsupported |
|----------------------------|---------|-------|-------|---------------------------------------------|
| **Safe Process Runner (`runCommand`)** | ✅ Fully supported (`cmd.exe` bypassed; direct `.exe` lookup) | ✅ Fully supported (`execFile`) | ✅ Fully supported (`execFile`) | Disallowed executables rejected before spawn; missing binary returns `notFound: true`. |
| **Port Availability (`checkPort`)** | ✅ Non-intrusive TCP socket | ✅ Non-intrusive TCP socket | ✅ Non-intrusive TCP socket | Validates port range 1-65535; never signals or kills processes. |
| **Process Identification on Port Conflict** | ✅ `netstat -ano` (`Get-NetTCPConnection` fallback) | ✅ `ss -tlpn` (`lsof -iTCP` fallback) | ✅ `lsof -iTCP -sTCP:LISTEN -n -P` | Missing utility or permission denied: marks `conclusive: false`, states "owning process could not be identified". |
| **Node.js Runtime & Engine Satisfaction** | ✅ `node -v` | ✅ `node -v` | ✅ `node -v` | Missing runtime: returns `status: "failed"` with clear remedial advice. |
| **Package Managers (`npm`, `pnpm`, `yarn`)** | ✅ Tested via PATH lookup | ✅ Tested via PATH lookup | ✅ Tested via PATH lookup | Uninstalled manager: degrades to `status: "skipped"` with reason. |
| **Python Virtual Environment (`venv`)** | ✅ `.venv\Scripts\python.exe` / `VIRTUAL_ENV` | ✅ `.venv/bin/python` / `VIRTUAL_ENV` | ✅ `.venv/bin/python` / `VIRTUAL_ENV` | No venv found: triggers `PYTHON_VENV_MISSING` rule. |
| **Python Package Dependencies** | ✅ `python -m pip list --format=json` | ✅ `python -m pip list --format=json` | ✅ `python -m pip list --format=json` | No python/pip: marks check `status: "skipped"`, does not crash. |
| **Django Settings Discovery** | ✅ Static AST / regex parsing | ✅ Static AST / regex parsing | ✅ Static AST / regex parsing | Never executes project code; safe on all operating systems. |
| **Django Pending Migrations** | 🛡️ Gated behind `--allow-project-code` | 🛡️ Gated behind `--allow-project-code` | 🛡️ Gated behind `--allow-project-code` | Without flag: reported as `"skipped: requires running project code; use --allow-project-code"`. |
| **Docker & Docker Compose Inspection** | ✅ Static YAML parsing + docker query | ✅ Static YAML parsing + docker query | ✅ Static YAML parsing + docker query | Malformed YAML handled safely; missing compose reports status cleanly. |
| **Database Diagnostics (Stage 1 DNS)** | ✅ `dns.promises.lookup` | ✅ `dns.promises.lookup` | ✅ `dns.promises.lookup` | Fails with `dns_failure`; subsequent stages skipped. |
| **Database Diagnostics (Stage 2 TCP)** | ✅ `net.Socket` non-intrusive connect | ✅ `net.Socket` non-intrusive connect | ✅ `net.Socket` non-intrusive connect | Fails with `connection_refused` or `timeout`; never claims uninstalled. |
| **Database Diagnostics (Stage 3 Auth)** | 🛡️ Gated behind `--db-url-env <VAR>` | 🛡️ Gated behind `--db-url-env <VAR>` | 🛡️ Gated behind `--db-url-env <VAR>` | Read-only no-op ping (`admin.ping`, `SELECT 1`). Passwords never logged. |
