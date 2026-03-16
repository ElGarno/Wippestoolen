---
title: Start Session
description: Initialize work session with project context and pending tasks
argument-hint: project-path (e.g., layers/project/loyalty/trust_score)
---

Starting work session for project: **$ARGUMENTS**

## Steps:

1. **Read project guidance**: Load `$ARGUMENTS/CLAUDE.md` for project-specific rules and workflows

2. **Find context file**: Look for the latest `$ARGUMENTS/doc/tasks/context_session_*.md`
   - If multiple exist, use the highest numbered one
   - If none exist, create one (see template below)

3. **Review current status**:
   - What was the last task being worked on?
   - Are there any pending/blocked tasks?
   - What was the last progress entry?
   - What open questions remain?

4. **Check for agent outputs**: Look in `$ARGUMENTS/doc/agents/` for recent analysis
   - Any architecture decisions documented?
   - Any security reviews pending implementation?
   - Any database designs to follow?

5. **Check for updates**:
   - Run `git status` to see any uncommitted changes
   - Run `git log -3 --oneline` to see recent commits

6. **Summarize for user**:
   - Current project goal
   - Last known status
   - Pending tasks (if any)
   - Relevant agent outputs (if any)
   - Recommended next steps

## If no context file exists:

Create `$ARGUMENTS/doc/tasks/context_session_01.md`:

```markdown
# Context Session 01 - {Brief Title}

## Project Goal
{What we're trying to achieve}

## Current Status
- **Phase**: planning
- **Last Updated**: YYYY-MM-DD HH:MM
- **Blockers**: None

## Tasks
- [ ] Define project objectives
- [ ] Review existing code/documentation

## Progress Log
### YYYY-MM-DD
- Session initialized
- Awaiting task definition

## Open Questions
- {Questions to clarify}

## Files Modified
- None yet

## Agent Outputs Referenced
- None yet
```

## Create doc structure if missing:

```
$ARGUMENTS/doc/
├── agents/
│   ├── architecture/
│   ├── security/
│   ├── python/
│   ├── backend/
│   ├── database/
│   ├── infrastructure/
│   ├── frontend/
│   └── pm-reports/
└── tasks/
    └── context_session_01.md
```