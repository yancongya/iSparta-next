# 真机验收步骤（桌面 + AE CEP）

> 目标：在本机验证「完整工作台共用 + AE 合成注入 + 同一转换核 + 双端一起更」。  
> 环境假设：Windows 10/11、已装 After Effects、仓库在 `F:\iSparta`。  
> **本机命令优先走统一入口**（`scripts/dev/preview.js` / `build.js` / `check.js`，见 `AGENTS.md` §1.1）——
> 它们内置了删除守卫豁免与产物定位，比裸跑 `npm run build:*` 少踩坑。

---

## 0. 准备（一次性）

| # | 步骤 | 期望 |
|---|------|------|
| 0.1 | `npm ci`（或已装依赖） | 无报错 |
| 0.2 | `npm run lint`（或 `node scripts/dev/check.js lint`） | DONE |
| 0.3 | **开发默认 HMR**：`npm run dev:cep` | MainPath=`./dev-hmr.html`→8082 |
| 0.4 | 拷编码器到 `targets/cep/bin/win64` | 见 `bin/README.md` |
| 0.5 | 出包才：`dev:cep:off` + `build:cep` + `prepare:cep` | `build/cep-payload/…` |

> **CEP 无 Ctrl+R**：刷新=**关面板再开**；改 `src/**` HMR 自动热更。  
> **MainPath 禁 http://**；**禁 mock**；开发服后台常驻。

---

## A. 开发态 CEP（junction，最快）

### A1. 挂载扩展

```powershell
node scripts/dev/build.js cep     # 等价 npm run build:cep，重建 targets/cep/ui
$src = "F:\iSparta\targets\cep"
$dst = Join-Path $env:APPDATA "Adobe\CEP\extensions\io.github.isparta-next"
$systemDst = Join-Path $env:CommonProgramFiles "Adobe\CEP\extensions\io.github.isparta-next"
if (Get-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue) {
  throw "目标已存在，请先人工确认它是本仓库的开发挂载；本手册不会删除或覆盖现有扩展：$dst"
}
if (Get-Item -LiteralPath $systemDst -Force -ErrorAction SilentlyContinue) {
  throw "检测到系统级正式扩展。请勿再挂载同 ID 的用户级副本：$systemDst"
}
New-Item -ItemType Junction -Path $dst -Target $src
```

### A2. 未签名调试开关

```powershell
foreach ($v in 6..14) {
  $k = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
  New-ItemProperty -Path $k -Name PlayerDebugMode -Value 1 -PropertyType String -Force | Out-Null
}
```

### A3. 面板与导入

| # | 步骤 | 期望 |
|---|------|------|
| A3.1 | 打开 AE 工程（含 2+ 合成） | 工程正常 |
| A3.2 | 窗口 → 扩展 → **iSparta** | 出现**完整工作台**（非精简单栏） |
| A3.3 | 打开合成树并刷新 | 显示工程合成名称、尺寸、fps、帧数；任务列表按工程合成同步 |
| A3.4 | 在合成树勾选/取消合成 | 对应任务的选择状态同步；切回任务列表后核对 |
| A3.5 | 双击合成树中的一行 | AE 尝试定位/打开该合成 |

### A4. 命名 / 路径（与桌面同规则）

| # | 步骤 | 期望 |
|---|------|------|
| A4.1 | 右栏「输出名字」 | 拆词胶囊可点；与桌面一致 |
| A4.2 | 「只留文字」 | 拼回名字正确 |
| A4.3 | 合成名含空格/下划线 | 默认名 = tokenize 规则（去空格等）+ 可选 suffix |
| A4.4 | 输出到：自定义 + 模板 `{srcName}` | 预览里合成名正确；**不是**临时 `*_png` 目录名 |
| A4.5 | 多选任务 | 逐项命名 / 共享设置横幅与桌面一致 |
| A4.6 | sizeLimit / 质量 / 格式 | 控件齐全；tip 走 locales |
| A4.7 | 逐帧延时 | CEP 下**隐藏**（桌面 PNG 序列仍有） |

### A5. 转换（同一 processor）

准备：输出目录可写；至少 1 个选中合成。

| # | 步骤 | 期望 |
|---|------|------|
| A5.1 | 格式 **APNG** → 开始 | 进度 → 产出 `*.png`（APNG）于输出目录 |
| A5.2 | 同任务再出 **WebP / GIF** | 扩展名正确；可用系统看图/浏览器打开 |
| A5.3 | 多合成一次导出 | 每合成一份；帧目录 `*_png` 可清理策略符合预期 |
| A5.4 | 质量 40 vs 90 | 体积有差异（证明走压缩参数） |
| A5.5 | 与桌面同序列对比（可选） | 同 PNG 序列桌面转换 vs CEP，参数路径一致（同 processor） |

---

## B. 桌面回归（完整工作台未破坏）

| # | 步骤 | 期望 |
|---|------|------|
| B1 | `npm run dev` | 工作台正常 |
| B2 | 拖入 PNG 序列 / APNG | 可转 APNG/WebP/GIF |
| B3 | Ctrl+V 粘贴 | 与改前一致 |
| B4 | 输出名拆词 / 路径模板 | 与改前一致 |
| B5 | 右键打开源/输出目录 | 文件管理器定位正确 |

---

## C. 一体安装（NSIS）

| # | 步骤 | 期望 |
|---|------|------|
| C1 | `node scripts/dev/build.js win`（内部即 `npm run build:windows`，已自动豁免删除守卫） | 出 NSIS 安装包；脚本直接打印 exe 绝对路径 / 体积 / sha256 |
| C2 | 安装 → 组件页 | ☑ 桌面 ☑ AE 扩展 |
| C3 | **只装桌面** | 无 `…\CEP\extensions\io.github.isparta-next` |
| C4 | 重装 **双勾** | 出现扩展目录 + `version.json`；含 `bin\win64\…` |
| C5 | 不经 junction 打开 AE → iSparta | 面板可用 |
| C6 | 卸载 | 应用与本扩展目录删除；其它 CEP 扩展不受影响 |

---

## D. 双端一起更

| # | 步骤 | 期望 |
|---|------|------|
| D1 | 改扩展内 `version.json` 版本号为假值后启动桌面 | 启动后被**刷新回**与 app/payload 一致 |
| D2 | （有新包时）electron-updater 热更后启动 | CEP 扩展版本同步 |
| D3 | AE 面板内更新 UI | **不**走 electron-updater 下载；遵循 CEP 当前更新提示策略 |

---

## E. 记录

| 项 | 结果 | 备注 |
|----|------|------|
| 日期 / AE 版本 | | |
| A3–A5 | ☐ 通过 / ☐ 失败 | |
| B | ☐ | |
| C | ☐ | |
| D | ☐ | |
| 截图/日志路径 | | |

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 菜单无 iSparta | 确认 junction 路径与 Id=`io.github.isparta-next`；重开 AE |
| 面板空白 | `PlayerDebugMode`；看 CEP 日志；确认已 `build:cep` |
| 无合成 | 打开工程后点树「刷新」；需脚本写文件权限（AE 首选项） |
| 编码失败 | `targets/cep/bin/win64` 五件套是否拷贝 |
| 路径变量不对 | CEP Comp 的 `outputBasePath` 应由 `comp-source` 注入为工程旁合成名目录；共享 `sourceDirOf` 只读取该基准并展开变量，不自行推断 CEP 路径 |
