# Frequently Asked Questions (FAQ)

Honest, transparent answers about what StackDoctor does, what it does not do, and the engineering principles behind it.

---

### What does StackDoctor NOT do?
- **Not a linter**: It does not analyze code syntax, stylistic conventions, or static types. (Use ESLint, Prettier, or Ruff for that).
- **Not a runtime debugger**: It does not step through application code, inspect variables in memory, or attach to running processes.
- **Not an auto-magical fixer**: It will **never** automatically run `npm install`, delete files, kill processes, or modify your database without your explicit review and typed approval.
- **Not an APM / Profiler**: It does not measure runtime latency, query execution times, or memory leaks.

---

### Why doesn't a refused TCP connection prove that a database is "not installed"?
A common fallacy in diagnostic tools is claiming *"MongoDB is not installed"* when a connection to `localhost:27017` is refused (`ECONNREFUSED`).

In reality, a connection refusal only proves one thing: **nothing is currently listening on that specific host and port**.
Possible reasons include:
1. The service is installed but currently stopped.
2. The service is listening on a Unix domain socket instead of TCP.
3. The service is listening on `127.0.0.1` while the client connected to `0.0.0.0` or IPv6 `::1`.
4. The service is running inside Docker or a VM and its ports have not been mapped to the host.
5. The service is hosted remotely, and network routing / firewalls blocked the port.

StackDoctor strictly adheres to **observed facts**. It reports `MONGO_CONNECTION_REFUSED` ("Connection refused on target host:port") and provides realistic hypotheses, but **never** overclaims that software is uninstalled when it cannot conclusively verify it.

---

### Why is AI optional and turned off by default?
Diagnostic facts should be deterministic, reproducible, and verifiable. 

If a tool relies on AI for diagnosis:
- It can hallucinate non-existent files or configuration options.
- It can overclaim causality based on superficial error messages.
- It requires sending your private environment data over the network to a third party.

In StackDoctor:
1. **The 20 core diagnostic rules are 100% deterministic TypeScript logic**. They run locally and offline in milliseconds.
2. AI is available only as an optional, secondary explanation layer (`stackdoctor ai-explain`).
3. You can use local, privacy-first offline models via Ollama (`http://localhost:11434`) without sending a single byte over the public internet.

---

### How does StackDoctor differ from an AI coding assistant (e.g. Copilot, Cursor)?
- **Grounding in Environment State**: AI assistants only see the files open in your editor. StackDoctor directly checks open TCP ports, running processes, virtualenv binaries, database reachability, Docker Compose networks, and lockfiles.
- **Safety Allowlist**: StackDoctor only proposes remediations from a strict, verified allowlist of reversible actions. It will never output dangerous shell commands like `rm -rf` or `sudo`.

---

### Does StackDoctor upload my secrets or `.env` files?
**Never.** StackDoctor includes an automated regex and keyword redaction pipeline (`packages/core/src/redact.ts`) that runs locally before any report is formatted, displayed, or uploaded. Environment variable *names* are compared to ensure your setup is complete, but secret *values* are never read into memory, stored in reports, or transmitted.
