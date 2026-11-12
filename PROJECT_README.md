# 《机心》 JIXIN — the engine behind the face

An interactive, full-3D cyberpunk website. Under the fog-harbour city of Wugang (雾港), Well-09 holds 傀-7, a municipal
mind that was sealed behind a colossal porcelain face. The visitor aligns three halo rings (忆 MEMORY / 感 SENSE / 志 WILL),
clicks the face, and it parts down the middle: the rain stops in mid-air, the city lights up, and the mind is revealed as a
music-box engine of four glyph drums whose every "thought" is a four-character line. Everything shown is fiction and
authored content — no live AI, no telemetry.

## Run it

The site is plain static files — no build step, no server logic, no API key.

```
python source/web/serve.py 8787        # then open http://localhost:8787/
```

Any static host works the same way (upload the contents of `source/web/`, or unzip `deliverables/JIXIN_site-static.zip`).
Opening `index.html` directly from disk does not work (browsers block ES modules and GLB loading on `file://`).
Needs a browser with WebGL2 (current Chrome / Edge / Safari / Firefox) and hardware acceleration.

Controls: drag a ring or press `1` `2` `3` · click the face or `Space` to unseal / seal · click a drum or `Z X C V` ·
drag empty space to orbit, wheel / pinch to zoom · ◇ marks to inspect, `Esc` to return · `T` tour · `M` sound ·
`Q` quality · `H` hide interface · `R` reset view.

URL flags: `?q=fidelity|balanced|performance|auto` quality profile · `?tour` start the tour ·
`?bench=30` real-time benchmark (30 s, result shown as JSON) · `?capture&director=film` fixed-step mode used by the recorder.

## Layout

| path | content |
| --- | --- |
| `source/web/` | the website: `index.html`, `style.css`, `src/*.js` (all scene code), `vendor/` (three.js r180, MIT), `assets/*.glb` (Lux3D models) |
| `source/lux3d/` | Lux3D API client, request files (prompts) and the resumable image → 3D chain used for the three assets |
| `source/capture/` | recorder (`capture.mjs`, `run_master.sh`), stills (`shot.mjs`), tour filmstrip, interaction test (`itest.mjs`), GPU probe, timing profiler |
| `source/report/` | report source (`report.html`, images) and PDF builder |
| `assets/lux3d/` | original Lux3D outputs per asset (concept image, ZIP, GLB), task ledger and credit record |
| `references/` | competition requirements, page snapshot, API spec used |
| `review/` | process stills and test logs |
| `deliverables/` | master video, previews, 4K stills, PDF report, zips, `SUBMISSION.md`, `VALIDATION.md` |
| `coordination/` | brief, tasks, `PROJECT_STATE.md` |

## What made what

| part | made with |
| --- | --- |
| the face / head (`mask.glb`), the bronze censer (`censer.glb`), the lantern drone (`drone.glb`) — geometry and base-colour / roughness textures | **Aholo Lux3D**: text → concept image, then image → 3D (G1). Task IDs in `assets/lux3d/ledger.jsonl` |
| splitting the single generated head into three moving shells, its inner lining, seam light, glaze crackle, gold-vein glow, struts | code (`src/mask.js`) on top of the generated mesh and texture |
| cognition engine (drums, pins, reeds, lotus, seed, turbine, memory spine), halo rings, well piers, galleries, deck, pillar, cables, talismans, rain, water, city, sky, light shafts, drones' flight and lamps | code: procedural geometry, custom GLSL, code-driven animation (`src/engine.js`, `halo.js`, `world.js`, `materials.js`, `textures.js`) |
| glyph bands, ring scales, neon signs, talismans, console screen | drawn at load time on 2D canvases with system CJK fonts (`src/textures.js`) |
| HDR pipeline (MSAA, bloom, grade), camera rig, state machine, tour, HUD, synthesised sound | code (`src/post.js`, `main.js`, `director.js`, `ui.js`, `audio.js`) |

## Reproduce

Tools: Python 3.12, Node 24, Microsoft Edge (Chromium), ffmpeg (the `imageio-ffmpeg` wheel ships one). Node packages are
pinned in `source/package.json` (`three@0.180.0` is vendored into `source/web/vendor/`; `puppeteer-core@24.22.0` only drives the recorder).

```
cd source && npm ci                                   # puppeteer-core for the capture tools
python web/serve.py 8787                              # serve the site
node capture/probe.mjs 3840x2160                      # what the capture browser's GPU offers
node capture/itest.mjs                                # 21-step live interaction test
node capture/shot.mjs ../review/stills 3840x2160 a:awake:3
FFMPEG=<ffmpeg> bash capture/run_master.sh <work_dir>  # native 3840x2160 / 120 fps master (6 resumable segments)
FFMPEG=<ffmpeg> python capture/validate_video.py <work_dir> validation.json   # full decode, frame counts, joins, native-frame match
node capture/join_check.mjs <dir>                     # joins rendered in one uninterrupted session
node capture/soundtrack.mjs soundtrack.wav 7020 120   # site synthesiser replayed offline from the simulation's sound events
FFMPEG=<ffmpeg> bash capture/make_derivatives.sh <work_dir>/JIXIN_master_3840x2160_120fps_hevc.mp4 soundtrack.wav <out>
node capture/bench.mjs bench.json --q fidelity --seconds 40      # real-time benchmark, visible full-screen window
node capture/failtest.mjs <dir>                       # no-WebGL, missing-model and phone checks
python report/fill_report.py <validation.json> <bench_dir> <env.json>
node report/build_pdf.mjs report/report_built.html ../deliverables/report/JIXIN_project-report.pdf
python package.py                                     # the two competition ZIPs + SHA256
```

The video tools must not run while you edit `source/web/`: each segment reloads the page.

Lux3D generation (already done; costs credits — do not rerun unless you want new assets):
`python source/lux3d/lux3d.py create image @source/lux3d/req_mask_image.json mask_image`, then
`python source/lux3d/img3d_from_task.py mask <image task id> 300000`. The key is read from the `LUX3D_CN_API_KEY`
environment variable and is never stored in this project.

## Licences

Site code: written for this entry. three.js r180 — MIT (`source/web/vendor/THREE-LICENSE`). The three GLB models were
generated with the entrant's Aholo Lux3D account. No third-party textures, models, fonts or audio files are bundled
(text is rendered with fonts already on the visitor's system; sound is synthesised in the browser).
