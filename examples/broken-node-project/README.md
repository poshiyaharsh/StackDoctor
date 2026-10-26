# Broken Node.js Project (Fixture)

This fixture represents a broken Node.js environment intentionally exhibiting multiple common diagnostic failures:

1. **`NODE_DEPS_NOT_INSTALLED`**: `package.json` exists, but `node_modules/` is not installed.
2. **`LOCKFILE_MISSING`**: No package lockfile (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`) exists.
3. **`NODE_VERSION_MISMATCH`**: Requires Node `^12.0.0`, which mismatches modern Node environments.
4. **`ENV_VAR_NAMES_MISSING`**: `.env` is present but is missing variables declared in `.env.example` (`PORT`, `DATABASE_URL`, `SESSION_SECRET`).
5. **`PORT_IN_USE`**: Port 3000 is declared in configuration and occupied during integration tests.
