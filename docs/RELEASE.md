# 发版操作清单（给维护者 / Agent）

**架构约定：本地只触发，打包发版全部由 GitHub CI/CD 完成。**

更新/自动更新架构说明见 [CHANGELOG.md](./CHANGELOG.md#更新机制)。

```text
本地 CLI（gh / scripts/release.ps1）
        │  只发指令，不构建安装包
        ▼
GitHub Actions  Release 工作流
        │  bump 版本 → commit + tag
        │  → 读取独立撰写的版本 Release Notes（不复用 commit 文案）
        │  → Win NSIS / Linux AppImage / macOS pkg（兼容 zip） → 挂 Release
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
| macOS arm64 | `isparta-next-<ver>-mac-arm64.pkg`（一体安装）；另有 zip | `latest-mac-pkg.yml`（pkg 校验）；`latest-mac.yml`（zip） |
| macOS x64 | `isparta-next-<ver>-mac-x64.pkg`（一体安装）；另有 zip | 同上 |
| AE CEP Windows | `isparta-next-<ver>-cep-win.zip` | 无（手动解压安装） |
| AE CEP macOS | `isparta-next-<ver>-cep-mac.zip` | 无（手动解压安装） |

CI 会额外写入**稳定别名**（无版本号），供落地页 `releases/latest/download/...`：

- `isparta-next-win-x64.exe`
- `isparta-next-linux-x64.AppImage`
- `isparta-next-cep-win.zip` / `isparta-next-cep-mac.zip`
- 以及 mac pkg / zip 别名等

> `latest*.yml` 的 `path` 必须与 **版本化** 资产名一致，供 electron-updater 定位安装包；**不要**改名或删除这些 yml。  
> macOS pkg 由同一份已构建 CEP payload 与桌面应用组装；当前 CI 无 Developer ID 签名/公证。`latest-mac-pkg.yml` 独立记录 pkg 的 URL、SHA-512 和大小，不覆盖 electron-builder 的 zip 更新清单。

### Release 文案规范

Commit 与 Release 各自服务不同读者：commit 主题按 Conventional Commits 写实现改动；Release 正文单独写用户看到的变化，不能把 commit 列表直接贴进更新说明。

每个版本的编辑源保存在 `.github/release-notes/vX.Y.Z.md`，可从 [`TEMPLATE.md`](../.github/release-notes/TEMPLATE.md) 复制。正文必须包含：

1. 首屏 `## 更新到 {{TAG}}` 和 **3–6 条用户收益摘要**，避免内部模块名、commit 前缀和开发过程描述。
2. `<details><summary>详细说明</summary>` 折叠区，按「新增 / 修复 / 体验优化」解释具体行为；不适用的类别可删。
3. `<!-- RELEASE_INSTALLERS -->` 和 `<!-- RELEASE_CHANGELOG -->` 两个占位符。CI 会在折叠区自动补安装资产表与比较链接。

工作流会在改写版本号、提交 bump、创建 tag 之前校验对应 Release 文案文件、固定结构和摘要数量。缺少文案时会提前失败，不再退回由 commit 标题自动生成。新版本发布后，编辑源与 GitHub Release 正文保持一致；更正文案时应同时更新两处。

每个新版本的文案文件必须先提交并 push 到 `master`（可与功能 commit 分开），然后触发 release workflow。`landing/` 页面部署仍由 `pages.yml` 独立处理，不进入桌面 / CEP Release 说明。

## 3. 版本号怎么选

| 场景 | bump |
| --- | --- |
| 修 bug / 小改 | `patch` |
| 新功能、向后兼容 | `minor` |
| 破坏性变更 | `major` |

当前版本：`package.json` 的 `version`（发版后由 CI 自动提交回 master）。

## 4. 失败时

> **先看这条**：`.\scripts\release.ps1` 报「参数列表中缺少参量」或输出乱码（如 `瑙﹀彂`）→ 脚本被 Windows PowerShell 5.1 按 ANSI(GBK) 读取导致解析失败，一个字都没执行（所以**不会**产生重复发版）。**`release.ps1` 必须保持 UTF-8 with BOM** —— 含中文的 `.ps1` 在 PS 5.1 下读不出正确编码，改文件时别把 BOM 抹掉；也可用 PowerShell 7 运行绕过。

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

如果工作流已把版本提交推到 `master`，但在打 tag 前失败，不要再次按 `patch` 发版（会跳过该版本）。先确认对应 tag 尚不存在，再由维护者创建该版本 tag；随后从 `master` 运行 Release 工作流并填写 `resume_version=<当前 package.json 版本>`，工作流会校验版本与 tag、跳过重复 bump/commit/tag，只构建并发布该版本。

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

发版后：用户可用已安装的 **NSIS/AppImage** 做「应用内热更新」验收；macOS 通过同版 pkg 更新，需管理员授权；首次安装与 CEP 生效仍需真机验收。
