# 更新记录

> 本文件分两部分：**[版本记录](#版本记录)**（使用者——每个版本改了什么）与 **[更新机制](#更新机制)**（维护者——检查 / 下载 / 安装如何工作）。
> 发版步骤见 [RELEASE.md](RELEASE.md) · Windows 免费签名见 [SIGNPATH.md](SIGNPATH.md) · 开发约定见 [AGENTS.md](../AGENTS.md) · 完整文档导航见 [README 文档导航](../README.md#文档导航)。

---

## 版本记录

> 面向使用者的**单语（中文）**变更摘要。  
> 完整安装包与自动生成说明见 [Releases](https://github.com/yancongya/iSparta-next/releases)。  
> Commit 规范与 Release 正文结构见 [AGENTS.md](../AGENTS.md)。

### v3.6.12（2026-10-14）

- 修复任务列表排序后拖拽框选选错任务的问题。
- 右键打开输出目录现在会打开实际目标目录；CEP 使用 AE 跨平台目录接口，合成树未加入任务时也按默认输出设置定位。

---

### v3.6.11（2026-10-13）

- Windows 和 macOS 安装包统一安装桌面版；检测到 After Effects 时同步部署同版本 CEP 扩展。Windows 固定全机安装并申请 UAC，macOS pkg 安装时申请管理员权限。
- 桌面版与 AE 面板更新时显示下载、安装和完成状态；AE 面板安装完成后提示重启 After Effects。
- 安装时仅清理本产品已识别的旧扩展副本与更新缓存；修复 AE 面板“打开输出目录”路径编码和失败反馈。
- 桌面版与 AE 面板新任务默认选中 APNG、GIF、WebP，启用压缩；输出到源文件目录，并启用 800 KB 阈值与超限删除。已保存的个人设置保持原值。

---

### v3.6.0（2026-10-08）

- **首启引导（7 页）**：首次启动按「欢迎 → 导入 → 输出 → 命名 → 路径变量 → AE → 完成」走一遍，把导入方式、输出设置与命名规则一次讲清；引导内文字不再参与选中，逐页有悬停反馈。
- **输出路径页**改为上下一列：真实路径独占一行横条，过长时按半角宽度从左截断（保留尾部文件名），不再挤在左右双栏里。
- **语言可跟随系统**：设置里的语言新增「跟随系统」（默认），首次启动按系统语言自动选中简体中文 / 繁體中文 / English。
- **AE 扩展支持应用内更新**：面板内检测到新版本时复用桌面的更新链路，可下载并直接运行同一个安装包，不必再去 Release 页取 zip。
- **安装向导精简**：安装范围只在「安装模式」页问一次，组件页不再重复提问；组件页改为「桌面版 / AE 扩展」两张等宽卡片，未勾选 AE 时扩展位置说明自动置灰。
- 修复 AE 扩展导出 GIF / WebP 失败（中间产物名不匹配）；合成树右键菜单补回「终止任务」。
- 修复双端桥接文件在 `public/` 的副本漂移。
- 开源许可明确为 MIT（仓库根新增 `LICENSE`）。

### v3.5.0（2026-10-04）

- **AE 扩展（双端一体）**：After Effects 内完整工作台——合成树 / 任务列表、渲 PNG 序列、输出 APNG / WebP / GIF，与桌面同一套转换核。安装向导可勾选「桌面 / AE 扩展」一体安装；Release 另附 CEP 扩展 zip（`isparta-next-cep-{win,mac}.zip`）。
- **AE 扩展 UI**：顶栏 logo + 功能钮右对齐，单按钮切换「任务列表 / 合成树」；右键菜单（打开合成位置 / 输出目录 / 终止任务）；双击定位合成；任务过滤条（搜索 / 帧率 / 帧数）钉顶不滚动；同名合成按工程文件夹区分；设置 / 日志弹窗在小面板内铺满。
- **安装范围**：组件页可选「所有用户（推荐，统一 CEP 目录）/ 仅当前用户」，二选一不重复落盘；自动扫描 AE 安装（注册表 + 多盘目录）；提权失败警告并可重试。
- **版本号可见**：桌面窗口标题与 AE 扩展菜单名均显示当前版本。
- 空态导入面板改为文件夹开合动画，支持点击 / 拖拽 / Ctrl+V 粘贴
- 空态键帽改为立体机械键，悬停上浮、按下蓝光，点击可触发粘贴
- 空态标题改为蓝渐变字，文案与三语提示同步
- 落地页改版：hero 双引擎动效舞台，全站文案面向新用户直白化，AE 段能力描述与实现对齐

### v3.4.0（2026-09-22）

- **更新弹窗**改为「新版已就绪」公告式布局：居中品牌标、版本标题、更新说明**要点列表**与安装说明。
- 更新说明文字对比度加深；按钮区为「跳过此版本 / 稍后 + 主操作」。
- 落地页导航 **logo** 与应用图标统一为品牌播放圆标（不再随主题变橙）。
- **右侧面板**不再横向溢出；窄窗口下两列参数自动收成单列，行内控件可换行不重叠。
- 更新说明 / 日志列表滚动时**边缘渐隐**；新增轻量横幅组件用于提示信息。
- 出包前增加**安装包体积门禁**（`npm run audit:size`），CI 收集产物后自动校验。

---

### v3.3.17（2026-09-22）

- Windows：点「重启以更新」时系统 **Toast**（正在安装更新…应用将关闭…）。
- NSIS 改为**完整安装向导**：含「安装选项」（所有用户 / 仅为我）与完成页「运行 iSparta-next」。
- 向导侧栏 / 页眉使用品牌色图；中文向导文案（electron-builder 自带 zh_CN）。

---

### v3.3.16（2026-09-21）

- **应用内更新说明**不再显示 Markdown/HTML 源码，净化为要点列表（【新增】【修复】分组）。
- 更新对话框说明区改用正文排版（非等宽源码样式）。

---

### v3.3.15（2026-09-21）

- 设置说明（递减/重试/阈值等）两端面板共用 Tip 文案；阈值相关 info 图标齐全。

- 输出设置面板参数区改为**两列对齐**（帧频/循环、压缩质量、递减/重试等）。
- **多选**时右侧仍显示完整共享输出设置；输出名支持**逐项拆词**与「只留文字」漏斗。
- 列表任务（有序列帧/文件列表）均可打开**帧预览 / 延时**面板。
- 默认设置与输出设置共用同一套 **hover 说明文案**（locales `*Tip`）。

---

### v3.3.13（2026-09-21）

- 列表交互：空白**拖拽框选**、双击空白全选、单击取消选择、**Delete** 删除所选。
- 底栏快捷键常驻展示改为**键盘图标**，点击展开说明。
- **多选**右侧：顶部横幅 + 共享路径/质量等设置 + 多行输出名。
- 中栏增加**删除所选**；右侧面板底部不再重复全局设置/删除入口。
- 品牌图标**放大居中**、去掉底部文字；桌面 / Web favicon / 落地页图标同源。

---

### v3.3.10 – v3.3.12（2026-09-21）

- **检查更新**不再静默自动下载：先出现「立即更新」，确认后再下载，完成后提示「重启以更新」。
- 任务**运行中**右键可**终止**；删除在运行中也可用（先杀进程再移除）。
- 引入品牌色应用图标（`#c8f542` 圆形播放标）；后续版本去掉文字并居中放大。
- 新增 `npm run serve`（浏览器 UI 预览，默认 8081）。

> v3.3.12 构建曾因 `shell.scss` 括号问题失败，已由 v3.3.13 修复并重新发布。

---

### v3.3.9（2026-09-21）

- **应用内更新**：启动检查到新版本时右下角 **Dock** 提示（非阻断）。
- Dock / 更新对话框 / 默认设置统一**下载进度条**与「重启以更新」。
- 手动「检查更新」仍打开完整对话框（更新说明 + 跳过此版本）。
- **纯应用内**更新，不申请系统通知权限（Win/mac/Linux 同一套 UI）。
- 默认设置多项改并排布局，并补 info 图标说明（Floyd/质量、大小阈值开关等）。

---

### v3.3.7 – v3.3.8（2026-09-18）

- 默认设置 Floyd / 压缩质量文案与 NSIS 安装名、exe 图标与产品名对齐。
- 落地页版本与更新日志改为运行时读 GitHub Releases API；发布文档（更新机制 / 发版）归档进本文件与 RELEASE。
- CI：日常多平台构建 Artifact；正式发版走 `release.yml` / `scripts/release.ps1`。

---

### 更早（v3.3.x 重构基线，摘要）

- Electron 升级至 **28**，`contextIsolation` / preload / IPC 白名单。
- 自绘 UI 体系（主题、通知、列表工作台）替换 Element UI。
- 输出大小阈值、路径变量模板、粘贴导入、前后对比滑块。
- GitHub Actions 多平台打包；macOS 手动更新说明；Windows 签名见 [SIGNPATH.md](SIGNPATH.md)。

---

## 更新机制

> 应用内检查 / 下载 / 安装的**现状**。适用版本：**v3.3.8+**（以 `package.json` `version` 为准）。

### 用户看到的行为

| 场景 | 行为 |
| --- | --- |
| 启动应用 | 约 8 秒后检查一次 GitHub Releases；失败**静默**（仅运行日志） |
| 有新版（自动检查） | 右下角**非阻断卡片**（Dock）：版本对比 + 「立即更新 / 详情」 |
| 有新版（手动检查：设置面板点「检查更新」／Dock 点「详情」） | 打开**更新弹窗**：版本对比 + **更新说明**（Release body，滤掉 chore/ci）+ 下载进度 + 「立即更新 / 重启」 |
| Win NSIS / macOS pkg / Linux AppImage（桌面） | 支持后台自动下载 → 提示 **「重启以更新」** |
| **AE 面板（CEP，Windows）** | 面板内后台下**同一个官方安装包** → 主按钮 **「运行安装包」** → 系统提权并静默安装，桌面与 AE 扩展一次更完；装完**需重启 After Effects** |
| `npm run dev` | 不自动更新；弹窗提供「前往下载」 |
| **AE 面板（CEP，macOS）** | 下载同版 pkg，申请管理员权限并安装；完成后提示重启 After Effects |
| **设置面板（双端同一份 `globalSetting.vue`）** | **只做「检查更新」**：当前版本 + 检查按钮 + 状态行 + 自动检查开关。**不**承载下载进度与「立即更新 / 重启」——那些统一归更新弹窗（`IsUpdateDialog`），否则检查时弹窗与设置面板会同时「进行」，两处进度重复 |

### 架构（代码入口）

```text
渲染层（Home / globalSetting / 选路在 src/util/updateService.js）
    │
    ├─ 桌面（policy = full）
    │     └─► 主进程 background.js
    │           ├─ updater:meta / updater:check（Node HEAD 取 302 tag）
    │           ├─ src/util/autoUpdate.js：Windows/Linux electron-updater；macOS pkg 更新
    │           └─ shell:openExternal      白名单（仅本仓库 Release/下载 URL）
    │
    └─ CEP（policy = cep-installer；Windows/macOS + --enable-nodejs）
          └─► targets/cep/lib/cep-bridge.js 的 updater:* 通道
                ├─ updater:meta         读扩展目录 version.json（回 cep: true）
                ├─ updater:http         Node https，302 主路径不跟随重定向
                ├─ updater:download     流式整包 + 边写边算 sha512（约 100MB）
                ├─ updater:cancelDownload / updater:downloadState
                ├─ updater:runInstaller / installState 提权安装并读取完成状态
                └─ shell:openExternal   转 cep.util.openURLInDefaultBrowser
    ▼
GitHub Releases（latest*.yml + 安装包）
```

| 模块 | 职责 |
| --- | --- |
| `src/util/updateCheck.js` | 检查结果契约（available / latest / offline…）、更新说明过滤、缓存复用的 `reconcileCachedResult`；**`makeCheckDeps` 统一三端 deps**（桌面主进程 / CEP 桥 / 浏览器兜底），版本判定只有一份，差异仅在传输层与平台来源 |
| `src/util/updatePrefs.js` | 更新偏好存储：**按宿主分键** `updateCheck.app` / `updateCheck.cep`（桌面与 CEP 共用同一份 `localstorage.json`，必须分键） |
| `src/util/updateService.js` | 渲染层编排：选路（IPC / 桥）、何时弹窗、红点、自动下载、重启或起安装包 |
| `src/util/autoUpdate.js` | 桌面：`supportsAutoUpdate()` + `updater:autoState` / `autoDownload` / `quitAndInstall` |
| `src/util/cepUpdater.js` | CEP：把桥的 `updater:*` 接成 `checkUpdate` 的 `fetchHead/fetchJson/fetchText`，解析 `latest.yml` / `latest-mac-pkg.yml` 拿 sha512，映射下载态 |
| `targets/cep/lib/cep-bridge.js` | CEP 桥：`updater:*` 六个通道 + `shell:openExternal`；网络与落盘全在 Node，判定仍在渲染层 |
| `src/ui-next/components/IsUpdateDialog.vue` / `IsUpdateDock.vue` | 更新对话框 / 右下角非阻断卡片（按 `auto.mode === 'installer'` 切 CEP 终态文案） |
| `electron-updater@4.6.5` | 与 electron-builder 22 + GitHub provider 匹配 |

**环境变量（测试/镜像）**：`ISPARTA_UPDATE_REPO`、`ISPARTA_UPDATE_BASE_URL`、`ISPARTA_UPDATE_API_URL`、`ISPARTA_FORCE_VERSION`、`ISPARTA_CEP_UPDATE_POLICY`（`none` / `notify-only` 可强制 CEP 侧退回仅提示）。

**版本检查统一（桌面 ↔ CEP）**：判定逻辑只有一份 `checkUpdate`，三端各自只注入 `makeCheckDeps` 的宿主参数：

| 端 | current 来源 | 传输层 | 平台来源 |
| --- | --- | --- | --- |
| 桌面（主进程 `updater:check`） | `ISPARTA_FORCE_VERSION` ‖ `app.getVersion()` | node `http` | `process.platform/arch` |
| CEP（`cepUpdater.cepCheckUpdate`） | 桥 `updater:meta` = 扩展目录 `version.json` | 桥 `updater:http` | 桥 `updater:meta` |
| 浏览器兜底（预览/开发） | `brand.APP_VERSION` 等 | `fetch` | `ispartaAPI.process` |

> `current` 的两处来源（`app.getVersion()` 与扩展目录 `version.json`）在**正规安装后同为 Release 版本号**（`prepare-cep-payload` / 安装器写 `version.json`）。仅当扩展目录未被安装器刷新、或用户级/系统级存在两份不同版本副本时才会不一致。
>
> **唯一有意的行为差异**：更新偏好按宿主分键（`updateCheck.app` / `updateCheck.cep`，见 `updatePrefs.js`）——桌面与 CEP 共用同一份 `localstorage.json`，若共用一个键，一端点过「稍后」会连累另一端被节流、不再弹更新卡片。

### 构建与 Release 资产

| 端 | target | 自动更新 |
| --- | --- | --- |
| Windows | NSIS `.exe` | 是（`latest.yml`） |
| Linux | AppImage | 是（`latest-linux.yml`） |
| macOS | pkg（未签名） | 是（`latest-mac-pkg.yml`，系统提权安装） |

- `artifactName`: `isparta-next-${version}-${os}-${arch}.${ext}`  
- `package.json` **`name` / `productName`**: `isparta-next`（安装目录与显示名对齐）  
- CI 上传 `latest*.yml` + 版本化安装包 + 稳定别名（落地页 `latest/download/...`）

用户路径：已安装正式包 → 检测到新版 → 用户确认下载 → 校验 → 安装进度与结果 → 重启桌面或 After Effects。Windows/macOS 安装器检测到 After Effects 时同步安装同版 CEP；未安装则跳过。

### 落地页（与应用解耦）

- 地址：https://yancongya.github.io/iSparta-next/  
- 版本、发布日期、LINEAGE 更新日志：**运行时读 GitHub API**（`releases?per_page` + `latest`）  
- 浏览器 `sessionStorage` 缓存约 **15 分钟**，降低匿名 API 限流  
- 不依赖构建期 `releases.json` bake；HTML 静态版本仅作 API 失败时兜底  
- 发版提交带 `[skip ci]`，一般**不必**为版本号再部署 Pages  

搜索收录步骤见 [SEO_SUBMIT.md](SEO_SUBMIT.md)。

### 本地如何验证

```powershell
node scripts/updateCheck.l1.js     # 纯逻辑
node scripts/cepUpdater.l1.js      # CEP 适配层纯函数（latest.yml 解析 / 下载态映射 / 安装包落盘目录）
node scripts/l3-run.js             # fixture + HTTP 链路
# fixture：
node scripts/fixture-github.js     # FIXTURE_MODE=available|latest|offline|...
```

热更新请用 **Release 安装包**（NSIS/AppImage），不要用 `npm run dev`。

### 已知限制与后续

| 项 | 说明 |
| --- | --- |
| macOS 签名 | CI pkg 尚未签名，系统可能拦截；正式分发仍需 Developer ID Installer 签名与公证 |
| macOS 上的 CEP | 可从面板下载安装同版 pkg；需系统管理员授权，完成后重启 After Effects |
| CEP 侧整包下载 | AE 面板内下的是完整安装包（约 100MB），没有桌面 electron-updater 的 blockmap 差量；网络差时体验不如桌面 |
| AE 不随安装包重启 | 向导装完扩展目录已是新版，但面板内存里仍是旧代码 → 必须重启 After Effects（文案已含此提示） |
| Windows SmartScreen | 未签名 NSIS 仍可能拦截；签名见 [SIGNPATH.md](SIGNPATH.md) |
| 匿名 GitHub API | 落地页约 60 次/小时/IP；应用侧主路径用 302，API 仅用于 notes |
| 安装目录 | Windows 固定 Program Files / Common Files，macOS 固定 /Applications / 系统级 CEP；旧用户级 CEP 仅清理本扩展 |
| SignPath | 申请未完成前，SmartScreen 问题会存在 |

> Adobe 已公布 AE 的 UXP 公开测试计划与 CEP 退出时间表。当前安装器只检测并安装 CEP；未来 AE 不再提供 CEP 运行时后，需要独立的 UXP 宿主适配与安装包，不能把现有 CEP 压缩包改名使用。转换核与宿主桥的分层应继续保留。参见 [Adobe 官方路线图](https://blog.developer.adobe.com/en/publish/2026/09/investing-in-the-future-of-creative-cloud-extensibility-uxp-comes-to-our-flagship-applications) 与 [CEP 到 UXP 迁移指南](https://github.com/Adobe-CEP/CEP-Resources/blob/master/UXP-Migration-Guide/README.md)。

---

## 相关文档

| 文档 | 用途 |
| --- | --- |
| **本文** | 版本记录 + 更新机制现状 |
| [RELEASE.md](RELEASE.md) | 如何发版 |
| [SIGNPATH.md](SIGNPATH.md) | Windows 免费签名 |
| [SEO_SUBMIT.md](SEO_SUBMIT.md) | 落地页搜索收录 |
| [AGENTS.md](../AGENTS.md) | 开发 / commit / release 约定 |
| [README.md](../README.md#文档导航) | **完整文档导航**（现状 / 手册 / 进行中 / 归档） |
