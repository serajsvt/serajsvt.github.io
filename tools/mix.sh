#!/usr/bin/env bash
# Mix voice + music + sfx onto the rendered frames → out/<slug>.mp4, then print checks.
# usage: bash tools/mix.sh scenes/<slug>
set -euo pipefail
SC=${1%/}; SLUG=$(basename "$SC"); ROOT=$(cd "$(dirname "$0")/.." && pwd); mkdir -p "$ROOT/out"
OUT="$ROOT/out/$SLUG.mp4"
ffmpeg -y -loglevel error -i "$SC/silent.mp4" -i "$SC/voice.wav" -i "$SC/music.wav" -i "$SC/sfx.wav" -filter_complex "
[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,highpass=f=70,equalizer=f=3200:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,asplit=2[vo][sc];
[2:a]volume=0.45[mu];[3:a]volume=0.75[fx];[mu][fx]amix=inputs=2:normalize=0[bed];
[bed][sc]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=300[bedd];
[vo][bedd]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
echo "== $OUT"
ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=duration,size -of compact "$OUT"
ffmpeg -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E " I:|Peak" || true
# contact sheet of the final encode (6 evenly spaced frames)
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"); mkdir -p "$SC/check"
for k in 0 1 2 3 4 5; do T=$(python3 -c "print(round($D*($k+.5)/6,2))"); ffmpeg -y -loglevel error -ss "$T" -i "$OUT" -frames:v 1 -vf scale=300:533 "$SC/check/f$k.png"; done
python3 -c "
from PIL import Image
ims=[Image.open('$SC/check/f%d.png'%k) for k in range(6)]
sh=Image.new('RGB',(306*6-6,533),'white')
[sh.paste(im,(i*306,0)) for i,im in enumerate(ims)]; sh.save('$SC/check/final_sheet.png')"
echo "final sheet → $SC/check/final_sheet.png"
