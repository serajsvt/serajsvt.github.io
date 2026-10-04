#!/usr/bin/env bash
# Real NASA images (public domain) from github.com/nasa/NASA-3D-Resources — the only photo source reachable from this sandbox.
# usage: bash tools/nasa.sh list [filter]                          → matching catalog lines (see tools/nasa_catalog.txt)
#        bash tools/nasa.sh get scenes/<slug> "<path>" <name>.jpg   → scenes/<slug>/img/<name>.jpg (resized to ≤ 2400 px)
set -euo pipefail
T=${YT_TOOLS:-$HOME/yt_tools}; REPO=$T/nasa3d; HERE=$(cd "$(dirname "$0")" && pwd)
case "${1:-}" in
  list) grep -i -- "${2:-}" "$HERE/nasa_catalog.txt" | grep -v "^#" ;;
  get)
    [ -d "$REPO/.git" ] || git clone -q --depth 1 --filter=blob:none --no-checkout https://github.com/nasa/NASA-3D-Resources.git "$REPO"
    mkdir -p "$2/img"; git -C "$REPO" show "HEAD:$3" > "$2/img/$4.tmp"
    python3 - "$2/img/$4.tmp" "$2/img/$4" <<'PY'
import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open(sys.argv[1]).convert("RGB"); im.thumbnail((2400, 2400)); im.save(sys.argv[2], quality=92)
print(f"saved {sys.argv[2]} {im.size[0]}x{im.size[1]}")
PY
    rm -f "$2/img/$4.tmp" ;;
  *) echo "usage: nasa.sh list [filter] | get scenes/<slug> \"<path>\" <name>.jpg"; exit 1 ;;
esac
