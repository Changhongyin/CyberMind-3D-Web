# JIXIN — Windows VM final transfer audit

Date: 2026-11-12 06:3x (VM local time). Full data: `review/windows-final-transfer-audit.json`.

## Conclusion: **READY** (for Codex verification)

All JIXIN project files found on the Windows VM are on the share. No project job, server or browser is running. Nothing was
deleted in this audit. Do not read this as "every file on Windows was checked": the exact scope is below.

## Running project jobs

None at 06:33: no node, ffmpeg, python or headless/puppeteer Edge processes, and no listening ports 8700–8899. The three
static servers this project used (:8787, :8790, :8791) were stopped by the agent at 06:04 (their logs are below).

## Scanned

| area | how |
| --- | --- |
| `C:\Users\lover` — the whole profile, including Desktop, Documents, Downloads, OneDrive, AppData (incl. Temp and every Claude session temp folder), `.claude`, `.codex`, `.clawd` | recursive walk of 112,667 files. A file was a candidate if it was modified since 2026-11-11 19:00 with a project-like extension, or if its path/name mentions jixin / cybermind / 机心 / capture.json / seg_N / master_3840 / soundtrack / report_built. Every candidate was SHA256-hashed and looked up in a hash index of all 238 files of the share project (0 share read errors) |
| `C:\` top level, `C:\Users`, `D:` | inspected only: since project start only the OS swap/hibernation files changed; no other profile is in use (Default/Public unchanged since 2026-08-11); D: is an empty CD-ROM drive |
| former scratch `C:\Users\lover\cybermind-scratch` | absent. It was removed at ~06:05 after a SHA256-verified transfer of 83 files (`review/copy_manifest.json`); only redundant intermediates were discarded there (video segments, silent master, superseded test renders, node_modules) |

**Errors / not scanned:**
- 84 access errors while walking: legacy junctions such as `AppData\Local\Application Data`, and over-long paths inside the Claude desktop app's skills cache. Neither is a project location.
- Not scanned: `C:\Windows`, `C:\Program Files*`, `C:\ProgramData`.

## Findings

| class | count | action |
| --- | --- | --- |
| JIXIN background-job logs of this agent session (Lux3D wait, export watcher, export / derivative exit codes, server logs) | 9 | **transferred** |
| transfer-audit scripts | 4 | **transferred** |
| unrelated app/system data (Claude desktop app, clawd, codex, Steam, Clash, Edge, Windows temp, `.claude.json`) | 57 | excluded |
| previous Zoetrope session temp files (5 images, job logs), from before JIXIN started | 15 | excluded — out of scope by instruction |
| Zoetrope STL checksum lists `Temp\a.txt`, `Temp\b.txt` | 2 | excluded — not JIXIN |
| `Temp\out.html` (docs page fetched 2026-11-11 19:20, before JIXIN) | 1 | excluded |
| raw scan output and the audit's own live job log | 2 | not copied; summarised in the audit JSON |
| browser profiles (68 puppeteer temp-profile files), app caches, npm/pip caches, programs, agent config | by rule | excluded, never copied |
| credentials / API keys | — | none copied: every transferred file was checked for the key value |

No JIXIN source, asset, render, report, validation record or unreproduced output was found outside the share.

## Transferred now (SHA256 re-read from the share, all verified)

| file on share | bytes | sha256 |
| --- | --- | --- |
| `recovery/windows-final-transfer/claude-session-7507bda7-job-logs/b91t0kjf2.output` | 213 | `08b118d54384fafddd1b45ef2eefdd368498e234c8690d2ee4ce7ff4f0b8a8b0` |
| `…/job-logs/bkxw7kdfs.output` | 1741 | `60431182f50616f4e5b5007b3ea37e62b2e44af4340463f437e79cd3ebbdd614` |
| `…/job-logs/bti87d89x.output` | 22 | `9ee8ddbc1f705d5cad80decea71573a77c4bf3d3e817fbb4e7c644c51b31e747` |
| `…/job-logs/b8nk6x737.output` | 22 | `9ee8ddbc1f705d5cad80decea71573a77c4bf3d3e817fbb4e7c644c51b31e747` |
| `…/job-logs/bynmbi7on.output` | 22 | `5da6bcf56bf3157a2448671a77c71e7350cc778f24edffcee3fcee8f0431879d` |
| `…/job-logs/b3ds21epz.output` | 22 | `9ee8ddbc1f705d5cad80decea71573a77c4bf3d3e817fbb4e7c644c51b31e747` |
| `…/job-logs/blvu9nbir.output` | 56 | `5fb264a3313163c2488a9928c3eebbe4e323d67bb30c649e5c7ff261a9cafbec` |
| `…/job-logs/be6ep3cky.output` | 56 | `b6e3013da6489b9de38906ac6593b9aa83304291db87d071432cfbb289ba6c28` |
| `…/job-logs/bb0opvj1x.output` | 56 | `a28e94cfde56bd6a69a6df89d1e4b3aae7348a3d93a9f8f447217e8c37cf11e2` |
| `recovery/windows-final-transfer/audit-tools/audit_scan.py` | 3651 | `51f0d3bdb9b58d036efd1bd00e358751c9d027adad6b0f3da2d01ef0b0a9e1d5` |
| `…/audit-tools/audit_finish.py` | 7481 | `b401dd909714ef175f6f08da70d4997a8f347725bd82f2d066f2e5282429f651` |
| `…/audit-tools/summ.py` | 561 | `56ea87b10bfa5a0497beb8b62e02a4e5ff47350b048c3c5e857a0738793fee7e` |
| `…/audit-tools/summ2.py` | 268 | `fe88e221db4a2ab6db552d5e5d62a463e670bf413abaad37650f963137611768` |

Three logs share one hash because each contains only the same `exit=0`-style line (22 bytes).

## Re-check of `review/copy_manifest.json` against the current share

- 84 entries: **83 match**.
- 1 expected mismatch: `review/copy_manifest.json` itself. Its entry recorded the hash of the copy made before the final entries were appended (`d706052e…`); the complete manifest was then written over it (now `bc1f37dc…`). A self-referencing manifest entry can never match its final file.
- No other file in the manifest changed after it was copied.

## Not done here (deliberately)

- No local deletions in this audit. The 13 transferred items are Claude harness temp files (job logs, scratchpad scripts), not project working copies; the harness cleans them up.
- No rendering, regeneration, redesign or deployment. No investigation of the old Zoetrope folder.
- The VM is **not** shut down: Codex shuts it down after verifying this report.
