#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=gh-updater.lib.sh
source "$SCRIPT_DIR/gh-updater.lib.sh"

if [[ ! -f "$SCRIPT_DIR/tools.yaml" ]]; then
    echo "ERROR: tools.yaml not found in $SCRIPT_DIR"
    exit 1
fi

gh_install_inventory "$SCRIPT_DIR/tools.yaml"
