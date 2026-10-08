# 更新与自动更新（现状）

> 适用版本：**v3.3.8+**（以 `package.json` `version` 为准）  
> 历史长篇规划见 [UPDATE_CHECK_PLAN.md](./UPDATE_CHECK_PLAN.md)（**文首已标过时**，仅作设计存档）。  
> 发版步骤见 [RELEASE.md](./RELEASE.md)。

---

## 1. 用户看到的行为

| 场景 | 行为 |
| --- | --- |
| 启动应用 | 约 8 秒后检查一次 GitHub Releases；失败**静默**（仅运行日志） |
| 有新版 | 非阻断弹窗：版本对比 + **更新说明**（Release body，滤掉 chore/ci） |
| Win NSIS / Linux AppImage（桌面） | 支持后台自动下载 → 提示 **「重启以更新」** |
| **AE 面板（CEP，Windows）** | 面板内后台下**同一个官方安装包** → 主按钮 **「运行安装包」** → 起 NSIS 向导，桌面与 AE 扩展一次更完；装完**需重启 After Effects** |
| macOS zip / `npm run dev` | **不**自动更新；弹窗提供「前往下载」 |
| **AE 面板（CEP，macOS）** | 无 NSIS，仅「前往下载」 |
| 默认设置 | 当前版本、手动「检查更新」、自动检查开关 |

---

## 2. 架构（代码入口）

```text
渲染层（Home / globalSetting / 选路在 src/util/updateService.js）
    │
    ├─ 桌面（policy = full）
    │     └─► 主进程 background.js
    │           ├─ updater:meta / updater:check（Node HEAD 取 302 tag）
    │           ├─ src/util/autoUpdate.js  electron-updater（Dev 与 mac 不启用）
    │           └─ shell:openExternal      白名单（仅本仓库 Release/下载 URL）
    │
    └─ CEP（policy = cep-installer；仅 Windows + --enable-nodejs）
          └─► targets/cep/lib/cep-bridge.js 的 updater:* 通道
                ├─ updater:meta         读扩展目录 version.json（回 cep: true）
                ├─ updater:http         Node https，302 主路径不跟随重定向
                ├─ updater:download     流式整包 + 边写边算 sha512（约 100MB）
                ├─ updater:cancelDownload / updater:downloadState
                ├─ updater:runInstaller detached + unref 起 NSIS 向导
                └─ shell:openExternal   转 cep.util.openURLInDefaultBrowser
    ▼
GitHub Releases（latest*.yml + 安装包）
```

| 模块 | 职责 |
| --- | --- |
| `src/util/updateCheck.js` | 检查结果契约（available / latest / offline…）、更新说明过滤 |
| `src/util/updatePrefs.js` | 更新偏好存储：**按宿主分键** `updateCheck.app` / `updateCheck.cep`（桌面与 CEP 共用同一份 `localstorage.json`，必须分键） |
| `src/util/updateService.js` | 渲染层编排：选路（IPC / 桥）、何时弹窗、红点、自动下载、重启或起安装包 |
| `src/util/autoUpdate.js` | 桌面：`supportsAutoUpdate()` + `updater:autoState` / `autoDownload` / `quitAndInstall` |
| `src/util/cepUpdater.js` | CEP：把桥的 `updater:*` 接成 `checkUpdate` 的 `fetchHead/fetchJson/fetchText`，解析 `latest.yml` 拿 sha512，映射下载态 |
| `targets/cep/lib/cep-bridge.js` | CEP 桥：`updater:*` 六个通道 + `shell:openExternal`；网络与落盘全在 Node，判定仍在渲染层 |
| `src/ui-next/components/IsUpdateDialog.vue` / `IsUpdateDock.vue` | 更新对话框 / 右下角非阻断卡片（按 `auto.mode === 'installer'` 切 CEP 终态文案） |
| `electron-updater@4.6.5` | 与 electron-builder 22 + GitHub provider 匹配 |

**环境变量（测试/镜像）**：`ISPARTA_UPDATE_REPO`、`ISPARTA_UPDATE_BASE_URL`、`ISPARTA_UPDATE_API_URL`、`ISPARTA_FORCE_VERSION`、`ISPARTA_CEP_UPDATE_POLICY`（`none` / `notify-only` 可强制 CEP 侧退回仅提示）。

---

## 3. 构建与 Release 资产

| 端 | target | 自动更新 |
| --- | --- | --- |
| Windows | NSIS `.exe` | 是（`latest.yml`） |
| Linux | AppImage | 是（`latest-linux.yml`） |
| macOS | zip（未签名） | 否（手动解压 + Gatekeeper 放行） |

- `artifactName`: `isparta-next-${version}-${os}-${arch}.${ext}`  
- `package.json` **`name` / `productName`**: `isparta-next`（安装目录与显示名对齐）  
- CI 上传 `latest*.yml` + 版本化安装包 + 稳定别名（落地页 `latest/download/...`）

用户路径：已安装正式包 → 检测到新版 → 下载 → **重启以更新**；安装目录在同路径覆盖，**不会**自动改文件夹名。

---

## 4. 落地页（与应用解耦）

- 地址：https://yancongya.github.io/iSparta-next/  
- 版本、发布日期、LINEAGE 更新日志：**运行时读 GitHub API**（`releases?per_page` + `latest`）  
- 浏览器 `sessionStorage` 缓存约 **15 分钟**，降低匿名 API 限流  
- 不依赖构建期 `releases.json` bake；HTML 静态版本仅作 API 失败时兜底  
- 发版提交带 `[skip ci]`，一般**不必**为版本号再部署 Pages  

搜索收录步骤见 [SEO_SUBMIT.md](./SEO_SUBMIT.md)。

---

## 5. 本地如何验证

```powershell
node scripts/updateCheck.l1.js     # 纯逻辑
node scripts/cepUpdater.l1.js      # CEP 适配层纯函数（latest.yml 解析 / 下载态映射 / 安装包落盘目录）
node scripts/l3-run.js             # fixture + HTTP 链路
# fixture：
node scripts/fixture-github.js     # FIXTURE_MODE=available|latest|offline|...
```

热更新请用 **Release 安装包**（NSIS/AppImage），不要用 `npm run dev`。

---

## 6. 已知限制与后续

| 项 | 说明 |
| --- | --- |
| macOS | 无付费证书则永远手动更新 |
| macOS 上的 CEP | 无 NSIS，AE 面板只能「前往下载」 |
| CEP 侧整包下载 | AE 面板内下的是完整安装包（约 100MB），没有桌面 electron-updater 的 blockmap 差量；网络差时体验不如桌面 |
| AE 不随安装包重启 | 向导装完扩展目录已是新版，但面板内存里仍是旧代码 → 必须重启 After Effects（文案已含此提示） |
| Windows SmartScreen | 未签名 NSIS 仍可能拦截；签名见 [SIGNPATH.md](./SIGNPATH.md) |
| 匿名 GitHub API | 落地页约 60 次/小时/IP；应用侧主路径用 302，API 仅用于 notes |
| 安装目录更名 | 自动更新不搬家；需卸载后重装才会改变路径 |
| SignPath | 申请未完成前，SmartScreen 问题会存在 |

---

## 7. 文档索引

| 文档 | 用途 |
| --- | --- |
| **本文 UPDATER.md** | 更新/自动更新**现状** |
| [RELEASE.md](./RELEASE.md) | 如何发版 |
| [SIGNPATH.md](./SIGNPATH.md) | Windows 免费签名 |
| [SEO_SUBMIT.md](./SEO_SUBMIT.md) | 落地页搜索收录 |
| [UPDATE_CHECK_PLAN.md](./UPDATE_CHECK_PLAN.md) | 历史规划存档（勿当执行清单） |
