# 双端一体验收清单（桌面 + AE CEP）

> 配套：`docs/PLAN-DUAL-TARGET.md`、`targets/cep/README.md`、`AGENTS.md`  
> **逐步操作**见 [ACCEPTANCE-RUNBOOK.md](ACCEPTANCE-RUNBOOK.md)。  
> 真机项需人工；自动化项以命令退出码为准。

## A. 静态 / 构建（可脚本）

| # | 项 | 命令 / 检查 | 结果 |
|---|----|-------------|------|
| A1 | Lint | `npm run lint` | ☐ |
| A2 | CEP 面板构建 | `npm run build:cep` → 存在 `targets/cep/ui/index.html` | ☐ |
| A3 | CEP payload | `npm run prepare:cep` → `build/cep-payload/io.github.isparta-next/` | ☐ |
| A4 | CEP zip | `npm run pack:cep` → `dist/isparta-next-cep-*.zip` | ☐ |
| A5 | 打包门禁 | `npm run doctor:pack` | ☐ |
| A6 | manifest | MainPath=`./ui/index.html`，Id=`io.github.isparta-next` | ☐ |
| A7 | 编码唯一 | 无 cli 自研编码；调用 `src/util/processor/*` | ☐ |

> 本机执行统一走 `scripts/dev/` 入口（见 `AGENTS.md` §1.1）：A1 / A5 可一次跑完 —— `node scripts/dev/check.js all`（lint + `doctor:pack` + 端口占用）；A2 产物用 `node scripts/dev/build.js cep` 重建。

## B. 桌面回归

| # | 项 | 步骤 | 结果 |
|---|----|------|------|
| B1 | 启动 | `npm run dev` 正常进工作台 | ☐ |
| B2 | PNG 序列→APNG | 导入序列，转换成功 | ☐ |
| B3 | APNG→WebP/GIF | 各出一份 | ☐ |
| B4 | 阈值/路径 | sizeLimit、输出路径模板仍可用 | ☐ |

## C. AE 扩展（开发态 junction）

| # | 项 | 步骤 | 结果 |
|---|----|------|------|
| C1 | 挂载 | junction/symlink + `PlayerDebugMode`（见 `targets/cep/README.md`） | ☐ |
| C2 | 面板 | AE → 窗口 → 扩展 → **iSparta** | ☐ |
| C3 | 列合成 | 面板列出工程合成（名称/尺寸/fps） | ☐ |
| C4 | 选合成导出 | 选合成 → PNG 序列 → **APNG** 成功 | ☐ |
| C5 | WebP/GIF | 同序列再出 WebP、GIF | ☐ |
| C6 | 与桌面一致 | 同序列参数下走同一 processor 路径（无第二套压缩） | ☐ |

## D. 一体安装（NSIS）

| # | 项 | 步骤 | 结果 |
|---|----|------|------|
| D1 | 出包 | `node scripts/dev/build.js win`（= `npm run build:windows` + 删除守卫豁免）成功 | ☐ |
| D2 | 只装桌面 | 取消 AE 扩展 → 无 CEP 目录、有桌面 | ☐ |
| D3 | 双装 | 勾选 AE 扩展 → `%APPDATA%\Adobe\CEP\extensions\io.github.isparta-next` | ☐ |
| D4 | version.json | 扩展目录内有版本清单 | ☐ |
| D5 | AE 可见面板 | 安装后无需手动 junction | ☐ |
| D6 | 卸载 | 清扩展目录与应用；桌面卸载完整 | ☐ |

## E. 发布链路（可 dry_run）

| # | 项 | 步骤 | 结果 |
|---|----|------|------|
| E1 | CI build | push 后 Artifact 含 `isparta-next-*-cep-{win,mac}.zip` | ☐ |
| E2 | release dry_run | `scripts/release.ps1 -DryRun` 或 workflow dry_run | ☐ |
| E3 | Release 资产 | 桌面包 + CEP zip + 稳定别名（仅用户点名发版时） | ☐ |

## 签字

- 日期：
- 验收人：
- 备注：
