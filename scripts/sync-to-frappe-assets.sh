#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-dist}"
TARGET_DIR="${TARGET_DIR:-/home/fg/gb/apps/cclms/cclms/public/xg-system}"

if [ ! -d "$SRC_DIR" ]; then
  echo "Build directory not found: $SRC_DIR"
  exit 1
fi

mkdir -p "$TARGET_DIR"
rsync -a --delete "$SRC_DIR"/ "$TARGET_DIR"/

echo "Synced React dashboard to Frappe assets:"
echo " - $TARGET_DIR"
echo "Open URL:"
echo " - /assets/cclms/xg-system/index.html"
