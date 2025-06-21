Task Master AI is task management system for AI-driven development designed to work seamlessly with AI agents.

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

## Documentation

For more detailed information, check out the documentation in the `docs` directory:

- [Configuration Guide](docs/configuration.md) - Set up environment variables and customize Task Master
- [Tutorial](docs/tutorial.md) - Step-by-step guide to getting started with Task Master
- [Command Reference](docs/command-reference.md) - Complete list of all available commands
- [Task Structure](docs/task-structure.md) - Understanding the task format and features
- [Example Interactions](docs/examples.md) - Common Cursor AI interaction examples
- [Migration Guide](docs/migration-guide.md) - Guide to migrating to the new project structure

#### Quick Install for Cursor 1.0+ (One-Click)

📋 Click the copy button (top-right of code block) then paste into your browser:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=taskmaster-ai&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcGFja2FnZT10YXNrLW1hc3Rlci1haSIsInRhc2stbWFzdGVyLWFpIl0sImVudiI6eyJBTlRIUk9QSUNfQVBJX0tFWSI6IllPVVJfQU5USFJPUElDX0FQSV9LRVlfSEVSRSIsIlBFUlBMRVhJVFlfQVBJX0tFWSI6IllPVVJfUEVSUExFWElUWV9BUElfS0VZX0hFUkUiLCJPUEVOQUlfQVBJX0tFWSI6IllPVVJfT1BFTkFJX0tFWV9IRVJFIiwiR09PR0xFX0FQSV9LRVkiOiJZT1VSX0dPT0dMRV9LRVlfSEVSRSIsIk1JU1RSQUxfQVBJX0tFWSI6IllPVVJfTUlTVFJBTF9LRVlfSEVSRSIsIk9QRU5ST1VURVJfQVBJX0tFWSI6IllPVVJfT1BFTlJPVVRFUl9LRVlfSEVSRSIsIlhBSV9BUElfS0VZIjoiWU9VUl9YQUlfS0VZX0hFUkUiLCJBWlVSRV9PUEVOQUlfQVBJX0tFWSI6IllPVVJfQVpVUkVfS0VZX0hFUkUiLCJPTExBTUFfQVBJX0tFWSI6IllPVVJfT0xMQU1BX0FQSV9LRVlfSEVSRSJ9fQo=
```

> **Note:** After clicking the link, you'll still need to add your API keys to the configuration. The link installs the MCP server with placeholder keys that you'll need to replace with your actual API keys.

## Requirements

Task Master utilizes AI across several commands, and those require a separate API key. You can use a variety of models from different AI providers provided you add your API keys. For example, if you want to use Claude 3.7, you'll need an Anthropic API key.

You can define 3 types of models to be used: the main model, the research model, and the fallback model (in case either the main or research fail). Whatever model you use, its provider API key must be present in either mcp.json or .env.

At least one (1) of the following is required:

- Anthropic API key (Claude API)
- OpenAI API key
- Google Gemini API key
- Perplexity API key (for research model)
- xAI API Key (for research or main model)
- OpenRouter API Key (for research or main model)
- Claude Code (no API key required - requires Claude Code CLI)

Using the research model is optional but highly recommended. You will need at least ONE API key (unless using Claude Code). Adding all API keys enables you to seamlessly switch between model providers at will.

## Quick Start

### Option 1: MCP (Recommended)

MCP (Model Control Protocol) lets you run Task Master directly from your editor.

#### 1. Add your MCP config at the following path depending on your editor

| Editor       | Scope   | Linux/macOS Path                      | Windows Path                                      | Key          |
| ------------ | ------- | ------------------------------------- | ------------------------------------------------- | ------------ |
| **Cursor**   | Global  | `~/.cursor/mcp.json`                  | `%USERPROFILE%\.cursor\mcp.json`                  | `mcpServers` |
|              | Project | `<project_folder>/.cursor/mcp.json`   | `<project_folder>\.cursor\mcp.json`               | `mcpServers` |
| **Windsurf** | Global  | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `mcpServers` |
| **VS Code**  | Project | `<project_folder>/.vscode/mcp.json`   | `<project_folder>\.vscode\mcp.json`               | `servers`    |

##### Manual Configuration

###### Cursor & Windsurf (`mcpServers`)

```json
{
  "mcpServers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
        "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
        "OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "YOUR_AZURE_KEY_HERE",
        "OLLAMA_API_KEY": "YOUR_OLLAMA_API_KEY_HERE"
      }
    }
  }
}
```

> 🔑 Replace `YOUR_…_KEY_HERE` with your real API keys. You can remove keys you don't use.

> **Note**: If you see `0 tools enabled` in the MCP settings, try removing the `--package=task-master-ai` flag from `args`.

###### VS Code (`servers` + `type`)

```json
{
  "servers": {
    "taskmaster-ai": {
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"],
      "env": {
        "ANTHROPIC_API_KEY": "YOUR_ANTHROPIC_API_KEY_HERE",
        "PERPLEXITY_API_KEY": "YOUR_PERPLEXITY_API_KEY_HERE",
        "OPENAI_API_KEY": "YOUR_OPENAI_KEY_HERE",
        "GOOGLE_API_KEY": "YOUR_GOOGLE_KEY_HERE",
        "MISTRAL_API_KEY": "YOUR_MISTRAL_KEY_HERE",
        "OPENROUTER_API_KEY": "YOUR_OPENROUTER_KEY_HERE",
        "XAI_API_KEY": "YOUR_XAI_KEY_HERE",
        "AZURE_OPENAI_API_KEY": "YOUR_AZURE_KEY_HERE"
      },
      "type": "stdio"
    }
  }
}
```

> 🔑 Replace `YOUR_…_KEY_HERE` with your real API keys. You can remove keys you don't use.

#### 2. (Cursor-only) Enable Taskmaster MCP

Open Cursor Settings (Ctrl+Shift+J) ➡ Click on MCP tab on the left ➡ Enable task-master-ai with the toggle

#### 3. (Optional) Configure the models you want to use

In your editor's AI chat pane, say:

```txt
Change the main, research and fallback models to <model_name>, <model_name> and <model_name> respectively.
```

For example, to use Claude Code (no API key required):

```txt
Change the main model to claude-code/sonnet
```

[Table of available models](docs/models.md) | [Claude Code setup](docs/examples/claude-code-usage.md)

#### 4. Initialize Task Master

In your editor's AI chat pane, say:

```txt
Initialize taskmaster-ai in my project
```

#### 5. Make sure you have a PRD (Recommended)

For **new projects**: Create your PRD at `.taskmaster/docs/prd.txt`
For **existing projects**: You can use `scripts/prd.txt` or migrate with `task-master migrate`

An example PRD template is available after initialization in `.taskmaster/templates/example_prd.txt`.

> [!NOTE]
> While a PRD is recommended for complex projects, you can always create individual tasks by asking "Can you help me implement [description of what you want to do]?" in chat.

**Always start with a detailed PRD.**

The more detailed your PRD, the better the generated tasks will be.

#### 6. Common Commands

Use your AI assistant to:

- Parse requirements: `Can you parse my PRD at scripts/prd.txt?`
- Plan next step: `What's the next task I should work on?`
- Implement a task: `Can you help me implement task 3?`
- View multiple tasks: `Can you show me tasks 1, 3, and 5?`
- Expand a task: `Can you help me expand task 4?`
- **Research fresh information**: `Research the latest best practices for implementing JWT authentication with Node.js`
- **Research with context**: `Research React Query v5 migration strategies for our current API implementation in src/api.js`

[More examples on how to use Task Master in chat](docs/examples.md)

### Option 2: Using Command Line

#### Installation

```bash
# Install globally
npm install -g task-master-ai

# OR install locally within your project
npm install task-master-ai
```

#### Initialize a new project

```bash
# If installed globally
task-master init

# If installed locally
npx task-master init

# Initialize project with specific rules
task-master init --rules cursor,windsurf,vscode
```

This will prompt you for project details and set up a new project with the necessary files and structure.

#### Common Commands

```bash
# Initialize a new project
task-master init

# Parse a PRD and generate tasks
task-master parse-prd your-prd.txt

# List all tasks
task-master list

# Show the next task to work on
task-master next

# Show specific task(s) - supports comma-separated IDs
task-master show 1,3,5

# Research fresh information with project context
task-master research "What are the latest best practices for JWT authentication?"

# Generate task files
task-master generate

# Add rules after initialization
task-master rules add windsurf,roo,vscode
```

## Git Worktrees Support

Task Master includes experimental support for Git worktrees, allowing you to work on multiple tasks in parallel using isolated development environments.

### What are Git Worktrees?

Git worktrees let you have multiple working copies of your repository checked out to different branches simultaneously. Task Master integrates with this Git feature to create task-specific worktrees, making it easy to:

- Work on multiple tasks in parallel without branch switching
- Keep uncommitted changes isolated between tasks
- Run tests or builds in one worktree while coding in another
- Quickly switch between task contexts

### Requirements

- Git 2.5 or later
- Feature must be enabled in your configuration

### Enabling Worktree Support

Add the following to your `.taskmaster/config.json`:

```json
{
  "features": {
    "worktrees": true
  }
}
```

### Worktree Commands

All worktree commands are available through the CLI:

```bash
# Create a worktree for a specific task
task-master worktree-create --task 123
task-master worktree-create --task 123 --base-branch develop

# List all worktrees
task-master worktree-list

# Remove a worktree
task-master worktree-remove task-123
task-master worktree-remove task-123 --force  # Force removal with uncommitted changes
task-master worktree-remove task-123 --remove-branch  # Also remove the branch

# Check current worktree status
task-master worktree-status
```

### How It Works

1. **Creating a Worktree**: When you run `worktree-create --task 123`, Task Master:

   - Creates a new branch named `task-123`
   - Creates a worktree at `./worktrees/task-123/`
   - Sets up the worktree with the task branch checked out
   - Registers the worktree in Task Master's state management

2. **Working in Worktrees**: Each worktree is a complete copy of your repository:

   - Navigate to `./worktrees/task-123/` to work on task 123
   - All Git operations work normally within the worktree
   - Changes are isolated to that specific branch

3. **Removing Worktrees**: The `worktree-remove` command safely cleans up:
   - Removes the worktree directory
   - Optionally removes the associated branch
   - Updates Task Master's state tracking
   - Prevents accidental removal while inside a worktree

### Best Practices

1. **One Task, One Worktree**: Create a dedicated worktree for each task you're actively working on
2. **Clean Up Regularly**: Remove worktrees after merging tasks to keep your workspace organized
3. **Commit Before Removing**: Always commit or stash changes before removing a worktree
4. **Use Base Branches**: Specify the appropriate base branch when creating worktrees for feature work

### Safety Features

- **Prevents Self-Deletion**: Cannot remove a worktree while your terminal is inside it
- **Uncommitted Changes Protection**: Requires `--force` flag to remove worktrees with uncommitted changes
- **Branch Protection**: Separate `--remove-branch` flag required to delete branches
- **Feature Flag**: Worktree commands only work when explicitly enabled in configuration

## Claude Code Support

Task Master now supports Claude models through the Claude Code CLI, which requires no API key:

- **Models**: `claude-code/opus` and `claude-code/sonnet`
- **Requirements**: Claude Code CLI installed
- **Benefits**: No API key needed, uses your local Claude instance

[Learn more about Claude Code setup](docs/examples/claude-code-usage.md)

## Troubleshooting

### If `task-master init` doesn't respond

Try running it with Node directly:

```bash
node node_modules/claude-task-master/scripts/init.js
```

Or clone the repository and run:

```bash
git clone https://github.com/eyaltoledano/claude-task-master.git
cd claude-task-master
node scripts/init.js
```

## Contributors

<a href="https://github.com/eyaltoledano/claude-task-master/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=eyaltoledano/claude-task-master" alt="Task Master project contributors" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=eyaltoledano/claude-task-master&type=Timeline)](https://www.star-history.com/#eyaltoledano/claude-task-master&Timeline)

## Licensing

Task Master is licensed under the MIT License with Commons Clause. This means you can:

✅ **Allowed**:

- Use Task Master for any purpose (personal, commercial, academic)
- Modify the code
- Distribute copies
- Create and sell products built using Task Master

❌ **Not Allowed**:

- Sell Task Master itself
- Offer Task Master as a hosted service
- Create competing products based on Task Master

See the [LICENSE](LICENSE) file for the complete license text and [licensing details](docs/licensing.md) for more information.
