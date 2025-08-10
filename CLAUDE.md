# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wippestoolen is a neighborhood tool-sharing platform where users can lend and borrow tools. The project is currently in early planning stages with core requirements documented in Instructions.md.

## Project Structure

This is a Python project (Python ≥3.13) configured with:
- Virtual environment in `.venv/`
- Project metadata in `pyproject.toml`
- MCP servers configured in `.mcp.json`

## Development Commands

Since this is an early-stage project without source code yet, standard Python development commands would be:
- `python -m venv .venv` - Create virtual environment (already exists)
- `source .venv/bin/activate` - Activate virtual environment
- `pip install -e .` - Install project in development mode
- `python -m pytest` - Run tests (when implemented)

## Key Features to Implement

Based on Instructions.md, the MVP includes:
1. **Authentication & Profiles** - User registration, profiles with ratings
2. **Tool Listings** - CRUD operations for tools with photos, location, availability
3. **Booking Flow** - Request/confirm/active/returned states
4. **Reviews System** - Mutual ratings after tool returns
5. **Notifications** - In-app and email notifications
6. **Admin Panel** - User/tool management

## MCP Servers Available

The project has several MCP servers configured:
- `memory` - Knowledge graph for context
- `sequential-thinking` - Complex reasoning
- `git` - Git operations
- `mcp-obsidian` - Note management
- `context7` - Library documentation
- `time` - Time utilities

## Architecture Notes

Future implementation should consider:
- Mobile-friendly responsive design
- Privacy-first approach (GDPR compliance)
- Auditability for booking state changes
- Rate limiting for authentication
- Accessibility (WCAG compliance)