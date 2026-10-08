# 引导页面升级计划（启动 / 安装 / 首启）

> 状态：**W1 已完成（骨架 + 外壳 + 环境自适应已接线）** · 目标：把「安装指导」从单页 NSIS 原生页，升级为覆盖 **启动 → 安装 → 首启** 的完整体验。
> 视觉/交互范式参考 `liliMozi/openhanako`（副本 `.worktrees/openhanako`，已 gitignore）。
> **图形一律内联 SVG，优先做成「动图 SVG」**（不用位图/GIF/WebP 截图，见 §5.6）；不引入远程资源。
> **开工前先用预览台打磨视觉**（`npm run preview:guide`，见 §5.7）——不打包、不起 Electron。
> 该预览台已沉淀为可复用资产：`electron-development` skill 的 `assets/preview-bench/`（见 §9）。
> 实现阶段须同步更新 `AGENTS.md` §9 文档索引。

---

## 1. 背景与目标

现状：iSparta 与「安装指导」相关的只有一处 —— `build/installer.nsh` 里手绘的 NSIS 组件页（`ispartaComponentsPre`），文案硬编码简中、坐标为绝对定位。应用内**没有**任何首启引导，顶栏「帮助」只是跳转落地页。

目标：

1. **A · 安装向导组件页**：文案走多语言、布局对齐，借鉴 openhanako 的安装器稳健性。
2. **B · 首启引导**：新增独立向导（分步 + 顶部进度点 + 教程卡片），落到 `src/ui-next/`。
3. **0 · 启动进度页**（净新增）：吉祥物 + 大标题 + 进度条 + 状态小字，**仅有数据迁移任务时**出现。
4. **环境自适应**（贯穿 B，**仅生产环境**）：主题/语言默认值读当前电脑环境，用户显式选择后以其为准。见 §5.9。

---

## 2. 范围

**做：**

- 新增 `RootGate` 网关 + 引导向导组件，桌面与 CEP 两端共用。
- 安装页文案多语言 + 布局重排 + 装机稳健性增强。
- 启动进度页（迁移场景）。
- **动图 SVG 演示图形**（内联组件，替代静态占位图）。
- **引导页预览台**（`scripts/dev/guide-preview/`，dev only，不进产物）。
- **环境自适应**：主题跟随 `prefers-color-scheme`、语言按系统区域探测（仅生产环境）。
- 三语文案补齐、验收脚本。

**不做：**

- 不改发版策略（仍须人工点名发版，见 `AGENTS.md` §2.2）。
- 不为 CEP 另写平行精简面板（`AGENTS.md` §8.1 铁律）。
- 不引入新 UI 框架；复用现有 `ui-next` 设计系统与 token。
- 不引入远程资源（CEP CSP 受限）。
- **原型台 / 浏览器预览不做环境自适应**——预览的语言与主题由控制台手动指定，保证可复现（§5.9）。

---

## 3. 页面清单（9 页）

| # | 页面 | 阶段 | 建议组件文件 | 触发时机 | 分端 |
| --- | --- | --- | --- | --- | --- |
| 0 | 启动进度页 | 启动 | `ui-next/views/BootSplash.vue` | 有迁移任务时（否则跳过） | 仅桌面 |
| A | 安装向导组件页 | 安装 | `build/installer.nsh`（已有，精修） | 双击 exe 安装 / 升级 | 仅 Windows |
| 1 | 首启 · 欢迎 | 首启 | `ui-next/onboarding/steps/WelcomeStep.vue` | 首次启动 | 双端 |
| 2 | 首启 · 导入方式 | 首启 | `ui-next/onboarding/steps/ImportStep.vue` | ↗ | 双端 |
| 3 | 首启 · 输出设置 | 首启 | `ui-next/onboarding/steps/OutputStep.vue` | ↗ | 双端 |
| 4 | 首启 · 文件名自动切分 | 首启 | `ui-next/onboarding/steps/NamingStep.vue` | ↗ | 双端 |
| 5 | 首启 · 输出路径变量化 | 首启 | `ui-next/onboarding/steps/PathVarsStep.vue` | ↗ | 双端 |
| 6 | 首启 · AE 扩展 | 首启 | `ui-next/onboarding/steps/AeStep.vue` | ↗ | 仅装了 AE 扩展时 |
| 7 | 首启 · 完成导览 | 首启 | `ui-next/onboarding/steps/FinishStep.vue` | ↗ | 双端 |

进度点数量随「是否含第 6 页」动态变化（6 点或 7 点）。

**为什么命名拆成两页**：分词取舍与路径变量本来是同一条链路（路径里的 `{name}` 取的就是切分结果），
但一页里塞两块交互面板会让「每页只讲一件事」失守，且窄面板（CEP 520）下必须落成单列、纵向过长。
拆开后两页通过 `onboarding/demos/naming-store.js` 的 `Vue.observable` 单例串联：
在切分页取消掉的词，翻到路径页立刻能从真实路径里看到变化。

**每页图形与落地页的对应关系**（复用源一律只读，不改 `landing/`）：

| 引导页 | 对应落地页区块 | Vue 组件 |
| --- | --- | --- |
| 欢迎 | `hero`（品牌标） | `demos/WelcomeDemo.vue` |
| 导入方式 | 卡片式三方式（自绘） | `demos/ImportArt.vue` |
| 输出设置 | `#play` SIZE GATE（阈值 + 质量滑块 + 自动重压） | `demos/OutputGate.vue` |
| 文件名切分 | `#naming` 左栏（分词 + 漏斗） | `demos/NameSplitPanel.vue` |
| 输出路径 | `#naming` 右栏（预设 + 变量积木 + 真实路径） | `demos/NamePathPanel.vue` |
| AE 扩展 | `ae` 区块（面板滑入 + 重启环） | `demos/AeArt.vue` |
| 完成导览 | 自绘 | `demos/FinishDemo.vue` |

---

## 4. 逐页规格

### 4.0 启动进度页 `BootSplash.vue`

- **目的**：版本升级后整理/迁移历史任务时，给出明确进度与「完成后自动进主界面」的预期。
- **元素**：品牌标（**动图 SVG** 180×180：外框描边绘制 + 内核弹出 + 轨道点绕行）→ 大标题（`--is-fs-2xl`）→ 说明（`--is-text-2`）→ 进度条（`--is-track` 底 + `--is-accent` 填充）→ 状态小字（`--is-fs-sm` / `--is-text-3`）。
- **交互**：无按钮；状态文字淡入切换。
- **触发**：启动先跑一次「迁移检查」，**无任务直接跳过**，不拖慢日常启动。
- **验收**：① 无任务不出现、无白屏；② 有任务时进度与状态同步；③ 完成后自动进主界面。

### 4.A 安装向导组件页 `build/installer.nsh`

保留现有结构（组件勾选 + 安装范围单选 + AE 检测 + 重启提示），三项精修：

1. **多语言**：自定义文案改 NSIS `LangString`（简中 / 繁中 / 英文），随 `$LANGUAGE` 切换。
2. **布局**：分组框控件对齐（统一缩进与行高）、AE 检测结果单独一行并留状态图标位、重启提示降为次级小字。
3. **稳健性**（借鉴 openhanako `build/installer.nsh`）：`CRCCheck off` 绕过未签名 CRC 失败；安装前结束占用安装目录的进程；完成页 `MUI_FINISHPAGE_RUN` + `StartApp`；可选安装面自检 + 诊断日志。

### 4.1 首启 · 欢迎 `WelcomeStep.vue`

- **元素**：品牌标（**动图 SVG**，同源 `public/icons/icon-brand.svg`）+ 标题 + 副标题 + 一行提示（指向右上角设置）。
- **文案键**：`obWelcomeTitle` / `obWelcomeSub` / `obWelcomeHint`。
- **W1 调整**：本页**不再放独立语言选择器** —— 主题/语言已固定在面板右上角（§4.6），两处并存会出现两个需要同步的状态，反而容易不一致；改为一行提示引导过去。
- **验收**：在右上角切换语言后，本页与后续各页立即变化。

### 4.2 首启 · 导入方式 `ImportStep.vue`

- **元素**：标题 + 三张方式卡（图标 + 标题 + 说明），配 1 枚**动图 SVG**（`ImportDemo.vue`）。
- **动图演示**：三格并排 —— 文件卡落入虚线框（drop）/ `V` 键徽章脉冲（pulse）/ 合成图层上下浮动（lift）。
- **内容分端**（`hostAdapter.kind`）：桌面 = 文件夹/PNG 序列 · 拖拽导入 · `Ctrl+V` 贴图；CEP = 合成树勾选 · 在 AE 复制合成后粘贴 · 说明 AE 不支持把合成拖进面板。
- **文案键**：`obImportTitle` / `obImportSub` / `obImportRuleFile` / `obImportRuleDrag` / `obImportRulePaste` / `obImportRuleComp`。
- **验收**：两端各显示对应三种方式，不出现对方文案。

### 4.3 首启 · 输出设置 `OutputStep.vue`

- **元素**：标题 + 三张卡片（格式 APNG/WebP/GIF、质量与大小阈值、命名与路径变量），配**动图 SVG**（`OutputDemo.vue`）。
- **动图演示**：三枚格式 chip 错相位轮播高亮（3s）+ 体积进度条涨落 + 阈值标记线（`--is-warn`）。
- **交互**：只读讲解，不做真实设置（避免与设置面板职责重叠）。
- **文案键**：`obOutputTitle` / `obOutputSub` / `obOutputFormat` / `obOutputLimit` / `obOutputName`。
- **验收**：文案与设置面板 `*Tip` 不冲突、不重复维护。

### 4.4 首启 · AE 扩展 `AeStep.vue`（条件页）

- **出现条件**：本机检测到已装 AE 扩展（桌面查 CEP 目录/manifest；CEP 恒显示）。
- **元素**：标题 + 步骤列表（重启 AE 生效 → 「窗口 → 扩展」打开面板 → 未签名扩展的 PlayerDebugMode 说明）+ **动图 SVG**（`AeDemo.vue`）。
- **动图演示**：AE 窗口内右侧面板滑入到位（slide）+ 重启箭头旋转（spin）。
- **交互**：只读；附「前往官网」外链（走 `hostAdapter.openExternal`）。
- **文案键**：`obAeTitle` / `obAeSub` / `obAeStepRestart` / `obAeStepMenu` / `obAeStepDebug`。
- **验收**：未装扩展的机器上本页不出现，进度点总数减 1。

### 4.5 首启 · 完成导览 `FinishStep.vue`

- **元素**：标题 + **动图 SVG**（`FinishDemo.vue`：圆环描边绘制 + 对勾绘制 + 三点弹出）+ 功能卡片（批量转换 / 超限自动压小 / 前后对比滑块 / 主题与语言）+ 主按钮「开始使用」+ 次按钮「前往官网」。
- **交互**：点「开始使用」写完成标记并关闭引导。
- **文案键**：`obFinishTitle` / `obFinishBatch` / `obFinishLimit` / `obFinishCompare` / `obFinishTheme` / `obDone`。
- **验收**：关闭后不再自动出现；主界面正常可用。

### 4.6 面板外框与右上角设置 `Onboarding.vue`（外壳）

引导是**一扇独立小窗**，外框固定三部分：

- **顶栏**：左侧窗口点（装饰）+ 面板名；**右上角为设置入口**。
- **进度点**：顶部居中，当前步 `--is-accent` 拉长（6px → 20px 胶囊），其余 `--is-track`。
- **页脚**：左「跳过」（ghost），右「n / N」+「上一步」+ 主按钮（末步变「开始使用」）。

**右上角设置（主题 · 语言）—— 属于「指导面板」自身的能力，不是宿主应用/开发台的功能：**

- 形态：紧凑胶囊 `⚙ 当前主题 · 当前语言`（例 `⚙ 暗色 · 简中`），点击向下弹出小面板。
  > **胶囊显示「解析后的实际值」，不是模式**。主题取 `ThemeManager.get()`（`dark`/`light`），语言取当前 `$i18n.locale`。模式（跟随系统…）只在弹层里表达 —— 否则默认状态下会出现「跟随系统 · 跟随系统」这种读不懂的胶囊。实测截图：`⚙ 暗色 · 简体`。
- 弹层宽度 **296px**：要容得下「跟随系统 / 亮色 / 暗色」与「简体 / 繁體 / EN / 跟随系统」各占一行，否则 `IsSegmented`（`flex-wrap:wrap`）会折行成两排。窄于 `calc(100vw - 2 * var(--is-s-4))` 时自动收窄。
- 弹层两段：**主题**（跟随系统 / 亮色 / 暗色）+ **语言**（跟随系统 / 简中 / 繁中 / EN）。
  > **W1 调整**：主题做成**三档**（不是早期写的两档）。默认模式就是 `'system'`，两档会让「跟随系统」时显不出当前选择，也与设置面板的三档不一致。
- 交互：点弹层内部不关闭；点外部或 `Esc` 关闭；切换**即时全局生效**（语言写回 `globalSetting.language`）。
- **位置**：贴面板右上角（桌面 = 标题栏右侧；CEP 无系统标题栏时贴内容区右上角）。
- **初值来自环境**：读 `ThemeManager.get()` / 当前 `i18n.locale`，两者默认模式均为 `'system'`，即首次进入就已是「系统深/浅色 + 系统语言」（§5.9）。用户在此处的选择会被持久化，之后不再跟随系统。
- **验收**：两端都能开合；CEP 窄宽 520 下弹层**不溢出**；切换即时生效且关闭引导后保持。

> ⚠️ 面板窗口**不能**用 `overflow:hidden` 裁圆角——右上角弹层需要溢出标题栏；圆角由顶栏/页脚各自承担，内容区（`.screen`）仍 `overflow:hidden` 裁剪步骤。

---

## 5. 技术落点

### 5.1 入口接线（`RootGate` 网关）

CEP 侧**没有 vue-router**（`src/cep/main.js` 直接 `render: h => h(Home)`），故引导**不挂路由**，用一个网关统一两端：

```
新建 src/ui-next/views/RootGate.vue
   ├─ booting ?      → <boot-splash>
   ├─ onboarding ?   → <onboarding @finish="close">
   └─ else           → <home>
```

| 端 | 改动 |
| --- | --- |
| 桌面 | `src/router.js` 的 `/` 路由 component：`Home` → `RootGate` |
| CEP | `src/cep/main.js` 的 `render`：`Home` → `RootGate` |

`Home.vue` **不改模板结构**（避免污染 39KB 大文件）；仅把顶栏「?」从 `openLanding()` 改为调起引导（面板内仍保留官网链接）。

**引导入口有两个**（实测踩到）：空态头部的「?」（`.ib-iconbtn`）与**非空态工具条**（`.ib-rail__btn--help`）。原先只有空态那一个 —— 一旦列表里已有任务，「?」就消失了，C2「随时重新调起」根本做不到。W1 在 rail 上补了一枚 `question` 图标按钮。

**W1 落地细节**：`Home` 在工作台里**常驻挂载**，引导是覆盖其上的定层浮层（`position:fixed; inset:0`，`z-index: calc(var(--is-z-dialog) + 100)`，低于 `--is-z-notice` 让通知仍可见）。这样关闭引导后任务列表 / 拖拽态 / 滚动位置都不丢，也避免每次开合都重建整个工作台。

### 5.2 首次标记与重新调起

- 新建 `src/ui-next/onboarding/state.js`：`Vue.observable` 状态模块，暴露 `isDone()` / `open()` / `close()` / `finish()`。
- 持久化走 `storage`（`src/util/node-env.js`），键 `onboardingState`，值 `{ version: 1, done: true }`；**按 version 比对**，改版可重新引导。
- 桌面与 CEP **各自独立**判定。
- **CEP 读不到时按「已完成」降级**：`readRecord()` 明确区分「桥不可用（`ok:false`）」与「还没有记录（`ok:true, record:null`）」。前者一律当已完成 —— 否则若 CEP 端 storage 不可写，会变成每次启动都弹引导，属于最差降级。首次安装的键缺失走的是后者，正常弹一次。
- 跳过（Skip）与走完最后一步一样写完成标记，避免下次启动又出现。

### 5.3 分端内容

统一读 `src/util/host-env.js` 的 `hostAdapter`：`kind === 'cep'` → 导入页显示合成树/粘贴合成，省略文件/拖拽/剪贴板；`supportsFileImport` / `supportsCompImport` 直接驱动卡片显隐；第 4 页出现条件见 §4.4。

### 5.4 i18n 键位

- 键**扁平命名**，统一前缀 `ob*`（见各页「文案键」）。
- 三语齐全：`src/locales/zh-cn.js` / `zh-tw.js` / `en-us.js`。
- 引导语言选中项写回 `globalSetting.language`，复用 `src/i18n.js` 的 `syncLocaleFromStorage`。
- **默认语言不写死**：`globalSetting.language` 缺省 `'system'`，由 `src/util/system-locale.js` 解析（§5.9.2）。语言选择器应显示**已解析值**（`zh-cn`/`zh-tw`/`en-us`），而非原始 `'system'`。

### 5.5 设计 token 与组件复用

- 一律用现有变量，不写死色值：`--is-s-*` / `--is-r-*` / `--is-fs-*` / `--is-dur-*` / `--is-ease-*`；强调色 `--is-accent`（#c8f542）。
- 复用 `src/ui-next/components/ui/`（`IsButton` / `IsIcon` / `IsSwitch` / `IsSegmented`，已在两个入口全局注册）。
- 图标复用 `src/ui-next/icons/*.svg`，**禁用 emoji**。
- 主题跟随 `ThemeManager`（暗色为底 `--is-bg: #0c0f0e`，与截图风格一致，无需额外适配）。
- **⚠️ 主题 class 必须挂根节点**：`--is-*` 定义在 `.theme-dark` / `.theme-light` 下，而**自定义属性只向下继承**——若只挂在 `body` 的子元素（如 `#app`），`body{color:var(--is-text)}` 求值时变量未定义，`color` 回退成黑色，暗色下即「黑字黑底」。落地 Vue 时挂 `documentElement` 或 `RootGate` 最外层容器（预览台初版踩过，见 §5.10）。

### 5.6 动图 SVG 规范（替代静态占位图）

**可行，且是优选路径**：`tokens.css` 已有共享关键帧（`is-spin` / `is-pop` / `is-fade-up` / `is-drop-bounce`…）与 `prefers-reduced-motion` 兜底；运行时为 Electron 28 / Chromium 120、CEP 走 CEF，CSS 动画 / `stroke-dashoffset` / `transform-box` 全可用；图标体系本就是 SVG，`animejs@^3.2.2` 已在依赖内。

**硬约束：**

1. 图形一律**内联 SVG 组件**（`<svg>` 写在 `.vue` 内），**不用** `<img src>` / PNG / GIF / WebP —— 可继承 CSS 变量、可控动画、无额外请求。
2. 动效**只用 `transform` / `opacity`**（+ 描边绘制）；时长/缓动引用 `--is-dur-*` / `--is-ease-*`。
3. **必须尊重 `prefers-reduced-motion`**：可动元素统一挂 `.anim`，reduce 下一律落到终态（`opacity:1; transform:none; stroke-dashoffset:0`），避免停在 0% 不可见。
4. 颜色一律走 token（`--is-accent` / `--is-cool` / `--is-violet` / `--is-ok` / `--is-warn`），**不写死色值**。
5. 循环周期 **2.4–3.4s**，相位错开（负 `animation-delay`），避免整页同频闪烁。

**目录与命名**：`src/ui-next/onboarding/demos/`，按页一枚组件（§3 对照表）。
**改版说明（已生效）**：早期设想是「把落地页已 token 化的 `ill-*` 与 `#pet` 整批搬过来复用」——
实际落位时否决了该方案（`ill-*` 是功能卡上的通用小插画，讲不清任何一页的事），
改为**逐页专属组件**：只有 `#play` / `#naming` 这类**成块的交互面板**值得 1:1 还原，
其余按页自绘。品牌标与完成动效仍为自研：`WelcomeDemo.vue` / `FinishDemo.vue`。

**⚠️ 安装向导页（A）不适用**：NSIS `nsDialogs` 原生控件**只能渲染静态 BMP**，无法承载动图。A 页只做文案 i18n + 布局 + 稳健性；**「精美动效」只能落在 B 首启引导**。这是两条路线的能力边界。

### 5.7 Dev 预览链（不打包、不起 Electron）

项目已具备完整 dev 预览链，无需为引导页新建构建体系：

| 目标 | 命令 | 地址 | 说明 |
| --- | --- | --- | --- |
| 桌面 Web 预览 | `npm run serve` | :8081 | `src/util/mock-bridge.js` 注入 mock 桥（`kind === 'browser-mock'`） |
| CEP 预览（HMR） | `npm run dev:cep` | :8082 | `BUILD_TARGET=cep`，开热更 |
| 三端一起 | `npm run dev:all` | 8080/8081/8082 | landing + 桌面 Web + CEP；加 `--electron` 起真 Electron |
| **引导页原型台** | `npm run preview:guide` | **:8090** | 本次新增，见下。**不要用 8083** —— vue-cli dev server 在 8081 被占时会自动顺延并霸占 8083，打开它看到的是应用本体（RootGate → 引导页），极易误判成预览台坏了 |

**引导页原型台**（`scripts/dev/guide-preview/` + `scripts/dev/serve-guide-preview.js`）：

- 单文件、零依赖、**不进打包产物**的纯静态页，用于在写 Vue 前把视觉与动图打磨到位。
- dev 控制台（**仅 dev**）：步骤切换、运行时切换（桌面 760×500 / CEP 520×560）、动效开关（对照 `prefers-reduced-motion` 终态）；「落地页复用」视图下另有 dev 主题切换。
- **主题 / 语言切换已从 dev 控制台移入「面板右上角」**（§4.6）——它是**指导面板自身**的能力，不是预览台功能；dev 控制台只留步骤 / 运行时 / 动效等纯调试项。
- 演示图形均为内联 SVG，**可直接搬进 `demos/*.vue`**（把关键帧挪进组件 scoped 样式即可）。
- 定位：**原型台管「好不好看」，`serve` / `dev:cep` 管「接得对不对」**，不必反复构建。
- **已验证不进产物**：`dist_electron/win-unpacked/resources/app/` 只收录构建输出（`index.html` / `js` / `css` / `bin` / `icons` / `lib`），**无 `scripts/` / `docs/` / `landing/` / `src/`**。

### 5.8 落地页动效组件复用（优先复用而非重画）

落地页的视觉组件本来就是**内联 SVG**；8 枚微插画与吉祥物**已是 token 化的纯 CSS 动效**，暗色下近乎开箱即用。

**依据**：`landing/styles.css` 顶部注释即写明「暗色：对齐应用 tokens.css」，其 `html[data-theme="dark"]` 把 `--paper/--card/--accent/--ink/--muted` 映射到 `#0c0f0e / #1a201c / #c8f542 / #eef3ec / #9aa89c`；`.ill-*` 的填充描边全走变量，标记内不写死色值。预览台实测：映射为 `--is-*` 后暗色自动变荧光绿、亮色自动变砖橙，控制台 0 真实报错。

| 落地页组件 | 现驱动 | 引导页落点 | 复用成本 |
| --- | --- | --- | --- |
| `ill-convert` | 纯 CSS `illFlip/illDash/illPulse` | OutputStep（格式互转） | **零改造**（仅换变量名） |
| `ill-gate` | 纯 CSS `illBreathe/illNeedle` | OutputStep（体积阈值） | **零改造** |
| `ill-batch` | 纯 CSS `illDash/illPulse` | ImportStep（批量 / 路径变量） | **零改造** |
| `ill-dl` | 纯 CSS `illDraw/illFloat` | FinishStep（下载 / 官网） | **零改造** |
| `ill-ae-install` | 纯 CSS `illDraw` | **A 安装向导页插图** | **零改造** |
| `ill-ae-render` | 纯 CSS `illDash` | AeStep（出序列） | **零改造** |
| `ill-ae-ui` | 静态构图 | AeStep（双端界面） | **零改造** |
| `ill-ae-core` | 纯 CSS `illPulse` | AeStep（同引擎） | **零改造** |
| `#pet` 吉祥物 | 纯 CSS `petIdle/petRun/petCheer` | **BootSplash 吉祥物位** | 极低（8 处 hex 换变量） |
| `hero-svg` / `ae-svg` | **GSAP + ScrollTrigger + 拖拽** | Welcome / Finish 大图（可选） | 中：硬编码 hex（`#c2410c` ×39）需批量转变量，动画改本地循环 |
| `gate-stage` / `name-panel` / `log-panel` | 真实表单 + JS | 能力已由应用本体覆盖 | 不适用 |
| `shots-*.png` 位图 | — | ❌ 与「不用图片」冲突 | 弃用 |

**三条落地约束**：① **变量名映射** —— `--paper/--card/--accent/--line/--ink/--muted` → `--is-bg/--is-card/--is-accent/--is-border/--is-text/--is-text-2`，不引入第二套 token；② **动画换驱动** —— `ill-*` / `pet` 是纯 CSS 可直接搬，`hero-svg` / `ae-svg` 的 GSAP + 滚动 + 拖拽需改为「进页即循环」的 CSS 关键帧（向导是模态、无滚动上下文）；③ **位图不搬**。

预览台已内置「落地页复用」对照视图，10 张卡实时对照，可直接验收。

### 5.9 环境自适应（系统主题 + 系统语言，**仅生产环境**）

**目标**：首次启动时界面默认跟随电脑环境（深浅色取系统外观、语言取系统语言区域）；用户显式选择后永久以其为准。
**范围**：桌面与 CEP 两端生效；**原型台与浏览器预览不参与**（手动指定，保证可复现）。

#### 5.9.1 主题：已有基建，**零新增代码**

`src/ui-next/theme.js` 的 `ThemeManager` 已完整实现该语义，直接复用，**不要另建主题状态**：存储键 `uiTheme` 缺失 → `mode = 'system'`；`systemTheme()` 读 `prefers-color-scheme`；`watchSystem()` 实时同步（仅 `mode === 'system'` 时重绘）；`init()` 在挂载前调用（无首帧闪烁）；`paint()` 同时写 `<html>` 与 `<body>`。

引导面板只做三件事：`ThemeManager.get()` 读当前值（别自己读 storage）；`ThemeManager.onChange()` 订阅变化（`destroyed` 时注销）；右上角切换调 `set('dark'|'light')`，补「跟随系统」项则调 `followSystem()`。与 `Home.vue` 共用同一实例，天然不会「引导里切了、主界面没变」。

#### 5.9.2 语言：`system-locale` 已落地，需接三处

**新增模块（已完成）**：`src/util/system-locale.js` —— 纯函数、零副作用、暂未被引用。

| 导出 | 作用 |
| --- | --- |
| `SUPPORTED` / `MODE_SYSTEM` / `FALLBACK` | `['zh-cn','zh-tw','en-us']` / 哨兵 `'system'` / `'zh-cn'` |
| `normalizeTag(tag)` | 单个 BCP-47 标签 → 受支持 locale；非法返回 `null` |
| `readEnvTags()` | 按优先级收集原始标签（宿主桥 → `navigator.languages` → `navigator.language` → `Intl`） |
| `detectSystemLocale()` / `explainSystemLocale()` | 探测结果（后者含 `tag`/`source`/`candidates`，供诊断与预览台展示） |
| `resolveLocale(mode)` | 模式解析成实际 locale（**`'system'` 不会被传进 vue-i18n**） |

**映射规则**（36 条用例实测通过）：`zh` / `zh-CN` / `zh-Hans` / `zh-SG` / `zh-MY` → `zh-cn`；`zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant*` → `zh-tw`（中国香港、中国澳门按繁体收敛）；`en*` / `ja-JP` / 其余任意合法标签 → `en-us`（应用只提供三语）；空串 / 非标签形状 / 非字符串 → `null`（交下一候选），全失败 → `FALLBACK`。

**接线三处**：

1. **`src/i18n.js` `detectLocale()`** —— 无记录或记录为 `'system'` 时调 `detectSystemLocale()`；全新安装（原写死 `FALLBACK`）改为跟随系统。时机无需改动：`ThemeManager.init()` → `syncLocaleFromStorage()` → `$mount()` 都在挂载前，不会「先中文后英文」跳变。
2. **`src/store/index.js`** —— `defaultState.language` 由 `'zh-cn'` 改为 `MODE_SYSTEM`，否则「默认值」与「用户显式选简中」无法区分。
3. **`src/components/globalSetting/globalSetting.vue`** —— 语言分段加第 4 项「跟随系统」；比较处一律经 `resolveLocale()`，**不要把 `'system'` 写进 `i18n.locale`**。

> ✅ **已拍板（W1 前）：全部用户启用。** 老用户 storage 里那个由旧出厂默认写入的 `'zh-cn'`，与「用户显式选了简中」无法区分，按「承认一次性语言变化」处理：`src/store/index.js` 加了一次性迁移 —— `language === 'zh-cn'` 且未打标记时改写为 `'system'` 并置 `langModeMigrated: true`；迁移后用户再显式选简中，不会被二次改写。全新安装直接以 `'system'` 落库。

#### 5.9.3 分端与边界

| 环境 | 主题来源 | 语言来源 |
| --- | --- | --- |
| 桌面 Electron | `prefers-color-scheme` | `navigator.languages` |
| CEP（CEF） | 同上 | `navigator.language`（继承宿主；AE 中文 → 简中，多为期望行为）。CEP 无 `ispartaAPI`，`readEnvTags()` 自然跳过宿主桥，**无需按端分支** |
| 原型台 / `serve` | **不参与**，控制台手动 | **不参与**，控制台手动 |
| 宿主桥 `ispartaAPI.os.locale` | — | 未暴露；若 CEP 探测不可靠，可加 `ipcMain.on('os:locale')` → `app.getLocale()` + `preload` 暴露，`readEnvTags()` 已预留最高优先级入口，**无需改调用方** |

#### 5.9.4 验收

- 系统切浅色 → 首启引导与主界面同步变浅（无需重启、无需手选）。
- 系统语言为英文 / 繁体 → 首启文案分别为英文 / 繁体。
- 在引导右上角显式选主题或语言 → 关闭后主界面一致；重启后不再跟随系统。

### 5.10 经验沉淀（踩坑与复用要点）

| 坑 / 要点 | 现象 | 处理 |
| --- | --- | --- |
| 令牌挂错层级 | 暗色下大面积**黑字黑底** | 主题 class 挂 `documentElement`（自定义属性只向下继承）；见 §5.5 |
| 离屏截图环境变量 | Electron 被当成 Node 跑，`require('electron')` 非对象 | 运行前 `env -u ELECTRON_RUN_AS_NODE` |
| 离屏截图 GPU 崩溃 | 无头下 GPU 进程失败 | 加 `--no-sandbox --in-process-gpu --use-gl=swiftshader --disable-gpu-sandbox` |
| `capturePage` / 计算样式陈旧 | 截图与 `getComputedStyle` 都可能读到**上一帧**：例如 `html` 已是 `is-theme-light`、`--is-accent` 已变 `#c2410c`，但 `body` 背景仍是暗色、选中圆点仍是荧光绿 | 离屏 + swiftshader 下的合成/样式缓存问题，**不是真 bug**。判定要「截图 + 同一状态内能自洽的多路读数」交叉看，单一路读数不可全信（W1 实测踩到） |
| 硬编码 hex | 暗色下某图形仍是亮色卡片 | 标记内所有色值换 token；落地页 `hero-svg`/`ae-svg` 即此类 |
| SVG 变换原点 | 轨道点飞出画布 | 带 `translate` 的 `<g>` 内不放绕行元素；旋转/缩放元素加 `transform-box:fill-box` |
| 预览台进产物 | — | 已实测产物只含构建输出，`scripts/` 天然不进包 |
| `'system'` 泄漏进 vue-i18n | 空界面（无翻译） | 一律经 `resolveLocale()` 再赋值 |
| 动效可访问性 | reduce 下元素停在 0% 不可见 | 可动元素统一挂 `.anim`，reduce / 关动效时落到终态 |

---

## 6. 任务分期

### W0 · 原型台（先做，零风险）

- [x] 建 `scripts/dev/guide-preview/` 原型台 + `npm run preview:guide`
- [x] 内置「落地页复用」对照视图（10 张卡；暗/亮双主题、动效开关实测通过）
- [x] 面板右上角设置（主题 · 语言）原型 + 三语文案；修复暗色「黑字黑底」
- [x] 只读「系统环境 · 生产参考」探测块（§5.9 映射可视化）
- [x] 同能力沉淀为通用资产 → `electron-development/assets/preview-bench/`（§9）
- [ ] 在原型台上定稿品牌动效两枚（Welcome / Finish）的造型、节奏、配色
- [ ] 验收：明/暗主题、桌面/CEP 尺寸、动效开关三种状态都正常

### W1 · 骨架与外框 ✅

- [x] `RootGate.vue` + 接线（`router.js` / `cep/main.js`）
- [x] `onboarding/state.js`（`Vue.observable` 单例 + storage 标记，键 `onboardingState`）
- [x] `Onboarding.vue` 外壳：顶栏 + 进度点 + 步骤切换（带方向过渡）+ **右上角设置（§4.6）**
- [x] **环境自适应接线（§5.9）**：`i18n.js` 接 `resolveLocale()`；`store` 默认 `language: 'system'` + 一次性迁移；`globalSetting` 加「跟随系统」项；引导读写 `ThemeManager`（不自建状态）
- [x] 拍板「行为变更范围」（§8）→ **① 全部用户启用**
- [x] i18n 键位（三语各 47 条 `ob*` + `languageSystem`；键位对齐与占位符一致性已脚本校验）
- [x] 五个步骤页骨架 `steps/*.vue`（真实文案、分端内容已按 `hostAdapter` 分流）
- [x] 品牌动图两枚 `demos/WelcomeDemo.vue` / `demos/FinishDemo.vue`（内联 SVG + token 色）
- [x] 「?」帮助按钮改为调起引导（`Home.vue`，原「跳落地页」保留在引导内）
- [x] 桌面端实测通过（离屏脚本 7 步：自动弹出 → 弹层 → 切 EN → 切亮色 → 4 步走完 → 写 `onboardingState` → 「?」重开）
- [ ] ⏳ CEP 端实测（需起 AE；两端口构建均已通过）

> 原「把落地页 8 枚 `ill-*` 搬成 `demos/*.vue`」的方案**已作废**：
> `ill-*` 是落地页功能卡上的**通用小插画**，一页塞八枚并不能解释任何一件事。
> 改为**逐页专属组件**（§3 对照表），输出页直接还原落地页 `#play` 的可交互 SIZE GATE、
> 命名拆成两页还原 `#naming` 左右栏。`landing/` 全程只读，一个字节不改。

### W2 · 首启步骤页（7 步）

- [x] `WelcomeStep.vue`：项目 logo（同 `icon-brand.svg` 几何）+ `iSparta-next` 字标 +
      定位语（PNG 序列 / APNG / WebP / GIF 互转与压缩）+ 三枚能力小面板（多语言 / 双主题 / 多端兼容）
- [x] `ImportStep.vue`：三种方式**不再按端分流**（拖入 / 粘贴 / AE 合成，两端都支持）；
      图形留在卡内，标题与说明脱离卡片落在卡外
- [x] `OutputStep.vue` + `demos/OutputGate.vue`：还原落地页 SIZE GATE
      （质量滑块**左→右**、阈值 MB/KB、通过/超限徽标、体积计量条 + 阈值刻度线、格式 chip、自动重压日志）
- [x] `NamingStep.vue` + `demos/NameSplitPanel.vue`：文件名自动切分（分词取舍 + 漏斗只留文字）
- [x] `PathVarsStep.vue` + `demos/NamePathPanel.vue`：输出路径变量化（预设 + 变量积木 + 真实路径预览）
      ，与切分页经 `naming-store.js` 串联
- [x] `AeStep.vue` + `demos/AeArt.vue`：标题改「同步支持安装 AE 端扩展！」，
      正文一句话讲完「重启 AE → 窗口菜单打开面板」，只保留未签名兜底
- [x] `FinishStep.vue`（沿用 W1 的 `FinishDemo.vue`）
- [ ] 验收：桌面、CEP 各走一遍内容正确；CEP 窄屏动图不溢出

### W3 · 启动进度页

- [ ] `BootSplash.vue` + 迁移检查入口（无任务即跳过）
- [ ] 验收：无任务不出现；有任务进度与状态同步；自动进主界面

### W4 · 安装向导组件页（A）

- [ ] 自定义文案改 NSIS `LangString`（简中/繁中/英文）
- [ ] 布局对齐重排
- [ ] 稳健性：`CRCCheck off` / 占用进程检测 / 完成页自启确认
- [ ] `npm run build:windows` 出包实测 安装 → 卸载 → 升级 三条路径
- [ ] 验收：三语正确；覆盖安装不报 CRC；卸载清理干净

### W5 · 收尾

- [x] 「?」帮助按钮改为调起引导（W1 已完成）
- [ ] 更新 `docs/CHANGELOG.md`（若有用户可见变化）
- [ ] `AGENTS.md` §9 索引登记 + 勾选本节状态
- [ ] `npm run lint` 通过

---

## 7. 验收清单

| # | 项 | 判据 |
| --- | --- | --- |
| C1 | 首次启动 | 桌面首启弹引导；完成后不再自动弹 |
| C2 | 重新调起 | 「?」按钮可随时重新打开引导（**空态头部与非空态工具条各有一个入口**，实测通过） |
| C3 | 分端内容 | 桌面无合成树文案；CEP 无文件/拖拽/剪贴板文案 |
| C4 | 条件页 | 装了 AE 扩展才出第 4 页，进度点数同步 |
| C5 | 三语 | 简中/繁中/英文全齐，切换即时生效 |
| C6 | 主题 | 暗色下层次正确，无硬编码色值 |
| C7 | CEP 窄屏 | 窄宽度下不溢出、不横向滚动；动图随容器缩放 |
| C8 | 启动进度页 | 无迁移任务不出现；有任务正常推进 |
| C9 | 安装页 | 三语正确、覆盖安装无 CRC 报错、卸载干净 |
| C10 | 纪律 | `npm run lint` 通过；未触发发版流程 |
| C11 | 动图 SVG | 全部内联 SVG、无位图/无远程资源；只用 transform/opacity；reduce 下落终态 |
| C12 | 预览台 | `npm run preview:guide` 可起；原型台文件不进打包产物 |
| C13 | 复用一致性 | 移植的 `ill-*` / `#pet` 在暗色为荧光绿、亮色为砖橙；不残留 `--paper/--card/--accent` 旧名 |
| C14 | 面板内设置 | 面板右上角可开合主题 + 语言；切换即时全局生效；CEP 窄宽 520 下弹层不溢出；关闭引导后保持 |
| C15 | 暗色可读性 | 暗色下**无深色文字**（`h1`/`h2`/未选中分段/卡片标题/按钮）；显式计算色为亮色而非默认黑 |
| C16 | 自适应 · 主题 | 系统切色**重启前**同步跟随；`uiTheme` 无记录时 `getMode() === 'system'` |
| C17 | 自适应 · 语言 | 系统为 `en-*` / `zh-TW` / `zh-HK` 时首启分别为英文 / 繁体；`resolveLocale('system')` 落在 `SUPPORTED` 内；显式选择后重启不再跟随 |
| C18 | 自适应边界 | 原型台与 `npm run serve` **不**跟随系统，保证可复现 |

---

## 8. 风险与边界

| 风险 | 说明 | 对策 |
| --- | --- | --- |
| CEP 无 router | 不能照抄桌面路由方案 | 用 `RootGate` 网关统一两端 |
| CEP 面板极窄 | onboarding 可能溢出 | 复用 `_bp.scss` 断点，窄屏单列 |
| NSIS 多语言成本 | `LangString` 需逐条定义 | 单列 W4，先简中 + 英文，繁中跟进 |
| NSIS 不能放动图 | `nsDialogs` 只支持静态 BMP | 动效全落 B；A 页只做 i18n + 布局 + 稳健性 |
| CEP storage 落盘 | 首次标记可能不持久 | 开工前先验证 `storage` 在 CEP 的写入 |
| 主题 class 挂载位置 | 挂错层级 → 暗色「黑字黑底」 | 挂 `documentElement` 或最外层容器；已列 C15 |
| 语言探测的行为变更 | 老用户 storage 隐式 `'zh-cn'` 无法与「显式选简中」区分 | **已拍板 ①「全部用户启用」**（承认一次性语言变化）：一次性迁移改写为 `'system'`，见 §5.9.2 |
| CEP 语言探测精度 | 只能取 CEF 的 `navigator.language`，可能随宿主 AE 语言 | 已按「AE 中文 → 简中」视为期望；不符再用 `app.getLocale()` IPC 补（入口已预留） |
| `'system'` 泄漏进 vue-i18n | 直接赋值会得到无翻译空界面 | 一律经 `resolveLocale()`；已列 C17 |
| 动图体积/性能 | 内联 SVG 过复杂会拖慢渲染 | 只用 transform/opacity、控循环周期、CEP 可降级静态帧 |
| `Home.vue` 膨胀 | 已有 39KB | 不改模板结构，仅改帮助按钮回调 |

---

## 9. 参考

| 对象 | 位置 |
| --- | --- |
| openhanako 引导（视觉范式） | `.worktrees/openhanako/desktop/src/react/onboarding/`（+ `steps/`）、`desktop/src/onboarding.html` |
| openhanako 安装器稳健性 | `.worktrees/openhanako/build/installer.nsh`、`tests/windows-installer-contract.test.ts` |
| iSparta 待改安装器 | `build/installer.nsh`（`ispartaComponentsPre`）、`electron-builder.yml` 的 `nsis:` |
| iSparta 设计系统 | `src/ui-next/styles/tokens.css`、`ui.scss`、`components/ui/` |
| **引导页原型台（本次新增）** | `scripts/dev/guide-preview/index.html` + `scripts/dev/serve-guide-preview.js`（`npm run preview:guide`） |
| **预览台通用资产（已沉淀）** | `electron-development` skill：`assets/preview-bench/`（`index.html` / `serve.mjs` / `USAGE.md`）、`references/ui-preview-bench.md` |
| **落地页动效组件（复用源）** | `landing/index.html` 的 8 处 `class="ill-svg ill-*"` + `#pet`；样式见 `landing/styles.css` 的 `.ill-*` 与 `@keyframes illFlip/illDash/illPulse/illBreathe/illNeedle/illDraw/illFloat/petIdle/petRun/petCheer` |
| **系统语言探测（本次新增）** | `src/util/system-locale.js`（纯函数；36 条标签映射用例实测通过） |
| 主题管理器（自适应已具备） | `src/ui-next/theme.js`、`src/main.js` / `src/cep/main.js` 的 `init()` 调用点 |
| 语言接线（W1 已完成） | `src/i18n.js`（`detectLocale` → `resolveLocale`）、`src/store/index.js`（`defaultState.language: 'system'` + 一次性迁移）、`src/components/globalSetting/globalSetting.vue`（「跟随系统」项） |
| **引导模块（W1 新增 / W2 扩到 7 步）** | `src/ui-next/views/RootGate.vue`；`src/ui-next/onboarding/`：`state.js`、`Onboarding.vue`、`steps/*.vue`（7 页：Welcome / Import / Output / Naming / PathVars / Ae / Finish）、`demos/*.vue`（6 枚组件 + `naming-store.js`） |
| 落地页暗色映射 | `landing/styles.css` 的 `html[data-theme="dark"]`（已对齐 `src/ui-next/styles/tokens.css`） |
| 浏览器调试 mock 桥 | `src/util/mock-bridge.js`（`serve` 下注入，`kind === 'browser-mock'`） |
| dev 预览编排 | `scripts/dev-all.js`（landing 8080 / web 8081 / cep 8082） |
| 双端边界 | `docs/CEP-UPGRADE-SCOPE.md`、`docs/PLAN-DUAL-TARGET.md` |
