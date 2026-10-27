# Known Limitations

This document provides a transparent, honest account of current limitations, trade-offs, and edge cases in StackDoctor v0.1.0.

---

## 1. Supported Ecosystems & Runtimes

- **Node.js**:
  - Full support for standard npm and package.json configurations.
  - Multi-package monorepos with nested workspaces (`pnpm-workspace.yaml`, Lerna, Yarn Berry zero-install) have basic scanning but lack deep workspace topological diagnostics.
- **Python & Django**:
  - Detection covers standard `virtualenv`, `.venv`, `requirements.txt`, and Django `manage.py` / `settings.py`.
  - Poetry (`pyproject.toml`), Pipenv (`Pipfile`), and Conda environments are currently recognized only through active `$VIRTUAL_ENV` environment flags.
- **Unimplemented Runtimes**:
  - Go, Rust, Ruby on Rails, Java (Maven/Gradle), PHP, and .NET are not yet supported.

---

## 2. Database Support

- **Supported**: MongoDB and MySQL.
- **Not Yet Supported**:
  - PostgreSQL adapter is not yet implemented (planned for v0.2.0).
  - Redis connection reachability is currently inferred from Docker Compose service names, but direct `PING/PONG` protocol handshakes are not yet implemented.
  - SQLite file permissions and lock contentions are not diagnosed.

---

## 3. Container & Infrastructure Limits

- **Docker Compose**:
  - StackDoctor parses `docker-compose.yml` and `compose.yaml` files statically.
  - It does not diagnose advanced multi-compose overrides (`-f docker-compose.override.yml`), Kubernetes manifests, Helm charts, or Podman rootless socket mappings.
- **Port Checking vs Host Network**:
  - When containers use host networking mode (`network_mode: "host"`), port mapping declarations are bypassed in compose files and cannot be inferred purely by static inspection.

---

## 4. Platform & Process Ownership Caveats

- **Process Ownership Identification**:
  - On Linux and macOS, process identification relies on `ss` or `lsof`. If running without permissions or in sandboxed containers, process IDs cannot be determined and StackDoctor honestly reports `conclusive: false`.
  - On Windows, `netstat -ano` requires appropriate user privileges to map listening TCP ports to owning process names.

---

## 5. Safe Remediation Scope

- StackDoctor only permits execution of 4 strictly allowlisted operations (`NODE_INSTALL_DEPENDENCIES`, `PYTHON_CREATE_VENV`, `PYTHON_INSTALL_DEPENDENCIES`, `DJANGO_APPLY_MIGRATIONS`).
- It deliberately disallows arbitrary shell execution, file deletion (`rm -rf`), and process termination (`kill -9`). Fixing issues outside these 4 operations requires manual developer action.
