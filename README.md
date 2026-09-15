# iSparta-next

**中文** | [English](README.en.md)

[![Latest release](https://img.shields.io/github/v/release/yancongya/iSparta-next?include_prereleases&label=Release)](https://github.com/yancongya/iSparta-next/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/yancongya/iSparta-next/total.svg)](https://github.com/yancongya/iSparta-next/releases)
[![Build Multi-Platform](https://img.shields.io/github/actions/workflow/status/yancongya/iSparta-next/build.yml?branch=master&label=CI)](https://github.com/yancongya/iSparta-next/actions/workflows/build.yml)
[![Electron](https://img.shields.io/badge/Electron-28.3.3-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-2.x-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)

**iSparta-next** 是在停更多年的经典 [iSparta](https://github.com/iSparta/iSparta) 基础上重构的桌面动图转换工具，支持 **APNG / Animated WebP / GIF / PNG 序列** 之间的互转与压缩。

> **[点此前往 Releases 下载安装包 →](https://github.com/yancongya/iSparta-next/releases)**  
> 技术栈：Electron 28 + Vue 2 · 支持 Windows / macOS / Linux

## 项目背景：为什么还有 iSparta-next

**原版 [iSparta](https://github.com/iSparta/iSparta) 已长期停止维护**——Electron 主版本停在旧内核、界面与转换链路多年未迭代，大量历史 Issue（帧错乱、路径打开失败、存储异常、打包过时等）无人修复，安全补丁也跟不上。

本仓库 **不是** 原版的简单补丁，而是在社区 fork（主要基于 [bigxixi/iSparta](https://github.com/bigxixi/iSparta)，该 fork 已完成 libwebp 安全升级、Electron 6→13、CI 迁移等必要基建）之上 **再次 fork 后做的前后端重构**，代号 **iSparta-next**：

- **后端 / 运行时重构**：Electron 13 → 28，去掉 `remote`，开启 `contextIsolation` / `sandbox`，文件与进程能力收拢到主进程 IPC
- **前端整体重做**：弃用 Element UI，自研设计系统与两栏工作台，补齐主题、动效、对比等现代工具体验
- **功能增量**：输出大小阈值、输出路径模板、粘贴导入、前后对比滑块等原版没有的能力
- **工程可维护性**：GitHub Actions 多平台构建、Windows 免签名本地打包、规格文档与升级路线归档

### 与旧版 / 中间 fork 的关系

| 来源 | 状态 | 相对原版的主要动作 | 与本仓库关系 |
| --- | --- | --- | --- |
| [iSparta/iSparta](https://github.com/iSparta/iSparta)（原版） | **长期停更** | 经典 APNG/WebP 转换工具；大量 bug 未修 | 产品形态来源，**不建议再直接使用** |
| [Xheldon/iSparta](https://github.com/Xheldon/iSparta) | 社区维护中 | 修帧乱序等问题；部分界面修补 | 历史参考之一 |
| [bigxixi/iSparta](https://github.com/bigxixi/iSparta) | 社区 fork | libwebp 1.5（修 CVE-2023-4863）、Electron 6→13、Vue CLI 4、`execFile` 防注入、存储/锁死修复、GitHub Actions | **本仓库的直接上游** |
| **本仓库 iSparta-next** | **当前维护版** | 见下方「相对旧版：修了什么 / 多了什么」 | 在 bigxixi 基建上完成前后端重构与功能扩展，安装包见 [Releases](https://github.com/yancongya/iSparta-next/releases) |

### 相对旧版：修了什么

| 类别 | 旧版问题 | iSparta-next 现状 |
| --- | --- | --- |
| 安全 | 依赖 `electron.remote`；渲染进程可裸调 Node；命令拼接有注入风险 | IPC + preload 白名单；`contextIsolation` / `sandbox` / `nodeIntegration:false`；`execFile` 受控执行 |
| 运行时 | Electron 停在旧主版本，安全补丁缺失 | **Electron 28.3.3** |
| 依赖安全 | 旧 libwebp 存在高危漏洞（CVE-2023-4863 等） | 继承上游升级的 **libwebp 1.5** 及对应二进制 |
| 帧序 | 导入/打开目录时偶发帧错乱、乱序 | 自然排序补全打开目录与拖拽路径；同树 APNG 去重 |
| Windows 路径 | 「打开原目录」在 Windows 下路径分隔符异常 | 已兼容修复 |
| 存储 / 状态 | 缓存读空、转换锁死、导入 options 共享引用污染 | 存储改主进程实现；转换锁与缓存恢复加固；导入实例隔离 |
| 命名 | 强制/自动追加 `_apng` 后缀，输出位置也不直观 | 默认后缀留空；首个输出预设直接写源目录（不再强行建 `/output`） |
| 打包 | Travis/AppVeyor 失效；Windows 无签名环境易卡 | GitHub Actions；本地 `electronDist` + 跳过签名，`build:windows` 可出包 |

### 相对旧版：多了什么功能

原版没有、本仓库新增或重做后的产品能力：

1. **输出大小阈值**  
   默认 1MB；超出可警告 / 自动删除 / 按步长自动降质量重压，适配贴纸与平台体积上限。

2. **输出路径策略 + 变量模板**  
   源目录 / 旁级目录 / 自定义目录；支持 `{srcPath}` `{srcName}` `{srcParent}` 等路径变量，批量导出更可控。

3. **前后对比滑块**  
   转换完成后点击缩略图，可滑动（或键盘微调）对比原图与输出效果。

4. **粘贴导入**  
   除拖拽、打开目录外，支持直接粘贴截图入队。

5. **亮 / 暗主题（含跟随系统）**  
   顶栏一键切换；输出设置、弹窗、开始按钮等全套界面同主题。

6. **自研 UI 工作台（替换 Element UI）**  
   两栏布局（任务列表 + 输出设置）、封面 1:1 缩略图、悬停预览、折叠面板、进度光带、批量统计、设计 token 化，降低第三方组件库耦合。

7. **交互与动效增强**  
   列表入场、数字滚动、完成彩带、拖放反馈；尊重 `prefers-reduced-motion`；另有像素小精灵彩蛋。

8. **逐帧延时配置**  
   PNG 序列可单独调整每帧 delay，不再只能用全局帧频。

9. **全局默认设置**  
   预设输出格式、质量、后缀、大小阈值等，减少重复配置。

10. **多任务批量工作流强化**  
    多选、批量开始、统一输出到目录、失败/成功统计、打开输出目录等路径更完整。

> 详细阶段说明见 [`docs/compose/ROADMAP-isparta-next.md`](docs/compose/ROADMAP-isparta-next.md) 与 `docs/compose/spec/` 下各特性规格。

## 截图

| 空状态（拖放 / 粘贴导入） | 主界面（任务 + 输出设置） |
| :---: | :---: |
| <img src="public/screenshot/empty.png" alt="空状态：拖放、粘贴、点击打开目录" width="480"> | <img src="public/screenshot/main.png" alt="主界面：任务列表与输出设置" width="480"> |

| 默认设置 |
| :---: |
| <img src="public/screenshot/settings.png" alt="默认设置：语言、主题、帧频、输出路径与大小阈值" width="480"> |

## 下载

请直接到 **[Releases](https://github.com/yancongya/iSparta-next/releases)** 页面下载最新安装包。

| 平台 | 产物 | 架构 |
| --- | --- | --- |
| Windows | `.zip` | x64 |
| macOS | `.zip`（内含 `.app`） | x64 / arm64 |
| Linux | `.tar.gz` | x64 |

三端均由 GitHub Actions 构建。macOS 包为 **未签名** 构建：解压后若系统拦截，可在「系统设置 → 隐私与安全性」中允许打开，或对 App 执行 `xattr -dr com.apple.quarantine`。

> 需要自己编译或参与开发，请往下看「快速开始」。

## 功能

### 格式转换

| 输入 | 输出 | 说明 |
| --- | --- | --- |
| PNG 序列 | APNG | 多帧合并为动图，可设帧频、循环次数；支持逐帧延时 |
| GIF | APNG | 无损 / 可控质量转 APNG |
| WebP | APNG | 动图 WebP 转 APNG |
| APNG | Animated WebP | 可设循环、无损、压缩质量 |
| APNG | GIF | APNG 转 GIF |
| APNG | APNG | 无损 / 有损压缩，减小体积 |

### 工作流能力

- **批量处理**：一次导入多个任务，各自独立配置，支持批量开始与统一输出目录
- **拖拽 / 粘贴导入**：拖入文件或文件夹，或直接粘贴截图
- **输出路径模板**：源目录、旁级目录或自定义目录，支持 `{srcPath}` `{srcName}` `{srcParent}` 等变量
- **输出大小阈值**：默认 1MB，可警告、自动删除，或按步长自动降质量重压
- **前后对比**：转换完成后可滑动对比原图与结果
- **亮 / 暗主题**：亮色、暗色、跟随系统
- **多语言**：简体中文、繁體中文、English
- **默认设置**：全局预设输出格式、质量、后缀等，减少重复配置

## 环境要求

- [Node.js](https://nodejs.org/)（建议 16+，与 CI 一致）
- npm
- Linux 额外依赖（部分原生二进制需要）：

```bash
sudo apt-get install libpng16-dev
```

## 快速开始

```bash
# 克隆本仓库（iSparta-next）
git clone https://github.com/yancongya/iSparta-next.git
cd iSparta-next

# 安装依赖
npm install

# 开发模式（Electron 调试窗口 + 开发服务器）
npm run dev
```

## 构建

```bash
# 三端（mac / win / linux）
npm run build

# 仅 Windows
npm run build:windows
```

构建产物输出在 `dist_electron/`。

### 打包说明

- 使用 `electron-builder`，配置见 [`electron-builder.yml`](electron-builder.yml)
- 打包时优先使用本地已安装的 Electron（`electronDist`），避免重复下载
- Windows 构建默认跳过代码签名（`signAndEditExecutable: false`）
- 应用 ID：`io.github.isparta`

### CI 与发版

仓库里有两条 Actions 工作流：

| 工作流 | 文件 | 触发 | 作用 |
| --- | --- | --- | --- |
| **Build Multi-Platform** | [build.yml](.github/workflows/build.yml) | push `master` / 手动 | 构建 Win/Linux/macOS Artifact（约 7 天），**不发 Release** |
| **Release** | [release.yml](.github/workflows/release.yml) | 手动 `workflow_dispatch` | 自动升版本 → 提交并打 tag → 构建三端 → 创建 GitHub Release |

#### 日常构建

推送到 `master` 会自动出测试包；也可在 Actions 页面手动跑 `Build Multi-Platform`。

#### 正式发版（本地 CLI 触发，云端 CI/CD 打包）

本地不构建安装包，只触发 GitHub Actions：

```powershell
.\scripts\release.ps1 -Bump patch
# 或 minor / major，可加 -DryRun、-Prerelease
```

也可网页：**Actions → Release → Run workflow**，或：

```powershell
gh workflow run release.yml -R yancongya/iSparta-next -f bump=patch -f prerelease=false -f dry_run=false
```

选择：
   - **bump**：`patch` / `minor` / `major`（从当前 `package.json` 版本递增）
   - **prerelease**：勾选后在 GitHub 上标为 Pre-release（测试包可勾，正式版可不勾）
   - **dry_run**：只试算版本并构建，不提交、不打 tag、不发 Release

运行成功后会：
   - 更新 `package.json` / `package-lock.json` 版本号
   - 提交 `chore(release): vX.Y.Z [skip ci]` 并创建 `vX.Y.Z` 标签
   - **自动汇总**上个 tag 以来的 commit（feat/fix/docs/ci 等）生成 Release Notes
   - 用该版本号在 GitHub runner 上构建 Win / Linux / macOS，资产命名为：
     - `isparta-<ver>-win-x64.zip`
     - `isparta-<ver>-linux-x64.tar.gz`
     - `isparta-<ver>-mac-arm64.zip`
     - `isparta-<ver>-mac-x64.zip`

> 说明：发版提交带 `[skip ci]`，避免和日常 CI 重复构建。  
> macOS 包不在 CI 内产出，需要本地 `npm run build` 后手动补传到同一 Release。  
> 若 `master` 开了分支保护禁止 bot 直推，请改用 Personal Access Token 配 `secrets.RELEASE_TOKEN`，或先临时放开保护；当前工作流默认使用 `GITHUB_TOKEN`。

不建议再手动打 `v*` 标签「碰运气」发版：**只有 Release 工作流会创建公开 Release**。

精简操作清单见 [`docs/RELEASE.md`](docs/RELEASE.md)。

## 项目结构

```text
iSparta-next/
├── src/
│   ├── background.js          # Electron 主进程（窗口、IPC、菜单、文件协议）
│   ├── preload.js             # contextIsolation 下的安全桥接
│   ├── main.js / App.vue      # 渲染进程入口
│   ├── ui-next/               # 新版界面（设计系统组件、主题、Home）
│   ├── components/            # 业务组件（列表、设置、对比、延时等）
│   ├── util/processor/        # 各格式转换器与大小阈值策略
│   ├── store/                 # Vuex
│   ├── locales/               # i18n 文案
│   └── router.js
├── static/bin/                # 各平台原生转换二进制
│   ├── win32/  win64/  mac/
├── public/                    # 静态资源、图标、截图
├── test/                      # 测试样例（PNG / GIF / APNG / WebP）
├── docs/                      # 升级路线与规格说明
├── electron-builder.yml
└── vue.config.js
```

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发运行 |
| `npm run build` | 构建 mac + win + linux |
| `npm run build:windows` | 仅构建 Windows |
| `npm run lint` | ESLint / Vue 检查 |

## 技术栈

- **桌面**：[Electron](https://www.electronjs.org/) 28
- **前端**：Vue 2 · Vue Router · Vuex · vue-i18n · Sass
- **工程**：Vue CLI 4 · vue-cli-plugin-electron-builder · electron-builder
- **转换引擎**：APNG Tools（`apngasm` / `apngdis` / `apngopt` / `apngquant` 等）、libwebp（`cwebp` / `dwebp` / `webpmux`）、`gif2apng` / `apng2gif`

## 安全架构（iSparta-next 演进）

本仓库在经典 iSparta 基础上完成了 Electron 现代化：

- 禁用 `remote`，对话框 / 右键菜单等能力走主进程 IPC
- `contextIsolation: true` · `nodeIntegration: false` · `sandbox: true`
- preload 白名单暴露 API；文件读写与 `execFile` 倾向主进程完成
- 渲染层通过 `isparta-file` 协议安全读取本地帧缩略图

详细阶段计划见 [`docs/compose/ROADMAP-isparta-next.md`](docs/compose/ROADMAP-isparta-next.md)。

## 语言

界面语言可在设置中切换：

- 简体中文
- 繁體中文
- English

## 贡献

欢迎提交 Issue 与 Pull Request。

1. Fork 本仓库并创建功能分支
2. 本地 `npm install && npm run dev` 验证
3. 保持 `npm run lint` 通过
4. 描述清楚变更动机与验证方式

## 维护与致谢

### iSparta-next 当前维护

- [yancongya](https://github.com/yancongya) — 本仓库（前后端重构、新功能与发版筹备）

### 原版作者

- [jeakey](https://github.com/jeakey)
- [ccJUN](https://github.com/ccJUN)
- [yikfun](https://github.com/yikfun)

### 历史贡献者 / 上游 fork

- [DreamPiggy](https://github.com/dreampiggy)
- [Xheldon](https://github.com/Xheldon)
- [bigxixi](https://github.com/bigxixi)

感谢所有为 iSparta 及其社区 fork 提交过修复与改进的贡献者。

### 开源组件致谢

- [apngasm](http://apngasm.sourceforge.net/)
- [APNG Optimizer](https://sourceforge.net/projects/apng/files/APNG_Optimizer/)
- [apng2webp](https://github.com/Benny-/apng2webp)
- [pngout](http://advsys.net/ken/utils.htm)
- [pngquant](https://pngquant.org/)
- [libwebp](https://developers.google.com/speed/webp/)

## License

请以仓库内实际许可文件为准；历史项目沿用 iSparta 开源许可。
