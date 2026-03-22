# Multi-stage Dockerfile for Wippestoolen FastAPI Backend
# Optimized for production deployment on Railway

# Build stage
FROM python:3.13-slim as builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv for faster dependency management
RUN pip install uv

# Set work directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Production stage
FROM python:3.13-slim as production

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r wippestoolen \
    && useradd -r -g wippestoolen wippestoolen

# Set work directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY wippestoolen/ ./wippestoolen/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY entrypoint.sh ./

# Create directories for logs and uploads, make wippestoolen user own the app directory
RUN mkdir -p /app/logs && \
    chmod +x /app/entrypoint.sh && \
    chown -R wippestoolen:wippestoolen /app

# Switch to non-root user
USER wippestoolen

# Expose port
EXPOSE 8000

# Default command - use entrypoint script
CMD ["./entrypoint.sh"]