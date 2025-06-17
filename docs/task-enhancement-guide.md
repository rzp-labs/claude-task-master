# Task Enhancement Guide

## Overview

Task Enhancement is an AI-powered feature that improves your task descriptions, implementation details, and test strategies. When enabled, it enriches tasks with comprehensive information, technical considerations, and actionable guidance to accelerate development.

## What Task Enhancement Does

### Before Enhancement
```json
{
  "id": 1,
  "title": "Add user authentication",
  "description": "Users need to log in",
  "details": "Basic login form",
  "status": "pending"
}
```

### After Enhancement
```json
{
  "id": 1,
  "title": "Add user authentication",
  "description": "Implement comprehensive user authentication system with secure login, session management, and password validation to enable personalized user experiences",
  "details": "Create login/logout functionality with JWT tokens, implement password hashing with bcrypt, add session persistence with secure cookies, integrate with existing user model, and ensure HTTPS-only authentication flows",
  "testStrategy": "Unit tests for authentication logic, integration tests for login/logout flows, security tests for token validation, end-to-end tests for complete user journeys, and performance tests for concurrent login scenarios",
  "enhancementLevel": "high",
  "metadata": {
    "technicalConsiderations": [
      "Database schema for user credentials and sessions",
      "JWT token expiration and refresh strategy", 
      "Password complexity requirements and validation"
    ],
    "potentialChallenges": [
      "Secure password storage and hashing",
      "Session management across multiple devices",
      "Rate limiting for login attempts"
    ],
    "successCriteria": [
      "Users can successfully register and login",
      "Sessions persist across browser restarts",
      "Security tests pass with no vulnerabilities"
    ]
  }
}
```

## Configuration (v0.18+)

Task enhancement configuration has been simplified to a single setting:

```json
{
  "taskEnhancement": {
    "enabled": true  // Enable/disable enhancement
  }
}
```

When enabled:
- Always provides comprehensive, high-quality enhancements
- Automatically selects the best available AI model
- Requires manual triggering for better control

## How to Trigger Enhancement

Since automatic triggers have been removed, you can enhance tasks through:

### 1. MCP Tools in IDEs
Use the task enhancement tools available in:
- Cursor AI
- VS Code with MCP extension
- Other MCP-compatible editors

### 2. CLI Commands
When using CLI commands, add enhancement flags:
```bash
# Example: Add task with enhancement
taskmaster add-task "Implement user authentication" --enhance

# Example: Update task with enhancement  
taskmaster update-task 5 --enhance
```

### 3. Direct Enhancement Command
```bash
# Enhance a specific task
taskmaster enhance-task 5

# Force re-enhancement
taskmaster enhance-task 5 --force
```

## What Gets Enhanced

Task enhancement improves:

1. **Description**: Expands brief descriptions into comprehensive overviews
2. **Implementation Details**: Provides step-by-step guidance and technical approaches
3. **Test Strategy**: Suggests thorough testing approaches including unit, integration, and edge cases
4. **Technical Considerations**: Lists important technical factors to consider
5. **Potential Challenges**: Identifies common pitfalls and obstacles
6. **Success Criteria**: Defines clear, measurable outcomes

## Model Selection

The system automatically handles model selection:

1. **Research Model First**: If configured, uses research model for best quality
2. **Main Model Fallback**: Automatically falls back if research unavailable
3. **No Configuration Needed**: Just enable enhancement and let the system handle the rest

## Best Practices

### When to Enhance Tasks

✅ **Good candidates for enhancement:**
- Complex features requiring detailed planning
- Tasks with security or performance implications
- Integration tasks touching multiple systems
- Tasks that will be worked on by multiple developers

❌ **Tasks that may not need enhancement:**
- Simple bug fixes with clear solutions
- Minor UI tweaks or copy changes
- Tasks with already detailed specifications

### Working with Enhanced Tasks

1. **Review Before Starting**: Enhanced details provide valuable context
2. **Update as Needed**: Enhancement is a starting point, not gospel
3. **Share Knowledge**: Enhanced tasks help onboard team members
4. **Track Progress**: Use success criteria to measure completion

## Troubleshooting

### Enhancement Not Working

1. **Check Configuration**: Ensure `enabled: true` in taskEnhancement
2. **Verify API Keys**: Model provider API keys must be configured
3. **Check Model Config**: Ensure main or research model is properly set
4. **Review Logs**: Check error messages for specific issues

### Performance Tips

- Enhancement takes 20-40 seconds depending on model
- Processing happens asynchronously 
- Consider batch enhancing tasks during planning phase
- Use force flag to re-enhance outdated tasks

## Migration from Previous Versions

If upgrading from v0.17 or earlier:

1. **Remove old config fields**: Only `enabled` is now supported
2. **Update workflows**: Automatic triggers removed - use manual enhancement
3. **No data migration needed**: Existing enhanced tasks remain unchanged

Old configuration fields that are no longer used:
- `required`
- `detailLevel` 
- `timeout`
- `useResearch`
- `enhanceOnCommands`

## Examples

### Enhancing a New Feature Task

```bash
# Create task
taskmaster add-task "Implement real-time notifications"

# Enhance it
taskmaster enhance-task 1

# Result: Comprehensive implementation plan with WebSocket details,
# scalability considerations, and testing strategies
```

### Re-enhancing After Requirements Change

```bash
# Update task with new requirements
taskmaster update-task 5 --description "Add email notifications in addition to real-time"

# Re-enhance with updated context
taskmaster enhance-task 5 --force

# Result: Updated enhancement incorporating email integration
```

## API Integration

For custom integrations, trigger enhancement programmatically:

```javascript
// Example using MCP client
await mcpClient.callTool('enhance-task', {
  taskId: 5,
  force: false,
  projectRoot: '/path/to/project'
});
```

## Summary

Task enhancement in v0.18+ focuses on simplicity and quality:
- Single configuration option: enabled/disabled
- Always provides comprehensive enhancements
- Manual triggering for better control
- Automatic model selection for best results

Enable it with one line of config and enhance tasks when you need detailed guidance.