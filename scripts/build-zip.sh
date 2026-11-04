#!/usr/bin/env bash
# Builds dist/Tokyo-Downloader-Extension-<version>.zip (no tests, no Mac metadata) from ./extension
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
OUT="dist/Tokyo-Downloader-Extension-$V.zip"
mkdir -p dist && rm -f "$OUT"
( cd extension && zip -X -r "../$OUT" . -x "test.cjs" -x "*.DS_Store" -x "__MACOSX/*" )
echo "Built $OUT"
