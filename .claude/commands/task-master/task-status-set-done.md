Mark a task as completed.

Arguments: $ARGUMENTS (task ID)

## Completing a Task

This command validates task completion and updates project state intelligently.

## Pre-Completion Checks

**REQUIRED**: Task must be in "review" status first!

If not in review:
1. Set status to "review" first
2. Run the post-task checklist
3. Fix any issues found
4. Then proceed with marking as "done"

Additional checks:
1. Verify test strategy was followed
2. Check if all subtasks are complete
3. Validate acceptance criteria met
4. Ensure all code is committed

## Execution

```bash
task-master set-status --id=$ARGUMENTS --status=done
```

## Post-Completion Actions

1. **Update Dependencies**
   - Identify newly unblocked tasks
   - Update sprint progress
   - Recalculate project timeline

2. **Documentation**
   - Generate completion summary
   - Update CLAUDE.md with learnings
   - Log implementation approach

3. **Next Steps**
   - Show newly available tasks
   - Suggest logical next task
   - Update velocity metrics

## Celebration & Learning

- Show impact of completion
- Display unblocked work
- Recognize achievement
- Capture lessons learned