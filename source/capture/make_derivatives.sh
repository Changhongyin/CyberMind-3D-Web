#!/usr/bin/env bash
# Builds the delivered videos from the validated silent master and the offline soundtrack.
#   FFMPEG=... bash make_derivatives.sh <silent_master.mp4> <soundtrack.wav> <out_dir>
# 1. MASTER: the 3840x2160 / 120 fps HEVC Main10 video stream is COPIED bit-for-bit (no re-encode); AAC sound is added.
# 2. 4K60 viewing copy: every second frame of the master (exact 120 -> 60 decimation, no blending), H.264 High.
# 3. 1080p60 viewing copy: same decimation, Lanczos downscale, H.264 High.
set -e
M="$1"; A="$2"; O="$3"; mkdir -p "$O"
MASTER="$O/JIXIN_master_3840x2160_120fps_HEVC-Main10.mp4"
V4K="$O/JIXIN_viewing-copy_3840x2160_60fps_H264_derived-from-master.mp4"
V1080="$O/JIXIN_viewing-copy_1920x1080_60fps_H264_derived-from-master.mp4"
COL=(-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv)
"$FFMPEG" -y -loglevel error -i "$M" -i "$A" -map 0:v:0 -map 1:a:0 -c:v copy -tag:v hvc1 -c:a aac -b:a 256k -ar 48000 -movflags +faststart \
  -metadata title="JIXIN 机心 - demonstration master" -metadata comment="native 3840x2160 120fps, fixed 1/120 s steps, one rendered frame per output frame; video stream copied unchanged; sound = site synthesiser rendered offline from the same simulation" "$MASTER"
"$FFMPEG" -y -loglevel error -i "$M" -i "$A" -map 0:v:0 -map 1:a:0 -vf "fps=60" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -profile:v high -level 5.2 "${COL[@]}" \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -metadata title="JIXIN 机心 - 4K60 viewing copy (every 2nd frame of the 4K120 master)" "$V4K"
"$FFMPEG" -y -loglevel error -i "$M" -i "$A" -map 0:v:0 -map 1:a:0 -vf "fps=60,scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.2 "${COL[@]}" \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -metadata title="JIXIN 机心 - 1080p60 viewing copy (derived from the 4K120 master)" "$V1080"
# the master's video packets must be identical to the silent master's
a=$("$FFMPEG" -loglevel error -i "$M" -map 0:v:0 -c copy -f md5 -); b=$("$FFMPEG" -loglevel error -i "$MASTER" -map 0:v:0 -c copy -f md5 -)
echo "video packet md5 silent=$a delivered=$b"; [ "$a" = "$b" ] && echo VIDEO_STREAM_IDENTICAL || { echo VIDEO_STREAM_DIFFERS; exit 1; }
echo DERIVATIVES_DONE
