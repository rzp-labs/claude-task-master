# Task Enhancement System Documentation

## Overview

The Task Enhancement System is a comprehensive AI-powered feature that automatically improves task descriptions, details, and test strategies using advanced language models. It provides intelligent enhancements with robust error handling, timeout protection, and mode-specific behavior for both CLI and MCP environments.

## Architecture

### Core Components

1. **enhance-task-details.js** - Main enhancement logic
2. **enhancement-utils.js** - Utility functions for enhancement state management
3. **enhancement-errors.js** - Error classification and handling
4. **update-single-task-status.js** - Status change triggers

### Integration Points

- **AI Services**: Unified interface supporting multiple providers (Anthropic, OpenAI, Perplexity, etc.)
- **Configuration Management**: Dynamic configuration with validation
- **UI Systems**: Separate feedback for CLI (spinners) and MCP (structured logging)
- **Task Management**: Seamless integration with task lifecycle

## Features

### Intelligent Enhancement

- **Multi-level Detail**: Minimal, moderate, and comprehensive enhancement levels
- **AI Model Selection**: Automatic selection between research and main models with fallback
- **Context-Aware**: Uses project context and task information for better results
- **Metadata Enrichment**: Adds technical considerations, challenges, and success criteria

### Robust Error Handling

- **Error Classification**: Timeout, API, Network, Validation, and Configuration errors
- **User-Friendly Messages**: Clear guidance for error resolution
- **Graceful Degradation**: Fallback mechanisms when primary models fail
- **Recovery Guidance**: Specific recommendations based on error type

### Configuration System

```json
{
  "taskEnhancement": {
    "enabled": true,
    "required": false,
    "detailLevel": "moderate",
    "timeout": 30000,
    "useResearch": true,
    "enhanceOnCommands": ["create", "update", "expand", "status-change"]
  }
}
```

### Timeout Protection

- **Configurable Timeouts**: 15 seconds minimum, 5 minutes maximum
- **Automatic Cleanup**: Resource cleanup on timeout
- **Performance Tracking**: Duration and token usage metrics

## Enhancement Triggers

### Automatic Triggers

1. **Status Change**: When task status changes to 'in-progress'
2. **Task Creation**: New tasks (if configured)
3. **Task Updates**: Modified tasks (if configured)
4. **Task Expansion**: When tasks are expanded with subtasks

### Manual Triggers

- Direct API calls through MCP tools
- CLI commands with force options
- Programmatic enhancement requests

## API Reference

### Main Functions

#### `enhanceTaskDetails(task, options)`

Enhances a task with AI-generated improvements.

**Parameters:**
- `task` (Object): The task to enhance
- `options` (Object): Enhancement options
  - `detailLevel` (String): 'minimal', 'moderate', or 'comprehensive'
  - `timeout` (Number): Timeout in milliseconds (15000-300000)
  - `useResearch` (Boolean): Whether to use research model
  - `force` (Boolean): Force enhancement even if disabled
  - `context` (Object): Project context and logging
  - `projectRoot` (String): Absolute path to project root

**Returns:**
```javascript
{
  success: Boolean,
  task: Object,           // Enhanced task object
  error: String,          // Error message if failed
  isTimeout: Boolean,     // Whether failure was due to timeout
  errorType: String,      // Classified error type
  recoverable: Boolean,   // Whether error is recoverable
  errorSummary: Object,   // Detailed error information
  telemetryData: Object,  // Performance metrics
  modelUsed: String,      // Model that generated the enhancement
  fallbackUsed: Boolean,  // Whether fallback was used
  timestamp: String       // Enhancement timestamp
}
```

#### `taskNeedsEnhancement(task, config)`

Determines if a task needs enhancement based on configuration and state.

#### `getEnhancementConfig(projectRoot)`

Retrieves and validates enhancement configuration with defaults.

### Error Types

- **TimeoutError**: Operation exceeded time limit
- **APIError**: API key missing or provider issues
- **NetworkError**: Connection or network problems
- **ValidationError**: Invalid input or configuration
- **ConfigurationError**: Configuration issues
- **AIServiceError**: AI service-specific errors

## Usage Examples

### Basic Enhancement

```javascript
import { enhanceTaskDetails } from './enhance-task-details.js';

const task = {
  id: 1,
  title: 'Implement user authentication',
  description: 'Add login functionality',
  status: 'pending'
};

const result = await enhanceTaskDetails(task, {
  detailLevel: 'moderate',
  projectRoot: '/path/to/project'
});

if (result.success) {
  console.log('Enhanced task:', result.task);
} else {
  console.error('Enhancement failed:', result.error);
}
```

### Status Change Trigger

```javascript
import { handleTaskEnhancementTrigger } from './update-single-task-status.js';

// Automatically triggered when task status changes to 'in-progress'
await handleTaskEnhancementTrigger(task, tasksPath, showUi);
```

### Configuration-Based Enhancement

```javascript
// Configuration in .taskmaster/config.json
{
  "taskEnhancement": {
    "enabled": true,
    "required": true,        // Makes enhancement mandatory
    "detailLevel": "comprehensive",
    "timeout": 45000,
    "useResearch": true,
    "enhanceOnCommands": ["status-change"]
  }
}
```

## Testing

### Test Categories

1. **Unit Tests**: Core logic validation
2. **Integration Tests**: Component interaction testing
3. **Error Handling Tests**: Comprehensive error scenarios
4. **Timeout Tests**: Timeout behavior verification
5. **Configuration Tests**: Configuration validation

### Test Fixtures

The system includes comprehensive test fixtures and mocks:

- **enhancement-fixtures.js**: Task and configuration factories
- **enhancement-mocks.js**: Jest module mocks and utilities
- **Test scenarios**: Parameterized test cases for various conditions

### Running Tests

```bash
# All tests
npm test

# Specific test files
npm test tests/unit/scripts/modules/task-manager/enhance-task-details-comprehensive.test.js
npm test tests/unit/scripts/modules/task-manager/enhance-task-details-timeout.test.js
npm test tests/integration/task-enhancement-workflow.test.js
```

## Performance Considerations

### Optimization Strategies

1. **Model Selection**: Intelligent routing between models based on capability
2. **Timeout Management**: Configurable timeouts prevent hanging operations
3. **Caching**: Enhancement state tracking prevents duplicate work
4. **Resource Cleanup**: Proper cleanup of timers and resources

### Telemetry

The system tracks:
- Token usage for cost monitoring
- Enhancement duration for performance analysis
- Error rates and types for reliability metrics
- Model usage patterns for optimization

## Security

### API Key Management

- Environment variable-based configuration
- Provider-specific key validation
- Secure error messages (no key exposure)

### Input Validation

- Comprehensive input sanitization
- Configuration validation with safe defaults
- Protection against malicious inputs

## Troubleshooting

### Common Issues

1. **Enhancement Disabled**
   - Check `taskEnhancement.enabled` in configuration
   - Use `force: true` to override

2. **API Key Errors**
   - Verify environment variables (ANTHROPIC_API_KEY, etc.)
   - Check provider configuration

3. **Timeout Issues**
   - Increase timeout in configuration
   - Check network connectivity
   - Consider using main model instead of research

4. **Model Selection Issues**
   - Verify model provider configuration
   - Check API key availability for selected providers

### Debug Mode

Enable debug logging for detailed information:

```javascript
// Configuration
{
  "debug": true,
  "logLevel": "debug"
}
```

## Future Enhancements

### Planned Features

1. **Custom Prompts**: User-defined enhancement prompts
2. **Quality Metrics**: Enhancement quality scoring
3. **Batch Processing**: Multiple task enhancement
4. **A/B Testing**: Model comparison and optimization
5. **Advanced Caching**: Intelligent enhancement caching

### Extension Points

The system is designed for extensibility:
- Custom error handlers
- Additional AI providers
- Custom enhancement levels
- Specialized enhancement strategies

## Contributing

### Development Setup

1. Install dependencies: `npm install`
2. Run tests: `npm test`
3. Format code: `npm run format`
4. Check types: `npm run typecheck`

### Adding New Features

1. Update core logic in `enhance-task-details.js`
2. Add corresponding tests
3. Update configuration schema if needed
4. Document new features

### Best Practices

- Always add comprehensive tests for new features
- Follow existing error handling patterns
- Maintain backward compatibility
- Update documentation for API changes