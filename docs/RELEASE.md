# 发版操作清单（给维护者 / Agent）

**架构约定：本地只触发，打包发版全部由 GitHub CI/CD 完成。**

更新/自动更新架构说明见 [UPDATER.md](./UPDATER.md)。

```text
本地 CLI（gh / scripts/release.ps1）
        │  只发指令，不构建安装包
        ▼
GitHub Actions  Release 工作流
        │  bump 版本 → commit + tag
        │  → 汇总 feat / fix / docs 生成 Release Notes
        │  → Win NSIS / Linux AppImage / macOS zip → 挂 Release
        │  → 上传 latest*.yml（electron-updater）
        ▼
https://github.com/yancongya/iSparta-next/releases
```

目标仓库：`yancongya/iSparta-next` · 本地工作副本：仓库根目录（路径因人而异）

> 发版提交为 `chore(release): vX.Y.Z [skip ci]`，**不会**自动触发 Pages。  
> 落地页版本/更新日志为**运行时读 GitHub API**，发版后一般无需再部署落地页。

## 0. 前置

- 已登录 `gh`：`gh auth status` 显示 `yancongya`
- 在 `master`，工作区干净（无未提交改动）
- 要发的代码已合入并推送
- 建议 commit 使用 Conventional 前缀（`feat:` / `fix:` / `docs:`），便于自动汇总

```powershell
cd <your-local-repo>
git status
git checkout master
git pull origin master
```

## 1. 日常推送（不发版）

```powershell
git add <files>
git commit -m "feat|fix|chore: 简述"
git push origin master
```

只触发日常 CI 构建校验（Artifact），不升版本、不发 Release。

## 2. 正式发版（本地 CLI 触发云端打包）

### 推荐：一键脚本

```powershell
.\scripts\release.ps1                 # patch，例如 3.3.8 -> 3.3.9
.\scripts\release.ps1 -Bump minor     # minor，例如 3.3.x -> 3.4.0
.\scripts\release.ps1 -Bump major
.\scripts\release.ps1 -DryRun         # 只试跑，不发版
.\scripts\release.ps1 -Bump patch -Prerelease
```

### 等价 gh 命令

```powershell
gh workflow run release.yml -R yancongya/iSparta-next `
  -f bump=patch -f prerelease=false -f dry_run=false

gh run list -R yancongya/iSparta-next --workflow=release.yml --limit 1
gh run watch --repo yancongya/iSparta-next <run-id>
```

### 网页等价

Actions → **Release** → Run workflow → 选 bump / prerelease / dry_run。

### 成功后产物命名（以 CI 实际为准）

| 平台 | 主资产 | updater 元数据 |
| --- | --- | --- |
| Windows x64 | `isparta-next-<ver>-win-x64.exe`（NSIS） | `latest.yml` |
| Linux x64 | `isparta-next-<ver>-linux-x64.AppImage` | `latest-linux.yml` |
| macOS arm64 | `isparta-next-<ver>-mac-arm64.zip` | `latest-mac.yml`（不自动更新） |
| macOS x64 | `isparta-next-<ver>-mac-x64.zip` | 同上 |

CI 会额外写入**稳定别名**（无版本号），供落地页 `releases/latest/download/...`：

- `isparta-next-win-x64.exe`
- `isparta-next-linux-x64.AppImage`
- 以及 mac zip 别名等  

> `latest*.yml` 的 `path` 必须与 **版本化** 资产名一致，供 electron-updater 定位安装包；**不要**改名或删除这些 yml。  
> macOS 仍为 CI **未签名** zip，不走应用内自动更新。

### Release Notes 汇总规则

工作流只汇总用户可见变更（便于应用内弹窗展示）：

| 类型 | 是否写入 Notes |
| --- | --- |
| `feat` / `fix` / `docs` | **是** |
| `chore` / `ci` / `build` / `refactor` / `perf` / `test` 等 | **否**（工程项不进正文） |
| 无前缀 commit | 默认不进主列表 |

仍会附安装包表与 changelog 链接。若某次要改文案，在 GitHub 上 Edit release 即可。

## 3. 版本号怎么选

| 场景 | bump |
| --- | --- |
| 修 bug / 小改 | `patch` |
| 新功能、向后兼容 | `minor` |
| 破坏性变更 | `major` |

当前版本：`package.json` 的 `version`（发版后由 CI 自动提交回 master）。

## 4. 失败时

1. `gh run view <id> --repo yancongya/iSparta-next --log-failed`
2. **Bump version** 失败 → 分支保护禁止 bot 直推，或版本/tag 冲突
3. **Collect & rename assets** 失败 → 检查 `latest*.yml` / 安装包是否生成；收集脚本须用通配符，勿写死不存在的文件名
4. **Build** 失败 → 本地 `npm run build:windows`；本机网络无法下载 NSIS 工具时可用本地缓存/ELECTRON_BUILDER_NSIS_DIR（CI 通常无此问题）
5. **Publish** 失败 → tag 是否已推、Artifact 是否非空
6. 错误 tag 需删除后再发：

```powershell
git push origin :refs/tags/vX.Y.Z
git tag -d vX.Y.Z
```

## 5. 不要做的事

- 不要在未合并进 `master` 时发版
- 不要在本地构建后手动上传当正式发版
- 不要手打 `v*` tag 指望自动出包（只有 Release 工作流会创建公开 Release）
- 不要对同一版本号连点两次
- 不要删改 Release 上的 `latest*.yml`

## 6. 给 Agent 的最短路径

```text
检查 gh auth + master 干净 + pull
    ↓
若只改代码：commit + push origin master（结束）
    ↓
若要发版且用户已授权：
    gh workflow run release.yml -f bump=patch -f prerelease=false -f dry_run=false
    gh run watch <run-id>
    gh release view --repo yancongya/iSparta-next
    ↓
向用户报告：版本号、Release 链接、关键资产（exe / AppImage / latest.yml）
```

发版后：用户可用已安装的 **NSIS/AppImage** 做「应用内热更新」验收；macOS 仍手动下载 zip。
