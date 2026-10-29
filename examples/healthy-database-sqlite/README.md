# Healthy SQLite Database Project Fixture

This synthetic test fixture represents a valid, properly initialized SQLite project:
- `prisma/schema.prisma` configured with `provider = "sqlite"` and `url = "file:./dev.db"`.
- `dev.db` contains a valid SQLite 3 magic header.
- Expected findings: none (`[]`). Zero false positives.

