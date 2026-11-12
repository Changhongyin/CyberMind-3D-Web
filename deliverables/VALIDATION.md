# 《机心》 JIXIN — validation record

Date: 2026-11-12. Every result below was measured on the machine described here; raw data is in `review/`.
Nothing on this page is estimated or carried over from an earlier version.

## Test environment

| item | value |
| --- | --- |
| host | VMware virtual machine on an Apple-silicon Mac; Windows 11 Pro ARM64 (build 26300); 10 vCPU; 17 GB RAM |
| GPU / backend | VMware SVGA 3D → ANGLE Direct3D 11 → WebGL2. Edge needs `--ignore-gpu-blocklist --use-angle=d3d11`; without it this VM falls back to software rendering |
| display | 3420×2146 @ 60 Hz (as reported by Windows), device pixel ratio 2 |
| browser | Microsoft Edge 157 (Chromium); three.js r180 |
| capture tools | headless Edge driven by puppeteer-core 24.22.0; ffmpeg n9.0.1 (imageio-ffmpeg build) |

## A · Demonstration master (offline) — PASS

| check | result | status |
| --- | --- | --- |
| render method | fixed 1/120 s simulation step; one native 3840×2160 render (4×MSAA HDR, DPR 1) and one lossless PNG screenshot per output frame; drawing buffer, scene target and screenshot size checked on every frame | pass |
| resolution / rate | 3840×2160, 120 fps, HEVC Main10 4:2:0, CRF 16, about 124 Mbps | pass |
| full decode | 7020 / 7020 frames, 58.500 s, no decode errors (each of the 6 segments was also fully decoded: 1200 ×5 + 1020) | pass |
| segment joins | change across join ÷ change between neighbouring frames = 1.23 / 1.23 / 1.14 / 52.60 / 112.45. The last two joins fall exactly on scripted camera cuts at 40.0 s and 50.0 s. All 10 frames on both sides of every join were re-rendered in one uninterrupted session (`join_check.mjs`) and match the master (mean difference 1.95–3.80 / 255, i.e. encoding loss only) | pass |
| frame order | 12 lossless PNGs kept during capture (every 600th frame) vs. the same decoded frames: mean difference 1.44–2.46 / 255 | pass |
| capture integrity | the recorder now refuses to write a segment's completion record unless ffmpeg exits 0. Segments 0 and 1 were recorded before this guard existed; both passed full decoding | pass |
| capture time | about 2.3 h for 7020 frames (≈1.18 s per frame), far slower than real time. This proves the video, not real-time performance | — |
| sound | the site's own Web Audio synthesiser, replayed offline from the simulation's logged sound calls (`soundtrack.mjs`): 3 ring ticks, 3 ring locks, 1 wake, 17 drum plucks, plus per-frame ambience. Placed at (simFrame − 2)/120 s, i.e. on the first frame that shows the event. 48 kHz stereo, peak −5.8 dBFS. The browser recorder itself captures no audio | pass |
| master with sound | video packets identical to the validated silent master (MD5 8725b0c09c9bb9282a4e124fc3a51929 for both); AAC 256 kb/s added | pass |
| 4K60 viewing copy | 3840×2160, 60 fps, H.264 High, 3510 frames, 58.5 s, 75 Mbps; frame k = master frame 2k (k=1800 vs master 3600: 2.80 / 255; neighbours 9.3–9.5) | pass |
| 1080p60 viewing copy | 1920×1080, 60 fps, H.264 High, 3510 frames, 58.5 s, 20 Mbps, Lanczos downscale | pass |

Records: `review/video/master_validation.json`, `master_validation_joins.png`, `join-check-continuous/`,
`master-native-frames/`, `capture-records/` (per-segment metadata and logs), `waveform.png`.

## B · Interactive website, real time (measured) — native 4K/120 NOT MET

Method: `?bench=40`. Each run has a 6 s warm-up, then 40 s of the scripted tour (ring alignment, wake transformation, close
inspection), timed with requestAnimationFrame. The page was visible and focused; headed runs used a full-screen Edge window.

| profile | internal render size | drawing buffer | avg fps | frame ms p50 / p95 / p99 | draw calls |
| --- | --- | --- | --- | --- | --- |
| fidelity (native) | 3420×2060 | 3420×2060, DPR 2 | **17.4** | 51.2 / 114.6 / 257.7 | 126 |
| balanced (75%, upscaled) | 2565×1545 | 3420×2060 | 55.3 | 15.8 / 32.9 / 40.2 | 128 |
| performance (50%, upscaled) | 1710×1030 | 3420×2060 | 62.4 | 15.7 / 16.9 / 31.1 | 100 |
| auto (dynamic; ended at 75%) | 2565×1545 | 3420×2060 | 53.6 | 15.8 / 32.0 / 78.0 | 98 |
| fidelity, **headless offscreen** (not presented) | 3840×2160 | 3840×2160, DPR 1 | 17.2 | 54.6 / 117.2 / 170.2 | 111 |

- **Native 3840×2160 at 120 fps in real time is NOT MET on this machine:** about 17 fps at native resolution.
- **120 presented frames per second cannot be verified here at all.** Windows reports a 60 Hz display.
- The benchmark's `estRefreshHz` field (60–75) comes from rAF timing jitter on the virtual display. It is not a refresh-rate measurement.
- Above 60 fps, the performance profile's 62.4 fps average is not proof of presented frames.
- The upscaled profiles (balanced, performance, auto) are labelled as upscaled in the site's HUD and quality panel. They are not counted as native 4K.
- Not tested: any machine with a discrete GPU and a 120 Hz display (none was available). Real-time 4K/120 therefore stays **unverified**.
- Raw JSON: `review/benchmark/bench_*.json`; environment: `review/benchmark/env.json`.

## C · Website function (tested from the packaged `JIXIN_site-static.zip`, unzipped and served from a fresh folder)

| test | result |
| --- | --- |
| `itest.mjs`: real pointer and keyboard events on the live page | **21 / 21 pass**: enter screen; render loop runs; ring locks by mouse drag, by click (auto-align) and by key 3; face refuses to open before all rings lock; unseal button appears; orbit and zoom; click face → transformation → awake; drum click and HUD glyph button change the thought; ◇ mark opens an inspection, Esc returns; tour starts and a pointer press interrupts it; performance profile halves the internal target and fidelity restores native; Space seals, the rings release; second full run works; no page errors |
| `failtest.mjs` | **3 / 3 pass**: no WebGL → readable message and reload button; `drone.glb` returning 404 → warning on the loading screen, site still enters; 390×844 phone viewport with touch → no horizontal scroll, tap wakes the face |
| ZIP integrity | `zipfile.testzip()` clean; 27 files |

Logs and screenshots: `review/tests/`. ZIP sizes and SHA256: `deliverables/zips.sha256.json` (both under 500 MB).

## D · Other checks

- Lux3D: 6 tasks, all status 3 (success) on the first attempt. 96 credits, read from the task list's `consumedCredits` (`assets/lux3d/credits_from_task_list.json`). No regeneration in this project.
- No API key anywhere in the project folder: searched every file for the key value.
- Report PDF: 13 pages. Each page was rendered to PNG and visually inspected (`review/report-pages/`). No overflow, no broken images.
- Every file copied from the temporary Windows scratch folder to the share was re-read and SHA256-verified (`review/copy_manifest.json`) before the scratch folder was removed.

## Not done / needs the entrant

- Public demo URL: no authorised hosting account was available. The static ZIP is ready for any static host.
- Competition form submission, accepting its terms and the Xiaohongshu post: intentionally not done.
- Upload size limits for the video and report fields were not visible in the available screenshots; check the form.
- Native 4K/120 real-time performance: unverified (see B).
