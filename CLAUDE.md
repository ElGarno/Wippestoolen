# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wippestoolen is a neighborhood tool-sharing platform where users can lend and borrow tools. The core MVP features include authentication, tool listings, booking flow, reviews, and notifications. See `Instructions.md` for detailed product requirements.

## Tech Stack & Dependencies

- **Python**: ≥3.13 (required)
- **Package Manager**: uv (for dependency management)
- **Development Tools**: black, ruff, mypy, pytest (configured in pyproject.toml)

## Development Commands

### Environment Setup
```bash
source .venv/bin/activate  # Activate virtual environment
uv sync                     # Install all dependencies
uv add <package>           # Add a production dependency
uv add --dev <package>     # Add a development dependency
```

### Code Quality
```bash
black .                    # Format code
ruff check .              # Lint code
ruff check --fix .        # Auto-fix linting issues
mypy .                    # Type checking
```

### Testing
```bash
pytest                    # Run all tests
pytest -v                # Verbose test output
pytest --cov             # Run tests with coverage
pytest -k "test_name"    # Run specific test
```

## Core Features to Implement

### MVP Requirements (from Instructions.md)
1. **Auth & Profiles**: Sign up/in/out, user profiles with ratings
2. **Tool Listings**: CRUD operations with photos, location, availability
3. **Booking Flow**: Request → Confirm/Decline → Active → Returned
4. **Reviews**: Mutual 1-5 star ratings after tool return
5. **Notifications**: In-app notifications for booking requests

### Data Models (to be implemented)
- User (with profile, location, rating)
- Tool (title, category, photos, availability, owner)
- Booking (borrower, tool, dates, status)
- Review (rating, comment, reviewer, reviewee)

## Implementation Guidelines

When implementing features:
1. Start with data models and migrations
2. Build API endpoints/views following RESTful patterns
3. Add comprehensive tests for business logic
4. Ensure proper validation and error handling
5. Consider privacy and security (GDPR-aware, rate limiting)

## Project Status

⚠️ **Early Stage**: No source code implemented yet. When starting development:
1. Choose a web framework (Django, FastAPI, Flask)
2. Set up database models based on Instructions.md requirements
3. Implement authentication first as it's foundational
4. Follow the MVP features order from Instructions.md

## Important Rules
- Before you do any work, MUST view the context file at `.claude/tasks/context_session_xx.md`.
- If no context-file is available at `.claude/tasks/`, create the first context file (.claude/tasks/context_session_01.md) from the `Instructions.md.
- Add the sections `project_goal', 'current_status', 'tasks', progress_log` and what else seems reasonable to the context file.
- Always get context from `.claude/tasks/context_session_xx.md` before starting delegating work to your sub-agents.
- You can call sub-agents for specific tasks, but always ensure you have the full context first.
- After you finished the work, you MUST update the .claude/tasks/context_session_xx.md` file with the latest status, tasks, and progress log to make sure others can get full context of what you did.

### Sub agents
You have access to the following sub-agents for **documentation creation only**:
- **backend-expert**: Creates documentation for backend API design and business logic patterns. Saves files in `.claude/doc/backend/`.
- **database-expert**: Creates documentation for database schema design and query optimization strategies. Saves files in `.claude/doc/database/`.
- **security-specialist**: Creates documentation for security assessment protocols and compliance requirements. Saves files in `.claude/doc/security/`.
- **frontend-expert**: Creates documentation for frontend UI/UX design patterns and implementation guidelines. Saves files in `.claude/doc/frontend/`.
- **python-expert**: Creates documentation for Python code quality standards and best practices. Saves files in `.claude/doc/python/`.
- **aws-cloud-expert**: Creates documentation for AWS infrastructure design and IaC with Tofu patterns. Saves files in `.claude/doc/infrastructure/`.
- **software-architect**: Creates documentation for high-level architecture and design patterns. Saves files in `.claude/doc/architecture/`.
- **project-manager**: Creates documentation for project coordination, cost optimization, and quality assurance processes. Saves files in `.claude/doc/pm-reports/`.

**IMPORTANT**: Sub-agents should ONLY create documentation, specifications, and planning materials. They should NOT implement any actual code. All code implementation must be done by the main agent (you) after reviewing the sub-agent's documentation.

When passing tasks to sub-agents, ensure they have the necessary context from `.claude/tasks/context_session_xx.md`.
After each sub agent finishes their documentation work, make sure you read their output to get full context before you start implementing.

If the essence of different subagents is contradictory, you can override the subagent's output with your own decision, but always document this in the context file.
