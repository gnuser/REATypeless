#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p build/icon.iconset build/module-cache
swift -module-cache-path build/module-cache scripts/make-icon.swift build/icon.png
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" build/icon.png --out "build/icon.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" build/icon.png --out "build/icon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns build/icon.iconset -o build/icon.icns
