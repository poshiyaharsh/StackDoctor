# Broken SQLite Database Project Fixture

This synthetic test fixture reproduces two common developer SQLite issues:
1. `SQLITE_FILE_NOT_FOUND`: `DATABASE_URL` references `./missing_dir/app.db` where the parent directory `missing_dir` does not exist.
2. `SQLITE_FILE_CORRUPTED`: `SQLITE_DB_PATH` points to `corrupted.db` which contains HTML error markup instead of a valid SQLite 3 magic header (`SQLite format 3\0`).
