#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p build
/usr/bin/say -o build/test-speech.aiff 'Hello world, this is a private voice dictation test. Please send the project update tomorrow morning.'
/opt/homebrew/bin/ffmpeg -v error -y -i build/test-speech.aiff -ar 16000 -ac 1 build/test-speech.wav
