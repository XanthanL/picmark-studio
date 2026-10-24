# 图印工坊 色彩与表面规范

> 2026-10-20 全盘重写。旧版「宣纸墨印 + 朱砂 accent」与「蓝 `#1E88E5`」均已作废。
> 现行风格：**新拟物 Neumorphism · 纯黑白**，与 `css/style.css` 严格一致。

## 1. 设计原则

- **表面优先**：底色与卡面同色，层次只靠双向投影拉开，不靠描边、不靠色差。
- **绝对均匀**：页面与卡片不得有渐变背景、纹理、背景图或 `backdrop-filter`——
  新拟物的投影在明暗不均的地方会露馅。
- **零彩色**：全站只允许中性灰。强调一律用**反相**——实心墨底 + 底色的字
  （`--inv` / `--inv-ink`），只出现在主按钮、当前步骤、选中项、滑块、进度填充、
  危险按钮、品牌印章的墨条。探针脚本（`.workbuddy/check.cjs` 配合 probe）会断言
  页面上所有 `color / background-color / box-shadow` 的 RGB 三通道相等。
- **投影即状态**：抬起 = 可交互 / 选中，压入 = 凹槽 / 正在输入 / 已按下。

## 2. 色彩 token

### 亮色（默认）

| Token | 色值 | 用途 |
|---|---|---|
| `--bg` | `#e9e9e9` | 页面底 + 卡面（二者必须同色） |
| `--ink` | `#111111` | 主文字 / 反相实体的底 |
| `--ink-2` | `#5a5a5a` | 次级文字、按钮默认态 |
| `--ink-3` | `#8f8f8f` | 提示、占位符、标签 |
| `--inv` / `--inv-ink` | `#111111` / `#ffffff` | 反相实体（强调专用） |
| `--ring` | `rgba(17,17,17,.30)` | 聚焦光环（不用彩色描边） |
| `--nm-d` / `--nm-l` | `#c8c8c8` / `#ffffff` | 投影暗面 / 亮面 |

### 暗色（`prefers-color-scheme: dark` 或 `html[data-theme="dark"]`）

| Token | 色值 |
|---|---|
| `--bg` | `#1b1b1b` |
| `--ink` / `--ink-2` / `--ink-3` | `#f2f2f2` / `#b5b5b5` / `#828282` |
| `--inv` / `--inv-ink` | `#f2f2f2` / `#1b1b1b`（反相方向随主题翻转） |
| `--nm-d` / `--nm-l` | `#101010` / `#262626` |

主题记忆：`localStorage('picmark-theme')` → `html[data-theme]`；未设置时跟随系统。

## 3. 投影三件套

| Token | 定义 | 用在哪 |
|---|---|---|
| `--nm-out` | `7px 7px 15px d, -7px -7px 15px l` | 卡片（rail / stage / console / results） |
| `--nm-sm` | `3px 3px 7px d, -3px -3px 7px l` | 按钮、药丸、缩略图、滑块 |
| `--nm-in` | `inset 4px 4px 8px d, inset -4px -4px 8px l` | 输入框、画布槽 |
| `--nm-in-sm` | `inset 2px 2px 5px d, inset -2px -2px 5px l` | 凹槽轨道（步骤条、模式切换、rail 舱格） |
| `--float` | 单向柔和投影 | 顶栏（浮起的元素） |
| `--relief` | `1px 1px 1px l, -1px -1px 1px d` | 文字压印（舱格标题、页脚签名） |

## 4. 交互态映射

| 状态 | 表现 |
|---|---|
| hover | 投影放大，可点元素 `translateY(-1~-2px)` |
| active / 按下 | 转为 `--nm-in*`，位移归零 |
| focus | 凹槽加深 + `0 0 0 2px var(--ring)` 光环（不用描边） |
| 选中 | **反相实体**（黑底白字 / 暗色下白底黑字），保留小投影 |
| disabled | 平贴 + `--nm-in-sm` + `--ink-3` 文字 |
| 危险（删除） | 常态即反相实体，按下转内凹 |

## 5. 布局骨架

```
topbar（sticky，--float）
└ rail（sticky 工具条：底图 / 字体 / 排版 / 特效 / 颜色 五个凹槽舱格）
└ stage（画布舞台：模式切换 + 缩放条 + 画布槽 + 点位 + 区域控件）
└ console（grid 1fr 340px：名单 | 生成）
└ results（生成结果缩略图）
```

- 桌面：rail 吸顶（`top: 62px`），画布槽 `--canvas-max-h: calc(100vh - 430px)`，
  app.js 读 wrapper 的 computed `max-height` 减 padding 算 `previewScale`——
  改这个值时必须两处同源，否则 CSS 二次缩放画布、区域坐标就错。
- ≤1023px：rail 压成**横向滑动的一条**（约 60px 高）仍吸顶，画布 40vh 落在首屏；
  console 变单列。
- ≤560px：表单行纵向堆叠，预览两列。

## 6. 明确不做

- 不用渐变背景、纹理、噪点、背景图
- 不用 `backdrop-filter` / 半透明卡面
- 不用硬描边分界（分隔只用 `--line`）
- **不引入任何彩色**（含 error 色——错误提示用加粗墨色 + 光环）
- 不给内容型卡片加 hover 位移（里面是表单，打字时整卡跳动很难受）

## 7. 坑

- `.rail` 是 sticky + `overflow-y: auto`（限高 `calc(100vh - 76px)`）；
  ≤1023px 改为 `overflow-x: auto` 的横滑条。自绘下拉的列表是 `position: fixed`，
  不受这个 overflow 影响，别改回 `absolute`。
- 空状态的 `.weight-status / .error-msg / .weight-hint` 用 `:empty` 隐藏，
  否则凹槽轨道里会出现孤零零的小凸点。
