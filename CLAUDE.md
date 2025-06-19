# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Philosophy

Our guiding principle is "nail it before we scale it." This philosophy applies to all development, not just MVPs:

- **Start simple**: Focus on core functionality working reliably before adding complexity
- **Learn from usage**: Add features only when proven necessary through real-world use
- **Trust existing tools**: Let established systems (like Git) handle errors naturally rather than adding defensive layers
- **User owns their environment**: Users are responsible for disk space, permissions, and system requirements
- **Clear over clever**: Prefer clear error messages over pre-emptive checks and complex abstractions
- **Iterate based on evidence**: Every new feature should solve a proven problem, not a theoretical one
- **Reuse error handling**: ALWAYS use existing error handling channels. Custom error handlers require explicit user approval with detailed justification

This approach ensures we build what users actually need, not what we imagine they might want.

## Post-Task Checklist (Run Before Marking Done)

### 🔴 Critical Checks (MUST Run)

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

4. **Biome Check (Combined Lint & Format)**

   ```bash
   npx biome check .
   ```

   This runs both linting and format checking together

5. **Error Handling Audit**

   - ✓ Uses existing error patterns (`throw new Error()`)
   - ✓ No custom error classes without explicit approval
   - ✓ Error messages follow project patterns

6. **Git Status Clean**
   ```bash
   git status
   ```
   All changes must be committed before marking done

### 🟡 Important Checks

7. **Run Tests**

   ```bash
   npm test
   ```

   If tests fail, fix them unless explicitly told to skip

8. **Remove Debug Code**
   ```bash
   # Check for debug artifacts in your changed files
   git diff --name-only HEAD | xargs grep -l "console\.log\|TODO\|FIXME\|XXX" 2>/dev/null || echo "✓ Clean"
   ```
   Remove any debug logs or unresolved TODOs you added

### ❌ Do NOT Do Unless Explicitly Asked

- Write new tests (separate task)
- Refactor unrelated code
- Add "nice to have" features
- Create documentation
- Performance optimization
- Security audits

## Task Completion Workflow

**NEVER** mark a task as "done" without running the checklist:

1. When work is complete: `set_task_status --id X --status review`
2. Run the Post-Task Checklist above
3. Fix any issues found
4. Only then: `set_task_status --id X --status done`

**Alternative**: Use the `/task-complete` command which includes the checklist.

## Common Development Commands

### MCP Tools

I have access to multiple MCP tool servers providing comprehensive functionality:

#### MCP Resource Tools

- **`ListMcpResourcesTool`** - List available MCP resources
- **`ReadMcpResourceTool`** - Read specific MCP resources

All MCP tools are prefixed with their server name (e.g., `mcp__taskmaster-ai__`) and automatically determine context from the workspace.

#### AI & Research Tools (`mcp__repomix__`, `mcp__code-reasoning__`, `mcp__sequential-thinking__`, `mcp__perplexity-ask__`, `mcp__context7__`)

> **ALWAYS use `repomix` when searching through the codebase**

- **`mcp__repomix__pack_codebase`** - Generate an XML file of the current codebase for efficient search
- **`mcp__repomix__pack_remote_repository`** - Generate an XML file of a remote repository for efficient search
- **`mcp__repomix__grep_repomix_output`** - Search for patterns in packed codebase using regex
- **`mcp__repomix__read_repomix_output`** - Read contents of packed codebase with optional line ranges
- **`mcp__repomix__file_system_read_directory`** - List directory contents with file/folder indicators
- **`mcp__repomix__file_system_read_file`** - Read individual files with security validation
- **`mcp__code-reasoning__code-reasoning`** - Code reasoning and analysis
- **`mcp__sequential-thinking__sequentialthinking`** - Sequential thinking for complex problems
- **`mcp__perplexity-ask__perplexity_ask`** - Perplexity AI integration
- **`mcp__context7__resolve-library-id`** / **`get-library-docs`** - Library documentation

#### File System & Code Operations (`mcp__serena__`)

**System Operations**

- **`search_for_pattern`** - Search for regex patterns across the codebase
- **`restart_language_server`** - Restart language server when needed
- **`activate_project`** / **`remove_project`** - Project management
- **`switch_modes`** / **`get_current_config`** - Configuration management

**File Operations**

- **`list_dir`** - List directory contents recursively or non-recursively
- **`find_file`** - Find files by name pattern using wildcards
- **`read_file`** - Read file contents with offset/length support
- **`create_text_file`** - Write new files or overwrite existing ones

**Code Intelligence**

- **`get_symbols_overview`** - Get overview of code symbols in files/directories
- **`find_symbol`** - Find symbols by name path with optional filtering
- **`find_referencing_symbols`** - Find all references to a symbol

**Code Editing**

- **`replace_symbol_body`** - Replace the body of a specific symbol
- **`insert_after_symbol`** / **`insert_before_symbol`** - Insert code relative to symbols
- **`replace_regex`** - Replace content using regular expressions
- **`delete_lines`** / **`replace_lines`** / **`insert_at_line`** - Line-based editing

**Memory & Context Management**

- **`write_memory`** / **`read_memory`** / **`list_memories`** / **`delete_memory`** - Project memory management
- **`think_about_collected_information`** - Analyze gathered information sufficiency
- **`think_about_task_adherence`** - Verify task alignment before code changes
- **`think_about_whether_you_are_done`** - Assess task completion
- **`summarize_changes`** - Summarize codebase modifications

> **should ONLY be used when another tool cannot complete the needed action**

- **`execute_shell_command`** - Run terminal commands with output capture

#### Task Master Tools (`mcp__taskmaster-ai__`)

Task management and AI-powered project organization:

**Git Worktree Management**

- **`list_worktrees`** - List all active Git worktrees
- **`create_worktree`** - Create isolated Git worktree for task development
- **`remove_worktree`** - Remove Git worktree and cleanup

**Project & Task Management**

- **`initialize_project`** - Initialize a new Task Master project structure
- **`parse_prd`** - Parse Product Requirements Documents to generate tasks
- **`next_task`** - Find next task based on dependencies
- **`set_task_status`** - Set task/subtask status

**Single Task Operations**

- **`get_task`** - Get detailed task information
- **`add_task`** - Add new tasks with AI-generated details
- **`update_task`** - Update single task information
- **`remove_task`** - Remove tasks or subtasks permanently
- **`move_task`** - Move tasks/subtasks to new positions

**Single Subtask Operations**

- **`add_subtask`** - Add subtasks to existing tasks
- **`update_subtask`** - Append timestamped info to subtasks
- **`remove_subtask`** - Remove subtask from parent

**Multi-Task & Subtask Operations**

- **`get_tasks`** - Get all tasks with optional filtering
- **`update_tasks`** - Update multiple upcoming tasks with new context
- **`clear_subtasks`** - Clear all subtasks from tasks

**Analysis & Expansion**

- **`analyze_project_complexity`** - Analyze task complexity
- **`complexity_report`** - Display complexity analysis
- **`expand_task`** - Expand task into subtasks
- **`expand_all`** - Expand all pending tasks

**Dependencies & Tags**

- **`list_tags`** / **`use_tag`**
- **`add_tag`** / **`delete_tag`** / **`rename_tag`** / **`copy_tag`**
- **`validate_dependencies`** / **`fix_dependencies`**
- **`add_dependency`** / **`remove_dependency`**

**AI & Research**

- **`models`** - Configure AI models
- **`research`** - AI-powered research with project context

### Testing

```bash
# Run all tests
npm test

# Run only failed tests
npm run test:fails

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npm test tests/unit/commands.test.js

# Run e2e tests
npm run test:e2e
```

### Code Formatting

```bash
# Check formatting
npm run format-check

# Auto-format code
npm run format
```

### MCP Server Development

```bash
# Run the MCP server locally
npm run mcp-server

# Use MCP inspector for debugging
npm run inspector
```

### Release Management

```bash
# Create a changeset for your changes
npm run changeset

# Publish a release (maintainers only)
npm run release
```

## High-Level Architecture

### Project Structure

Task Master is an AI-powered task management system designed to work seamlessly with Cursor AI and other editors through the Model Context Protocol (MCP).

### Key Design Patterns

1. **Dual Interface Architecture**: Both CLI and MCP server share core business logic but have separate entry points and tool definitions.

2. **Provider Pattern**: AI services use a common base class allowing easy addition of new AI providers.

3. **Task File Structure**: Tasks are stored in JSON format with support for:

   - Hierarchical task/subtask relationships
   - Dependencies between tasks
   - Multiple task statuses (pending, in-progress, done, etc.)
   - Tag-based organization for different contexts

4. **Research Integration**: Special research functionality that can use Perplexity or other AI models to gather current information with project context.

#### Core Components

1. **MCP Server** (`mcp-server/`)

   - FastMCP-based server implementation that exposes Task Master functionality as MCP tools
   - Entry point: `mcp-server/server.js`
   - Core logic in `mcp-server/src/core/task-master-core.js`
   - Tools exposed through `mcp-server/src/tools/`
   - Direct function implementations in `mcp-server/src/core/direct-functions/`

2. **CLI Interface** (`scripts/`)

   - Traditional command-line interface for Task Master
   - Main entry: `scripts/dev.js` handles all CLI commands
   - Task management logic in `scripts/modules/task-manager/`
   - Initialization flow through `scripts/init.js`

3. **AI Providers** (`src/ai-providers/`)

   - Unified interface for multiple AI providers (Anthropic, OpenAI, Google, etc.)
   - Base provider class defines common interface
   - Each provider extends base class with specific implementation
   - Special Claude Code provider for integration with Claude's native tools

4. **Shared Utilities**
   - Configuration management through `scripts/modules/config-manager.js`
   - Path utilities handle cross-platform file paths
   - Logger utilities provide consistent logging across components

### Important Implementation Details

- All file paths should use absolute paths for reliability
- The project uses ES modules (type: "module" in package.json)
- Biome is used for code formatting with tab indentation
- Jest tests use experimental VM modules flag
- MCP tools automatically determine project root from workspace context
- Task IDs use a hierarchical system (e.g., "1", "1.1", "1.2" for subtasks)

### Environment Variables

Key API keys are loaded from environment:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `PERPLEXITY_API_KEY`
- `OPENROUTER_API_KEY`
- `XAI_API_KEY`
- `MISTRAL_API_KEY`
- `AZURE_OPENAI_API_KEY`
- `OLLAMA_API_KEY`
