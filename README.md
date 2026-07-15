# 图印工坊 · PicMark Studio

> 纯前端、零部署的浏览器内批量个性化图片生成工具 —— 上传底图、标记位置、导入名单，一键生成并打包下载 ZIP。

🟢 **在线 Demo**：<https://your-username.github.io/picmark-studio/>

---

## 功能特性

- 🖼️ **纯前端零部署**：单个静态站点即可运行，无需服务器、数据库或构建工具。
- 🔒 **图片不上传服务器**：所有图片处理均在浏览器内完成，名单与底图绝不出本机，隐私安全有保障。
- 🎯 **可视化区域编辑器**：在画布上拖拽绘制文字区域，支持移动、缩放、撤销/重做，所见即所得。
- 🔤 **自适应字号**：根据区域大小与文本长度自动二分搜索最佳字号，长名字也能完美填充。
- 🧰 **预设模板一键套用**：内置 6 套常用场景模板，导入底图后选择预设即可生成区域，无需手动绘制。
- 📝 **名单导入灵活**：支持直接粘贴文本（每行一个名字）或上传 `.txt` / `.csv` 文件。
- 🎨 **水墨印章风格 UI**：宣纸暖白底 / 墨黑文字 / 朱砂红强调，契合印章、证书、邀请函等东方场景。
- 🗂️ **批量打包下载**：生成结果自动打包为 ZIP 一次性下载，配合 Web Worker 不阻塞界面。
- 📱 **移动端适配**：响应式布局，手机浏览器、微信内置浏览器均可使用。
- ⚡ **性能可调**：支持原图尺寸 / 高清 / 标准 / 快速四档输出质量，适配不同设备性能。

## 快速开始

只需三步，即可批量生成个性化图片：

1. **上传底图** —— 在「底图与文字」区域点击或拖拽上传一张模板图片（JPG / PNG / WEBP）。
2. **标记位置或套用预设** —— 切换到「区域」模式，手动绘制文字框；或在「套用预设」下拉中选择一个预设模板（如「工牌胸牌」「荣誉证书」）。
3. **导入名单并生成** —— 在「导入名单」中粘贴名单（每行一个名字），点击「开始生成并下载」，等待进度条完成后即可得到 ZIP 压缩包。

## 截图与演示

> 以下为界面截图 / 操作动图占位区，后续将补充实际素材。

```
┌─────────────────────────────────────────┐
│           [ 主界面截图占位 ]              │
├─────────────────────────────────────────┤
│           [ 区域编辑动图占位 ]            │
├─────────────────────────────────────────┤
│           [ 批量生成演示占位 ]            │
└─────────────────────────────────────────┘
```

## 本地运行

本项目为纯静态站点，无需安装依赖，任选一种方式即可在本地预览：

**方式一：Python 内置服务器（推荐）**

```bash
git clone https://github.com/your-username/picmark-studio.git
cd picmark-studio
python -m http.server 8080
```

然后在浏览器访问 <http://localhost:8080/>。

**方式二：Node 静态服务器**

```bash
npx serve .
# 或
npx http-server -p 8080
```

**方式三：直接打开**

直接用浏览器打开 `index.html` 亦可使用大部分功能；但部分浏览器对 `file://` 协议下的字体加载、Worker 等有限制，建议优先使用前两种方式。

## 预设模板

内置 6 套预设模板，覆盖常见个性化图片场景。坐标均以图片宽高比例（0~1）存储，套用时会按实际图片尺寸自动换算为像素，因此同一套预设可适配任意比例的底图：

| 预设名称 | 适用场景 | 区域构成 |
|----------|----------|----------|
| 工牌胸牌 | 员工工牌、活动胸牌 | 姓名居上 + 编号居下 |
| 荣誉证书 | 奖状、荣誉证书 | 姓名居中 + 日期右下 |
| 邀请函 | 婚礼、活动邀请函 | 嘉宾姓名居中 |
| 签到名牌 | 会议、团建签到 | 超大姓名 + 单位底部 |
| 贺卡祝福 | 节日、生日贺卡 | 称呼居中 + 落款右下 |
| 简约名片 | 个人、商务名片 | 姓名左上 + 职务右下 |

> 想新增预设？欢迎参考 [CONTRIBUTING.md](./CONTRIBUTING.md) 中「贡献预设模板」一节，在 `js/region-editor.js` 的 `PRESETS` 数组中添加即可，这是最简单的贡献方式。

## 技术栈

- **原生 HTML / CSS / JavaScript**：无框架、无构建工具，源码即运行码。
- **Canvas 2D API**：底图绘制、文字渲染、区域叠加均基于 Canvas。
- **JSZip**：在浏览器内将生成结果打包为 ZIP（本地依赖，位于 `lib/`）。
- **FileSaver.js**：触发 ZIP 文件下载（本地依赖，位于 `lib/`）。
- **Web Worker**：批量生成任务放入独立线程，避免阻塞主界面。
- **FontFace API**：支持上传自定义字体（TTF / OTF / WOFF）用于渲染。

## 贡献

欢迎贡献代码、预设模板或反馈问题！请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解代码结构、贡献流程与代码风格要求。

## 开源协议

本项目基于 [MIT License](./LICENSE) 开源，版权所有 © 2024-2026 XanthanL。欢迎自由使用、修改与分发。

---

## English

# PicMark Studio

> A purely front-end, zero-deployment, in-browser tool for batch-generating personalized images — upload a template, mark text regions, import a name list, and download all results as a ZIP in one click.

🟢 **Live Demo**: <https://your-username.github.io/picmark-studio/>

---

## Features

- 🖼️ **Pure front-end, zero deployment** — runs as a single static site; no server, database, or build tool required.
- 🔒 **Images never leave your browser** — all processing happens locally; templates and name lists are never uploaded, keeping your data private.
- 🎯 **Visual region editor** — drag to draw text regions on the canvas with move, resize, undo/redo support. What you see is what you get.
- 🔤 **Adaptive font sizing** — a binary search automatically picks the best font size for each region, so even long names fill the area perfectly.
- 🧰 **One-click preset templates** — 6 built-in presets for common scenarios; pick one after uploading your template and the regions are generated for you.
- 📝 **Flexible name list import** — paste names directly (one per line) or upload a `.txt` / `.csv` file.
- 🎨 **Ink-stamp aesthetic UI** — warm xuan-paper white, ink black, and cinnabar red, fitting stamp, certificate, and invitation scenarios.
- 🗂️ **Batch ZIP download** — results are zipped and downloaded in one go, with generation offloaded to a Web Worker so the UI never freezes.
- 📱 **Mobile-friendly** — responsive layout that works in mobile browsers and the WeChat in-app browser.
- ⚡ **Adjustable performance** — four output quality levels (original / high / standard / fast) to match different devices.

## Quick Start

Generate personalized images in three steps:

1. **Upload a template** — in the "Template & Text" section, click or drag to upload a template image (JPG / PNG / WEBP).
2. **Mark regions or apply a preset** — switch to "Region" mode and draw text boxes manually, or pick a preset (e.g. "Badge", "Certificate") from the "Apply preset" dropdown.
3. **Import names and generate** — paste your name list (one per line) in "Import names", click "Start generating & download", and grab the ZIP when the progress bar finishes.

## Screenshots & Demo

> Placeholders for UI screenshots and demo GIFs — actual assets will be added later.

```
┌─────────────────────────────────────────┐
│           [ main UI screenshot ]         │
├─────────────────────────────────────────┤
│           [ region editor demo ]         │
├─────────────────────────────────────────┤
│           [ batch generation demo ]      │
└─────────────────────────────────────────┘
```

## Run Locally

This is a static site with no dependencies to install. Pick any of the following:

**Option 1: Python built-in server (recommended)**

```bash
git clone https://github.com/your-username/picmark-studio.git
cd picmark-studio
python -m http.server 8080
```

Then open <http://localhost:8080/> in your browser.

**Option 2: Node static server**

```bash
npx serve .
# or
npx http-server -p 8080
```

**Option 3: Open directly**

You can also open `index.html` directly in a browser; most features work, but some browsers restrict font loading and Workers under the `file://` protocol, so the first two options are preferred.

## Preset Templates

Six built-in presets cover common personalized-image scenarios. Coordinates are stored as ratios (0~1) of the image dimensions and converted to pixels when applied, so a single preset works with templates of any aspect ratio:

| Preset | Use case | Regions |
|--------|----------|---------|
| Badge (工牌胸牌) | Staff badges, event badges | Name on top + ID on bottom |
| Certificate (荣誉证书) | Awards, certificates | Centered name + date bottom-right |
| Invitation (邀请函) | Wedding, event invitations | Centered guest name |
| Sign-in Nameplate (签到名牌) | Conference, team-building sign-in | Large name + organization at bottom |
| Greeting Card (贺卡祝福) | Holiday, birthday cards | Salutation centered + signature bottom-right |
| Minimal Card (简约名片) | Personal, business cards | Name top-left + title bottom-right |

> Want to add a preset? See the "Contributing a Preset Template" section in [CONTRIBUTING.md](./CONTRIBUTING.md) — just add an entry to the `PRESETS` array in `js/region-editor.js`. It's the easiest way to contribute.

## Tech Stack

- **Vanilla HTML / CSS / JavaScript** — no framework, no build tool; the source is the runnable code.
- **Canvas 2D API** — template rendering, text drawing, and region overlays all built on Canvas.
- **JSZip** — packs generated results into a ZIP in the browser (vendored in `lib/`).
- **FileSaver.js** — triggers the ZIP download (vendored in `lib/`).
- **Web Worker** — batch generation runs in a separate thread to keep the UI responsive.
- **FontFace API** — supports uploading custom fonts (TTF / OTF / WOFF) for rendering.

## Contributing

Contributions of code, presets, and issue reports are all welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first to learn about the code structure, contribution workflow, and code style guidelines.

## License

This project is open-sourced under the [MIT License](./LICENSE), copyright © 2024-2026 XanthanL. You are free to use, modify, and distribute it.
