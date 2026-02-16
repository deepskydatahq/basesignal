#!/usr/bin/env bash
set -euo pipefail

# Publish all @basesignal packages to npm
# Usage: ./scripts/publish-all.sh [--dry-run]
#
# Prerequisites:
# - npm login (with access to @basesignal scope)
# - All packages built (npm run build --workspaces)
# - All tests passing (npm test --workspaces)

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "=== DRY RUN ==="
fi

# Publish order matters: dependencies before dependents
PACKAGES=(
  "packages/core"
  "packages/storage"
  "packages/crawlers"
  "packages/mcp-server"
  "packages/cli"
)

echo "Building all packages..."
npm run build --workspaces

echo "Running all tests..."
npm test --workspaces

for pkg in "${PACKAGES[@]}"; do
  echo ""
  echo "Publishing ${pkg}..."
  npm publish --workspace "${pkg}" --access public ${DRY_RUN}
done

echo ""
echo "Done."
