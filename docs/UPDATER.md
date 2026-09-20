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
| Win NSIS / Linux AppImage | 支持后台自动下载 → 提示 **「重启以更新」** |
| macOS zip / `npm run dev` | **不**自动更新；弹窗提供「前往下载」 |
| 默认设置 | 当前版本、手动「检查更新」、自动检查开关 |

---

## 2. 架构（代码入口）

```text
渲染层（Home / globalSetting）
    │  ipc.invoke('updater:check' | 'updater:meta' | 'updater:auto*')
    ▼
主进程 background.js
    ├─ src/util/updateCheck.js   纯逻辑：302 取 tag、API notes、semver、资产探测
    ├─ src/util/autoUpdate.js    electron-updater 封装（Dev 与 mac 不启用）
    └─ shell:openExternal        白名单（仅本仓库 Release/下载 URL）
    ▼
GitHub Releases（latest*.yml + 安装包）
```

| 模块 | 职责 |
| --- | --- |
| `src/util/updateCheck.js` | 检查结果契约（available / latest / offline…）、更新说明过滤 |
| `src/util/updatePrefs.js` | 存储键 `updateCheck`：enabled / autoDownload / lastAt / skipVersion / lastNotifiedVersion / lastResult |
| `src/util/updateService.js` | 渲染层编排：何时弹窗、红点、自动下载、重启 |
| `src/util/autoUpdate.js` | `supportsAutoUpdate()` + `updater:autoState` / `autoDownload` / `quitAndInstall` |
| `src/ui-next/components/IsUpdateDialog.vue` | 更新对话框 |
| `electron-updater@4.6.5` | 与 electron-builder 22 + GitHub provider 匹配 |

**环境变量（测试/镜像）**：`ISPARTA_UPDATE_REPO`、`ISPARTA_UPDATE_BASE_URL`、`ISPARTA_UPDATE_API_URL`、`ISPARTA_FORCE_VERSION`。

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
