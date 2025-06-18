# Task Completion Checklist

## Critical Checks (MUST Run)

1. **Verify Core Functionality Works**
   - Test the feature/fix manually
   - Confirm it solves the stated problem
   - Ensure no crashes or obvious errors
   - If it doesn't work, STOP and fix it first

2. **Code Formatting**
   ```bash
   npm run format-check
   ```
   If this fails, run: `npm run format`

3. **Linting**
   ```bash
   npx biome lint .
   ```
   Fix any errors before proceeding

4. **Biome Check (Combined)**
   ```bash
   npx biome check .
   ```

5. **Error Handling Audit**
   - ✓ Uses existing error patterns (`throw new Error()`)
   - ✓ No custom error classes without explicit approval
   - ✓ Error messages follow project patterns

6. **Git Status Clean**
   ```bash
   git status
   ```
   All changes must be committed before marking done

## Important Checks

7. **Run Tests**
   ```bash
   npm test
   ```
   If tests fail, fix them unless explicitly told to skip

8. **Remove Debug Code**
   ```bash
   git diff --name-only HEAD | xargs grep -l "console\.log\|TODO\|FIXME\|XXX" 2>/dev/null || echo "✓ Clean"
   ```

## Workflow
1. Complete work
2. Set status to 'review': `set_task_status --id X --status review`
3. Run checklist above
4. Fix any issues
5. Set status to 'done': `set_task_status --id X --status done`

## What NOT to Do (Unless Asked)
- Write new tests (separate task)
- Refactor unrelated code
- Add "nice to have" features
- Create documentation
- Performance optimization
- Security audits