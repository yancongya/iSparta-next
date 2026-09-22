# iSparta-next 开发约定

> 给人 / Agent 共用。动手前先读本文，**优先复用仓库已有脚本与流程**，不要重复发明。

## 1. 仓库与运行

| 用途 | 用法（PowerShell，仓库根 `F:\iSparta` 或你的克隆路径） |
|------|----------------------------------------------------------|
| Electron 开发 | `npm run dev`，或 `scripts\dev\run-dev.cmd`（日志：`dev.log` / `dev.err` / `dev.status`） |
| 浏览器 UI 预览 | `npm run serve`（默认 8081） |
| 依赖安装 | `scripts\dev\run-npm-install.cmd` / `run-clean-install.cmd` / `run-electron-install.cmd` |
| Lint | `npm run lint` |
| 本地打包 Windows | `npm run build:windows` |
| 更新逻辑测试 | `node scripts\updateCheck.l1.js`；fixture：`scripts\fixture-github.js` |
| 图标再生 | 见 `scripts\build-app-icons.js`、`scripts\make-icons-from-png.py`、`scripts\make-installer-images.py`（勿手改位图当源） |

环境：Node 经 `MIMO_NODE` / `MIMO_NPM` 时用 `& $env:MIMO_NODE $env:MIMO_NPM run <script>`。Windows 上不要用 Unix 登录 shell。

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

## 9. 文档索引

| 文档 | 用途 |
| --- | --- |
| `AGENTS.md` | 开发约定（本文） |
| `docs/CHANGELOG.md` | 版本摘要（中文） |
| `docs/UPDATER.md` | 更新检查 / 自动更新现状 |
| `docs/RELEASE.md` | 发版操作 |
| `README.md` | 中文产品说明 |
