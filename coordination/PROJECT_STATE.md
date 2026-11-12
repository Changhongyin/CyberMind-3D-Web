# Project state — 《机心》 JIXIN (CyberMind 3D website)

Status: **COMPLETE (2026-11-12).** Delivery package in `deliverables/`; test and validation records in `review/`.
Remaining actions belong to the entrant: host the static site publicly, submit the form, accept its terms, optional Xiaohongshu post.

## Concept (locked)
Under Wugang (雾港), Well-09 holds the sealed municipal mind 傀-7. The visitor aligns three halo rings (忆/感/志), clicks the
face, and the porcelain face splits in two: the rain stops mid-air and the city lights up. Four glyph drums hold its
4-character "thoughts" (4096 lines). Inspection marks lead to close views; the face can be sealed again.

## Lux3D — done, do NOT regenerate
6 tasks, 96 credits (image 6690690/6690707/6690729 → img-to-3d G1 6691940/6691965/6691979). Originals and ledger: `assets/lux3d/`.

## Deliverables
- `video/`: master 3840x2160 120 fps HEVC Main10, 7020 frames, 58.5 s, with sound (video packets identical to the validated silent
  master); 4K60 and 1080p60 H.264 viewing copies (derived, labelled); `soundtrack/` WAV and event log.
- `stills/`: 12 native 3840x2160 PNGs. `report/JIXIN_project-report.pdf`: 13 pages, every page inspected.
- `JIXIN_site-static.zip` (48 MB) and `JIXIN_source.zip` (~172 MB), SHA256 in `zips.sha256.json`; `SUBMISSION.md`; `VALIDATION.md`.

## Verified (details in deliverables/VALIDATION.md)
- Master: full decode, frame counts, joins (two large-change joins = scripted cuts, re-rendered continuously and matched), native-frame match.
- Packaged site, unzipped: itest 21/21, failtest 3/3, sound label correct. No API key anywhere (files and ZIP entries scanned).
- Real time on this VM (60 Hz, VMware SVGA 3D): fidelity 17.4 fps at native 3420x2060; balanced 55 fps; performance 62 fps.
  **Native 4K/120 real time is NOT MET here and is unverified on capable hardware.**

## If anything must be redone
Tools are in `source/capture/` (see README "Reproduce"). Run them from a folder that has puppeteer-core
(`cd source && npm ci`). Serve the site with `python source/web/serve.py 8787`. Never edit `source/web/` while a segmented
export runs. After any change to `source/web/`, re-run `python source/package.py` and re-test the unzipped site.
The temporary Windows scratch folder (C:\Users\lover\cybermind-scratch) was removed after SHA256-verified transfer
(`review/copy_manifest.json`). Its discarded content was redundant intermediates only: video segments, the silent master,
superseded test renders and node_modules (reinstallable from `source/package-lock.json`).
