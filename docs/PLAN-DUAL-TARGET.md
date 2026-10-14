# 双端实现状态：桌面 + AE CEP

> **状态：双端代码与构建流程已落地；Windows/macOS 与 After Effects 的实机安装、更新和转换验收由用户设备完成并记录。**
> 验收步骤见 [`ACCEPTANCE-RUNBOOK.md`](ACCEPTANCE-RUNBOOK.md)。本文记录当前结构与行为，不再保留过期实施方案。

## 1. 目标与边界

- 桌面版与 CEP 面板共用 Vue 2 工作台和 `src/util/processor/*` 转换核。
- Electron 主进程与 CEP Node/JSX 分别提供宿主桥；AE 的合成列表和渲染能力只放在宿主适配层。
- 同一任务模型和处理器负责压缩、格式转换、大小阈值与输出命名；CEP 不维护独立编码链。
- 桌面与 CEP 通过同一版本安装包更新；CEP 不单独启动 Electron 更新器。

## 2. 目录职责

| 路径 | 当前职责 |
| --- | --- |
| `src/ui-next/`、`src/components/` | 桌面与 CEP 共用工作台和业务组件 |
| `src/util/processor/` | 共用转换处理器 |
| `src/util/host-env.js`、`src/cep/` | 宿主能力与 AE 合成输入适配 |
| `src/cep/`、`targets/cep/jsx/` | CEP 入口、桥接和 AE JSX 脚本 |
| `targets/cep/ui/` | 受控 CEP UI 构建产物；源码变化后需同步构建 |
| `public/bin/` | 开发态工具，以及 CEP payload 的默认工具来源 |
| `static/bin/` | 转换器运行时搜索的 Electron 备用路径 |
| `scripts/dev/` | 统一预览、构建、体检入口及其 Windows 包装 |

不要因为 `public/bin/` 与 `static/bin/` 都有工具文件就直接删一份：运行时代码会搜索这两处，部分二进制版本也不同。若要调整，先变更并验证实际打包/查找策略。

## 3. CEP 合成输入现状

- CEP 启动或刷新任务视图时，会读取当前 AE 工程的合成列表并同步到任务列表；未保存工程无法提供可靠的合成目录，应先在 AE 保存工程。
- 合成树是现有合成的浏览和选择视图。空任务态点击面板会重新读取当前工程合成列表。
- 空任务态目前没有“勾选合成后加入任务”的可用入口；合成名粘贴、读取 AE 当前选中合成的输入适配函数也没有接入主界面事件。不要在 UI 文案或文档中把这些路径描述为可用功能。
- 改动这些输入能力时，先检查 `Home.vue`、`compTree.vue` 与 `src/cep/comp-source.js` 的实际事件调用关系，避免只存在适配函数却没有 UI 入口。

## 4. 安装与更新边界

- Windows 安装固定为系统级并请求 UAC；只有检测到 After Effects 才部署 CEP 到系统扩展目录，并清理本产品旧副本。
- macOS 使用 pkg 安装流程部署桌面与 CEP；桌面热更新完成后由安装/同步流程处理扩展。
- CEP 面板内更新使用同版官方桌面安装包；安装完成后按提示重启 After Effects。
- 当前实现细节以 [`AGENTS.md` §8.1](../AGENTS.md)、[`docs/CHANGELOG.md`](CHANGELOG.md)、`build/installer.nsh` 与 `scripts/mac-pkg/postinstall` 为准。

## 5. 现成命令

| 任务 | 命令 |
| --- | --- |
| CEP 面板预览 | `node scripts/dev/preview.js cep` |
| CEP 源码变更后构建 | `node scripts/dev/build.js cep` |
| 打包前检查 | `node scripts/dev/check.js pack` |
| 完整体检 | `node scripts/dev/check.js all` |
| 双端实机验收 | 按 [`ACCEPTANCE-RUNBOOK.md`](ACCEPTANCE-RUNBOOK.md) 操作并记录 |

静态构建、lint 和 CI 只能证明代码/产物通过相应检查，不能替代 Windows/macOS 安装以及 AE 内加载和渲染验收。
