# Step-by-Step Merge Guide: Claude Code + Task Master v0.17.0

## Pre-Merge Checklist

- [ ] Commit or stash any uncommitted changes
- [ ] Create a backup branch: `git checkout -b backup/claude-code-pre-merge`
- [ ] Return to feature branch: `git checkout fix/claude-code-no-api-key`

## Merge Process

### 1. Start the Merge

```bash
git merge upstream/main
```

You'll see conflicts in:
- `docs/models.md`
- `scripts/modules/task-manager/expand-task.js`

### 2. Resolve `docs/models.md`

Open the file and look for conflict markers. Resolution strategy:
1. Keep the upstream version's table structure
2. Add Claude Code section at the end
3. Ensure our provider is documented

Example resolution:
```markdown
# Available Models as of June 14, 2025

[Keep all upstream content...]

## Claude Code Provider

The Claude Code provider allows using Claude through the Claude Code CLI without API keys:

| Provider     | Model Name                    | SWE Score | Input Cost | Output Cost |
| ------------ | ----------------------------- | --------- | ---------- | ----------- |
| claude-code  | claude-opus-4-20250514       | 0.725     | 0          | 0           |
| claude-code  | claude-sonnet-4-20250514     | 0.727     | 0          | 0           |
| claude-code  | claude-code (Default)        | 0.727     | 0          | 0           |
```

### 3. Resolve `scripts/modules/task-manager/expand-task.js`

This is more complex. Key areas to preserve:

From our branch:
- Claude Code provider compatibility
- Any specific error handling for Claude Code

From upstream:
- Enhanced prompt generation
- Tag support
- New complexity report integration

### 4. Fix Tag-Related Code

In `scripts/modules/ai-services-unified.js`, we need to restore tag functionality:

```javascript
// At the top, restore the import
import { 
    log, 
    findProjectRoot, 
    resolveEnvVariable, 
    getCurrentTag  // Add this back
} from './utils.js';

// In the response handling section, add tag info
const tagInfo = _getTagInfo(effectiveProjectRoot);
return {
    mainResult: finalMainResult,
    telemetryData: telemetryData,
    tagInfo: tagInfo  // Include tag information
};
```

### 5. Handle Package Version

After resolving conflicts:
```bash
# Stage resolved files
git add docs/models.md scripts/modules/task-manager/expand-task.js

# Update any other files that need tag support
git add scripts/modules/ai-services-unified.js

# Complete the merge
git commit -m "Merge upstream/main v0.17.0 into Claude Code integration

- Resolved conflicts in models.md and expand-task.js
- Restored tag support for compatibility
- Maintained Claude Code provider functionality"
```

## Post-Merge Testing

### Basic Functionality Tests

```bash
# 1. Test Claude Code provider detection
task-master models

# 2. Test task parsing with Claude Code
task-master parse-prd --input=test-prd.txt

# 3. Test task expansion
task-master expand --id=1

# 4. Test new research command
task-master research "How should I implement authentication?"
```

### MCP Integration Tests

```bash
# 1. Start MCP server
npm run mcp-server

# 2. Test in Cursor/Claude Desktop
# Verify all MCP tools work with Claude Code provider
```

### Tag System Tests

```bash
# These should at least not error out
task-master add-tag test-tag
task-master use-tag test-tag
task-master list-tags
```

## Troubleshooting

### If tag commands fail:

Add stub implementation in `scripts/modules/task-manager/tag-management.js`:
```javascript
// Minimal stub to prevent errors
export function getCurrentTag(projectRoot) {
    return 'master'; // Default tag
}
```

### If AI calls fail:

Check that telemetry data includes all required fields:
```javascript
telemetryData = {
    modelUsed: 'claude-code',
    providerName: 'claude-code',
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    commandName: options.feature || 'unknown'
};
```

### If research command doesn't work:

Ensure Claude Code provider handles the research role:
```javascript
// In claude-code.js
if (options.role === 'research') {
    // Handle research-specific requirements
}
```

## Final Verification

Run the complete test suite:
```bash
npm test
```

Key files to verify:
- [ ] `src/ai-providers/claude-code.js` - Provider implementation intact
- [ ] `scripts/modules/config-manager.js` - Claude Code auth handling preserved
- [ ] `scripts/modules/supported-models.json` - Claude Code models included
- [ ] All tests pass

## Rollback Plan

If issues arise:
```bash
# Abort the merge
git merge --abort

# Or reset to backup
git reset --hard backup/claude-code-pre-merge
```

## Success Criteria

- [ ] All existing Claude Code functionality works
- [ ] New v0.17.0 features are accessible
- [ ] No regression in API-key-free operation
- [ ] MCP integration remains functional
- [ ] Tests pass
- [ ] Documentation is complete