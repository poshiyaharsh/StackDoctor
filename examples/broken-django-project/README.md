# Broken Django Project (Fixture)

This fixture represents a broken Django project environment intentionally exhibiting common Python and Django setup failures:

1. **`PYTHON_VENV_MISSING`**: No active or local `.venv`/`venv` directory exists.
2. **`PYTHON_PACKAGES_MISSING`**: Declared packages in `requirements.txt` are missing from the environment.
3. **`DJANGO_SETTINGS_NOT_FOUND`**: `manage.py` references `broken_app.nonexistent_settings`, which does not exist on disk.
