# Gemini Code Review Extension Prototype

This repository prototypes a custom Gemini CLI code review extension modeled on
Google's public `gemini-cli-extensions/code-review` package.

The extension defines:

- `/code-review` for local branch diffs.
- `/pr-code-review` for GitHub pull request reviews through the GitHub MCP server.
- A shared `code-review-commons` skill with review policy and severity rules.

## Repository Layout

```text
commands/
  code-review.toml
  pr-code-review.toml
skills/code-review-commons/
  SKILL.md
gemini-extension.json
GEMINI.md
.github/workflows/
  gemini-pr-review.yml
  extension-smoke.yml
```

## GitHub Workflow

`.github/workflows/gemini-pr-review.yml` runs on pull requests, manual dispatch,
and PR comments containing `@gemini-review`.

It installs this checked-out extension into Gemini CLI:

```yaml
extensions: |
  [
    "."
  ]
prompt: /pr-code-review
```

## Required Secret

Add this repository secret before expecting the Gemini review job to complete:

- `GEMINI_API_KEY`: a Gemini API key from Google AI Studio.

Optional GitHub App mode:

- `APP_ID`: repository variable with your GitHub App ID.
- `APP_PRIVATE_KEY`: repository secret with the app private key.

When `APP_ID` is unset, the workflow uses the built-in `GITHUB_TOKEN`, which is
enough for same-repository pull requests.

## Local Smoke Test

```bash
git diff -U5 --merge-base origin/HEAD
gemini extensions link .
gemini --prompt "/code-review"
```

## Example Trigger

Open a pull request against this repository. The smoke workflow should pass.
The Gemini review workflow should run and post a PR review when `GEMINI_API_KEY`
is configured.
