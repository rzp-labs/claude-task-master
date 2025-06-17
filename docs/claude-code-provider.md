# Claude Code Provider Integration Documentation

## Overview

The Claude Code provider integration enables Task Master users to leverage their Claude Code flat-fee subscription plan for all AI operations without requiring separate API keys or incurring per-token costs. This integration uses the same OAuth2 authentication as the Claude desktop app through the `@anthropic-ai/claude-code` SDK.

## Key Features

### 1. No API Key Required
Unlike traditional API providers, Claude Code uses transparent OAuth2 authentication through the Claude desktop app. This means:
- No API keys to manage or rotate
- No environment variables to set
- Authentication happens automatically if Claude desktop app is installed and logged in

### 2. Flat-Fee Pricing Model
- **Cost**: $0 (Free with Claude Code subscription)
- All operations show as "Free" in Task Master's cost tracking
- No per-token charges
- Unlimited usage within Claude Code subscription limits

### 3. Multiple Model Support
The integration supports both Claude Opus 4 and Claude Sonnet 4 models:
- `claude-opus-4-20250514` (72.5% SWE score) - Default
- `claude-sonnet-4-20250514` (72.7% SWE score)

### 4. Provider/Model Format
To distinguish between flat-fee Claude Code and pay-per-token Anthropic API:
```bash
# Use Claude Code (free with subscription)
task-master models --set-main claude-code/claude-opus-4-20250514

# Use Anthropic API (pay per token)
task-master models --set-main anthropic/claude-opus-4-20250514
```

## Technical Implementation

### Configuration Changes

#### 1. No API Key Requirement (`config-manager.js`)
```javascript
// Line 483 - isApiKeySet()
if (providerName?.toLowerCase() === 'ollama' || providerName?.toLowerCase() === 'claude-code') {
    return true; // No API key needed
}

// Line 580 - getMcpApiKeyStatus()
case 'claude-code':
    return true; // Uses OAuth2 through CLI
```

#### 2. Provider Registration (`ai-services-unified.js`)
```javascript
// Line 43 - Import
import { ClaudeCodeProvider } from '../../src/ai-providers/index.js';

// Line 58 - Provider instance
'claude-code': new ClaudeCodeProvider()

// Line 178 - Key mapping
'claude-code': null // No API key needed

// Lines 188-191 - Special handling
if (providerName === 'claude-code') {
    return null; // Claude Code uses OAuth2 through CLI
}
```

#### 3. Cost Display (`ui.js`)
```javascript
const formatCost = (costObj, provider) => {
    if (provider === 'claude-code') {
        return chalk.green('Free');
    }
    // ... regular cost calculation
}
```

### Provider Implementation (`claude-code.js`)

Key features of the Claude Code provider:

1. **SDK Integration**
   ```javascript
   import { query } from '@anthropic-ai/claude-code/sdk.mjs';
   ```

2. **Model Mapping**
   ```javascript
   this.modelMapping = {
       'claude-code': 'claude-opus-4-20250514', // Default
       'claude-opus-4-20250514': 'claude-opus-4-20250514',
       'claude-sonnet-4-20250514': 'claude-sonnet-4-20250514'
   };
   ```

3. **Usage Extraction**
   ```javascript
   // Extract actual usage from SDK result messages
   if (message.type === 'result' && message.result) {
       return {
           promptTokens: result.input_tokens || 0,
           completionTokens: result.output_tokens || 0,
           totalTokens: (result.input_tokens || 0) + (result.output_tokens || 0)
       };
   }
   ```

4. **AbortController Support**
   ```javascript
   const abortController = abortSignal ? { signal: abortSignal } : undefined;
   ```

## Usage Examples

### Basic Setup
```bash
# Set Claude Code as main provider
task-master models --set-main claude-code

# Or specify a specific model
task-master models --set-main claude-code/claude-opus-4-20250514
```

### PRD Parsing
```bash
# Parse a PRD using Claude Code (free)
task-master parse-prd --input=requirements.txt

# Output shows:
# Provider: claude-code
# Model: claude-opus-4-20250514
# Est. Cost: $0.000000
```

### Model Comparison
```bash
# List all available models
task-master models --list

# Claude Code models appear at the bottom:
# claude-code | claude-opus-4-20250514  | 72.5% ★★★ | Free
# claude-code | claude-sonnet-4-20250514 | 72.7% ★★★ | Free
```

### Mixed Provider Setup
```bash
# Use Claude Code for main (free)
task-master models --set-main claude-code/claude-opus-4-20250514

# Use Perplexity for research
task-master models --set-research perplexity/sonar-pro

# Use Anthropic API for fallback (pay per token)
task-master models --set-fallback anthropic/claude-3-7-sonnet-20250219
```

## Error Handling

### SDK Not Installed
```
Error: Claude Code SDK not installed. Please install it with:
npm install @anthropic-ai/claude-code

Note: This SDK requires Node.js 18+ and uses the same authentication as Claude desktop app.
```

### Authentication Failed
```
Error: Claude Code authentication failed. The SDK uses the same authentication as Claude desktop app.
Please ensure Claude desktop app is installed and authenticated.
```

### Claude Desktop Not Found
```
Error: Claude desktop app not found. The SDK requires Claude desktop app for authentication.
Please install it from: https://claude.ai/download
```

## Testing

### Unit Tests
All 18 unit tests pass, covering:
- Text generation
- Object generation
- Streaming
- Tool/function calling
- AbortController support
- Usage extraction
- Error handling

### Integration Testing
Manual testing confirmed:
1. Model configuration and switching
2. PRD parsing and task generation
3. Task operations (list, expand, update)
4. Cost tracking (shows as "Free")
5. Provider/model format parsing
6. Error handling for invalid models/providers

## Migration Guide

For users currently using Anthropic API who want to switch to Claude Code:

1. **Install Claude Desktop App**: Download from https://claude.ai/download
2. **Install SDK**: `npm install @anthropic-ai/claude-code`
3. **Switch Provider**: `task-master models --set-main claude-code`
4. **Remove API Keys**: No longer needed for Claude Code

## Limitations

1. **Authentication**: Requires Claude desktop app to be installed and logged in
2. **Usage Reporting**: SDK doesn't report token usage in the same format as API
3. **Model Selection**: Limited to Opus 4 and Sonnet 4 models
4. **Regional Availability**: Subject to Claude Code subscription availability

## Future Enhancements

1. **MCP Server Integration**: Explore deeper integration with Claude Code's MCP capabilities
2. **Enhanced Usage Tracking**: Improve token usage extraction from SDK
3. **Model Auto-Selection**: Automatically choose between Opus and Sonnet based on task complexity
4. **Workspace Integration**: Leverage Claude Code's workspace understanding features

## Troubleshooting

### Provider Not Found
If you see "Unknown provider 'claude-code'", ensure you're using the latest version of Task Master with Claude Code support.

### Authentication Issues
1. Verify Claude desktop app is installed: `which claude`
2. Check authentication status: `claude auth status`
3. Re-authenticate if needed: `claude auth login`

### Model Not Available
Ensure you're using one of the supported models:
- `claude-opus-4-20250514`
- `claude-sonnet-4-20250514`
- `claude-code` (defaults to Opus 4)

## Technical Details

### SDK Version
- Package: `@anthropic-ai/claude-code`
- Version: 1.0.24
- Import: `@anthropic-ai/claude-code/sdk.mjs`

### Authentication Flow
1. SDK checks for Claude desktop app installation
2. Uses existing OAuth2 token from desktop app
3. No API key exchange required
4. Transparent to Task Master operations

### Cost Calculation
- Input tokens: $0/million
- Output tokens: $0/million
- Display: "Free" in all cost summaries
- Telemetry: Records usage but shows $0 cost

## References

- [Claude Code SDK on npm](https://www.npmjs.com/package/@anthropic-ai/claude-code)
- [Claude Desktop App](https://claude.ai/download)
- [Task Master Documentation](../README.md)
- [Provider Implementation](../src/ai-providers/claude-code.js)