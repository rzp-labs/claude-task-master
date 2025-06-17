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

#### Desktop Commander Tools (`mcp__desktop-commander__`)

File system and command execution:

**File Operations**

- **`read_file`** - Read file contents with offset/length support
- **`read_multiple_files`** - Read multiple files simultaneously
- **`write_file`** - Write or append to files
- **`create_directory`** - Create directories
- **`list_directory`** - List directory contents
- **`move_file`** - Move or rename files
- **`search_files`** - Find files by name pattern
- **`search_code`** - Search code with ripgrep
- **`get_file_info`** - Get file metadata
- **`edit_block`** - Surgical text replacements

**Command Execution**

- **`execute_command`** - Run terminal commands
- **`read_output`** - Read command output
- **`force_terminate`** - Terminate sessions
- **`list_sessions`** - List active sessions
- **`list_processes`** - List running processes
- **`kill_process`** - Terminate processes

**Configuration**

- **`get_config`** / **`set_config_value`** - Manage Desktop Commander config

#### Task Master Tools (`mcp__taskmaster-ai__`)

Task management and AI-powered project organization:

**Project & Task Management**

- **`initialize_project`** - Initialize a new Task Master project structure
- **`parse_prd`** - Parse Product Requirements Documents to generate tasks
- **`add_task`** - Add new tasks with AI-generated details
- **`add_subtask`** - Add subtasks to existing tasks
- **`update_task`** - Update single task information
- **`update_subtask`** - Append timestamped info to subtasks
- **`update`** - Update multiple upcoming tasks with new context
- **`remove_task`** - Remove tasks or subtasks permanently
- **`remove_subtask`** - Remove subtask from parent
- **`clear_subtasks`** - Clear all subtasks from tasks
- **`move_task`** - Move tasks/subtasks to new positions

**Task Status & Queries**

- **`get_tasks`** - Get all tasks with optional filtering
- **`get_task`** - Get detailed task information
- **`next_task`** - Find next task based on dependencies
- **`set_task_status`** - Set task/subtask status

**Analysis & Expansion**

- **`analyze_project_complexity`** - Analyze task complexity
- **`expand_task`** - Expand task into subtasks
- **`expand_all`** - Expand all pending tasks
- **`complexity_report`** - Display complexity analysis

**Dependencies & Tags**

- **`add_dependency`** / **`remove_dependency`** - Manage task dependencies
- **`validate_dependencies`** / **`fix_dependencies`** - Check and fix dependencies
- **`list_tags`** / **`add_tag`** / **`delete_tag`** - Tag management
- **`use_tag`** / **`rename_tag`** / **`copy_tag`** - Tag operations

**AI & Research**

- **`models`** - Configure AI models
- **`research`** - AI-powered research with project context
- **`generate`** - Generate task files

#### Language Server Tools (`mcp__language-server__`)

Code intelligence and refactoring:

- **`definition`** - Find symbol definitions
- **`diagnostics`** - Get file diagnostics
- **`edit_file`** - Apply multiple text edits
- **`hover`** - Get hover information
- **`references`** - Find all symbol usages
- **`rename_symbol`** - Rename symbols across codebase

#### AI & Research Tools

- **`mcp__sequential-thinking__sequentialthinking`** - Sequential thinking for complex problems
- **`mcp__code-reasoning__code-reasoning`** - Code reasoning and analysis
- **`mcp__perplexity-ask__perplexity_ask`** - Perplexity AI integration
- **`mcp__context7__resolve-library-id`** / **`get-library-docs`** - Library documentation

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

### Key Design Patterns

1. **Dual Interface Architecture**: Both CLI and MCP server share core business logic but have separate entry points and tool definitions.

2. **Provider Pattern**: AI services use a common base class allowing easy addition of new AI providers.

3. **Task File Structure**: Tasks are stored in JSON format with support for:

   - Hierarchical task/subtask relationships
   - Dependencies between tasks
   - Multiple task statuses (pending, in-progress, done, etc.)
   - Tag-based organization for different contexts

4. **Research Integration**: Special research functionality that can use Perplexity or other AI models to gather current information with project context.

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
