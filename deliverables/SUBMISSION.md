# 《机心》 JIXIN — 参赛提交说明 / submission sheet

Prepared for the Aholo 全球 3D AI 黑客松 form. **Nothing has been submitted, published or agreed to.** The entrant fills the
form, ticks the declarations and publishes the demo/social links personally.

Rules re-checked on the live page on 2026-11-12 (snapshot: `references/competition-page-text-20261112.txt`):
deadline **2026-11-19 19:00 (UTC+8)**, last successful submission counts; required = 项目报告书 + 完整 Demo（链接或视频，须含真实运行画面）;
bonus = 小红书 #Aholo黑客松 link, 项目源代码 (link or ZIP/RAR ≤ 500 MB per the form screenshot); scoring published as
群核技术栈应用 30% / 有趣程度 25% / 创新性 20% / 完成度 20% / 传播 5% (expert 70% + player 30%).

## 1 · 选题（Topic）

**选题名称**

> 机心 JIXIN

**选题简介**（92 字）

> 可亲手“启封”的全3D赛博朋克网站：转动三环，巨型瓷面裂开，雨停在半空，一台用字鼓与簧片“思考”的机械心智醒来。写给科幻与网页3D爱好者；面壳、铜炉、灯奴三件主角资产由Lux3D生成。

## 2 · 必交项 · 完整 Demo（链接或视频）

| option | file / action | notes |
| --- | --- | --- |
| **Demo link (preferred)** | unzip `JIXIN_site-static.zip` onto any static host (e.g. a 魔搭创空间 static-HTML space, OSS/COS bucket website, GitHub/Cloudflare Pages) and submit that URL | pure static files, no server code, no API key. **Missing dependency: an authorised hosting account — not available to the agent.** Open the public URL in a private window before submitting. |
| **Video** | `video/JIXIN_viewing-copy_1920x1080_60fps_H264_derived-from-master.mp4` (smallest) or the 4K60 copy | real running footage of the site; upload size limit for this field was not visible in the screenshots — check the form. |
| master (archive / on request) | `video/JIXIN_master_3840x2160_120fps_HEVC-Main10.mp4` | native 3840×2160, 120 fps, 7020 frames, 58.5 s. HEVC 10-bit: plays in current Safari/QuickTime, Windows with HEVC extension, VLC, mpv. |

## 3 · 必交项 · 项目报告书

`report/JIXIN_project-report.pdf` (13 pages, 16:9, Chinese). Contains process screenshots, iterations, Lux3D before/after, code
contribution, measured performance and limitations.

## 4 · 生态伙伴设备 / 技术

Select **无 / None** — no ecosystem-partner hardware or technology was used. (Aholo Lux3D itself is the mandatory tool and is
declared through the report and the declaration checkbox.)

## 5 · 应用赛道（select 1–3 that truly apply）

Recommended: **游戏 (games)** — it is an interactive 3D experience with a play loop (align → unseal → rewrite thoughts → reseal).
Not applicable: 空间设计, 影视, 3D 打印, 具身智能 (the video is a recording of the site, not a film production; nothing is printed or embodied).
If you prefer not to enter a single-item category, choose None.

## 6 · 加分项

- **社交媒体链接**: not created. Suggested post text (edit freely, publish yourself, keep it public until results):
  > 做了一个可以亲手“启封”的赛博朋克网站《机心》：转动三道光环，一张六米高的白瓷面从中间裂开，雨停在半空，里面是一台用字鼓和簧片思考的机械心智。面壳、铜炉、巡逻灯奴三件主角资产用 Aholo Lux3D 生成，其余全部用代码搭建。#Aholo黑客松
  > (attach 2–4 images from `stills/` and/or the 1080p60 video)
- **项目源代码**: upload `JIXIN_source.zip` (< 500 MB) or a repository link if you publish one.

## 7 · 声明（tick only if true for you）

- “我确认作品使用 Aholo Lux3D 完成，且可运行、可演示” — true for this package (see report pp.7–8 and `assets/lux3d/ledger.jsonl`).
- “我已阅读并同意……提交须知” — read the linked terms yourself before ticking.

## Files in `deliverables/`

| file | size | purpose |
| --- | --- | --- |
| `video/JIXIN_master_3840x2160_120fps_HEVC-Main10.mp4` | 905.8 MB | native 4K120 demonstration master, 7020 frames, 58.5 s, with sound |
| `video/JIXIN_viewing-copy_3840x2160_60fps_H264_derived-from-master.mp4` | 549.5 MB | labelled 4K60 viewing copy (every 2nd master frame), with sound |
| `video/JIXIN_viewing-copy_1920x1080_60fps_H264_derived-from-master.mp4` | 145.7 MB | labelled 1080p60 viewing copy, with sound — smallest upload option |
| `video/soundtrack/` |  | the WAV mixed into the videos + its event log (provenance) |
| `stills/JIXIN_4K_01…12_*.png` | 12 files | native 3840×2160 stills rendered from the site (+ shots.meta.json with state/pose) |
| `report/JIXIN_project-report.pdf` | 8.8 MB | project report, 13 pages |
| `JIXIN_site-static.zip` | see zips.sha256.json | the website, ready for any static host |
| `JIXIN_source.zip` | see zips.sha256.json | complete source package (< 500 MB) |
| `VALIDATION.md` |  | what was tested, where, and what remains unmet |

