# Code Style and Conventions

## Formatting (Biome Configuration)
- **Indentation**: Tabs (not spaces)
- **Line Width**: 80 characters
- **Quotes**: Single quotes for JavaScript
- **Bracket Spacing**: Enabled
- **Arrow Parentheses**: Always include parentheses
- **Trailing Commas**: None

## JavaScript Conventions
- **ES Modules**: Use `import`/`export` syntax
- **Async/Await**: Prefer over promises for readability
- **Error Handling**: Use `throw new Error()` pattern
- **Function Declarations**: Use function declarations for main functions
- **Arrow Functions**: Use for short callbacks and inline functions

## File Organization
- **MCP Tools**: Prefix with `mcp__server-name__`
- **Utilities**: Separate into logical modules
- **Constants**: Define in `src/constants/`
- **Tests**: Mirror source structure in `tests/`

## Documentation
- **JSDoc**: Document public functions with parameters and return types
- **README**: Keep comprehensive and up-to-date
- **CLAUDE.md**: Development instructions for AI assistants

## Naming Conventions
- **Files**: kebab-case for filenames
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Variables**: camelCase
- **Classes**: PascalCase

## Project-Specific Rules
- Disable certain Biome rules (see biome.json)
- Use absolute paths for file operations
- Follow "nail it before we scale it" philosophy
- Prefer clear error messages over defensive programming