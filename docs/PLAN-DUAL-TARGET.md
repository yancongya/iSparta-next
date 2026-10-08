# 双端一体 Plan：桌面 + AE CEP（iSparta-next）

> 状态：**实现已落地（W1–W4 / W2u / W5 文档）**；AE 真机选合成冒烟待人工。  
> 约束：先读 `AGENTS.md`；用现成 skills / `scripts\` / `npm run *`；升级时同步文档、脚本、`AGENTS.md`。  
> 参考只读：`.worktrees/*`、本机 PAG/SVGA 安装形态——**不改造参考仓库**。

> 验收表见 [ACCEPTANCE-DUAL-TARGET.md](ACCEPTANCE-DUAL-TARGET.md)。实现主干已落地；**暂缓 commit**（用户要求）。  
> **UI/功能与桌面对齐差距**见 [CEP-ALIGNMENT.md](CEP-ALIGNMENT.md)（命名拆词、路径、任务列表合成树/拖粘贴等）。  
> **下一波多 Agent 执行简报**见 [EXEC-WAVE2.md](EXEC-WAVE2.md)（完整工作台 + hostAdapter/sourceAdapter + 双端一起更）。

## 1. Goal（完成定义）

1. **一仓双目标**：同一仓库可开发、测试、出包  
   - 桌面：现有 Electron 工作台（APNG/WebP/GIF/PNG 序列）  
   - 扩展：AE CEP 面板（**可选合成** → 渲染序列 → 动图），能力对齐桌面  
2. **Web 框架双端共用（强制）**：桌面与 CEP 共用 **Vue 2** 及**完整同一套** UI/业务（`Home`/`projectList`/`setting`/命名/路径等）；**禁止简化版/平行精简面板**。AE 特殊化只用 **注入/适配**（jsx、合成输入、host adapter）。**仅打包方式与后端桥不同**。  
3. **共享转换核（强制）**：压缩 / 合成 / 降质 **必须同一套** `src/util/processor/*`（经桥 `exec/fs/path/storage`）；CEP 不得另写编码流水线。桌面与 CEP 只各一 adapter。  
4. **AE 注入/宿主能力**：jsx 提供合成列表与**多选/单选合成**，按工作区/合成渲 PNG 序列后**进入同一 processor** 出 WebP / APNG / GIF。  
5. **一体安装 + 双端一起更**：同一 NSIS/Release 更新桌面与 AE 扩展；扩展不单独热更。electron-updater 热更桌面后应用自检并刷新 CEP 落盘（对齐 payload 版本清单）。**W9-update 已落地**：`src/util/cepSync.js` 启动自检重拷；`updatePolicy`（cep→none/notify-only）；`version.json` 与 prepare-cep/NSIS 对齐；卸载/刷新只动 `EXT_ID`。  
6. **发布**：`build.yml` 日常双产物 Artifact；`release.yml` 发版时桌面安装包内嵌扩展 + Release 附扩展包。  
7. **文档同步**：每阶段结束更新 `docs/*` 与 `AGENTS.md` 中相关约定。

**非目标（本 Plan 不做）**：Bolt/Vite 新脚手架；Nx/Turbo；UXP；改造参考项目；自动 release（仍须用户点名）。

## 2. 现状锚点（已核实）

| 项 | 位置 |
|----|------|
| 桌面壳 | `src/background.js` + `src/preload.js` + `vue.config.js` |
| 转换核 | `src/util/processor/*`（`action.js` 走 `job:execFile`） |
| 桥接口 | `src/util/node-env.js`（`ispartaAPI`） |
| CLI | `public/bin/{win32,win64,mac,linux}/` |
| 打包 | `electron-builder.yml`（NSIS 完整向导） |
| CI | `.github/workflows/{build,release,pages}.yml` |
| 约定 | `AGENTS.md`、`docs/UPDATER.md`、`docs/RELEASE.md`、`docs/CHANGELOG.md` |

## 3. 工作流拆分（可多 Agent 并行）

| 流 | 代号 | 产出 | 依赖 |
|----|------|------|------|
| 共享核与桥 | **W1-core** | processor 只认桥；`bridge` 接口文档化；桌面行为不回归 | 无（可先动） |
| CEP 扩展 | **W2-cep** | `targets/cep/`：manifest、精简 UI、`jsx` 导出、Node CLI 封装 | W1 接口定稿即可并行 |
| 安装与打包 | **W3-pack** | NSIS 组件页 + extraResources + 安装/卸载钩子；扩展 zip 产物 | W2 目录结构稳定后 |
| CI/CD | **W4-ci** | build/release 扩展 job；Artifact 命名 | W3 产物路径定稿 |
| 文档与约定 | **W5-docs** | `docs/*`、`AGENTS.md`、CHANGELOG 条目；skills 使用说明 | 各流出口各同步一次 |

多 Agent 时：**W1 ∥ W2** 为主并行；**W3 → W4**；**W5** 跟随各流出口，不单独堵路。

## 4. 阶段与验收

### P0 基线（0.5d）
- [x] 本 Plan 入库；`AGENTS.md` 增加「双端目标」指针一小节  
- [x] 扩展 ID / 目录名定稿：**`io.github.isparta-next`**（与 `appId` 一致；Extension Id / BundleId / CEP 目录名同此）  
- [x] 扩展编码定稿：**方案 A 小工具子集**（apngasm / apngquant / cwebp·dwebp 等，对齐 `processor/*`；暂不收成单 ffmpeg）  
- **出口**：ID、目录名、编码方案已定（2026-07 用户确认）

### P1 共享核（W1，1–2d）
- [x] 梳理 `processor/*` 对 `node-env` 的全部依赖  
- [x] 桥接口冻结：`execFile` / `fs` 子集 / `path` / `storage`（与现 preload 对齐）→ [`docs/BRIDGE.md`](BRIDGE.md)  
- [x] 桌面冒烟：`npm run lint` + 转换一条 PNG 序列→APNG  
- **出口**：接口说明进 `docs/`；无行为回归

### P2b 双端共用 UI + 同一转换核（W2u，新增）
- [x] CEP 面板改为 **Vue 2** 构建入口，复用 `src/ui-next` / `src/util`（或抽共享包路径），与桌面同框架  
- [x] 去掉 `targets/cep/lib/cli.js` 旁路编码，**统一走 `src/util/processor/*`**（挂 `cep-bridge`）  
- [x] jsx：**合成列表 + 选择**（单/多），所选合成渲序列 → processor  
- [x] 输出格式与桌面一致：WebP / APNG / GIF（及序列）  
- [x] 浏览器可预览面板（dev：`npm run serve` 或 CEP 静态入口；有 `index.html` 入口）  
- **出口**：同一 processor 为唯一编码路径；`npm run lint` / `build:cep` 通过；manifest MainPath=`./ui/index.html`；AE 真机选合成冒烟待做

### P2 CEP 扩展（W2，2–4d）
- [x] `targets/cep/` 传统结构（对齐 webp_apng / pagconfig 体量，不抄业务）  
- [x] manifest：AEFT `[15.0,99.9]`、`--enable-nodejs`、Panel 520×560  
- [x] `jsx`：`ispartaExportPngSequence` + 渲染队列备份恢复（ES3）  
- [x] `lib/`：`cep-bridge` / `cli`（含 mac chmod + 清 quarantine）  
- [x] 编码器：小工具子集（apngasm/apngquant/apngopt/cwebp/webpmux；见 `targets/cep/bin/README.md`）  
- [x] 开发态说明：junction + PlayerDebugMode（`targets/cep/README.md`）  
- [ ] **AE 真机冒烟**（导出序列→APNG/WebP；待人工）  
- **出口**：结构与桥校验已过；真机冒烟待做

### P3 一体安装（W3，1–2d）
- [x] `extraResources` 携带 CEP 产物（`build/cep-payload` → `resources/cep/io.github.isparta-next`）
- [x] `nsis.include`（`build/installer.nsh`）：组件页 ☑ 桌面 / ☑ AE 扩展（至少其一；可只装桌面）
- [x] 安装复制到 CEP 目录（优先 `%APPDATA%\Adobe\CEP\extensions\io.github.isparta-next`；管理员可同时 Common Files）；卸载清理；失败路径提示（可选 ExMan/ZXP 兜底）
- [x] `version.json` 版本清单（暂存时写入 + 安装时覆盖安装信息）
- [x] 未签名扩展：安装时写 CSXS PlayerDebugMode（HKCU 6–14）
- **出口**：本地 `npm run build:windows` 安装包勾选扩展后 AE 可见面板（待真机）

### P4 CI/CD（W4，1d）
- [x] `build.yml`：+ CEP 产物 job（win/mac）  
- [x] `release.yml`：挂扩展包（`isparta-next-${version}-cep-{win,mac}.zip` + 稳定别名）  
- [x] NSIS 包内已含扩展（W3 extraResources / 组件页，见 P3）  
- [x] 仍遵守：**仅用户点名才 release**  
- **出口**：CI Artifact 可下载；release dry_run 通过  
- **产物约定**（W3/W4 共用）：源 `targets/cep/` + `public/bin` 小工具子集 → zip 根 `io.github.isparta-next/`；文件名 `isparta-next-${version}-cep-${platform}.zip`；稳定别名 `isparta-next-cep-{win,mac}.zip`

### P5 收尾（W5，0.5–1d）
- [x] `AGENTS.md`：双端目录、开发/打包命令、扩展约定  
- [x] `docs/`：双端开发简记；CHANGELOG 仅在用户可见变化时  
- [x] 任务列表与 Plan 勾选对齐  
- **出口**：文档与仓库一致

## 5. 复用清单（避免造轮子）

| 复用 | 来源 | 用途 |
|------|------|------|
| processor + sizeGate + 输出路径 | 本仓库 | 双端转换 |
| `node-env` 接口形状 | 本仓库 | CEP adapter 对齐 |
| 渲序列 + 调 CLI | webp_apng 方法 | `targets/cep/jsx` |
| Node spawn + 扩展内二进制 | SVGAConverter / ffmpeg-runner | CEP 执行层 |
| 多落盘 + 版本清单 | PAG | W3 安装 |
| ExManCmd 装 ZXP | ZXPInstaller | 兜底 |
| 规范 / 检查 | `cep-playground` skill、`jsx-modular-refactor` | W2 写码与检查 |
| 发版脚本 | `scripts/release.ps1`、`doctor-packaging.js` | W4 |

**禁止**：临时 `.bat` 执行链；Bolt；改参考仓；无 AGENTS/文档同步的落地。

## 6. 多 Agent 协作约定

1. 每个 Agent 领一条 **W\***，只改本流路径；跨流变更先改本 Plan 再动。  
2. 动手前读 `AGENTS.md` + 本 Plan；完成后勾选阶段项，并更新本流相关文档。  
3. 共享文件（`node-env`、`processor/*`、`electron-builder.yml`、`AGENTS.md`）**串行修改**，避免并行写冲突。  
4. 验收以阶段「出口」为准；lint / 冒烟不过不标 done。  
5. 发版动作仍由主会话/用户点名，子 Agent 不跑 `release.ps1`。

## 7. 风险与待决

| 项 | 说明 | 倾向 |
|----|------|------|
| 扩展编码核心 | 小工具链 vs 单 ffmpeg | **已定：小工具子集（A）** |
| 扩展 ID / 面板名 | 影响 manifest 与安装目录 | **已定：`io.github.isparta-next`** |
| 未签名 CEP | 需 PlayerDebugMode 或签名 ZXP | P3 二选一或主备 |
| AE 版本矩阵 | AEFT 版本范围 | manifest 先 `[15.0,99.9]` 再收紧 |
| CI Artifact 命名 | `build.yml` 桌面曾用 `isparta-*`，与 release / electron-builder `isparta-next-*` 不一致 | **已消：统一为 `isparta-next-*`**（updater 资产名不变） |

## 8. 任务 ID 映射（task 工具）

- T5 总计划：双端一体 Plan 推进  
  - T5.1 P0 基线与 ID 定稿  
  - T5.2 P1 共享核与桥（W1）  
  - T5.3 P2 CEP 扩展（W2）  
  - T5.4 P3 一体安装（W3）  
  - T5.5 P4 CI/CD（W4）  
  - T5.6 P5 文档与 AGENTS 同步（W5）

## 9. 安装范围 / AE 版本探测 / 回退链（设计说明，待实现）

> 调研结论：CEP 扩展目录**不分 AE 版本**，一份拷贝通吃 2023/2024/2025。
> 「选版本」的正确语义 = 校验兼容 + 展示 + 写对应 CSXS 的 PlayerDebugMode，**不是装多份**。

### 9.1 AE 版本探测（多盘，不只 C 盘）

| 手段 | 说明 | 优先级 |
| --- | --- | --- |
| 注册表 | `HKLM\\SOFTWARE\\Adobe\\After Effects\\<ver>`（含 WOW6432Node），取 InstallPath | ★★★ 首选，与盘符无关 |
| 全盘枚举 | `DriveGet` 取固定盘符 → `\\Program Files\\Adobe\\Adobe After Effects *\\Support Files`（含 x86） | ★★ 兜底，覆盖手动挪盘/绿色安装 |
| 安装清单 | `%ProgramData%\\Adobe\\Install\\` | ★ 偶发补充 |
| 运行时 | jsx `app.path` | 仅 AE 内，不用于安装器 |

用途：展示「检测到 AE 2023 / 2024 / 2025」、校验 manifest `[15.0,99.9]` 兼容、按 CSXS 主版本写 PlayerDebugMode。

### 9.2 安装目标（两候选，**互斥**）

| 级别 | 路径 | 权限 | 覆盖 |
| --- | --- | --- | --- |
| **系统级（推荐）** | `C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\extensions` | 需管理员（UAC 提权） | 所有用户 × 所有 AE 版本 |
| 用户级 | `%APPDATA%\\Adobe\\CEP\\extensions` | 免管理员 | 当前用户 × 所有 AE 版本 |

**互斥规则**：二选一，**禁止双写**（Common Files 与 APPDATA 并存会引发 CEP 加载优先级歧义 / 重复加载）。
当前 `installer.nsh` 的 `UAC_IsAdmin` 顺带双写行为**须改**。

**选择口径（已实现）**：范围**不再由组件页询问**，唯一真相源是 electron-builder 自带的「安装模式」页
（`$installMode` = `all` / `CurrentUser`）—— 它同时决定主程序目录与 CEP 落盘位置，避免同一个问题问两遍。
组件页只**只读展示**落盘位置（`build/installer.nsh` 的 `ispartaResolveScope`）。

### 9.3 UAC 流程

```
「安装模式」页（electron-builder 自带，欢迎页之后）
    ↓ 用户选「所有用户 / 仅当前用户」；选前者时该页立即 UAC 提权
    ↓ 结果写入 $installMode（"all" | "CurrentUser"）
ispartaResolveScope（唯一推导点）
├─ all（已是管理员）
│     → 主程序 $PROGRAMFILES64\isparta-next
│     → 写 Common Files\Adobe\CEP\extensions\<EXT_ID>
│     → 所有用户 × 所有 AE 版本
└─ CurrentUser（免管理员）
      → 主程序 $LOCALAPPDATA\Programs\isparta-next
      → 写 %APPDATA%\Adobe\CEP\extensions\<EXT_ID>
      → 仅当前用户（AE 全版本仍可用）

组件页（目录页之后）
    → 只勾选「桌面版 / AE 扩展」，安装范围只读展示，不再提问、不再申请提权
    → silent(/S) 升级不经组件页 → 由 customInstall 再 Call 一次 ispartaResolveScope 兜底
```

### 9.4 识别失败回退链

```
1. 注册表扫到 AE 安装路径 → 校验目标盘可写
2. 全盘目录枚举（D/E/F…）→ 找 *After Effects *\\Support Files
3. 都识别不到 → 提示「未检测到 AE」
   ├─ 仍可按默认 CEP 目录安装（后续装 AE 也能加载）
   └─ 或用户手动 Browse / 自填目录
```

> 一个 AE 都没扫到时仍可装：CEP 扩展不绑定 AE 安装路径，装 AE 后自然加载。

### 9.5 升级测试关注点

1. 多盘 AE 探测展示正确
2. 管理员 → Common Files 单份；user-only → APPDATA 单份；**不双写**
3. 热更 `cepSync.js` 目标目录与安装级别对齐（Common Files 需提权/提示）
4. PlayerDebugMode 按探测到的 CSXS 主版本写（现 6–14；AE2025 若 CSXS 15 需补）
5. CI/CD：`build.yml`/`release.yml` 的 cep job **须先 `npm run build:cep`**（当前只 rsync `targets/cep/`，会打进过时 UI）

### 9.6 现状缺口（实现前必改）

| 项 | 现状 | 目标 |
| --- | --- | --- |
| AE 多盘探测 | 无 | 注册表 + 全盘枚举 |
| 安装互斥 | UAC_IsAdmin 顺带双写 | 二选一，禁双写 |
| UAC 推荐流 | 无 | 组件页区分「推荐管理员 / 仅当前用户」 |
| 手动选目录 | 无 | 识别失败时 Browse 兜底 |
| CI 构建 CEP UI | 只 rsync 旧产物 | 打 zip 前 `build:cep` |
