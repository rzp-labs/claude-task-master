Set a task's status to review.

Arguments: $ARGUMENTS (task ID)

## Marking Task for Review

This status indicates work is complete but needs verification before final approval.

## When to Use Review Status

- Code complete and ready for post-task checklist
- Implementation done but needs verification
- All development work finished, running quality checks
- Ready to validate before marking as "done"

**IMPORTANT**: Always use "review" status before "done" to run the post-task checklist

## Execution

```bash
task-master set-status --id=$ARGUMENTS --status=review
```

## Review Preparation

When setting to review:
1. **Run Post-Task Checklist**
   - Execute the complete Post-Task Checklist from CLAUDE.md
   - This is the critical quality gate before marking as done
   - Fix all issues found during the checklist
   - Do not proceed to "done" until all checks pass

2. **Documentation**
   - Update task with review notes
   - Link relevant artifacts
   - Specify reviewers if known

3. **Smart Actions**
   - Create review reminders
   - Track review duration
   - Suggest reviewers based on expertise
   - Prepare rollback plan if needed