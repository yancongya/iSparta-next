# 工具链校验与目标大小规划（已实现）

> 状态：**两条改进点均已实现并通过全量检测**（模板 / SCSS / Babel / 完整 CEP 构建 / lint）。
> 本清单保留原始对照与落地要点作为背景，「实现说明」记录最终落地方式与简化取舍。

## 对照表（原始需求背景）

| # | 改进点 | 参考做法 | iSparta 原现状 → 增量价值 |
| --- | --- | --- | --- |
| 1 | **工具链完整性校验 + 可信安装** | 编码器打成 bundle，清单带 SHA256 + 大小 + 白名单，校验不过就重装；staging 目录 + marker 保证原子切换、断点可恢复 | `Action.bin()` 原是"多候选路径里第一个存在就用"，不校验哈希，且工具散落在 `public/bin`、`static/bin`、CEP `ui/bin` 多处。编码器损坏 / 版本漂移 / 被篡改不会被发现 |
| 2 | **目标大小"前置规划"** | 在压缩之前把目标体积翻译成参数组合，UI 实时预估；压缩只是执行计划 | `sizeGate.js` 原是事后策略：压完发现超限，再循环降质量重压（最多 N 次）。若能在首压前按目标体积估算一个起始质量，可显著减少重试次数和大动画耗时 |

---

## 1. 工具链完整性校验（实现说明）

**涉及文件**：
- `src/util/processor/toolManifest.js` — 清单，按副本分组（desktop / static / cep），每工具 `sha256|size`，含平台与文件名白名单。
- `src/util/processor/sha256.js` — 纯 JS SHA-256，零依赖、三端可用；已对照 Node crypto 验证（含二进制与中文）。
- `src/util/processor/toolIntegrity.js` — 校验核心：`verifyTool` / `verifyToolchain` / `diagnoseToolchain` / `restoreTool`。
- `src/util/processor/action.js` — `Action.bin()` 接入软校验：命中候选后核对清单，损坏则跳过找健康副本；全损坏时用首个存在的兜底，**绝不阻断转换**；进程内缓存避免重复读盘。
- `src/components/globalSetting/globalSetting.vue` + `.scss` — 「关于」页只读诊断卡片（平台 / 通过数 / 异常明细 / 重新校验）；三语各补 11 个文案 key。

**关键发现**：清单生成时发现 webp 三件套（`cwebp`/`dwebp`/`webpmux`）在 `public/bin` 与 `static/bin` 的哈希不同（12 处）。这正是"版本漂移"的真实案例，故清单按副本分别记录，校验时按候选所在副本匹配期望值。

**实现取舍（务实简化）**：
- **不扩展 IPC 桥契约**：`docs/BRIDGE.md` 是冻结清单。哈希用纯 JS 在渲染层算，读字节走既有 `readFileSync(p)`（无 enc → 字节，三端签名一致），因此 Electron / CEP / 浏览器 mock 全兼容，无需改 preload / background / cep-bridge。
- **软校验而非强制重装**：iSparta 是随包分发的离线工具，没有运行时下载安装流程。因此"校验不过就重装"落地为"跳过损坏副本 → 找其它健康副本 → 全损坏则告警兜底"；`restoreTool` 提供跨副本恢复能力，供后续按需调用。
- **未做 staging + marker 原子切换**：该机制服务于"运行时下载/安装"，与当前随包分发模型不匹配，投入大于收益，暂不引入。
- 校验结果走应用日志与设置面板卡片，不改变转换流程与用户配置。

## 2. 目标大小前置规划（实现说明）

**涉及文件**：
- `src/util/sizePlanner.js` — 纯函数：经验模型 `体积 ≈ 源体积 × (质量/100)^k`（k 按格式取 1.15~1.6），由目标体积反推保守起始质量；`safety=0.9`、下限 20，宁可估低让 `sizeGate` 兜底。
- `src/util/processor/index.js` — 首压前 `applyStartPlan()`：sizeLimit 开启时按目标体积下调起始质量（只降不升，改的是转换副本，不碰 store 用户配置）。
- `src/util/processor/sizeGate.js` — 重压基线 `plannedRetryBaseline()`：把规划值作为超限重压的起点，减少"压→测→降→再压"的轮次。

**实现取舍**：
- 规划只作**起始建议**，不替换 `sizeGate` 事后重试——两者并存更稳。
- 用户显式设定的低质量不被抬高；首压本就达标时规划完全不介入。
- 估算模型为量级经验值，未做大规模样本校准；目标极小（Q=1 仍超限）时 `feasible=false`，仍由 `sizeGate` 按真实大小判定。

## 已明确放弃（记录原因，避免重复讨论）

| 点 | 放弃原因 |
| --- | --- |
| CLI / MCP | 转换核深度耦合 Vuex store + IPC，解耦工作量大；一次性任务模型收益有限 |
| 文件夹监听 / 剪贴板常驻监听 | 已有粘贴 + 拖拽导入，常驻监听会改变产品形态 |
| staging + `ready.json` 原子切换 | 服务于运行时下载安装，与随包分发模型不匹配，投入大于收益 |
