# 本地 CLI 触发 GitHub CI/CD 发版（打包在云端，不在本机）
# 用法:
#   .\scripts\release.ps1                 # patch
#   .\scripts\release.ps1 -Bump minor
#   .\scripts\release.ps1 -Bump major -Prerelease
#   .\scripts\release.ps1 -DryRun
param(
  [ValidateSet('patch','minor','major')]
  [string]$Bump = 'patch',
  [switch]$Prerelease,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo = 'yancongya/iSparta-next'

Write-Host "==> 检查 git / gh ..." -ForegroundColor Cyan
git status --porcelain | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'git status 失败' }

$dirty = git status --porcelain
if ($dirty) {
  Write-Host "工作区有未提交改动，请先 commit/push 后再发版：" -ForegroundColor Yellow
  Write-Host $dirty
  exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'master') {
  Write-Host "当前分支是 $branch，请先切到 master 并 pull" -ForegroundColor Yellow
  exit 1
}

git pull origin master
if ($LASTEXITCODE -ne 0) { throw 'git pull 失败' }

$pre = if ($Prerelease) { 'true' } else { 'false' }
$dry = if ($DryRun) { 'true' } else { 'false' }

Write-Host "==> 触发 GitHub Actions Release (bump=$Bump, prerelease=$pre, dry_run=$dry)" -ForegroundColor Cyan
Write-Host "    打包由 GitHub 云端 Win/Linux runner 完成，本地不构建安装包。"

gh workflow run release.yml -R $repo `
  -f "bump=$Bump" `
  -f "prerelease=$pre" `
  -f "dry_run=$dry"
if ($LASTEXITCODE -ne 0) { throw 'gh workflow run 失败（检查 gh auth status）' }

Start-Sleep -Seconds 3
gh run list -R $repo --workflow=release.yml --limit 1
Write-Host ""
Write-Host "已触发。可监视进度:" -ForegroundColor Green
Write-Host "  gh run watch --repo $repo (选最新 Release run)"
Write-Host "  或打开 https://github.com/$repo/actions/workflows/release.yml"
Write-Host "成功后查看: https://github.com/$repo/releases"
