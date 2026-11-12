# 机心 JIXIN — 面壳之后的引擎

## [进入 3D 互动体验 · 国内直连官方入口](https://changhongyin.github.io/CyberMind-3D-Web/)

无需启动本地服务器。转动三环、启封白瓷面壳，探索雾港下的机械心智。

> 中国大陆可直连（GitHub Pages）：2026-11-13 实测首页 HTTP 200、站点 27 个文件逐文件 SHA-256 一致、
> 真实浏览器渲染通过；详见 [deploy/README.md](deploy/README.md) 与 [deploy/VERIFICATION.md](deploy/VERIFICATION.md)。
>
> 原公网地址 <https://jixin-cybermind.reedymaple.chatgpt.site> 由 Cloudflare 托管，在中国大陆会被拦截（HTTP 403），
> 仅保留为历史发布记录。首次进入需下载约 54 MB 的 3D 模型，请等待加载完成。

- [完整项目备份与原画质视频](https://github.com/Changhongyin/CyberMind-3D-Web/releases/tag/v1.0.0)
- [项目报告 PDF](deliverables/report/JIXIN_project-report.pdf)
- [验证记录](deliverables/VALIDATION.md)
- [原工程说明与复现方法](PROJECT_README.md)

网站源代码位于 `source/web/`；资产、制作日志、过程图与核对资料分别位于 `assets/`、`coordination/`、`review/` 和 `recovery/`。Aholo Lux3D 用于面壳、铜炉、巡逻灯奴三件资产，其余环境及交互由程序构建。

视频母版为原生 3840×2160、120 fps、58.5 秒，含声音。网页实时帧率取决于设备；4K120 实时运行尚未验证。

Git 仓库保留源文件及资料；大体积视频、已有压缩包和发布副本保存在 Release 的完整备份中。完整备份覆盖清单中的全部原项目文件（排除 Git 内部数据、可重建依赖与系统缓存）。复原方法见 Release 的 RESTORE.md。
