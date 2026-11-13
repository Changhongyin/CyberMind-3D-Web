# 国内访问官方入口与部署说明

## 官方入口

| 入口 | 地址 | 状态 |
| --- | --- | --- |
| **国内快速入口（腾讯云上海 CDN，当前主入口）** | <https://my-render-demo-d2g394trhe6ae0726-1489026908.tcloudbaseapp.com/jixin/> | ✅ 可访问（2026-11-13 实测）；首次需等 3 秒点「确定访问」，之后同一浏览器不再提示；平台标注默认域名仅供测试 |
| 备用入口（GitHub Pages） | <https://changhongyin.github.io/CyberMind-3D-Web/> | ✅ 中国大陆可直连，无提示页；国内速度不稳定（实测 2 KB/s–4 MB/s 波动） |
| 海外原发布地址 | <https://jixin-cybermind.reedymaple.chatgpt.site> | ⚠️ Cloudflare 拦截，中国大陆无法打开，仅作历史记录 |

网站内容与仓库中的 [`source/web/`](../source/web) 完全一致：纯静态文件，无构建步骤、无服务端逻辑，
任意静态托管都能运行。当前同一份文件同时发布在腾讯云 CloudBase（上海 CDN，主入口）和 GitHub Pages（备用入口）。

## 为什么换了入口

原地址 `jixin-cybermind.reedymaple.chatgpt.site` 托管在 Cloudflare 上，中国大陆网络访问会被
Cloudflare 安全策略拦截（HTTP 403 `Sorry, you have been blocked`），因此国内打不开。

现提供两个国内入口：

- **腾讯云 CloudBase 默认域名（主入口，速度快）**：站点部署在上海节点，国内 CDN 实测约 1–2 MB/s。
  首次打开会出现平台「测试域名风险提醒」（HTTP 404），等 3 秒倒计时结束点「确定访问」后写入
  `cloudbase_confirm_domain_access` cookie，之后同一浏览器直接进入站点。
- **GitHub Pages（备用入口，无提示页）**：内容完全一致，但中国大陆访问速度受跨境线路影响很大
  （同一时段实测 2 KB/s–4 MB/s 波动）。

## 部署结构

- 正式内容源：仓库 `main` 分支的 `source/web/`；
- 发布分支：`gh-pages` 分支，根目录即 `source/web/` 的内容（附 `.nojekyll`）；
- GitHub Pages：Settings → Pages → Source = `gh-pages` / `(root)`，访问
  <https://changhongyin.github.io/CyberMind-3D-Web/>。

## 更新网站

在本地修改 `source/web/` 并提交到 `main` 后，执行：

```bash
./deploy/publish-github-pages.sh
```

脚本会把 `source/web/` 的内容重新发布到 `gh-pages` 分支（强制覆盖），GitHub Pages 随后自动重建，
通常 1–2 分钟内生效。可用环境变量覆盖默认值：

```bash
PAGES_REMOTE=git@github.com:Changhongyin/CyberMind-3D-Web.git \
PAGES_BRANCH=gh-pages \
./deploy/publish-github-pages.sh
```

发布后可运行校验脚本，确认线上与本地逐文件一致：

```bash
./deploy/verify-site.sh
# 或指定地址
SITE_URL=https://changhongyin.github.io/CyberMind-3D-Web ./deploy/verify-site.sh
```

同步更新腾讯云 CloudBase 主入口：

```bash
tcb hosting deploy source/web /jixin -e my-render-demo-d2g394trhe6ae0726 --concurrency 10
```

## 本地预览 / 其他静态托管

```bash
cd source/web
python3 serve.py 8787     # http://127.0.0.1:8787/
```

该目录可直接原样部署到任何静态托管（GitHub Pages、腾讯云 CloudBase、OSS/COS、Nginx 等）。

### 腾讯云 CloudBase 默认域名（主入口）

本机已配置 CloudBase，环境 `my-render-demo-d2g394trhe6ae0726`（ap-shanghai，体验版），
站点文件位于静态托管路径 `/jixin/`：

```bash
tcb hosting deploy source/web /jixin -e my-render-demo-d2g394trhe6ae0726 --concurrency 10
```

首次访问流程：浏览器导航请求会被平台拦截并返回「风险提醒」页（HTTP 404，3 秒倒计时结束后可点
「确定访问」），确认后写入 `cloudbase_confirm_domain_access` cookie 并加载真实站点；之后同一浏览器
直接进入。2026-11-13 真机实测（中国浙江，Safari，直连）：

- 三个 GLB：mask 5.7 s / drone 5.8 s / censer 7.3 s，约 25 s 后进入「就绪 · ready」；
- 进入 3D 场景：60 FPS（内部 2752×1628 原生 · 4×MSAA）；
- curl 同时段对比：CloudBase 约 1.1–1.8 MB/s，GitHub Pages 约 2–22 KB/s。

注意：平台明确标注默认域名**仅供开发测试**，存在访问频率限制与稳定性风险；体验版环境有效期至
2027-03-16。要彻底去掉提示页并长期稳定，需绑定**已完成 ICP 备案的自定义域名**（CloudBase 会校验备案），
备案后可直接复用这份 `/jixin/` 文件。

## 如要使用自己的域名

- GitHub Pages：在仓库 Settings → Pages → Custom domain 填写域名，并在 DNS 添加 CNAME；
  GitHub Pages 支持 HTTPS。中国大陆访问自定义域名同样取决于线路。
- 腾讯云 CloudBase：静态托管 → 自定义域名（需 ICP 备案 + 证书），可完全去掉默认域名的提示页，
  获得国内 CDN 加速。

## 目录

```
deploy/
├── README.md                  # 本文件
├── publish-github-pages.sh    # 发布 source/web 到 gh-pages
├── verify-site.sh             # 线上逐文件 SHA-256 校验
├── VERIFICATION.md            # 2026-11-13 国内访问验证记录
├── verification.json          # 机器可读的验证数据
└── screenshots/               # 中国大陆网络下真实浏览器渲染截图
```
