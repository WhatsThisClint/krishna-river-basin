#!/usr/bin/env bash
set -e

PROJECT_DIR="/run/media/clinton/24700DC6700D9FA2/Krishna River Basin"
cd "$PROJECT_DIR"

echo "========================================================"
echo "Krishna River Basin — GitHub Push Assistant"
echo "========================================================"

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "Step 1: Logging into GitHub..."
    echo "Follow the prompt below to log in via browser or token:"
    gh auth login
fi

echo ""
echo "Step 2: Authenticated as: $(gh api user --jq .login 2>/dev/null || echo 'User')"

REPO_NAME="krishna-river-basin"
echo "Creating GitHub repository: $REPO_NAME (public)..."

# Create remote repo and push in one shot
if ! git remote get-url origin &>/dev/null; then
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
else
    git push -u origin master
fi

echo ""
echo "========================================================"
echo "SUCCESS! Repository pushed to GitHub:"
gh repo view --web || true
echo "========================================================"
