# 贡献指南

感谢你对图印工坊（PicMark Studio）的关注！无论是提交问题、贡献预设模板，还是直接贡献代码，都非常欢迎。本指南将帮助你快速上手。

## 如何本地启动

本项目为纯静态站点，无需安装任何依赖。克隆仓库后任选一种方式启动本地服务器即可：

```bash
git clone https://github.com/XanthanL/picmark-studio.git
cd picmark-studio

# 方式一：Python（推荐）
python -m http.server 8080

# 方式二：Node
npx serve .
```

然后在浏览器打开 <http://localhost:8080/> 即可。

> 不建议直接双击 `index.html` 打开：`file://` 协议下部分浏览器会限制 Web Worker 与自定义字体加载，导致批量生成或自定义字体功能异常。

修改代码后刷新浏览器即可看到效果，无需重新构建。

## 代码结构说明

```
picmark-studio/
├── index.html              # 入口页面，包含整体 HTML 结构与三段式分区（底图与文字 / 导入名单 / 批量生成）
├── css/
│   └── style.css           # 全部样式，新拟物表面（投影 token）与响应式布局
├── js/
│   ├── app.js              # 主业务逻辑：状态管理、DOM 绑定、图片处理、名单解析、批量生成与 ZIP 打包
│   ├── layers.js           # 图层渲染内核：文字锚点 / 文字区域 / PNG 水印统一由 renderAll() 绘制，页面与 Worker 共用
│   ├── layer-editor.js     # 画布交互：命中测试、移动 / 8 向缩放 / 旋转手柄、撤销重做栈
│   ├── layer-panel.js      # 图层面板：列表与选中项配置区（按图层类型动态生成字段）
│   ├── layer-presets.js    # 预设模板数组
│   ├── text-style.js       # 文字绘制内核：字体、字间距、描边、阴影、下划线（页面与 Worker 共用）
│   ├── panel-controls.js   # 顶部工具条控件（字号 / 字重 / 对齐 / 特效滑杆等）
│   ├── custom-select.js    # 自绘下拉组件
│   ├── web-fonts.js        # 开源网络字体注册表：按需 fetch woff2 → FontFace，出图时把字形数据交给 Worker
│   └── worker.js           # Web Worker：批量生成在独立线程执行，调用同一个 PMLayers.renderAll
├── lib/
│   ├── jszip.min.js        # 第三方库：浏览器内 ZIP 打包（本地依赖）
│   └── FileSaver.min.js    # 第三方库：触发文件下载（本地依赖）
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

各文件职责：

- **`index.html`**：页面骨架与三段式分区，所有 DOM 节点的 `id` 在 `app.js` 中被引用，修改时请注意保持一致。
- **`css/style.css`**：样式与配色。请使用文件顶部定义的 CSS 变量，避免硬编码色值。
- **`js/app.js`**：核心控制器，负责串联上传 → 编辑 → 生成的完整流程。
- **`js/layers.js`**：唯一的绘制入口。**预览、主线程出图、Worker 出图都必须调 `PMLayers.renderAll`**，
  任何「在某处手写一段 ctx 绘制」的改动都会重新引入「预览 ≠ 成品」这类 bug。
- **`js/layer-editor.js`**：画布交互与历史栈，通过 `window.LayerEditor` 暴露。

## 贡献预设模板

这是最简单、门槛最低的贡献方式，无需理解全部代码，只需编辑一个数组即可。

预设模板定义在 `js/layer-presets.js` 的 `PMLayerPresets` 数组中。每个预设是一个对象，包含 `name`、`desc` 和 `regions` 三个字段：

```javascript
var PRESETS = [
  {
    name: '工牌胸牌',            // 预设名称（显示在下拉菜单中）
    desc: '姓名居上 + 编号居下',  // 简短描述
    regions: [                  // 区域数组，每个元素对应一个文字框
      {
        rx: 0.22, ry: 0.12,     // 区域左上角坐标，以图片宽高的比例表示（0~1）
        rw: 0.56, rh: 0.28,     // 区域宽高，同样以比例表示
        config: {               // 文字渲染配置
          useNameList: true,    // true=从名单读取，false=使用 fixedText
          fixedText: '',        // useNameList 为 false 时的固定文本
          fontFamily: 'Microsoft YaHei, sans-serif',
          fontWeight: 700,
          color: '#1A1A1A',
          alignH: 'center',     // 水平对齐：left / center / right
          alignV: 'middle',     // 垂直对齐：top / middle / bottom
          maxFontSize: 120,
          minFontSize: 24
          // 完整字段见 defaultConfig()，未指定的字段会自动补全默认值
        }
      }
      // 可继续添加更多区域
    ]
  }
  // 可继续添加更多预设
];
```

**贡献步骤**：

1. 在 `PRESETS` 数组中新增一个对象，填写 `name`、`desc` 和 `regions`。
2. 坐标统一用比例（0~1），这样同一套预设可适配任意尺寸的底图。
3. 本地启动后，上传一张对应场景的底图，在「套用预设」下拉中选择你的新预设，确认区域位置与文字效果符合预期。
4. 提交 PR，在描述中说明预设的适用场景，最好附一张效果图。

## 贡献代码流程

1. **Fork** 本仓库到你的 GitHub 账号。
2. **克隆** 你 Fork 后的仓库到本地：
   ```bash
   git clone https://github.com/<你的用户名>/picmark-studio.git
   cd picmark-studio
   ```
3. **添加上游** 以便同步最新代码：
   ```bash
   git remote add upstream https://github.com/XanthanL/picmark-studio.git
   ```
4. **新建分支**，分支名请用英文并简明描述改动：
   ```bash
   git checkout -b feat/add-csv-multi-column
   ```
5. **完成开发与自测**，提交时遵循下方「代码风格要求」。
6. **推送** 到你的 Fork：
   ```bash
   git push origin feat/add-csv-multi-column
   ```
7. **发起 Pull Request**，目标分支为 `main`，并按 PR 模板填写说明。

### 分支命名建议

- 新功能：`feat/简短描述`
- 修复缺陷：`fix/简短描述`
- 文档改进：`docs/简短描述`
- 预设模板：`preset/预设名称`

## Issue 提交规范

提交 Issue 前请先搜索是否已有相同问题，避免重复创建。

### Issue 类型与标题前缀

| 类型 | 前缀 | 示例 |
|------|------|------|
| 缺陷报告 | `[Bug]` | `[Bug] 区域模式下删除最后一个区域后撤销按钮未禁用` |
| 功能请求 | `[Feature]` | `[Feature] 支持从 Excel 导入多列名单` |
| 预设请求 | `[Preset]` | `[Preset] 新增「结婚请柬」预设模板` |
| 问题咨询 | `[Question]` | `[Question] 自定义字体在 iOS 上不生效` |

### 填写要求

- **缺陷报告**：请使用 Bug 报告模板，务必填写复现步骤、浏览器与系统版本、预期与实际表现。如能附截图或录屏更佳。
- **功能请求**：请使用功能请求模板，说明使用场景、期望效果与备选方案。
- 一个 Issue 只描述一个问题，便于追踪与讨论。

## 代码风格要求

- **不引入框架与构建工具**：保持纯原生 HTML / CSS / JS，第三方库仅限 `lib/` 目录中已有的本地依赖，不新增 CDN 依赖。
- **缩进**：统一使用 2 个空格缩进，不混用 Tab。
- **命名**：变量与函数使用驼峰命名（`camelCase`）；常量使用全大写下划线（`PRESETS`、`UPPER_SNAKE`）；CSS 类名使用连字符（`kebab-case`）。
- **DOM 引用**：所有 DOM 节点通过 `document.getElementById` 获取并集中声明，新增节点需在 `index.html` 与 `app.js` 中保持 `id` 一致。
- **样式**：优先使用 `css/style.css` 中已定义的 CSS 变量，禁止硬编码色值；表面层次只能用投影 token（`--nm-out` / `--nm-sm` / `--nm-in*`），不要用描边或色差分层；**全站零彩色**，强调一律用反相实体 `--inv` / `--inv-ink`，详见 `color-spec.md`。
- **注释**：复杂逻辑需用中文注释说明意图；导出函数、模块入口应附简短说明。不要为显而易见的代码添加冗余注释。
- **兼容性**：面向现代浏览器（Chrome / Safari / Edge / 微信内置浏览器），可使用 ES6+ 语法，但避免使用尚未广泛支持的实验性 API。
- **提交信息**：使用简洁的祈使句，首行不超过 50 字符，例如 `fix: disable undo button when no history`。如需详细说明，空一行后补充正文。

## 改完自检

`.workbuddy/` 下有一组可复跑的校验脚本，改动后请至少跑第一条：

1. `node .workbuddy/check.cjs` —— i18n 键覆盖、HTML 标签平衡、JS 引用的 `id` 是否都存在、
   `els.*` 是否都在 `els` 对象里声明过（这一条能拦住「改了 HTML 忘了改 JS」的运行时炸点）。
2. `node .workbuddy/probe3.cjs` 生成 `probe3.html`（端到端：上传 → 建图层 → 批量出图 → ZIP），
   `node .workbuddy/probe5.cjs` 生成 `probe5.html`（图层增删改、撤销重做、预设、输出格式）。
   两者需要本地 HTTP 服务（`python -m http.server 8765`）+ 带调试端口的 Chrome，
   再用 `node .workbuddy/cdp.cjs <url> "<表达式>"` 取结果。
   **注意**：`--virtual-time-budget` 会跑飞真异步，端到端探针必须用 CDP 真实等待。
3. `node .workbuddy/layout-check.cjs` —— 多视口断言（图层面板双栏、列表不被吸顶条遮挡、无横向溢出）。

调 CSS 时记得 `index.html` 里的 `css/style.css?v=N` 版本号要 +1，否则本地调试会读到缓存的旧样式。

再次感谢你的贡献！如有任何疑问，欢迎在 Issue 中讨论。
