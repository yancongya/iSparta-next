---
feature: frontend-redesign
status: designed
updated: 2026-09-10
branch: feat/frontend-redesign
commits: TBD
---

# 前端整体交互重设计（保留接口）

## Report

## [S1] Problem

iSparta-next 已完成 Electron 28 + IPC/preload 改造，但 UI 仍是 Element UI 2 的旧三栏布局：任务列表、输出设置、转换状态反馈弱，长期维护成本高。用户要求：**整体重做交互**，**保留接口**（store 语义、`ispartaAPI`、processor），并希望**长期稳定**，可不依赖第三方组件库。

参考项目：
- `REDACTED_REF_PROJECT\image-compression`：CSS 变量设计 token、暗色卡片、自研控件
- `REDACTED_REF_PROJECT\image-compression-tool-master`：Vue3 + Vite、Uploader / Controls / Preview 分区、进度与统计清晰

## [S2] Design

**技术栈（长期）**：**Vue 3 + Vite + TypeScript（可选）+ 自研设计系统**，不引入 Element UI。

**保留的接口层**（新 UI 只消费，不改语义）：
- Vuex 现有 action/getter 形状（或加一层 pinia adapter 映射同一 API）
- `window.ispartaAPI`（dialog/fs/ipc/job）
- `processor` 入口与 `item.options` / `item.basic` / `item.process` 数据结构
- 存储键：`globalSetting` / `iSparta-item`

**信息架构（交互）**：
1. **顶栏**：产品名、语言、全局设置、关于  
2. **主区左**：拖放导入区 + 任务队列（缩略图、类型、状态、进度、多选）  
3. **主区右**：选中任务的输出设置（格式、帧率、循环、质量、输出名）  
4. **底栏**：数量、全选、批量开始/删除  
5. **空状态**：大拖放区（参考 compression-tool 的 Uploader）  
6. **转换中**：行内进度 + 全局队列指示（参考 progress overlay，但不挡操作）

**视觉与设计（frontend-design skill）**：
- **方向**：桌面「生产工具」——**工业/实用向暗色工具台**，避免 SaaS 营销页与通用 AI 风
- **Token 复用**：从 `REDACTED_REF_PROJECT\image-compression\css\style.css` 抽取 `--primary-*`、`--dark-bg/panel/card`、间距/圆角，落到 `src/ui-next/styles/tokens.css`
- **交互复用**：`image-compression-tool-master` 的 Uploader 拖放态、Controls 分区、列表 + 进度语义，改为绑定 iSparta store / ispartaAPI
- **组件**：自研 `DropZone` / `TaskRow` / `FormatToggles` / `Progress` 等，不引 Element
- **记忆点**：任务列表「胶片帧」缩略图条 + 转换进度光带

**工程落地**：
- 新 worktree `feat/frontend-redesign`，基于 `feat/electron-upgrade`
- 渐进：`src/ui-next/` 新壳 + 入口开关，旧 `views/LandingPage` 可回退
- 先用 Vue2 SFC 跑通 Electron；Vue3+Vite 在 P5 后独立迁移（接口不变）

## [S3] Out of Scope

- 转换算法、Electron 主版本、sandbox 策略（属 P3–P5）
- Element UI 深度定制 / 仅换皮不改信息架构
- 移动端响应式

## Tasks

- [ ] T1: 设计 token + 基础布局壳（顶栏/主区/底栏）— acceptance: 空状态拖放区可见，无 Element 依赖 (covers: S2)
- [ ] T2: 任务列表与多选、状态/进度 — acceptance: 能显示 store.items，勾选/删除可用 (covers: S2; depends: T1)
- [ ] T3: 输出设置面板对接 editOptions — acceptance: 改格式/帧率写回 store，开始按钮逻辑正确 (covers: S2; depends: T1)
- [ ] T4: 导入链路对接 dialog/drag + file.js — acceptance: 打开目录/拖拽入队与旧版一致 (covers: S2; depends: T2)
- [ ] T5: 转换启动与进度展示 — acceptance: 调 processor，进度更新 (covers: S2; depends: T3, T4)
- [ ] T6: 与旧页面可切换/回归对比 — acceptance: 关键路径冒烟通过 (covers: S2; depends: T5)
