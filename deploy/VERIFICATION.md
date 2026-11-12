# 国内访问验证记录（2026-11-13）

## 结论

| 项目 | 结果 |
| --- | --- |
| 官方入口 | <https://changhongyin.github.io/CyberMind-3D-Web/> |
| 测试网络 | 中国大陆 · 浙江 · 家庭宽带，**直连、未使用代理**（系统代理关闭，`--noproxy '*'`，出境 IP 124.160.210.209） |
| 首页 HTTP | `200 OK`，`content-type: text/html; charset=utf-8` |
| 文件完整性 | `source/web/` 共 **27 个文件、54,918,807 字节，SHA-256 逐一比对 27/27 一致** |
| 真实浏览器渲染 | 无头 Chrome 140（WebGL2）打开成功：无 JS 报错、无请求失败，三个 GLB 模型全部加载，点击「进入第九井」后进入 3D 场景并可交互 |
| 原公网地址 | `https://jixin-cybermind.reedymaple.chatgpt.site` 返回 Cloudflare `403 Sorry, you have been blocked`，中国大陆不可达（历史发布记录） |

## 1. HTTP 可达性

```text
$ curl -sI https://changhongyin.github.io/CyberMind-3D-Web/
HTTP/2 200
server: GitHub.com
content-type: text/html; charset=utf-8
cache-control: max-age=600
x-github-edge-region: fra

$ curl -sI https://changhongyin.github.io/CyberMind-3D-Web/assets/mask.glb
HTTP/2 200
content-type: model/gltf-binary
content-length: 15565300
```

## 2. 逐文件校验

`deploy/verify-site.sh` 对 `source/web/` 的 27 个文件逐个下载并比对 SHA-256：

```text
assets/censer.glb   OK ... index.html OK ... src/*.js OK ...
style.css OK ... vendor/* OK ... tools/model-viewer.html OK
verified_ok=27 failed=0
```

> 注：校验时 `assets/mask.glb` 曾因跨境带宽波动中断一次，重试后 SHA-256 一致；这是 GitHub Pages
> 海外线路的正常波动，不代表文件不一致。机器可读结果见 [`verification.json`](verification.json)。

## 3. 真实浏览器渲染

用无头 Chrome（`chrome-headless-shell` 140.0.7339.82，SwiftShader 软件 WebGL2，视口 1440×900）从上述
中国大陆网络直接访问：

- `page.goto` 返回 200，`document.title` = `机心 JIXIN — 面壳之后的引擎`；
- `webgl2: true`；控制台 **0 个 error**，**0 个失败请求**；
- 资源加载完成：`main.js`、`three.module.min.js`、`GLTFLoader.js`、`src/*.js` 以及
  `mask.glb`、`censer.glb`、`drone.glb` 全部 200；
- 加载界面进度条走完，显示「就绪 · ready / 进入第九井 ENTER WELL-09」；
- 点击进入后 `#hud` 显示，状态为「第九井 · 傀-7 · 封存中 SEALED」，可切换画质、按键转动三环；
- 截图为真实浏览器输出：
  - [`screenshots/01-loading.png`](screenshots/01-loading.png)
  - [`screenshots/02-scene.png`](screenshots/02-scene.png)
  - [`screenshots/03-rings.png`](screenshots/03-rings.png)

> 渲染时软件 WebGL 只有约 1 FPS（`1 FPS · 内部 1440×900 原生 · 4×MSAA · 177 calls · 4.54M tris`），
> 这是无头环境用 CPU 模拟 GPU 所致；真实设备使用 GPU 时帧率取决于设备性能（与原项目说明一致）。

## 4. 原地址为何打不开

```text
$ curl -s -o /dev/null -w '%{http_code}' https://jixin-cybermind.reedymaple.chatgpt.site/
403
# Cloudflare: "Sorry, you have been blocked"（安全策略拦截中国大陆访问）
```

## 5. 备选托管：腾讯云 CloudBase 的实测结论

已试用本机登录的 CloudBase 环境（`my-render-demo-d2g394trhe6ae0726`，ap-shanghai），站点部署在
静态托管 `/jixin/`，CDN 下载 15.5 MB 模型约 2.9 s（约 5.4 MB/s，国内速度很好）。但 CloudBase 的
**默认域名**会为浏览器导航插入腾讯云“测试域名风险提醒”中间页（页面标题 `风险提醒`，提示内容未经审核），
默认域名也仅面向开发测试且有风控/限流。因此它不作为公开“官方网站”，仅保留为待备案域名可用的备用副本。
正式消除提示页需要绑定已完成 ICP 备案的自定义域名。

## 6. 复现命令

```bash
cd <repo>

# 重新发布（source/web -> gh-pages）
./deploy/publish-github-pages.sh

# 逐文件校验
./deploy/verify-site.sh
```

## 7. 局限与后续建议

- 本次验证在中国大陆单一网络（浙江）完成；GitHub Pages 的国内访问速度因运营商和时段波动，
  首次加载需下载约 54 MB 模型，建议测试时留足加载时间。
- 如需长期、稳定、合规的品牌站点，建议绑定**已备案的自有域名**（GitHub Pages 自定义域名，或
  腾讯云 CloudBase 自定义域名 + 国内 CDN），这样可以获得更好的国内访问速度并去掉平台提示页。
