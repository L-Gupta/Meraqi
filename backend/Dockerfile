# Local-dev image for the FastAPI backend. Source is NOT baked in — compose
# bind-mounts backend/ over /app so edits hot-reload. /app/data is a named
# volume (see docker-compose.yml), still encrypted at rest by
# app/security/file_crypto.py exactly as in a native run.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install only the runtime dependencies listed in pyproject.toml; the `app`
# package itself is imported from the bind mount (cwd /app is on sys.path).
COPY pyproject.toml ./
RUN python -c "import tomllib; print('\n'.join(tomllib.load(open('pyproject.toml', 'rb'))['project']['dependencies']))" \
        > /tmp/requirements.txt \
    && pip install -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

RUN useradd --create-home --uid 1000 tam \
    # A new named volume inherits this dir's ownership, so tam can write to it.
    && mkdir -p /app/data && chown tam:tam /app/data
USER tam

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "app"]
