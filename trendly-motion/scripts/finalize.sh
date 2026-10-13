#!/usr/bin/env bash
# Final encode of a Remotion render (out/raw/trendly-<fmt>.mp4):
# - standard limited-range BT.709 yuv420p (Remotion writes full-range BT.601),
# - audio re-encoded from the WAV master and trimmed to exactly 15.000 s,
# - faststart for web playback, plus a lighter web version (16:9) and a poster.
# Usage: bash scripts/finalize.sh 16x9|9x16 [variant]   (variant: vendeurs)
set -euo pipefail
cd "$(dirname "$0")/.."
fmt="$1"
variant="${2:-}"
name="trendly${variant:+-$variant}-$fmt"
raw="out/raw/$name.mp4"
wav="public/audio/trendly-sound${variant:+-$variant}.wav"
vf="scale=in_range=full:in_color_matrix=bt601:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p"

encode() { # <crf> <maxrate or ""> <output>
	local rate=()
	[ -n "$2" ] && rate=(-maxrate "$2" -bufsize "$2")
	ffmpeg -v error -y -i "$raw" -i "$wav" -map 0:v -map 1:a -vf "$vf" \
		-c:v libx264 -preset slow -crf "$1" "${rate[@]}" -profile:v high -level:v 4.2 \
		-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
		-c:a aac -b:a 256k -t 15 -movflags +faststart "$3"
	echo "wrote $3"
}

encode 17 "" "out/$name.mp4"
if [ "$fmt" = "16x9" ]; then
	encode 23 "8M" "out/$name-web.mp4"
fi
# Poster: the last frame (logo + tagline)
ffmpeg -v error -y -sseof -0.05 -i "out/$name.mp4" -frames:v 1 -q:v 2 "out/$name-poster.jpg"
echo "wrote out/$name-poster.jpg"
