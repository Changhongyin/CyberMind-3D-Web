# 国内访问官方入口与部署说明

## 官方入口

| 入口 | 地址 | 状态 |
| --- | --- | --- |
| **国内直连（官方）** | <https://changhongyin.github.io/CyberMind-3D-Web/> | ✅ 中国大陆可直连，2026-11-13 实测通过 |
| 海外原发布地址 | <https://jixin-cybermind.reedymaple.chatgpt.site> | ⚠️ Cloudflare 拦截，中国大陆无法打开，仅作历史记录 |
| 腾讯云备用副本 | <https://my-render-demo-d2g394trhe6ae0726-1489026908.tcloudbaseapp.com/jixin/> | ⚠️ 文件已就绪，但 CloudBase 默认域名会先显示“测试域名风险提醒”页；绑定**已备案自定义域名**后可直接访问 |

网站内容与仓库中的 [`source/web/`](../source/web) 完全一致：纯静态文件，无构建步骤、无服务端逻辑，
任意静态托管都能运行。当前正式入口由 GitHub Pages 从 `gh-pages` 分支发布。

## 为什么换了入口

原地址 `jixin-cybermind.reedymaple.chatgpt.site` 托管在 Cloudflare 上，中国大陆网络访问会被
Cloudflare 安全策略拦截（HTTP 403 `Sorry, you have been blocked`），因此国内打不开。

新入口使用 GitHub Pages（GitHub 的静态托管）。2026-11-13 在中国大陆（浙江，直连、无代理）实测：

- 首页 `HTTP 200`，`content-type: text/html; charset=utf-8`；
- `source/web/` 下 **27/27 个文件 SHA-256 与线上一致**；
- 无头 Chrome（140.0.7339.82，WebGL2 / SwiftShader）真实渲染：无 JS 报错、无资源加载失败，
  54 MB 的三个 GLB 模型全部加载，点击「进入第九井」后可进入 3D 场景并交互；
- 截图见 [`screenshots/`](screenshots)，完整记录见 [`VERIFICATION.md`](VERIFICATION.md)。

> 中国大陆访问 GitHub Pages 的速度会因运营商/时段波动（实测约 0.6–4 MB/s）。首次进入需下载
> 约 54 MB 的模型资源，请耐心等待加载条走完；之后浏览器缓存会显著加快。

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

## 本地预览 / 其他静态托管

```bash
cd source/web
python3 serve.py 8787     # http://127.0.0.1:8787/
```

该目录可直接原样部署到任何静态托管（GitHub Pages、腾讯云 CloudBase、OSS/COS、Nginx 等）。

### 腾讯云 CloudBase 备用副本

本机已配置 CloudBase，环境 `my-render-demo-d2g394trhe6ae0726`（ap-shanghai，体验版），
站点文件位于静态托管路径 `/jixin/`：

```bash
tcb hosting deploy source/web /jixin -e my-render-demo-d2g394trhe6ae0726 --concurrency 10
```

注意：CloudBase **默认域名**（`*.tcloudbaseapp.com`）会为浏览器导航插入“测试域名风险提醒”中间页，
只适合测试；要作为正式站点必须绑定**已完成 ICP 备案的自定义域名**（CloudBase 会校验备案），
备案后可在环境内直接使用同一份 `/jixin/` 文件，无需重新部署。

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
