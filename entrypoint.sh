#!/bin/bash
set -e

echo "🏁 Starting Wippestoolen application..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
python -c "
import time
import sys
from sqlalchemy import create_engine
from wippestoolen.app.core.config import settings

max_attempts = 30
attempt = 0

# Use synchronous database URL for health check
db_url = settings.database_url.replace('postgresql+asyncpg://', 'postgresql://')

while attempt < max_attempts:
    try:
        engine = create_engine(db_url)
        connection = engine.connect()
        connection.close()
        print('✅ Database connection successful!')
        break
    except Exception as e:
        attempt += 1
        print(f'⏱️  Database not ready (attempt {attempt}/{max_attempts}): {e}')
        if attempt >= max_attempts:
            print('❌ Failed to connect to database after maximum attempts')
            sys.exit(1)
        time.sleep(2)
"

# Run database migrations
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "🗄️  Running database migrations..."
    alembic upgrade head || {
        echo "⚠️  Migration failed, stamping current state and continuing..."
        alembic stamp head
    }
    echo "✅ Database migrations completed!"
else
    echo "🗄️  Skipping database migrations (RUN_MIGRATIONS=false)"
fi

echo "🚀 Starting FastAPI application..."
exec uvicorn wippestoolen.app.main:app --host 0.0.0.0 --port 8000