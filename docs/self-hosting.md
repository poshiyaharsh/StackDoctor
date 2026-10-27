# Self-Hosting Guide

StackDoctor includes an optional team collaboration platform consisting of an **Express REST API** (`apps/api`), a **React Web Dashboard** (`apps/web`), and a **MongoDB** datastore.

---

## 1. Quick Start with Docker Compose

Create a `docker-compose.yml` file for your deployment:

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:7.0
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    ports:
      - "127.0.0.1:27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=stackdoctor

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    depends_on:
      - mongodb
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - MONGODB_URI=mongodb://mongodb:27017/stackdoctor
      - SESSION_SECRET=${SESSION_SECRET}
      - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
      - CORS_ORIGIN=http://localhost:5173

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - "5173:80"
    environment:
      - VITE_API_BASE_URL=http://localhost:3000

volumes:
  mongo_data:
```

Launch the stack:
```bash
docker compose up -d
```

---

## 2. Required Environment Variables

### API Server (`apps/api`)

| Variable Name | Purpose | Example / Requirements |
|---|---|---|
| `PORT` | HTTP port for the API server | `3000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://mongodb:27017/stackdoctor` |
| `SESSION_SECRET` | Signing secret for session cookies | High-entropy string (>= 32 characters) |
| `ENCRYPTION_MASTER_KEY` | AES-256-GCM master key for BYOK encryption | 32-byte hex or high-entropy string |
| `CORS_ORIGIN` | Allowed web origins for CORS | `https://stackdoctor.yourdomain.com` |
| `NODE_ENV` | Runtime environment | `production` |

---

## 3. Production Hardening Checklist

Before exposing StackDoctor on a public network, follow this production checklist:

1. **HTTPS / TLS Termination**:
   - Place a reverse proxy (Nginx, Traefik, or Caddy) in front of the API and Web containers.
   - Enforce HTTP to HTTPS redirects and TLS 1.3.
   - Configure HSTS headers (`Strict-Transport-Security`).

2. **Secrets Management**:
   - Never commit `.env` or secrets to source control.
   - Supply `SESSION_SECRET` and `ENCRYPTION_MASTER_KEY` via container environment variables or a secret vault (e.g. AWS Secrets Manager, HashiCorp Vault).

3. **MongoDB Security**:
   - Bind MongoDB strictly to the Docker internal network (do not publish port 27017 to `0.0.0.0`).
   - Enable authentication (`auth: true`) with strong database credentials.
   - Schedule automated volume snapshots (`mongodump` or disk backups) for `mongo_data`.

4. **Session Cookie Security**:
   - In production (`NODE_ENV=production`), ensure cookies have `secure: true`, `httpOnly: true`, and `sameSite: "lax"`.

5. **Rate Limiting & Firewalls**:
   - Limit API login and upload attempts using reverse proxy rate limiters or API gateway rules.
