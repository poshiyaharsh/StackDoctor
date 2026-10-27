# Privacy Policy & Data Guarantees

StackDoctor is designed with privacy and local security as core architectural principles.

---

## 1. Core Principle: 100% Offline by Default

When you run `stackdoctor scan`:
- **Nothing leaves your machine.**
- No telemetry, analytics, tracking, or network telemetry pings are sent.
- No network requests are made unless explicitly requested by specific opt-in flags (e.g. `--db-url-env` for database TCP pinging or AI explanation commands).

---

## 2. What Is Examined Locally

During a local scan, StackDoctor reads and collects only the minimum operational metadata necessary to evaluate diagnostic rules:
- **Environment Metadata**: Operating system type (`win32`, `linux`, `darwin`), Node.js runtime version, Python runtime version.
- **Project Structure**: Presence of configuration files (`package.json`, `requirements.txt`, `docker-compose.yml`, `.env.example`).
- **Configuration Variable Names**: Key names only from `.env` and `.env.example` (e.g. `PORT`, `DATABASE_URL`).
- **Network Ports**: Local TCP port binding availability on `127.0.0.1` and owning process PID/name (if permitted by the OS).
- **Installed Package Names & Versions**: Extracted from `package.json` or `pip list` to diagnose dependency drift.

---

## 3. What Is NEVER Collected, Stored, or Transmitted

StackDoctor enforces strict automated redaction filters (`packages/core/src/redact.ts`):
- **Secret Values**: Passwords, API tokens, JWTs, AWS credentials, and private keys are **automatically redacted** to `[REDACTED]` or masked.
- **Environment Variable Values**: `.env` values are never stored in diagnostic reports or transmitted. Only variable *names* are compared.
- **Application Source Code**: Business logic, JavaScript/TypeScript code, Python files, and proprietary application algorithms are never read into reports.
- **Database Contents**: Table data, collections, and records are never queried. Authenticated checks only run ping commands (`admin.ping`, `SELECT 1`).
- **Customer Data**: No end-user data or application runtime state is inspected.

---

## 4. What Leaves the Machine and When

Data only leaves your machine in two explicit, user-initiated actions:

### A. Report Upload (`stackdoctor upload`)
- **Trigger**: Only when you explicitly run `stackdoctor upload` and answer `y` to the interactive consent preview.
- **Payload**: The sanitized JSON diagnostic report containing finding IDs, titles, observed facts, and recommendations.
- **Destination**: The StackDoctor server you configured (defaults to your self-hosted instance).

### B. AI Explanations (`stackdoctor ai-explain` or Web BYOK)
- **Trigger**: Only when you explicitly request an AI explanation and consent to sending sanitized findings.
- **Payload**: Strictly filtered, size-capped JSON findings and observed facts. Prompt injection guards sanitize untrusted input before transmission.
- **Destination**: Your chosen provider (OpenAI, Anthropic) or your local offline Ollama daemon (`http://localhost:11434`).

---

## 5. Web Platform Retention & Deletion

For users of the optional self-hosted Web Dashboard & API platform:
- **Data Retention**: Diagnostic reports can be configured to expire automatically after a set retention window (e.g. 7, 30, or 90 days).
- **Deletion**: Users can delete individual reports or wipe all project diagnostic history at any time from the Web Dashboard (**Settings** -> **Danger Zone** -> **Delete All Reports**).
- **Account Deletion**: Deleting an account permanently purges all associated projects, reports, API tokens, and BYOK credentials from the database.
