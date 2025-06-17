Show detailed task information with rich context and insights.

Arguments: $ARGUMENTS

## Enhanced Task Display with Smart Selection

### 1. **Intelligent Task Resolution**

Parse $ARGUMENTS to understand user intent:

**Direct ID**: `5`, `15`, `23.2`
→ Show specific task by ID

**Natural Language**: `"the login bug"`, `"authentication task"`
→ Search task titles and descriptions for best match

**Relative References**: 
- `"current"` → Currently in-progress task
- `"previous"` → Last viewed/modified task
- `"next"` → Next recommended task
- `"blocked"` → Tasks blocked by dependencies

**Multiple Selection**: `"5 8 12"`, `"all frontend"`
→ Show multiple tasks in sequence

**Smart Filters**: `"high priority pending"`, `"my tasks"`
→ Show filtered task list with details

### 2. **Context-Aware Display**

Adapt output based on request:

```bash
# Simple ID - Full detail view
/task-master/task-show 15

# Natural language - Show with match confidence
/task-master/task-show "the auth bug"
→ "Found: Task #15 'Fix authentication timeout' (95% match)"

# Multiple - Compact comparison view
/task-master/task-show "15 16 17"
→ Side-by-side status comparison

# Filter - List with expandable details
/task-master/task-show "blocked tasks"
→ Tree view showing what's blocking each
```

### 3. **Smart Defaults**

When no arguments provided:
- If task in progress → Show current task
- If just completed task → Show next recommended
- Otherwise → Show task summary dashboard

### 4. **Enhanced Output Modifiers**

Support inline output control:
- `"15 format:json"` → JSON output
- `"current verbose"` → Extended details
- `"all minimal"` → ID and title only
- `"15 with:history"` → Include change log
- `"blocked tree"` → Dependency tree view

### 5. **Implementation**

```javascript
function parseTaskShowArguments($ARGUMENTS) {
  // Check for special keywords
  if ($ARGUMENTS === "current") {
    return { type: "current", tasks: getCurrentTask() };
  }
  
  // Check for natural language
  if (!$ARGUMENTS.match(/^\d/)) {
    return { type: "search", tasks: searchTasks($ARGUMENTS) };
  }
  
  // Check for multiple IDs
  if ($ARGUMENTS.includes(" ")) {
    return { type: "multiple", tasks: parseMultipleIds($ARGUMENTS) };
  }
  
  // Default to single ID
  return { type: "single", tasks: [parseId($ARGUMENTS)] };
}
```

This approach makes the command more intuitive and powerful while maintaining backward compatibility.