---
feature: electron-upgrade
status: designed
updated: 2026-09-10
branch: feat/electron-upgrade
commits: aa7c6e9..aa7c6e9
---

# Electron Phase 2：升级主版本与进程隔离

## Report

## [S1] Problem

Phase1 已去掉 `remote`，但应用仍停在 **Electron 13**，且 `nodeIntegration: true`、`contextIsolation: false`、无 sandbox。安全补丁跟不上，后续功能升级也被锁死。

用户选择：**Electron 22–28** 档，尽量用该区间内较新且与现有 `vue-cli-plugin-electron-builder@2` 可搭配的主版本（优先试 **28**，失败再降）。

渲染进程大量 `require('fs'/'path')`、`os.tmpdir`、转换链路在 renderer 内跑——关闭 `nodeIntegration` 不能一刀切。

## [S2] Design

**目标架构（分里程碑，同一分支）**：

| 里程碑 | Electron | nodeIntegration | contextIsolation | 说明 |
| --- | --- | --- | --- | --- |
| M1 | 22–28（优先 28） | 仍 true | 仍 false | **先跑通新主版本**，行为与 phase1 对齐 |
| M2 | 同 M1 | **false** | **true** + sandbox | 引入 preload，Node 能力白名单化 |
| M3 | 同上 | — | — | 转换/文件系统能力迁到主进程或受控 API，renderer 去掉裸 `require('fs')` |

**M1 约定**：
- 只改 `package.json` 的 `electron`（及必要的 builder/plugin 兼容补丁），**不改**业务 IPC 契约（沿用 phase1）。
- 若 `vue-cli-plugin-electron-builder` 无法服务目标版本，允许小范围 patch 配置；若完全不可用，记录 blocker，**不**在同一任务里强行换 Forge（另开）。
- `NODE_OPTIONS=--openssl-legacy-provider`：webpack4 仍可能需要；Electron 子进程继续清空该 env（phase1 已有）。

**M2 约定**：
- 新增 `preload.js`，`contextBridge.exposeInMainWorld('ispartaAPI', …)` 仅暴露：dialog open、menu popup、shell showItem、以及后续 fs/job API 桩。
- `webPreferences`: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`（若 sandbox 与现有 native/asar 冲突，可先 false 并记风险）。
- 渲染侧所有 `require('electron')` 改为 `window.ispartaAPI`；无 API 则先在 preload 内完成再桥接。

**M3 约定（转换链路）**：
- 扫描/读 PNG、写临时目录、spawn 编码器等迁到主进程 `ipcMain.handle('fs:…')` / `job:run`，或 `utilityProcess`。
- 本阶段验收以「与 phase1 相同的用户路径」为准，不要求重构 UI。

**错误行为**：IPC 失败返回 `{ ok: false, error }`；转换失败仍写入 process.schedule=-1。

**测试边界**：与 phase1 相同的手动冒烟清单 + 打包 `npm run build:windows` 一次（若环境允许）。

## [S3] Out of Scope

- Electron 33+ / 最新、全面换 Electron Forge（除非 M1 blocker 强制）
- Vue 3 / Vite / 重写 UI
- 业务功能增强与 issue 功能修复
- 代码签名、自动更新

## Tasks

- [ ] T1: M1 升级 electron 依赖到 22–28 内可运行版本 — acceptance: `npm run dev` 可启动 iSparta-next 窗口；phase1 的拖拽/打开目录/右键可用 (covers: S2)
- [ ] T2: M1 记录兼容性与必要配置补丁 — acceptance: spec/提交说明中写明所选版本与 plugin 兼容情况 (covers: S2; depends: T1)
- [ ] T3: M2 添加 preload + contextBridge API 骨架 — acceptance: preload 存在且 ispartaAPI 可在 renderer 访问 (covers: S2; depends: T1)
- [ ] T4: M2 切换 webPreferences 为 isolation/sandbox 并改造 electron 调用 — acceptance: 无 `require('electron')` 在 renderer；窗口仍可完成 phase1 冒烟路径 (covers: S2; depends: T3)
- [ ] T5: M3 将 fs/转换 Node 依赖迁出 renderer — acceptance: renderer 无裸 `require('fs')`；PNGs→APNG 转换成功 (covers: S2; depends: T4)
- [ ] T6: 全量人工冒烟 + 视环境打包验证 — acceptance: 冒烟清单通过；build 可选 (covers: S2; depends: T5)
