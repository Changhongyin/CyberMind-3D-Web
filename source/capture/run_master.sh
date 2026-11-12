#!/usr/bin/env bash
# Records the 58.5 s demonstration master in six resumable segments and joins them without re-encoding.
#   FFMPEG=/path/to/ffmpeg bash run_master.sh <work_dir>        (site must be served on localhost:8787; run from a folder with puppeteer-core)
# A segment whose .capture.json already exists is skipped, so an interrupted run can simply be started again.
set -e
OUT="${1:-out/master}"; mkdir -p "$OUT"
BOUNDS=(0 10 20 30 40 50 58.5)
for i in 0 1 2 3 4 5; do
  seg="$OUT/seg_$i"
  if [ -f "$seg.capture.json" ]; then echo "segment $i already recorded"; continue; fi
  node capture.mjs "$seg.mp4" --from "${BOUNDS[$i]}" --to "${BOUNDS[$((i+1))]}" --fps 120 --size 3840x2160 --codec hevc --crf 16 --keep 600
done
: > "$OUT/list.txt"; for i in 0 1 2 3 4 5; do echo "file 'seg_$i.mp4'" >> "$OUT/list.txt"; done
"$FFMPEG" -y -loglevel error -f concat -safe 0 -i "$OUT/list.txt" -c copy -tag:v hvc1 -movflags +faststart "$OUT/JIXIN_master_3840x2160_120fps_hevc.mp4"
echo MASTER_DONE
