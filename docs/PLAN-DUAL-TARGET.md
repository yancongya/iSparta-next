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
- CEP 适配层把合成原目录注入为 `.aep` 旁的合成名目录；`{srcPath}` 与其他变量都从这个上下文展开，AE PNG 序列帧与最终 APNG/GIF/WebP 共用解析后的任务输出目录。合成名中的文件系统非法字符会替换为下划线。
- 当前工程合成会同步为任务列表项；合成树勾选状态与任务选择状态联动，双击行会调用 AE 定位/打开合成。
- 合成树拖拽会写入自定义 MIME，`comp-source.js` 也保留 drop/paste 适配方法，但当前 `Home.vue` 的工作台 drop/paste 只处理文件导入，未调用这些合成适配方法；不能把合成拖拽或粘贴描述为已接通功能。
- 改动合成输入交互时，沿 `Home.vue`、`compTree.vue`、`src/cep/comp-source.js` 核对事件生产者、消费者和实际界面入口；函数存在不等于用户路径可用。

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
