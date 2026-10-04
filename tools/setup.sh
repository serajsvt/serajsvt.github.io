#!/usr/bin/env bash
# One-time setup per session: Piper TTS + CC BY 4.0 LibriTTS voice from GitHub releases, and a toolchain check.
set -euo pipefail
T=${YT_TOOLS:-$HOME/yt_tools}; mkdir -p "$T/voice"
if [ ! -x "$T/piper/piper" ]; then
  curl -sL -o "$T/piper.tgz" https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
  tar xzf "$T/piper.tgz" -C "$T" && rm "$T/piper.tgz"
fi
if [ ! -f "$T/voice/en-us-libritts-high.onnx" ]; then
  curl -sL -o "$T/voice.tgz" https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz
  tar xzf "$T/voice.tgz" -C "$T/voice" && rm "$T/voice.tgz"
fi
echo "Hello." | "$T/piper/piper" -m "$T/voice/en-us-libritts-high.onnx" --speaker 23 -f /tmp/_piper_test.wav >/dev/null 2>&1 && echo "piper OK"
command -v ffmpeg >/dev/null && echo "ffmpeg OK"
python3 -c "import numpy, scipy, PIL; print('python deps OK')" 2>/dev/null || pip install --break-system-packages -q numpy scipy pillow
node -e "for (const p of ['playwright','/opt/npm-tools/node_modules/playwright']) { try { require(p); console.log('playwright OK'); process.exit(0) } catch {} } console.log('playwright MISSING: npm i -g playwright')"
