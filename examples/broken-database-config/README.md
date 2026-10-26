# Broken Database Config Project (Fixture)

This fixture represents a broken database and container configuration intentionally exhibiting three common errors:

1. **`COMPOSE_SERVICE_NOT_FOUND`**: Application config references `redis`, but `docker-compose.yml` only defines `mongo`.
2. **`DB_HOST_NOT_RESOLVED`**: `MONGO_HOST` points to `unresolvable-mongo-host.invalid`, which fails DNS resolution.
3. **`PORT_INVALID`**: Declared port `99999` is outside the valid TCP port range (1-65535).
