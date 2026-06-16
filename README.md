# Gemini Code Review Extension Prototype

This repository contains a custom [Gemini CLI](https://github.com/google-gemini/gemini-cli)
extension for GitHub pull request reviews. It is modeled on Google's public
Gemini CLI extension pattern, but the review policy is intentionally stricter:

- PR findings are posted as GitHub line comments only.
- No review summary body is posted.
- No top-level PR comment is posted by the review command.
- Re-reviews inspect previous review threads and re-comment only when an old
  finding is still unresolved on a current changed diff line.

The workflow uses Google's
[`google-github-actions/run-gemini-cli`](https://github.com/google-github-actions/run-gemini-cli)
action and the official
[`github/github-mcp-server`](https://github.com/github/github-mcp-server) Docker
image.

## What Gets Installed

Copy these paths into the repository you want Gemini to review:

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

The PR workflow installs the checked-out repository as a Gemini CLI extension:

```yaml
extensions: |
  [
    "."
  ]
prompt: /pr-code-review
```

That means the extension files live in the same repo being reviewed. This is the
simplest setup for a real repository.

## Quick Setup

### 1. Copy the Files

From this prototype repo, copy the extension files and workflow files into your
target repo.

If you are copying from a local checkout:

```bash
SOURCE=/path/to/gemini-code-review-extension-prototype
TARGET=/path/to/your-repo

mkdir -p "$TARGET/.github/workflows"
cp -R "$SOURCE/commands" "$TARGET/"
cp -R "$SOURCE/skills" "$TARGET/"
cp "$SOURCE/gemini-extension.json" "$TARGET/"
cp "$SOURCE/GEMINI.md" "$TARGET/"
cp "$SOURCE/.github/workflows/gemini-pr-review.yml" "$TARGET/.github/workflows/"
cp "$SOURCE/.github/workflows/extension-smoke.yml" "$TARGET/.github/workflows/"
```

### 2. Ignore Local Gemini State

Add this to your target repo's `.gitignore`:

```gitignore
.gemini/
gha-creds-*.json
```

The workflow writes `.gemini/settings.json` at runtime. Do not commit local
Gemini credentials or generated settings.

### 3. Add Your Gemini API Key

Use one authentication method. For a normal Gemini API key from Google AI
Studio, add a repository secret named `GEMINI_API_KEY`.

With the GitHub web UI:

1. Open your repo on GitHub.
2. Go to `Settings > Secrets and variables > Actions`.
3. Click `New repository secret`.
4. Name it `GEMINI_API_KEY`.
5. Paste your API key as the value.

With the GitHub CLI:

```bash
gh secret set GEMINI_API_KEY --repo OWNER/REPO
```

The command will prompt for the secret value.

### 4. Confirm GitHub Actions Can Write PR Reviews

The workflow declares the permissions it needs:

```yaml
permissions:
  contents: read
  id-token: write
  issues: write
  pull-requests: write
```

If your organization restricts the default `GITHUB_TOKEN`, check:

`Settings > Actions > General > Workflow permissions`

The workflow needs permission to write pull request reviews. Same-repository PRs
use the built-in `GITHUB_TOKEN` by default.

### 5. Commit and Push

Commit the copied files and push them to your target repository.

```bash
git add commands skills gemini-extension.json GEMINI.md .github/workflows
git commit -m "add Gemini PR review workflow"
git push
```

## Running a Review

The workflow runs automatically on same-repository pull requests when they are
opened, reopened, synchronized, or marked ready for review.

It also supports manual and comment-based review:

```bash
gh workflow run gemini-pr-review.yml \
  --repo OWNER/REPO \
  -f pr_number=123 \
  -f additional_context="Focus on correctness and test coverage."
```

Or comment on a PR:

```text
@gemini-review focus on edge cases in the parser
```

Fork PRs are not auto-reviewed by the `pull_request` trigger. A maintainer can
trigger review manually or by commenting `@gemini-review`; the workflow checks
out the trusted base repository and reads the PR diff through GitHub APIs.

## Expected Behavior

For PR review, Gemini should:

1. Read the PR metadata and diff.
2. Read previous review threads with `pull_request_read` method
   `get_review_comments`.
3. Decide whether prior comments were resolved by the current diff.
4. Add only inline review comments on changed lines.
5. Submit the pending review with event `COMMENT` and an empty body.

Gemini should not:

- approve the PR
- request changes
- post a review summary
- post a top-level PR comment
- repeat resolved prior comments
- comment on unchanged context lines

If there are no substantive findings that can be attached to changed diff lines,
the command should leave no review.

## Optional Configuration

### Model

By default, the workflow leaves `GEMINI_MODEL` unset and lets Gemini CLI use its
default model. To pin a model, create a repository variable:

```bash
gh variable set GEMINI_MODEL --repo OWNER/REPO --body "MODEL_NAME"
```

### GitHub App Token

The built-in `GITHUB_TOKEN` is enough for same-repository PRs in most repos. If
you want reviews to come from your own GitHub App, configure:

- repository variable `APP_ID`
- repository secret `APP_PRIVATE_KEY`

The app needs these permissions:

- Contents: read
- Issues: write
- Pull requests: write

When `APP_ID` is unset, the workflow falls back to `github.token`.

### Vertex AI or Workload Identity Federation

The workflow also exposes the auth inputs supported by
`google-github-actions/run-gemini-cli`:

- `GOOGLE_API_KEY` secret with `GOOGLE_GENAI_USE_VERTEXAI=true`
- `GCP_WIF_PROVIDER`, `GOOGLE_CLOUD_PROJECT`, `SERVICE_ACCOUNT_EMAIL`, and
  either `GOOGLE_GENAI_USE_VERTEXAI=true` or `GOOGLE_GENAI_USE_GCA=true`

Do not configure multiple auth methods at once. The action warns when more than
one of `gemini_api_key`, `google_api_key`, or `gcp_workload_identity_provider`
is present.

## Local Smoke Test

You can test the local command before pushing:

```bash
gemini extensions link .
gemini --prompt "/code-review"
```

The local command reviews your current branch diff against `origin/HEAD`.

To validate the extension files without Gemini auth:

```bash
python3 - <<'PY'
import pathlib, tomllib
for path in pathlib.Path("commands").glob("*.toml"):
    tomllib.loads(path.read_text())
    print(f"ok {path}")
PY

git diff --check
```

The `extension-smoke.yml` workflow performs a similar validation in GitHub
Actions.

## Troubleshooting

### `No authentication method provided`

The repo does not have a usable Gemini auth method. For API key auth, set:

```bash
gh secret set GEMINI_API_KEY --repo OWNER/REPO
```

Then rerun the workflow or comment `@gemini-review` on the PR.

### `Resource not accessible by integration`

GitHub did not grant the workflow enough write permission to create PR review
comments. Check repository or organization Actions permissions, or configure the
optional GitHub App mode.

### Gemini Runs but No Comments Appear

The prompt is intentionally inline-only. No comment is posted when Gemini finds
no issue that can be attached to a changed diff line.

GitHub can silently drop review comments aimed at lines outside the current diff
hunk. Keep comments attached to changed `LEFT` or `RIGHT` lines only.

### Fork PRs Do Not Auto-Run

This is intentional. Automatic `pull_request` review is limited to
same-repository branches. For fork PRs, a maintainer can trigger a review with
`@gemini-review` or `workflow_dispatch`.

### Docker Is Required on Self-Hosted Runners

The workflow runs the GitHub MCP server with Docker:

```text
ghcr.io/github/github-mcp-server:v0.27.0
```

GitHub-hosted Ubuntu runners already have Docker. Self-hosted runners must
provide it.
