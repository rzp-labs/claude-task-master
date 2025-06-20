# MCP-CLI Refactoring Documentation

## Overview

This document describes the refactoring performed to align MCP server direct functions with CLI implementations, ensuring consistent behavior and proper tag/project context handling.

## Problem Statement

The MCP server implementation had several issues:

1. **Bypassing CLI Functions**: 6 MCP direct functions were completely bypassing their corresponding CLI functions
2. **Data Corruption**: `expandTaskDirect` was modifying data before passing to CLI
3. **Missing Parameters**: Widespread missing `tag` and `projectRoot` parameters in `readJSON`/`writeJSON` calls
4. **Inconsistent Behavior**: MCP and CLI implementations had diverged, leading to different behaviors

## Solution: 5-Phase Refactoring Plan

### Phase 1: Fix expandTaskDirect Data Corruption ✅

**Issue**: `expandTaskDirect` was modifying the full tasks data structure before calling the CLI function, causing data corruption.

**Fix**: 
- Removed premature data modification
- Let CLI function handle all data transformations
- Added proper tag parameter handling

**Files Changed**:
- `mcp-server/src/core/direct-functions/expand-task.js`

### Phase 2: Add Missing Tag Parameters ✅

**Issue**: Multiple files were calling `readJSON`/`writeJSON` without required `tag` and `projectRoot` parameters.

**Fix**:
- Added `getCurrentTag` imports where missing
- Updated all `readJSON`/`writeJSON` calls to include 3 parameters: `(path, projectRoot, tag)`
- Ensured tag context is properly determined and passed

**Files Changed**:
- `scripts/modules/task-manager/add-task.js`
- `scripts/modules/task-manager/set-task-status.js`
- `scripts/modules/task-manager/update-tasks.js`
- `mcp-server/src/core/direct-functions/remove-task.js`
- `mcp-server/src/core/direct-functions/add-tag.js`
- Updated corresponding test files to match new parameter expectations

### Phase 3: Refactor Simple Bypassing Functions ✅

**Functions**: `getCacheStats`, `complexityReport`

**Changes**:
- **getCacheStats**: Simplified to return basic stats without UI elements
- **complexityReport**: Removed incomplete caching logic, simplified to just read report data

**Files Changed**:
- `mcp-server/src/core/direct-functions/get-cache-stats.js`
- `mcp-server/src/core/direct-functions/complexity-report.js`

### Phase 4: Refactor Complex Bypassing Functions ✅

**Functions**: `showTask`, `listTags`, `removeTask`, `addTag`

**Changes**:
- **showTask**: Now properly calls CLI's `showTask` function
- **listTags**: Uses CLI's `listTags` function with MCP-specific formatting
- **removeTask**: Delegates to CLI with proper confirmation handling
- **addTag**: Uses CLI function with appropriate parameter mapping

**Files Changed**:
- `mcp-server/src/core/direct-functions/show-task.js`
- `mcp-server/src/core/direct-functions/list-tags.js`
- `mcp-server/src/core/direct-functions/remove-task.js`
- `mcp-server/src/core/direct-functions/add-tag.js`

### Phase 5: Validation and Cleanup ✅

**Validation Steps Completed**:
1. ✅ All tests passing (466 tests)
2. ✅ Code formatting applied
3. ✅ Linting checked (only external files had issues)
4. ✅ Functional testing of key operations (add-task, add-subtask, update-subtask, remove-subtask)

## Key Principles Applied

### 1. Thin Wrapper Pattern
MCP direct functions should be thin wrappers around CLI functions, handling only:
- Parameter transformation (MCP args → CLI args)
- Output formatting (CLI output → MCP response structure)
- Error handling specific to MCP context

### 2. Consistent Parameter Passing
All file I/O operations must include proper context:
```javascript
// ❌ Wrong
readJSON(tasksPath);
writeJSON(tasksPath, data);

// ✅ Correct
readJSON(tasksPath, projectRoot, tag);
writeJSON(tasksPath, data, projectRoot, tag);
```

### 3. Tag Context Preservation
Tag context must be properly determined and passed through all layers:
```javascript
const currentTag = tag || getCurrentTag(projectRoot) || 'master';
```

## Implementation Guidelines

### For New MCP Direct Functions

1. **Start with the CLI function**: Always check if a CLI function exists first
2. **Use the CLI function**: Call it rather than reimplementing logic
3. **Handle parameters properly**: Transform MCP args to CLI args format
4. **Preserve tag context**: Always pass `projectRoot` and `tag` parameters
5. **Format output appropriately**: Convert CLI output to MCP response structure

### Example Pattern

```javascript
export async function myFeatureDirect(args, log) {
    const { projectRoot, tag, ...otherArgs } = args;
    
    try {
        // Call the CLI function
        const result = await myFeatureCLI(
            otherArgs.param1,
            otherArgs.param2,
            { projectRoot, tag, format: 'json' }
        );
        
        // Return MCP-formatted response
        return {
            success: true,
            data: result
        };
    } catch (error) {
        return {
            success: false,
            error: { 
                code: 'ERROR_CODE',
                message: error.message 
            }
        };
    }
}
```

## Testing Considerations

1. **Unit Tests**: Ensure test expectations match actual function signatures
2. **Integration Tests**: Test both CLI and MCP paths to ensure consistency
3. **Tag Context Tests**: Verify tag context is properly preserved across operations
4. **Error Handling Tests**: Ensure errors are properly formatted for each interface

## Migration Notes

### For Existing Code

If you have code calling `readJSON`/`writeJSON` without all parameters:
1. Import `getCurrentTag` from utils
2. Determine the appropriate tag context
3. Update the function calls to include all 3 parameters

### For Tests

Update test expectations to match the new parameter counts:
```javascript
// Update from:
expect(writeJSON).toHaveBeenCalledWith(path, data);

// To:
expect(writeJSON).toHaveBeenCalledWith(path, data, projectRoot, tag);
```

## Benefits Achieved

1. **Consistency**: MCP and CLI now behave identically
2. **Maintainability**: Single source of truth for business logic
3. **Reliability**: Proper tag context prevents data isolation issues
4. **Testability**: Clearer separation of concerns makes testing easier

## Future Recommendations

1. **Enforce Parameter Validation**: Consider adding runtime checks for required parameters
2. **Automated Testing**: Add integration tests that verify MCP/CLI parity
3. **Code Generation**: Consider generating MCP wrappers from CLI function signatures
4. **Documentation**: Keep this document updated as new patterns emerge