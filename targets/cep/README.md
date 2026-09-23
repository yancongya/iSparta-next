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

## 开发 / 构建

```powershell
npm run dev:cep      # HMR：MainPath=./dev-hmr.html → :8082
npm run dev:cep:off  # 出包前切回 ./ui/index.html
npm run build:cep    # 仅出包
```

### CEP 铁律（必读）

| 规则 | 说明 |
|------|------|
| **无 Ctrl+R** | 刷新只能 **关面板再开**；改 `src/**` HMR 自动热更 |
| **MainPath 禁 http://** | 否则 **重启 AE 扩展消失**；HMR 用 `dev-hmr.html` |
| **禁 mock** | 否则任务列表全是假数据 |
| **桥加载** | HMR `/lib/`（`public/lib`），静态 `../lib/`；勿打进 bundle |
| **外链** | `cep.util.openURLInDefaultBrowser`，非 `window.open` |
| **jsx/manifest** | 不热更；关面板再开（manifest 需重启 AE） |

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
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Junction -Path $dst -Target $src
```

4. 未签名：写 `PlayerDebugMode`（CSXS.6–11）：

```powershell
foreach ($v in 6..14) {
  $k = "HKCU:\Software\Adobe\CSXS.$v"
  if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
  New-ItemProperty -Path $k -Name PlayerDebugMode -Value 1 -PropertyType String -Force | Out-Null
}
```

5. AE → 窗口 → 扩展 → **iSparta**。

macOS：

```bash
npm run build:cep
ln -s /path/to/iSparta/targets/cep "$HOME/Library/Application Support/Adobe/CEP/extensions/io.github.isparta-next"
```

## 一体安装

桌面 NSIS 组件页可勾选「AE 扩展」；详见 `docs/PLAN-DUAL-TARGET.md` 与 `build/installer.nsh`。

## JSX API

| 函数 | 作用 |
|------|------|
| `ispartaListComps()` | 合成列表 JSON（index/name/尺寸/fps/时长） |
| `ispartaExportPngSequenceByIndex(compIndex, location)` | 按索引导出 PNG 序列 |
| `ispartaExportPngSequence(location)` | 活动合成（兼容） |
