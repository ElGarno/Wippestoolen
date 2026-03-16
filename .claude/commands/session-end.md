---
title: End Session
description: Wrap up session with documentation updates and context preservation
argument-hint: project-path (e.g., layers/project/loyalty/trust_score)
---

Wrapping up work session for project: **$ARGUMENTS**

## Steps:

1. **Summarize completed work**:
   - What tasks were completed this session?
   - What changes were made to the codebase?
   - Are there any uncommitted changes?

2. **Update context file** (`$ARGUMENTS/doc/tasks/context_session_XX.md`):
   - Mark completed tasks as done `[x]`
   - Add new tasks discovered during work
   - Update `Current Status` section (phase, last updated, blockers)
   - Add progress log entry with today's date
   - Update `Files Modified` section
   - Update `Open Questions` for next session
   - Reference any agent outputs used

3. **Document agent outputs** (if sub-agents were used):
   - Verify outputs saved to `$ARGUMENTS/doc/agents/{agent-type}/`
   - Use naming: `{YYYY-MM-DD}_{topic}.md`
   - Reference in context file under `Agent Outputs Referenced`

4. **Check if README.md needs updates**:
   - Were new features added?
   - Did configuration change?
   - Are there new usage patterns?

5. **Check if CLAUDE.md needs updates**:
   - Were new critical rules discovered?
   - Did we hit a common pitfall worth documenting?
   - Did workflow change?

6. **Git status check**:
   - List any uncommitted changes
   - Remind user to commit if needed (offer `/cap`)

7. **Handoff summary**:
   - Current state of the project
   - Next recommended tasks
   - Any blockers or open questions
   - Sub-agents to consult for next tasks (if applicable)

## Context File Update Template:

Update `$ARGUMENTS/doc/tasks/context_session_XX.md`:

```markdown
## Current Status
- **Phase**: {planning/implementation/testing/review}
- **Last Updated**: YYYY-MM-DD HH:MM
- **Blockers**: {None or describe}

## Progress Log
### YYYY-MM-DD
- Completed: {task 1}, {task 2}
- In progress: {task 3}
- Blocked: {task 4} - {reason}
- Decisions made: {key decisions}
- Next: {recommended next steps}

## Files Modified
- `path/to/file1.py` - {brief description}
- `path/to/file2.yaml` - {brief description}

## Agent Outputs Referenced
- `doc/agents/architecture/YYYY-MM-DD_feature_design.md`
- `doc/agents/database/YYYY-MM-DD_schema_review.md`

## Open Questions
- {Question 1 for next session}
- {Question 2 for next session}
```

## Reminder Checklist:

- [ ] Context file updated with all sections
- [ ] Agent outputs saved (if any)
- [ ] README.md updated (if user-facing changes)
- [ ] CLAUDE.md updated (if new rules discovered)
- [ ] All changes committed (or user informed)