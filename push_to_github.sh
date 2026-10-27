#!/usr/bin/env bash
set -euo pipefail

# Run from any directory; publish this checkout rather than a machine-specific path.
PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

VISIBILITY="${1:---private}"
case "$VISIBILITY" in
    --private|--public) ;;
    *) echo "Usage: $0 [--private|--public]" >&2; exit 2 ;;
esac

if ! gh auth status >/dev/null 2>&1; then
    gh auth login --hostname github.com --git-protocol https --web
fi

BRANCH="$(git symbolic-ref --quiet --short HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Commit or stash local changes before publishing." >&2
    exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
    git push -u origin "$BRANCH"
else
    gh repo create krishna-river-basin "$VISIBILITY" --source=. --remote=origin --push
fi

gh repo view --json url --jq .url
