#!/usr/bin/env bash
# Two-pass loudnorm to -14 LUFS / -1 dBTP (Slack, YouTube, most players). Video stream copied untouched.
# Usage: master.sh <in.mp4> <out.mp4>
set -euo pipefail
IN=$1; OUT=$2
M=$(ffmpeg -hide_banner -i "$IN" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
read -r I TP LRA TH OFF <<<"$(echo "$M" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["input_i"],d["input_tp"],d["input_lra"],d["input_thresh"],d["target_offset"])')"
ffmpeg -hide_banner -loglevel error -y -i "$IN" -c:v copy \
  -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$I:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFF:linear=true,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart "$OUT"
echo "in   $I LUFS  $TP dBTP"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | awk '/I:/{i=$2} /Peak:/{p=$2} END{print "out  " i " LUFS  " p " dBTP"}'
