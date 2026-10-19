#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p build/native build/module-cache
cp native/output.swift build/main.swift
swiftc -module-cache-path build/module-cache native/FocusMemory.swift build/main.swift \
  -o build/native/output -framework AppKit -framework ApplicationServices
