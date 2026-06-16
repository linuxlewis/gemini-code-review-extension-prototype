# Gemini Inline PR Review

Reusable GitHub Action for Gemini-powered pull request review.

The action runs [Gemini CLI](https://github.com/google-gemini/gemini-cli) with a
bundled review extension and posts findings as GitHub inline review comments.
It is designed for code review automation, not chat-style PR summaries.

## Behavior

- Posts findings as line comments only.
- Does not approve pull requests.
- Does not request changes.
- Does not post a review summary body.
- Does not post top-level PR comments.
- Re-reviews previous review threads and re-comments only when a prior finding
  is still unresolved on a current changed diff line.
- Leaves no review when there are no substantive findings that can be attached
  to changed lines.

## Quick Start

### 1. Add Your Gemini API Key

Create a repository secret named `GEMINI_API_KEY`.

With the GitHub CLI:

```bash
gh secret set GEMINI_API_KEY --repo OWNER/REPO
```

Or use GitHub's UI:

`Settings > Secrets and variables > Actions > New repository secret`

### 2. Add the Workflow

Create `.github/workflows/gemini-pr-review.yml` in your repository:

```yaml
name: Gemini PR Review

on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
  issue_comment:
    types: [created]
  workflow_dispatch:
    inputs:
      pr_number:
        description: Pull request number to review
        required: true
      additional_context:
        description: Optional review focus
        required: false
        default: ""

concurrency:
  group: gemini-pr-review-${{ github.event.pull_request.number || github.event.issue.number || inputs.pr_number }}
  cancel-in-progress: true

permissions:
  contents: read
  id-token: write
  issues: write
  pull-requests: write

jobs:
  review:
    name: Gemini review
    runs-on: ubuntu-latest
    timeout-minutes: 10
    if: |
      github.event_name == 'workflow_dispatch' ||
      (
        github.event_name == 'pull_request' &&
        github.event.pull_request.head.repo.full_name == github.repository &&
        github.event.pull_request.draft == false
      ) ||
      (
        github.event_name == 'issue_comment' &&
        github.event.issue.pull_request &&
        contains(github.event.comment.body, '@gemini-review')
      )
    steps:
      - name: Gemini inline PR review
        uses: linuxlewis/gemini-code-review-extension-prototype@v0.1.0
        with:
          gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
          github_token: ${{ github.token }}
          pr_number: ${{ inputs.pr_number }}
          additional_context: ${{ inputs.additional_context }}
```

No `actions/checkout` step is required in the consuming repository. The action
bundles its own Gemini extension and reads the pull request through GitHub APIs.

Pin `uses:` to the release tag you want to run. For early testing before a
release is cut, use the branch or commit SHA you are evaluating.

### 3. Open or Update a PR

The workflow runs automatically for same-repository pull requests when they are
opened, reopened, synchronized, or marked ready for review.

To request an on-demand re-review, comment on the PR:

```text
@gemini-review
```

You can include focus text after the marker:

```text
@gemini-review focus on authorization edge cases
```

To run manually:

```bash
gh workflow run gemini-pr-review.yml \
  --repo OWNER/REPO \
  -f pr_number=123 \
  -f additional_context="Focus on data loss and concurrency bugs."
```

## Required Permissions

The workflow needs:

```yaml
permissions:
  contents: read
  id-token: write
  issues: write
  pull-requests: write
```

`pull-requests: write` is required to create inline review comments.
`issues: write` is included because GitHub PR conversations also use issue APIs.
`id-token: write` is only needed if you use Workload Identity Federation, but it
is safe to leave in place for the default API key setup.

If review comments fail with `Resource not accessible by integration`, check
your repository or organization Actions settings:

`Settings > Actions > General > Workflow permissions`

## Inputs

Common inputs:

| Input | Required | Description |
| --- | --- | --- |
| `gemini_api_key` | Usually | Gemini API key from Google AI Studio. |
| `github_token` | No | GitHub token used by the GitHub MCP server. Defaults to `github.token` when omitted. |
| `pr_number` | Manual only | Pull request number for `workflow_dispatch`. |
| `additional_context` | No | Extra review focus. Also populated from text after `@gemini-review`. |
| `gemini_model` | No | Optional model override. Leave empty for Gemini CLI's default. |
| `gemini_cli_version` | No | Gemini CLI version. Defaults to `latest`. |

Authentication alternatives:

| Input | Description |
| --- | --- |
| `google_api_key` | Vertex AI API key. Use with `use_vertex_ai: "true"`. |
| `gcp_workload_identity_provider` | Workload Identity Federation provider. |
| `gcp_project_id` | Google Cloud project for WIF. |
| `gcp_service_account` | Service account for WIF token generation. |
| `gcp_location` | Google Cloud location. |
| `use_vertex_ai` | Set to `"true"` for Vertex AI. |
| `use_gemini_code_assist` | Set to `"true"` for Gemini Code Assist auth. |

Use exactly one Gemini authentication method:

- `gemini_api_key`
- `google_api_key` with Vertex AI
- Workload Identity Federation

## Optional GitHub App Identity

By default, comments come from the workflow's `GITHUB_TOKEN`. If you want review
comments to come from a dedicated GitHub App, pass the app credentials:

```yaml
steps:
  - name: Gemini inline PR review
    uses: linuxlewis/gemini-code-review-extension-prototype@v0.1.0
    with:
      app_id: ${{ vars.GEMINI_REVIEW_APP_ID }}
      app_private_key: ${{ secrets.GEMINI_REVIEW_APP_PRIVATE_KEY }}
      gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

The GitHub App needs:

- Contents: read
- Issues: write
- Pull requests: write

## Fork Pull Requests

The recommended workflow does not automatically review fork PRs on the
`pull_request` event. That avoids running automated review on untrusted fork
events with write-capable tokens.

For a fork PR, a maintainer can trigger review manually with `workflow_dispatch`
or by commenting:

```text
@gemini-review
```

The action reads the PR diff through GitHub APIs and writes review comments with
the token granted to the workflow.

## Troubleshooting

### `No authentication method provided`

Set the `GEMINI_API_KEY` repository secret and rerun the workflow:

```bash
gh secret set GEMINI_API_KEY --repo OWNER/REPO
```

### No Comments Were Posted

This can be the correct result. The action is inline-only and leaves no review
when Gemini finds no substantive issue that can be attached to a changed diff
line.

### Comments Are Missing

GitHub only accepts line review comments on valid diff positions. Comments aimed
at unchanged lines or lines outside the current diff hunk may be dropped by
GitHub. The bundled prompt instructs Gemini to comment only on changed `LEFT` or
`RIGHT` diff lines.

### Docker Is Required

The action runs the official GitHub MCP server Docker image:

```text
ghcr.io/github/github-mcp-server:v0.27.0
```

GitHub-hosted Ubuntu runners already include Docker. Self-hosted runners must
provide it.

## Repository Contents

Most users only need the workflow snippet above. The internal files in this repo
are for the action itself:

```text
action.yml
commands/pr-code-review.toml
skills/code-review-commons/SKILL.md
gemini-extension.json
GEMINI.md
```
