# 发版操作清单（给维护者 / Agent）

**架构约定：本地只触发，打包发版全部由 GitHub CI/CD 完成。**

```text
本地 CLI（gh / scripts/release.ps1）
        │  只发指令，不构建安装包
        ▼
GitHub Actions  Release 工作流
        │  bump 版本 → commit + tag
        │  → 自动汇总本次迭代 commit 生成 Release Notes
        │  → Win / Linux / macOS 打包 → 挂 Release
        ▼
https://github.com/yancongya/iSparta-next/releases
```

目标仓库：`yancongya/iSparta-next` · 本地工作副本：仓库根目录（路径因人而异）

## 0. 前置

- 已登录 `gh`：`gh auth status` 显示 `yancongya`
- 在 `master`，工作区干净（无未提交改动）
- 要发的代码已合入并推送
- 建议 commit 使用 Conventional 前缀（`feat:` / `fix:` / `docs:` / `ci:` / `chore:`），便于自动汇总

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

只触发日常 CI 构建 Artifact，不升版本、不发 Release。

## 2. 正式发版（本地 CLI 触发云端打包）

### 推荐：一键脚本

```powershell
.\scripts\release.ps1                 # patch，例如 3.3.0 -> 3.3.1
.\scripts\release.ps1 -Bump minor     # minor，例如 3.3.0 -> 3.4.0
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

### 成功后产物命名

| 平台 | 资产名 |
| --- | --- |
| Windows x64 | `isparta-<ver>-win-x64.zip` |
| Linux x64 | `isparta-<ver>-linux-x64.tar.gz` |
| macOS arm64 | `isparta-<ver>-mac-arm64.zip` |
| macOS x64 | `isparta-<ver>-mac-x64.zip` |

> macOS 用 zip（runner 无 `/usr/bin/python`，旧 electron-builder 的 dmg 会失败）。包为**未签名**构建。

### 自动版本说明（bot 汇总）

Release 工作流会把上个 tag 到当前 HEAD 的 commit **自动分类汇总**进 Release Notes：

- `feat` → 新功能  
- `fix` → 修复  
- `docs` / `ci` / `build` / `refactor` / `perf` / `test` → 其他  
- 其余无前缀 commit → 其他  

并附带 compare 链接与安装表。无需手写 changelog；若某次要改文案，直接在 GitHub 上 Edit release 即可。

> macOS 为 CI **未签名** 构建。用户若被 Gatekeeper 拦截，见 Release 页说明（系统设置放行或 `xattr -dr com.apple.quarantine`）。

## 3. 版本号怎么选

| 场景 | bump |
| --- | --- |
| 修 bug / 小改 | `patch` |
| 新功能、向后兼容 | `minor` |
| 破坏性变更 | `major` |

当前版本：`package.json` 的 `version`（发版后由 CI 自动提交回 master）。

## 4. 失败时

1. `gh run view <id> --repo yancongya/iSparta-next --log-failed`
2. **Bump version** 失败 → 分支保护禁止 bot 直推，或版本格式异常
3. **Build** 失败 → 先本地 `npm run build:windows` / 看 electron 二进制安装
4. **Publish** 失败 → tag 是否已推、Artifact 是否非空
5. 错误 tag 需删除后再发：

```powershell
git push origin :refs/tags/vX.Y.Z
git tag -d vX.Y.Z
```

## 5. 不要做的事

- 不要在未合并进 `master` 时发版
- 不要在本地 `npm run build` 后手动上传当正式发版（除非补 macOS）
- 不要手打 `v*` tag 指望自动出包（只有 Release 工作流会创建公开 Release）
- 不要对同一版本号连点两次

## 6. 给 Agent 的最短路径

```text
检查 gh auth + master 干净 + pull
    ↓
若只改代码：commit + push origin master（结束）
    ↓
若要发版且用户已授权：
    .\scripts\release.ps1 -Bump patch
    gh run watch <最新 release run>
    gh release view --repo yancongya/iSparta-next
    ↓
向用户报告：新版本号、Release 链接、资产文件名、mac 需补传
```

成功后资产应包含 **win-x64** 与 **linux-x64** 两份；若页面只看到 Windows，请检查 linux 资产是否命名含 `linux-x64`（历史 v3.3.0 的 tar.gz 曾无平台后缀，已可重命名）。
