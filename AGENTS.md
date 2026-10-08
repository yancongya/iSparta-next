# iSparta-next 开发约定

> 给人 / Agent 共用。动手前先读本文，**优先复用仓库已有脚本与流程**，不要重复发明。

## 1. 仓库与运行

| 用途 | 用法（PowerShell，仓库根 `F:\iSparta` 或你的克隆路径） |
|------|----------------------------------------------------------|
| Electron 开发 | `npm run dev`，或 `scripts\dev\run-dev.cmd`（日志：`dev.log` / `dev.err` / `dev.status`） |
| 一键开发预览 | `npm run dev:all`（落地页 8080 + Web 8081 + CEP 8082）；`dev:all:electron` 再加 Electron；或 `scripts\dev\run-all-dev.cmd` |
| 依赖安装 | `scripts\dev\run-npm-install.cmd` / `run-clean-install.cmd` / `run-electron-install.cmd` |
| AE CEP 开发（**默认 HMR**） | `npm run dev:cep`（MainPath=`./dev-hmr.html`→8082）；刷新=**关面板再开（无 Ctrl+R）**。收工 `dev:cep:off`。出包才 `build:cep` |
| CEP 铁律 | MainPath **禁 http://**；**禁 mock**；桥 `/lib/`|`../lib/`；外链 `cep.util.openURLInDefaultBrowser` |
| CEP 载荷/扩展 zip | `npm run prepare:cep`（`build/cep-payload/`）；`npm run pack:cep`（`dist/*-cep-*.zip`） |
| 更新逻辑测试 | `node scripts\updateCheck.l1.js`；fixture：`scripts\fixture-github.js` |
| 图标再生 | 见 `scripts\build-app-icons.js`、`scripts\make-icons-from-png.py`、`scripts\make-installer-images.py`（勿手改位图当源） |

### 1.1 统一入口脚本（`scripts/dev/`）——**先查这里，不要现敲命令**

预览 / 构建 / 体检三类高频流程都收敛成三个 JS 入口，各配一个双击友好的 `.cmd` 包装。
它们固化的是**踩过的坑**（删除守卫豁免、CEP 产物漂移、端口顺延抢答），绕过它们直接手敲原命令会重新踩一遍。

| 入口 | 子命令 / 目标 | 用途 |
|------|---------------|------|
| `scripts\dev\preview.js`<br>`scripts\dev\run-preview.cmd` | `guide` :8090 · `landing` :8080 · `web` :8081 · `desktop` :8081 · `cep` :8082 | 起服务 → **按页面独有标记确认「应答方确实是我们」** → 打开默认浏览器。`--port N` 指定端口，`--no-open` 只起服务 |
| `scripts\dev\build.js`<br>`scripts\dev\run-build-win.cmd`<br>`scripts\dev\run-build-cep.cmd` | `win` · `cep`；`--backup` · `--dry`(`-n`) | 构建入口。见下方「两种模式的差异」 |
| `scripts\dev\check.js`<br>`scripts\dev\run-check.cmd` | `lint` · `pack` · `ports` · `all` | 体检：lint / `doctor:pack` 出包自检 / 8080–8099 端口占用与**归属识别**（附可复制 `taskkill`） |

```powershell
node scripts\dev\preview.js guide            # 引导页原型台
node scripts\dev\build.js win                # 本机打 Windows 安装包
node scripts\dev\build.js cep                # 改了 src/ 就重建 targets/cep/ui
node scripts\dev\check.js all                # lint + pack + ports
```

预览入口内部调用的就是仓库原有的服务脚本（`landing` → `npm run landing:serve`、`web` → `npm run serve`、`cep` → `npm run serve:cep`、`guide` → `npm run preview:guide`（:8090 原型台）、`desktop` → `npm run dev`）—— 单独调试服务本身时仍可直接跑它们，日常预览走 `preview.js` 以便拿到标记校验与真实端口提示。

**`build.js` 两种模式的差异**

- `win` → `npm run build:windows`（完整向导含 NSIS）。三件事自动化：① **注入 `CODEBUDDY_SAFE_DELETE_ENABLED=0`** —— `vue.config.js` 把 CEP 的 `outputDir` 指到 `targets/cep/ui`，构建会清空重建该目录，不豁免必撞安全删除守卫；② 构建前报告该目录的受控 / 未跟踪文件数（受控的可 git 恢复，未跟踪的一清就没，有未跟踪却没加 `--backup` 会提示）；③ 构建后直接给出最新 exe 的**绝对路径 / 体积 / 时间 / sha256**，失败则回显末尾日志。`--backup` 备份到 `.bak/`（已 gitignore），`--dry` 只打印将要执行的命令。
- `cep` → `npm run build:cep`，只重建 `targets/cep/ui`（没有安装包，秒级）。**改了 `src/` 或 `shared/` 就要跑**，否则提交进去的产物会与源码悄悄脱节；脚本会打印与 HEAD 的漂移项。

**两条刻意的设计**（改脚本时别退回旧写法）：① `preview.js` 的就绪判定以**子进程自己打印的地址**为准 —— vue-cli 端口被占会自动顺延，盲目扫端口会把邻近残留实例当成本次成果；② 只有能证明是自己的实例（页面标记命中）才复用，否则一律自己起。

**`scripts/dev/` 里的 `.cmd` 包装**（双击友好，等价于对应 node/npm 命令）：`run-dev` · `run-dev-cep` · `run-all-dev` · `run-landing` · `run-preview` · `run-build-win` · `run-build-cep` · `run-check` · `run-npm-install` / `run-clean-install` / `run-electron-install`。新脚本沿用同样风格，并写 `*.status` / `*.log` / `*.err` 三件套（均已在 `.gitignore` 内）。

环境：Node 经 `MIMO_NODE` / `MIMO_NPM` 时用 `& $env:MIMO_NODE $env:MIMO_NPM run <script>`。Windows 上不要用 Unix 登录 shell。

**行尾约定**（见根目录 `.gitattributes`）：会被脚本 / 编辑器重写的文本（`scripts/dev/guide-preview/index.html`、`docs/PLAN-GUIDE-PAGES.md`、`src/util/updateCheck.js`、`targets/cep/CSXS/manifest.xml`）声明为 `text eol=lf`，此后行尾差异不再产生 diff；vendor 进来的 `forge.js` 三份拷贝声明 `-text` 冻结字节。**改这些文件不要再手工还原行尾。**

**写仓库脚本的三个坑**：① Windows 上 Node 不能直接 `spawn` `.cmd`/`.bat`（Node 18.20+ 起为 CVE-2024-27980 抛 `EINVAL`），须过一层 shell —— 用 `scripts/dev/*.js` 里的 `spawnTool()`；② 同步版 `spawnSync` / `execFileSync` 在受限环境会 `EBUSY`，必须显式传 `stdio: ['ignore','pipe','ignore']`（见 `scripts/dev/check.js` 的 `capture()`），且**不要把失败静默吞掉**，否则「查不到」会被误报成「一切正常」；③ 含中文的 `.ps1` **必须存为 UTF-8 with BOM** —— Windows PowerShell 5.1 读无 BOM 的脚本会按 ANSI(GBK) 解码，中文变乱码后直接语法报错、整脚本不执行（`scripts/release.ps1` 就踩过：报「参数列表中缺少参量」，且因为一个字没跑，**不会**误触发发版）。

**图标唯一源**：`public/icons/icon-brand.svg`（品牌色 `#c8f542` + 深色播放标，**无文字**，图形居中并占满画布约 92%）。改 SVG 后再生成 png/ico/icns；同步：

- 应用：`public/icons/icon.png|ico|icns` + 多尺寸 png
- Web：`public/favicon.ico`、`public/favicon.svg`、`public/index.html` 引用
- 落地页：`landing/assets/icon.png`（`landing/index.html` 的 `rel=icon`）

## 2. Commit 与 Release 必须分开

**原则**：commit 说清「代码改了什么、为什么」；Release 说明面向用户「这个版本有什么变化」。两者文案独立撰写，不要把 commit 原文直接当成 Release 正文。

### 2.1 Commit 规范

- Conventional Commits：`feat|fix|refactor|docs|chore(scope): 中文简述`
- 一行主题（≤ 约 50–70 字）；需要时正文用短列表写清行为变化与验收点
- **不要**把 release 号、安装包下载说明写进业务 commit
- 业务改动与发版 bump（`chore(release): vX.Y.Z [skip ci]`）分开：bump 由 CI 生成，本地只提交功能 commit
- 提交前跑 `npm run lint`；不要 commit 本地日志（`dev.log`、`.g*-run.log` 等）
- 文案只写本仓库自身的改动与用户收益；**不要**在 commit / Release / 文档里点名外部项目或写「参考了…」

示例：

```text
feat(list): 空白处框选任务；Delete 删除所选
```

### 2.2 Release 触发策略（强制）

- **仅当用户明确要求发布/发版/release 时才触发** `release.yml` / `scripts/release.ps1`
- 修完 bug、改完 UI、补完文档：**只 commit / push**，不要自动发版
- 用户未点名发版时，最多说「已提交，需要发版再说」
- Release 与应用内更新说明与 CHANGELOG 保持产品向短句；不写外部对照来源

### 2.3 Release 说明结构（用户可见）

发版正文用 GitHub Markdown，**结构固定**：

1. **标题行 / 首屏简述**：`更新到 vX.Y.Z` + 3–6 条「用户能感知的变化」短句（先写这个，不要一上来贴 commit 列表）
2. **折叠的详细说明**：完整变更、修复、开发说明等

模板（可交给 Actions 或手工粘贴）：

```markdown
## 更新到 vX.Y.Z

- 一句话：最重要的变化
- 一句话：次重要
- 一句话：体验/修复要点

<details>
<summary>详细说明</summary>

### 新增
- …

### 修复
- …

### 开发 / 其他
- …

</details>
```

发版入口（**用现成脚本，不要另写一套**）：

```powershell
.\scripts\release.ps1                 # patch
.\scripts\release.ps1 -Bump minor
.\scripts\release.ps1 -DryRun
# 等价：gh workflow run release.yml -R yancongya/iSparta-next -f bump=patch …
```

CI：`release.yml` 负责 bump、打包、挂 Release（notes 模板见该 workflow）；`build.yml` 仅日常构建 Artifact；`pages.yml` 部署落地页。

## 3. 更新体验（产品约定）

- 启动自动检查 → **应用内** Dock（右下角），**不**用系统通知（「有新版」提示）
- **检查更新不自动下载**；UI 出「立即更新」，用户确认后再拉包；完成后「重启以更新」
- **安装阶段**可使用系统 Toast（Windows）：文案 `updateInstallingApp` / `updateInstallingBody`
- Windows NSIS 为**完整向导**（`oneClick: false` + `perMachine: false`）：自带「安装选项」页；侧栏图 `build/installerSidebar.bmp`（164×314）、页眉 `build/installerHeader.bmp`（150×57）
- 设置面板与 Dialog 与 Dock 状态一致；mac/Dev 显示「前往下载」
- 文案键见 `src/locales/*`，新增 UI 必须三语齐全

## 4. 任务列表交互（产品约定）

- 右键：运行中可 **终止任务**；**删除项目** 运行中也可用
- **任务列表与合成树两个视图**的右键菜单共用同一判定真相源：该行在 store 里的任务下标 + `process.schedule ∈ (0,1)`。禁止在组件里写死 `isRunning`（合成树曾写死 `false` + `index:-1`，长转换在该视图下无法中止）
- `Delete` / `Backspace`：删除所选（非输入框）
- `Ctrl+A`：全选；空白 **单击** 取消选择，**双击** 全选
- 空白 **拖拽**：框选任务（`user-select:none` + preventDefault，避免选中文字/缩略图）
- 底栏快捷键为 **键盘图标** 点开说明；全局设置与**删除所选**在中栏

## 5. 输出设置（产品约定）

- 多选：右侧仍显示完整设置；顶部横幅「已选 N 项」；路径/质量/格式/阈值等**共享**写入所有选中项
- 输出名：多选时**多行**分别编辑，支持与单选相同的**拆词**与「只留文字」
- 参数区尽量**两列对齐**（label / 输入 / info 图标同一节奏）

## 6. 设置说明文案（强制）

- **设置说明只维护一份**：`src/locales/*` 里的 `*Tip` 键
- 默认设置（globalSetting）与输出设置（setting）的 info 图标**必须**引用同一 `$t('xxxTip')`
- 禁止两边各写一份文案；禁止把单位（如「次」）当 tip
- 大小阈值 tip：`sizeLimitEnableTip` / `sizeLimitMaxTip` / `sizeLimitAutoQualityTip` / `sizeLimitAutoDeleteTip` / `sizeLimitStepTip` / `sizeLimitTriesTip`；单位用 `sizeLimitUnitTimes`
- Floyd / 质量：`floydTip` / `qualityTip`

- **应用内更新说明**：`formatReleaseNotes`（`src/util/updateCheck.js`）必须输出**纯文本**（已去掉 Markdown 井号/`<details>`/安装包表）；弹窗用普通 `div` + `pre-wrap`，禁止 `v-html`。Release 正文在 GitHub 网页上仍可是 Markdown + `<details>`。

## 7. 文档与变更记录

- **重要版本摘要**维护在 [`docs/CHANGELOG.md`](docs/CHANGELOG.md)（中文单语）：抽取关键 `feat`/`fix` commit 与 Release 结果，按版本写「用户可感知」短列表；不要粘贴琐碎 chore
- **README**（`README.md` / `README.en.md`）只保留：产品能力、更新机制、近期体验要点、文档链接；细节放 CHANGELOG / UPDATER，避免与 CHANGELOG 整段重复
- 新发版若含**用户可见**变化：更新 CHANGELOG 对应版本段 → 同步 README 中已过时描述 → 再 push；功能 commit 与 `docs` commit 可分开

## 8. Agent 行为

- 先搜代码/文档/脚本再改；架构与交互以本文、`docs/UPDATER.md`、`docs/RELEASE.md`、`docs/CHANGELOG.md` 为准
- 优先 `scripts\` 与 `npm run *`；不要为 lint/发版/图标另起临时流程
- **未经用户明确要求，禁止 commit 以外的发版/release**（见 §2.2）
- 主树（`master`）大范围写入前按会话规则确认 worktree；发版后 `git pull` 同步 bump
- 完成后：lint 通过 → commit（规范见上）→ 更新 CHANGELOG/README（如有用户可见变化）→ **等用户点名再 release**

## 8.1 双端目标（桌面 + AE CEP）

- 完整计划与多 Agent 分工见 [`docs/PLAN-DUAL-TARGET.md`](docs/PLAN-DUAL-TARGET.md)（Goal / W1–W5 / 验收）。
- 扩展 **Extension Id / CEP 目录名**：`io.github.isparta-next`；编码器用 **小工具子集**（与 `src/util/processor` 一致），扩展壳在 `targets/cep/`。
- 转换核只依赖 `src/util/node-env.js` 桥接口；桌面 IPC 与 CEP Node 各写 adapter，业务不复制。
- **Web 框架双端共用 Vue 2**；**压缩/合成只用 `src/util/processor/*`**，禁止在 CEP 另写编码链。AE 侧 jsx 负责选合成与渲序列，编码仍进 processor。
- **禁止简化版 UI**：扩展完整复用桌面工作台（列表/设置/命名/路径）；AE 特殊化仅通过 **注入/适配层**（jsx 宿主、合成输入源、host adapter），不得维护平行精简面板。
- **双端一起更**：同一 NSIS/Release 更新桌面与 AE 扩展；扩展不单独热更。桌面 electron-updater 完成后由应用自检并刷新 CEP 目录；CEP 内不跑 electron-updater。
- **CEP 的更新路径（Windows）**：AE 面板不再只做「前往下载」——面板后台下**同一个官方安装包**（`src/util/cepUpdater.js` + 桥的 `updater:*` 通道），下载完成后主按钮是「**运行安装包**」（起 NSIS 向导，`detached + unref` 不阻塞面板），桌面与 AE 扩展由向导的组件页一次更完。**AE 不会被安装包重启**，装完必须引导用户重启 After Effects（文案 `updateCepDownloaded` / `updateCepInstallerBody`）。mac 无 NSIS，CEP 侧仍只能「前往下载」。
- **更新偏好双端分键**：桌面与 AE 面板共用 `%TEMP%/iSparta/localstorage.json`（`os.tmpdir()`），更新节流相关键按宿主分开（`updateCheck.app` / `updateCheck.cep`，见 `src/util/updatePrefs.js`）——否则一端点过「稍后」会吃掉另一端的更新提示。主题、语言等其余偏好仍双端共享。
- 不用 Bolt/Nx；一体安装走现有 NSIS 组件页；发版仍须用户点名（§2.2）。
- **安装范围只问一次**：唯一真相源是 electron-builder 自带的「安装模式」页（`$installMode` = `all` / `CurrentUser`，选「所有用户」时该页已完成 UAC 提权）。它的结果同时决定**主程序**目录与 **CEP 落盘位置**（Common Files ↔ `%APPDATA%`，互斥禁双写）；NSIS 组件页**不再放安装范围 radio**，只只读显示落盘位置（`build/installer.nsh` 的 `ispartaResolveScope`）。AE 版本用注册表+多盘枚举探测，仅用于校验/展示/PlayerDebugMode，不装多份。详见 [`docs/PLAN-DUAL-TARGET.md`](docs/PLAN-DUAL-TARGET.md) §9。
- 实现阶段同步更新本节与 `docs/PLAN-DUAL-TARGET.md` 勾选状态。

## 8.2 视口断点统一约束（强制）

**唯一来源**（同值同步改，禁止在组件里手写 320/360/479/720/900 等邻近值）：

| Token | 值 | 文件 | 用途 |
| --- | --- | --- | --- |
| `$bp-narrow` / `BP_NARROW` | 360 | `src/ui-next/styles/_bp.scss`、`breakpoints.js` | CEP 极窄：壳层单列、藏侧栏、禁拖出 |
| `$bp-compact` / `BP_COMPACT` | 480 | 同上 | 条目卡片降档（视口级备用） |
| `$bp-wide` / `BP_WIDE` | 820 | 同上 | 底栏/列表列简化；主列最小宽收缩 |

- SCSS 用 `@import ".../bp"` 取 `$bp-*`；JS 用 `import { BP_* } from '.../breakpoints'`。
- **严格 CEP 注入**：断点样式必须包在 `body.is-cep` 内；JS 判定须加 `hostAdapter.supportsCompImport`。桌面窗口收窄不走这套。
- **条目 `@container` 340/480** 是组件内部几何断点，与视口断点分层，不共用 token，但需注释标明。
- 改断点值必须同时改 `_bp.scss` 与 `breakpoints.js`，并在本表更新。

## 8.3 CEP 弹窗铺满（强制）

CEP 下弹窗要铺满时必须三件套同时做，缺一就会被内联样式 / 外层 padding 卡住：

1. IsDialog `width` prop 传 `'100%'`（宿主动态，桌面保留固定值）
2. `root-class` 收紧 `.is-dialog` 外层 `padding: 6px`（如 `log-dialog` / `gs-dialog`）
3. `panel-class` + `body.is-cep` 门控，覆盖 `width/height/max-height`

细节与反例见 [`docs/CEP-UPGRADE-SCOPE.md`](docs/CEP-UPGRADE-SCOPE.md) §8。参考：`IsLogPanel.vue`、`globalSetting.vue`。

## 8.4 转换核中间产物命名（强制）

`src/util/processor/*` 的中间产物一律用 ASCII 名 `out.*` 落在 `item.basic.tmpOutputDir`，**用户可见的最终文件才用 `options.outputName`**。生产者与消费者必须同一真相源，改一处就得改全：

| 中间产物 | 谁写 | 谁读 |
| --- | --- | --- |
| `out.png` | `pngs2apng`（apngasm）/ `apngCompress`（拷入 fileList[0] + apngopt 回写；gif2apng、webp2apng 也汇到它） | `index.js apng2other`（APNG 分支）、`sizeGate.tmpPathFor`、`apng2gif` 的输入自拷 |
| `out-quant.png` | `apngCompress`（apngquant） | `apngCompress` → apngopt |
| `out-gif.png` | `apng2gif` 自拷（**刻意不复用 `out.png`**） | `apng2gif.exe` |
| `out.gif` | `apng2gif` | `index.js apng2other`（GIF 分支）、`sizeGate.tmpPathFor` |
| `out.webp` | `apng2webp` | `index.js apng2other`（WEBP 分支）、`sizeGate.tmpPathFor` |

- 反例（真实回归，v3.5.0 起双端同源）：`apng2gif` / `apng2webp` 曾写 `<outputName>.gif/.webp`，而 `apng2other` 按「ASCII 中间名」去找 `out.gif` / `out.webp` → 导出 GIF / WebP **必失败**，日志为 `转换中断 — ENOENT: copyfile '…\out.webp' -> '…\名称.webp'`（不是 CEP 独有 bug）。
- `apng2gif` 的输入为什么叫 `out-gif.png`：sizeGate 重压时 `fileList[0]` 是 `out-quant.png`，若拷进 `out.png` 会把最终 APNG 产物覆盖掉。

## 9. 文档索引

| 文档 | 用途 |
| --- | --- |
| `AGENTS.md` | 开发约定（本文） |
| `docs/CEP-UPGRADE-SCOPE.md` | CEP 升级范围与双端边界（共有 vs 注入） |
| `docs/PLAN-DUAL-TARGET.md` | 双端（桌面+CEP）计划与分工 |
| `docs/PLAN-GUIDE-PAGES.md` | 引导页面升级计划（启动/安装/首启共 7 页） |
| `docs/CHANGELOG.md` | 版本摘要（中文） |
| `docs/BRIDGE.md` | 转换核桥接口冻结（ispartaAPI / node-env / processor） |
| `docs/UPDATER.md` | 更新检查 / 自动更新现状 |
| `docs/RELEASE.md` | 发版操作 |
| `README.md` | 中文产品说明 |
