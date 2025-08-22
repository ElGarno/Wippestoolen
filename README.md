# Wippestoolen

A neighborhood tool-sharing platform where users can lend and borrow tools.

## Features

- **Tool Listings**: Create and manage tool listings with photos and availability
- **Booking System**: Request and manage tool borrowing with status tracking
- **Trust System**: Mutual reviews and ratings after each transaction
- **Location-based Search**: Find tools nearby with map integration
- **Secure Authentication**: JWT-based authentication with email verification
- **Mobile-friendly**: Responsive design that works on all devices

## Development Setup

### Requirements

- Python 3.13+
- PostgreSQL 13+
- Redis (optional, for caching and sessions)

### Installation

1. Clone the repository
2. Create virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # or .venv\Scripts\activate on Windows
   ```

3. Install dependencies:
   ```bash
   uv sync
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. Run database migrations:
   ```bash
   alembic upgrade head
   ```

6. Start the development server:
   ```bash
   uvicorn wippestoolen.app.main:app --reload
   ```

The API will be available at `http://localhost:8000`

### Development Commands

```bash
# Code formatting
black .

# Linting
ruff check .
ruff check --fix .

# Type checking
mypy .

# Run tests
pytest

# Run tests with coverage
pytest --cov
```

## Project Structure

```
wippestoolen/
├── app/
│   ├── core/           # Core configuration and utilities
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic models
│   ├── api/v1/         # API endpoints
│   ├── services/       # Business logic
│   └── utils/          # Helper functions
├── tests/              # Test files
├── migrations/         # Alembic migrations
└── scripts/            # Utility scripts
```

## Architecture

The application is built with:

- **FastAPI** - Modern, fast web framework for building APIs
- **SQLAlchemy** - SQL toolkit and Object-Relational Mapping
- **PostgreSQL** - Primary database for data storage
- **Redis** - Caching and session storage
- **AWS S3** - File storage for tool photos
- **Pydantic** - Data validation and serialization

## License

This project is licensed under the MIT License.