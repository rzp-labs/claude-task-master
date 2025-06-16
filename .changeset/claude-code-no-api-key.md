---
"task-master-ai": patch
---

feat: Enable Claude Code provider to work without API keys

- Add claude-code to providers that don't require API keys (like ollama)
- Update configuration management to handle claude-code authentication
- Improve claude-code provider implementation with better error handling
- Add support for AbortController, tool calling, and accurate token usage
- Update tests to cover all new functionality
- Fix SDK import path and authentication flow

This allows Task Master users to leverage their Claude Code flat-fee subscription through the Claude desktop app authentication, without needing separate API keys.