#!/usr/bin/env bash
# Deploy the live RTS game from the canonical warcrest repo.
# Safe to run from the sift monorepo root.
set -euo pipefail

SIFT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WARCREST="$SIFT_ROOT/warcrest"

if [[ ! -d "$WARCREST/.git" ]]; then
  echo "ERROR: warcrest repo not found at $WARCREST" >&2
  echo "Clone it beside sift:" >&2
  echo "  git clone https://github.com/twosenseproduction-hub/warcrest.git" >&2
  exit 1
fi

exec "$WARCREST/scripts/deploy.sh" "$@"
