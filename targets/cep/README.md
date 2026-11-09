# iSparta AE CEP 扩展（targets/cep）

一仓双目标中的 CEP 壳：在 After Effects 中**选择合成** → 渲 PNG 序列 → 与桌面**同一套** `src/util/processor/*` 压缩合成 → **APNG / WebP / GIF**。

- Extension Id / BundleId / 目录名：`io.github.isparta-next`
- 宿主：AEFT `[15.0,99.9]`，CSXS 6.0+，`--enable-nodejs`
- **UI 与桌面共用 Vue 2**（`src/cep` + `src/ui-next`），构建到 `ui/`
- **编码唯一路径**：`src/util/processor/*`（禁止在本目录另写压缩链）
- 编码器：`public/bin` 五件套（apngasm / apngquant / apngopt / cwebp / webpmux）

## 目录

| 路径 | 说明 |
|------|------|
| `CSXS/manifest.xml` | MainPath=`./ui/index.html`，ScriptPath=`./jsx/hostscript.jsx` |
| `ui/` | **构建产物**（`npm run build:cep`），勿手改 |
| `src/cep`（仓库根） | Vue 面板源码入口 |
| `jsx/hostscript.jsx` | 合成列表 / 按索引导出 PNG 序列（ES3） |
| `lib/cep-bridge.js` | 注入 `window.ispartaAPI`（与 `node-env` 同形） |
| `lib/cli.js` | 仅 bin 定位 / mac 自愈 / checkTools（**无编码**） |
| `lib/cs.js` | evalScript / SystemPath |
| `bin/` | 编码器落盘（见 `bin/README.md`） |
| （安装辅助） | **不进扩展文件夹**：发行 zip 顶层平铺 `安装方法-<plat>.txt` + 平台脚本（源自 `public/install/`，按平台取子集，见 `scripts/pack-cep-zip.js`）；解压即见，拷贝扩展时不会连带拷进 extensions 目录 |

## 开发 / 构建

```powershell
npm run dev:cep      # HMR：MainPath=./dev-hmr.html → :8082
npm run dev:cep:off  # 出包前切回 ./ui/index.html
npm run build:cep    # 仅出包
node scripts/dev/preview.js cep --mock   # 浏览器 mockup：:8082/?mock=1（不开 AE）
```

### CEP 铁律（必读）

| 规则 | 说明 |
|------|------|
| **无 Ctrl+R** | 刷新只能 **关面板再开**；改 `src/**` HMR 自动热更 |
| **MainPath 禁 http://** | 否则 **重启 AE 扩展消失**；HMR 用 `dev-hmr.html` |
| **真机 / 生产禁 mock** | 否则任务列表全是假数据；dev 浏览器预览的 `?mock=1` 是唯一例外，见下 |
| **桥加载** | HMR `/lib/`（`public/lib`），静态 `../lib/`；勿打进 bundle |
| **外链** | `cep.util.openURLInDefaultBrowser`，非 `window.open` |
| **jsx/manifest** | 不热更；关面板再开（manifest 需重启 AE） |

### 浏览器 mockup（dev-only，不进扩展包）

纯浏览器预览（`:8082`）没有 AE 宿主，`cep-bridge` 拿不到工程数据，任务列表 / 合成树都是空的。显式开关后由 `src/cep/mockup.js` 提供假应答：

```powershell
node scripts/dev/preview.js cep --mock   # 打开 http://127.0.0.1:8082/?mock=1
```

| 项 | 内容 |
| --- | --- |
| 生效条件 | `NODE_ENV=development` **且** URL 带 `?mock=1`（或 `?mockup=1`）；`serve:cep` 专用 |
| 假数据 | 6 条示例合成（含超长名）+ 工程树 + 工程状态；`src/util/mock-bridge.js` 另播种 5 条示例任务（首条含 APNG/GIF/WEBP 三格式产物） |
| 可验范围 | 任务列表、合成树交互、名字列 APNG / GIF / WEBP 三格式开关（名字与 A/G/W 同属表头那只撑满整列的搜索框，无独立格式表头）、长名省略、列宽拖拽（16px 把手跨在列边界上；尺寸 36 / 帧率 32 / 状态 56 为压缩下限，到底分隔线转警示色）、表头右键菜单（左移 / 右移 / 恢复默认宽度）、视图切换、状态列最新日志（进行中进度 / 失败原因 / 完成态产物大小，右对齐）与 hover 全文 |
| 不验范围 | 真实合成读取、PNG 序列渲染、编码、安装与更新；这些必须走 AE 实机（见 `docs/ACCEPTANCE-RUNBOOK.md`） |
| 重置 | 控制台 `__ispartaMockReset()` 清空后刷新；`__ispartaMockComplete(n)` 把前 n 条任务标成完成态（验收完成态卡片、产物大小与格式角标） |
| 生产影响 | `installMockup()` 的 `NODE_ENV` 判断在构建期被折叠；`targets/cep/ui` 生产载荷与真实面板不带参数、不启用 |

不带 `?mock=1` 的 `:8082` 预览保持原行为（空列表，仅看界面布局）。桌面 Web（:8081）的 mock 桥无需开关、自动生效，见 `AGENTS.md` §1.1。

打包 payload / 独立 zip：

```powershell
npm run prepare:cep  # build/cep-payload/io.github.isparta-next/
npm run pack:cep     # dist/isparta-next-cep-<ver>-win-x64.zip
```

## 开发安装（Windows junction）

1. 拷贝编码器到 `targets/cep/bin/win64/` 等（见 [bin/README.md](bin/README.md)）。
2. `npm run build:cep`。
3. 挂载：

```powershell
$src = "F:\iSparta\targets\cep"
$dst = Join-Path $env:APPDATA "Adobe\CEP\extensions\io.github.isparta-next"
$systemDst = Join-Path $env:CommonProgramFiles "Adobe\CEP\extensions\io.github.isparta-next"
if (Get-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue) {
  throw "目标已存在，请先人工确认它是本仓库的开发挂载；不会自动删除或覆盖：$dst"
}
if (Get-Item -LiteralPath $systemDst -Force -ErrorAction SilentlyContinue) {
  throw "检测到系统级正式扩展。请勿再挂载同 ID 的用户级副本：$systemDst"
}
New-Item -ItemType Junction -Path $dst -Target $src
```

4. 未签名：写 `PlayerDebugMode`。发行 zip **顶层**已附带现成脚本（Windows 双击 `Add Keys.reg`
   覆盖 CSXS.5–22，macOS 双击 `安装扩展.command` → `install-as-admin` 覆盖 CSXS.5–25）；手动写则循环 CSXS.6–14（与 `build/installer.nsh` 一致）：

```powershell
foreach ($v in 6..14) {
  $k = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
  New-ItemProperty -Path $k -Name PlayerDebugMode -Value 1 -PropertyType String -Force | Out-Null
}
```

5. AE → 窗口 → 扩展 → **iSparta-next**（菜单名随版本注入，见 CSXS/manifest.xml 的 `<Menu>`）。

macOS：

```bash
npm run build:cep
src="$(cd ./targets/cep && pwd)"
dst="$HOME/Library/Application Support/Adobe/CEP/extensions/io.github.isparta-next"
system_dst="/Library/Application Support/Adobe/CEP/extensions/io.github.isparta-next"
if [[ -e "$dst" || -L "$dst" ]]; then
  echo "目标已存在，请先人工确认；不会覆盖或删除：$dst" >&2
  exit 1
fi
if [[ -e "$system_dst" || -L "$system_dst" ]]; then
  echo "检测到系统级正式扩展。请勿再挂载同 ID 的用户级副本：$system_dst" >&2
  exit 1
fi
mkdir -p "$(dirname "$dst")"
ln -s "$src" "$dst"
```

## 一体安装

桌面 NSIS 安装使用系统级 Common Files 路径，macOS pkg 也部署到系统级 CEP 目录。开发挂载使用用户级目录；两种方式不可同时保留同 ID 副本。具体安装边界见 `docs/PLAN-DUAL-TARGET.md` 与 `build/installer.nsh`。

## JSX API

| 函数 | 作用 |
|------|------|
| `ispartaListComps()` | 合成列表 JSON（index/name/尺寸/fps/时长） |
| `ispartaExportPngSequenceByIndex(compIndex, location)` | 按索引导出 PNG 序列 |
| `ispartaExportPngSequence(location)` | 活动合成（兼容） |
