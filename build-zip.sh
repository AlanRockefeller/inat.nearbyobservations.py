#!/usr/bin/env bash
# Rebuild browser-extension.zip from the browser-extension/ folder.
# Run this after changing the extension so the downloadable zip stays current.
set -euo pipefail

cd "$(dirname "$0")"

rm -f browser-extension.zip
zip -q -r -X browser-extension.zip browser-extension \
  -x 'browser-extension/CLAUDE.md' \
  -x 'browser-extension/*.svg'

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' browser-extension/manifest.json)
echo "Built browser-extension.zip (version ${version})"
unzip -l browser-extension.zip
