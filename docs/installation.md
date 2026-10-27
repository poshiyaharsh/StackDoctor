# Installation & Platform Guide

StackDoctor provides multiple installation methods tailored for local developer use, CI/CD runners, and enterprise development environments.

---

## 1. Quick Start (No Install Needed)

You can run StackDoctor immediately using `npx`:

```bash
# Run a diagnostic scan in current directory
npx @harshposhiya/stackdoctor scan .

# Run diagnostic scan with JSON output
npx @harshposhiya/stackdoctor scan . --json
```

---

## 2. Global Installation via npm

For daily local usage across multiple projects, install StackDoctor globally:

```bash
npm install -g @harshposhiya/stackdoctor
```

Verify installation:
```bash
stackdoctor --version
stackdoctor --help
```

---

## 3. Install from Source (Contributors)

```bash
# Clone the repository
git clone https://github.com/poshiyaharsh/StackDoctor.git
cd StackDoctor

# Install monorepo dependencies
npm install

# Build all TypeScript packages & bundle CLI
npm run build

# Link CLI globally into your local npm prefix
npm link --workspace apps/cli

# Verify local link
stackdoctor --version
```

---

## 4. Supported Platform Matrix

StackDoctor is tested across Windows, Linux, and macOS on Node 20.x and 22.x. Diagnostic checks degrade gracefully when a platform utility is unavailable:

| Diagnostic Feature | Windows | Linux | macOS | Fallback Behavior When Tool / OS Restricted |
|---|---|---|---|---|
| **Safe Process Runner (`runCommand`)** | ✅ Direct `.exe` lookup (no `shell: true`) | ✅ Direct binary lookup (`execFile`) | ✅ Direct binary lookup (`execFile`) | Disallowed executables rejected before spawn; missing binary returns `notFound: true`. |
| **Port Probing (`checkPort`)** | ✅ Non-intrusive TCP socket | ✅ Non-intrusive TCP socket | ✅ Non-intrusive TCP socket | Validates port range 1-65535; never signals or kills processes. |
| **Process Ownership on Port Conflict** | ✅ `netstat -ano` / `Get-NetTCPConnection` | ✅ `ss -tlpn` / `lsof -iTCP` | ✅ `lsof -iTCP -sTCP:LISTEN -n -P` | Missing utility or permission denied: marks `conclusive: false`, states "owning process could not be identified". |
| **Node.js Engine Verification** | ✅ `node -v` | ✅ `node -v` | ✅ `node -v` | Missing runtime: returns `status: "failed"` with clear remedial advice. |
| **Package Managers (`npm`, `pnpm`, `yarn`)** | ✅ PATH lookup | ✅ PATH lookup | ✅ PATH lookup | Uninstalled manager: degrades to `status: "skipped"` with explanation. |
| **Python Virtual Environment (`venv`)** | ✅ `.venv\Scripts\python.exe` / `VIRTUAL_ENV` | ✅ `.venv/bin/python` / `VIRTUAL_ENV` | ✅ `.venv/bin/python` / `VIRTUAL_ENV` | No venv found: triggers `PYTHON_VENV_MISSING` rule. |
| **Python Package Dependencies** | ✅ `python -m pip list --format=json` | ✅ `python -m pip list --format=json` | ✅ `python -m pip list --format=json` | No python/pip: marks check `status: "skipped"`, does not crash. |
| **Django Settings Discovery** | ✅ Static AST / regex parsing | ✅ Static AST / regex parsing | ✅ Static AST / regex parsing | Never executes project code; safe on all operating systems. |
| **Django Pending Migrations** | 🛡️ Gated behind `--allow-project-code` | 🛡️ Gated behind `--allow-project-code` | 🛡️ Gated behind `--allow-project-code` | Without flag: reported as `"skipped: requires running project code; use --allow-project-code"`. |
| **Docker Compose Services** | ✅ Static YAML parsing + docker query | ✅ Static YAML parsing + docker query | ✅ Static YAML parsing + docker query | Malformed YAML handled safely; missing compose reports status cleanly. |
| **Database Diagnostics (Stage 1 DNS)** | ✅ `dns.promises.lookup` | ✅ `dns.promises.lookup` | ✅ `dns.promises.lookup` | Fails with `dns_failure`; subsequent stages skipped. |
| **Database Diagnostics (Stage 2 TCP)** | ✅ `net.Socket` non-intrusive connect | ✅ `net.Socket` non-intrusive connect | ✅ `net.Socket` non-intrusive connect | Fails with `connection_refused` or `timeout`; never claims uninstalled. |
| **Database Diagnostics (Stage 3 Auth)** | 🛡️ Gated behind `--db-url-env <VAR>` | 🛡️ Gated behind `--db-url-env <VAR>` | 🛡️ Gated behind `--db-url-env <VAR>` | Read-only no-op ping (`admin.ping`, `SELECT 1`). Passwords never logged. |

---

## 5. Troubleshooting & FAQ

### Issue: `stackdoctor: command not found` (or `'stackdoctor' is not recognized`)
- **Cause**: The global npm bin directory is not in your system `$PATH` (`%PATH%`).
- **Fix**:
  - Run `npm bin -g` (or `npm prefix -g`) to locate your global npm directory.
  - On Linux/macOS, add `export PATH="$(npm prefix -g)/bin:$PATH"` to your `~/.bashrc` or `~/.zshrc`.
  - On Windows, ensure `%APPDATA%\npm` is listed in your User `Path` environment variables.
  - Alternatively, run via `npx stackdoctor scan`.

### Issue: Windows PowerShell Execution Policy Error
- **Error**: `File C:\Users\...\stackdoctor.ps1 cannot be loaded because running scripts is disabled on this system.`
- **Cause**: Windows PowerShell default execution policy restricts unsigned local scripts.
- **Fix**: In PowerShell (run as Administrator or current user), execute:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
  ```

### Issue: Node Version Too Old (`engines.node: >=20.0.0`)
- **Error**: `Node.js version is incompatible. Requires node >= 20.0.0.`
- **Cause**: StackDoctor relies on modern Node features (native `fetch`, Web Crypto, structured clone).
- **Fix**: Upgrade Node using `nvm` or your preferred version manager:
  ```bash
  nvm install 22
  nvm use 22
  ```

### Issue: Permission Denied (`EACCES: permission denied`)
- **Cause**: Attempting global `npm install -g` into root-owned directories (`/usr/local`).
- **Fix**: Configure npm to use a directory in your home directory:
  ```bash
  mkdir ~/.npm-global
  npm config set prefix '~/.npm-global'
  export PATH=~/.npm-global/bin:$PATH
  npm install -g stackdoctor
  ```

### Issue: Corporate Proxy / Self-Signed SSL Certificates
- **Cause**: Network interception by corporate proxy blocking outgoing AI or HTTP checks.
- **Fix**: Configure standard proxy environment variables:
  ```bash
  export HTTPS_PROXY=http://proxy.corporate.internal:8080
  export NODE_EXTRA_CA_CERTS=/path/to/corporate-root-ca.crt
  ```

### Issue: Antivirus False Positives
- **Cause**: StackDoctor scans for configuration files, open ports, and potential canary secret tokens in files.
- **Fix**: StackDoctor operates strictly in read-only mode by default (it does not modify files or execute arbitrary shell strings). Add an exclusion for the repository folder in Windows Defender or your endpoint security agent if file read scanning causes delays.
