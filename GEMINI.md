# Linuxlewis Code Review Extension

This extension provides two review commands:

- `/code-review`: reviews local branch changes.
- `/pr-code-review`: reviews a GitHub pull request using the GitHub MCP server.

When a user asks to review code changes, prefer `/code-review`.

When a user asks to review a GitHub pull request, prefer `/pr-code-review`.
Use `REPOSITORY`, `PULL_REQUEST_NUMBER`, and `ADDITIONAL_CONTEXT` environment
variables when they are set.
