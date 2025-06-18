# Suggested Commands for Task Master Development

## Essential Commands (macOS/Darwin)

### System Commands
```bash
ls -la                    # List files with details
find . -name "*.js"       # Find JavaScript files
grep -r "pattern" .       # Search for patterns
git status               # Check git status
git diff                 # View changes
cd /path/to/dir          # Change directory
```

### Development Commands
```bash
# Testing
npm test                 # Run all tests
npm run test:fails       # Run only failed tests
npm run test:watch       # Watch mode testing
npm run test:coverage    # Coverage report
npm run test:e2e         # End-to-end tests

# Code Quality
npm run format-check     # Check formatting
npm run format          # Auto-format code
npx biome lint .         # Run linter
npx biome check .        # Combined lint & format

# MCP Development
npm run mcp-server       # Run MCP server locally
npm run inspector       # MCP inspector for debugging

# Release
npm run changeset       # Create changeset
npm run release         # Publish release
```

### Task Master CLI
```bash
# Project management
task-master init                    # Initialize project
task-master parse-prd              # Parse requirements document
task-master add-task "description" # Add new task
task-master list                   # List all tasks
task-master next                   # Find next task to work on

# Task status
task-master set-status --id 1 --status in-progress
task-master set-status --id 1 --status done

# Dependencies
task-master add-dependency --id 2 --depends-on 1
task-master validate-dependencies
```