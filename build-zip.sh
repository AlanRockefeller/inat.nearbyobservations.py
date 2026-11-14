#!/usr/bin/env bash
# Build the extension packages. Run this after changing the extension.
#
#   browser-extension.zip   For manual installs: unzips to a browser-extension/
#                           folder to load in chrome://extensions or Firefox.
#   dist/genus-proximity-finder-<version>.zip
#                           For addons.mozilla.org and the Chrome Web Store:
#                           manifest.json at the top level, as the stores require.
set -euo pipefail

cd "$(dirname "$0")"

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' browser-extension/manifest.json)
excludes=(-x '*/CLAUDE.md' -x 'CLAUDE.md' -x '*.svg')

rm -f browser-extension.zip
zip -q -r -X browser-extension.zip browser-extension "${excludes[@]}"
echo "Built browser-extension.zip (version ${version})"
unzip -l browser-extension.zip

mkdir -p dist
store_zip="dist/genus-proximity-finder-${version}.zip"
rm -f "$store_zip"
(cd browser-extension && zip -q -r -X "../$store_zip" . "${excludes[@]}")
echo
echo "Built ${store_zip} for addons.mozilla.org / Chrome Web Store"
unzip -l "$store_zip"
