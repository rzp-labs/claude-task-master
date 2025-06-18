# Task Master Project Overview

## Purpose
Task Master is an AI-powered task management system designed to work seamlessly with Cursor AI and other editors through the Model Context Protocol (MCP). It enables efficient project task management, breaking down complex development work into manageable tasks with AI assistance.

## Core Features
- Task creation and management with hierarchical subtasks
- AI-powered task expansion and complexity analysis
- Integration with multiple AI providers (Anthropic, OpenAI, Google, etc.)
- Git worktree support for parallel development
- MCP server for editor integration
- CLI interface for direct usage
- Research integration with current information gathering

## Architecture
- **Dual Interface**: Both CLI (`scripts/`) and MCP server (`mcp-server/`) implementations
- **AI Providers**: Unified interface supporting multiple AI services (`src/ai-providers/`)
- **Task Storage**: JSON-based with support for dependencies, tags, and status tracking
- **ES Modules**: Modern JavaScript with `type: "module"`
- **Cross-platform**: Works on macOS, Linux, and Windows