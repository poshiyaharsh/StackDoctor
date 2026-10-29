# Broken PostgreSQL Config Project (Fixture)

This fixture represents an uncontactable PostgreSQL database endpoint:

1. **`POSTGRES_CONNECTION_REFUSED`**: `DATABASE_URL` references PostgreSQL on `127.0.0.1:54329`, where no PostgreSQL instance or container is listening (ECONNREFUSED).
