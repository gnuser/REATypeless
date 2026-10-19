#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p build/module-cache
swiftc -module-cache-path build/module-cache native/FocusMemory.swift tests/native/main.swift -o build/native-regression
build/native-regression
