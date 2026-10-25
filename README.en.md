# iSparta-next

**English** | [中文](README.md)

[![Latest release](https://img.shields.io/github/v/release/yancongya/iSparta-next?include_prereleases&label=Release)](https://github.com/yancongya/iSparta-next/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/yancongya/iSparta-next/total.svg)](https://github.com/yancongya/iSparta-next/releases)
[![Build Multi-Platform](https://img.shields.io/github/actions/workflow/status/yancongya/iSparta-next/build.yml?branch=master&label=CI)](https://github.com/yancongya/iSparta-next/actions/workflows/build.yml)
[![Electron](https://img.shields.io/badge/Electron-28.3.3-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-2.x-42b883?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/yancongya/iSparta-next/blob/master/LICENSE)

**iSparta-next** is a desktop animated-image converter rebuilt from the classic [iSparta](https://github.com/iSparta/iSparta). It converts and compresses **APNG / Animated WebP / GIF / PNG sequences**.

> **[Download from Releases →](https://github.com/yancongya/iSparta-next/releases)**  
> Product page: **[https://yancongya.github.io/iSparta-next/](https://yancongya.github.io/iSparta-next/)**  
> Stack: Electron 28 + Vue 2 · Platforms: Windows / macOS / Linux  
>  
> **Docs:** [Changelog & updater](docs/CHANGELOG.md) · [Release process](docs/RELEASE.md) · [Docs map](#docs-map) · [SEO checklist](docs/SEO_SUBMIT.md)

### Updates & auto-update

- Roughly 8 seconds after launch the app checks **GitHub Releases** once (version + OS type only; turn it off in **Settings → Automatic update check**). When an update exists, a non-blocking corner card appears in-app; confirm to download, then **Restart to update**.
- **Windows (NSIS) / Linux (AppImage) / macOS (pkg)** all support in-app updates; macOS asks for administrator permission. CI packages are unsigned, so the OS may ask you to allow opening. The **AE panel** reuses the same official installer and needs an After Effects restart afterwards.
- Mechanics, architecture and limitations: [`docs/CHANGELOG.md`](docs/CHANGELOG.md#更新机制); release process: [`docs/RELEASE.md`](docs/RELEASE.md); free Windows signing: [`docs/SIGNPATH.md`](docs/SIGNPATH.md).

> **Install and update:** Windows and macOS installers are system-wide; the matching CEP extension is deployed when After Effects is detected. Desktop and AE panel share the same official installer — restart the app or After Effects when prompted. AE panel capabilities and upgrade boundary: [`docs/CEP-UPGRADE-SCOPE.md`](docs/CEP-UPGRADE-SCOPE.md).

### Recent highlights

- **AE panel:** one-button switch between comp tree and task list; right-click to open comp location / output folder / stop task; double-click to jump to a comp; pinned filter bar
- **Tasks and output:** per-comp settings persist; completed rows show final output size; copying files reports progress and result
- **Output actions:** copy completed files; hold Alt while hovering the toolbar button to open the output folder
- **Bundled install:** system-wide installation (UAC prompt, CEP under Common Files, a single copy per machine); auto-detects the AE version; version shown in both the desktop title bar and the AE panel
- **Onboarding (7 pages):** Welcome → Import → Output → Naming → Path variables → AE → Done, covering import methods, output settings and naming rules in one pass

Full per-version changes: [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

### Good for

- **APNG to GIF / APNG to WebP**, and reverse **GIF/WebP to APNG**
- **PNG sequence to animated image** (stickers, frame animation)
- **Animated image compression** under a size cap (e.g. 1MB sticker limits)
- **Batch convert** folders of frames with path templates
- Looking for an **iSparta alternative** after the original stalled

## Why iSparta-next

**The original [iSparta](https://github.com/iSparta/iSparta) has been unmaintained for years** — outdated Electron, stagnant UI and pipeline, many unfixed issues (frame order, open-folder failures, storage glitches, broken packaging), and missing security patches.

This repo is **not a small patch**. It is a **full frontend/backend refactor** on top of a community fork (mainly [bigxixi/iSparta](https://github.com/bigxixi/iSparta), which already brought libwebp security upgrades, Electron 6→13, and CI). Codename: **iSparta-next**.

- **Runtime**: Electron 13 → 28; no `remote`; `contextIsolation` / `sandbox`; FS & process work moved toward main-process IPC
- **UI**: Element UI replaced with a custom design system and a two-column workspace (theme, motion, compare, etc.)
- **New features**: output size limit, path templates, paste import, before/after slider — none of which existed in the original
- **Engineering**: GitHub Actions multi-platform builds, unsigned Windows local packaging, archived specs and roadmap

### Lineage

| Source | Status | Main changes vs original | Relation |
| --- | --- | --- | --- |
| [iSparta/iSparta](https://github.com/iSparta/iSparta) (original) | **Abandoned** | Classic APNG/WebP tool; many bugs unfixed | Product origin, **not recommended** |
| [Xheldon/iSparta](https://github.com/Xheldon/iSparta) | Community | Frame-order fixes; partial UI repairs | Historical reference |
| [bigxixi/iSparta](https://github.com/bigxixi/iSparta) | Community fork | libwebp 1.5 (CVE-2023-4863), Electron 6→13, Vue CLI 4, `execFile` hardening, storage/lock fixes, GitHub Actions | **Direct upstream** |
| **This repo (iSparta-next)** | **Current** | See “What was fixed / added” below | Refactor + feature work on bigxixi base; packages on [Releases](https://github.com/yancongya/iSparta-next/releases) |

### What was fixed vs the old app

| Area | Old problem | iSparta-next |
| --- | --- | --- |
| Security | `electron.remote`; renderer Node access; command injection risk | IPC + preload whitelist; `contextIsolation` / `sandbox` / `nodeIntegration:false`; controlled `execFile` |
| Runtime | Stale Electron major | **Electron 28.3.3** |
| Dependency CVEs | Old libwebp (e.g. CVE-2023-4863) | Upstream **libwebp 1.5** binaries |
| Frame order | Occasional scrambled frames on import/open folder | Natural sort on open-folder and drag paths; same-tree APNG dedupe |
| Windows paths | Broken “open original folder” separators | Fixed |
| Storage / state | Empty cache, conversion deadlock, shared `options` refs | Main-process storage; lock/cache hardening; isolated import instances |
| Naming | Forced `_apng` suffix; awkward output paths | Empty default suffix; first preset writes to source dir (no forced `/output`) |
| Packaging | Dead Travis/AppVeyor; unsigned Windows pain | GitHub Actions; local `electronDist` + skip signing; `build:windows` works |

### What was added

1. **Output size limit** — default 1MB; set a size limit and retry count for automatic quality reduction
2. **Output path strategy + templates** — source / beside / custom; `{srcPath}` `{srcName}` `{srcParent}` etc.  
3. **Before/after compare slider** — click a done thumbnail, drag or arrow-key to compare  
4. **Paste import** — drag, open folder, or paste a screenshot  
5. **Light / dark theme** — switch from the desktop title bar or settings panel; CEP uses the settings panel, including “follow system”
6. **Custom UI workspace** — two columns, 1:1 covers, hover preview, collapsible panel, progress, batch stats  
7. **Motion** — entrance, number tween, confetti, drop feedback; respects `prefers-reduced-motion`  
8. **Per-frame delay** — PNG sequences can set delay per frame  
9. **Global defaults** — formats, quality, suffix, size limit presets  
10. **Batch workflow** — multi-select, batch start, unified output dir, success/fail stats  
11. **Runtime log panel** — open from the toolbar; filter by level (all / info / ok / warn / error) with auto-follow, useful for debugging convert failures and path issues  

See [`docs/CHANGELOG.md`](docs/CHANGELOG.md), [`docs/PLAN-DUAL-TARGET.md`](docs/PLAN-DUAL-TARGET.md), and [`docs/CEP-UPGRADE-SCOPE.md`](docs/CEP-UPGRADE-SCOPE.md) for project history and current implementation boundaries.

## Screenshots

> Single source of truth lives in [`docs/screenshots/`](docs/screenshots). After changing an image run `node scripts\sync-screenshots.js` to refresh the landing-page copy; `--check` verifies they have not drifted (CI runs it).

**Desktop**

| Workbench (task list + output settings) | Empty state (drop / paste / open) |
| :---: | :---: |
| <img src="docs/screenshots/desktop-workspace-hd.webp" alt="Desktop workbench with task list and output settings" width="480"> | <img src="docs/screenshots/desktop-empty.webp" alt="Empty state: drop, paste, or open a folder" width="480"> |

| Default settings (language / theme / path vars / size cap) | Default settings (version & updates) |
| :---: | :---: |
| <img src="docs/screenshots/desktop-settings-general.webp" alt="Default settings: language, theme, output path variables, size limit" width="480"> | <img src="docs/screenshots/desktop-settings-update.webp" alt="Default settings: current version, update check and about" width="480"> |

**AE extension** (same workbench, hosted in the After Effects panel)

| Comp list | Comp tree |
| :---: | :---: |
| <img src="docs/screenshots/cep-task-list.webp" alt="AE extension: comp task list with selection, fps and frame count" width="480"> | <img src="docs/screenshots/cep-comp-tree.webp" alt="AE extension: comp tree with size, fps and frame count" width="480"> |

| Output settings (path vars + size cap) |
| :---: |
| <img src="docs/screenshots/cep-output-settings.webp" alt="AE extension: output path variables and size limit settings" width="480"> |

## Download

Get the latest installers from **[Releases](https://github.com/yancongya/iSparta-next/releases)**.

| Platform | Artifact | Arch |
| --- | --- | --- |
| Windows | `.exe` (desktop + optional AE extension) | x64 |
| macOS | `.pkg` (desktop + optional AE extension) | x64 / arm64 |
| Linux | `.AppImage` | x64 |

All three platforms are built by GitHub Actions. **macOS packages are unsigned** — if Gatekeeper blocks the installer, allow it in System Settings → Privacy & Security.

## Features

### Format conversion

| Input | Output | Notes |
| --- | --- | --- |
| PNG sequence | APNG | FPS / loop; per-frame delay |
| GIF | APNG | Lossless or quality-controlled |
| WebP | APNG | Animated WebP → APNG |
| APNG | Animated WebP | Loop, lossless, quality |
| APNG | GIF | APNG → GIF |
| APNG | APNG | Lossless / lossy compress |

### Workflow

- **First-run onboarding** — a 7-step tour (import → output → naming → paths → AE) on first launch, skippable and only shown once  
- **Batch** — many tasks, per-task options, batch start, shared output dir  
- **Drag & paste** — files/folders or pasted screenshots  
- **Path templates** — source / beside / custom with variables  
- **Size limit** — default 1MB; automatic re-encoding from a size limit and retry count
- **Compare slider** — original vs output  
- **Themes** — light, dark, system  
- **i18n** — 简体中文, 繁體中文, English  
- **Global defaults** — formats, quality, suffix, limits  

## Requirements

- [Node.js](https://nodejs.org/) (use version 20 from `.nvmrc`, matching CI)
- npm
- Linux extra dep for some native binaries:

```bash
sudo apt-get install libpng16-dev
```

## Quick start

```bash
git clone https://github.com/yancongya/iSparta-next.git
cd iSparta-next
npm install
npm run dev
```

## Build

```bash
# mac + win + linux
npm run build

# Windows only
npm run build:windows
```

Outputs land in `dist_electron/`.

### Packaging notes

- `electron-builder` config: [`electron-builder.yml`](electron-builder.yml)
- Prefers local Electron (`electronDist`) to avoid re-download
- Windows skips code signing by default (`signAndEditExecutable: false`)
- App ID: `io.github.isparta`

### CI & release

| Workflow | File | Trigger | What it does |
| --- | --- | --- | --- |
| **Build Multi-Platform** | [build.yml](.github/workflows/build.yml) | push `master` / manual | Builds Win/Linux/macOS artifacts (~7 days), **no Release** |
| **Release** | [release.yml](.github/workflows/release.yml) | manual `workflow_dispatch` | Bump version → commit + tag → auto changelog → build 3 OS → GitHub Release |

#### Daily builds

Push to `master` builds test packages. Or run **Build Multi-Platform** from the Actions tab.

#### Cutting a release (use Actions)

1. **Actions → Release → Run workflow**
2. Choose:
   - **bump**: `patch` / `minor` / `major` (from current `package.json`)
   - **prerelease**: mark as Pre-release on GitHub
   - **dry_run**: compute + build only; no commit/tag/Release
3. On success it:
   - Updates `package.json` / `package-lock.json`
   - Commits `chore(release): vX.Y.Z [skip ci]` and tags `vX.Y.Z`
   - Builds Win/Linux and attaches them to the GitHub Release

> macOS x64 and arm64 artifacts are built by the release workflow and attached to the same GitHub Release.
> If `master` blocks bot pushes, temporarily allow it or wire a PAT.  
> Do not rely on hand-pushed `v*` tags — **only the Release workflow publishes**.

Checklist: [`docs/RELEASE.md`](docs/RELEASE.md).

## Project structure

```text
iSparta-next/
├── src/
│   ├── background.js          # Electron main (window, IPC, menu, file protocol)
│   ├── preload.js             # contextBridge API
│   ├── main.js / App.vue      # Renderer entry
│   ├── ui-next/               # New UI (design system, theme, Home)
│   ├── components/            # Business UI (list, settings, compare, delay…)
│   ├── util/processor/        # Converters + size gate
│   ├── store/                 # Vuex
│   ├── locales/               # i18n
│   └── router.js
├── public/                    # Web assets; bin/ supplies dev tools and CEP payload tools
├── static/bin/                # Platform conversion tools used as an Electron runtime fallback
├── targets/cep/               # CEP shell, JSX host scripts, and tracked UI build output
├── scripts/                   # Build, preview, release, and verification entrypoints
├── docs/                      # Current guidance, acceptance steps, and archived specs
├── electron-builder.yml
└── vue.config.js
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev app (Electron window + dev server) |
| `npm run build` | Build mac + win + linux |
| `npm run build:windows` | Windows only |
| `npm run lint` | ESLint / Vue |
| `node scripts/dev/preview.js <guide\|landing\|web\|desktop\|cep>` | Start a preview server and open the browser |
| `node scripts/dev/build.js win` | Local Windows installer (delete-guard exemption injected; prints exe path / size / sha256) |
| `node scripts/dev/build.js cep` | Rebuild the AE / CEP panel bundle `targets/cep/ui` only |
| `node scripts/dev/check.js lint\|pack\|ports\|all` | Health check: lint / packaging gate / port occupancy & owner |

Double-click friendly wrappers under `scripts/dev/`: `run-all-dev`, `run-dev-cep`, `run-landing`, `run-preview`, `run-build-win`, `run-build-cep`, and `run-check`. See [`AGENTS.md`](AGENTS.md) for development conventions and the full script index (Chinese).

## Docs map

**The single index for this repo.** Grouped by role — the status column tells you which files are still authoritative:

| Doc | Status | Purpose |
| --- | --- | --- |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Current | Release history + in-app update mechanics (architecture / limits / local verification) |
| [`docs/BRIDGE.md`](docs/BRIDGE.md) | Current | Conversion-core bridge contract (ispartaAPI / node-env / processor) |
| [`docs/CEP-UPGRADE-SCOPE.md`](docs/CEP-UPGRADE-SCOPE.md) | Current | CEP upgrade scope and dual-target boundary (shared vs injected) |
| [`docs/RELEASE.md`](docs/RELEASE.md) | Guide | Release process (local CLI triggers the cloud build) |
| [`docs/SIGNPATH.md`](docs/SIGNPATH.md) | Guide | Free Windows code signing application |
| [`docs/SEO_SUBMIT.md`](docs/SEO_SUBMIT.md) | Guide | Landing page search submission |
| [`docs/ACCEPTANCE-RUNBOOK.md`](docs/ACCEPTANCE-RUNBOOK.md) | Guide | Dual-target on-device acceptance steps |
| [`docs/PLAN-DUAL-TARGET.md`](docs/PLAN-DUAL-TARGET.md) | Current | Shared desktop/CEP implementation, host boundaries, and status |
| [`docs/maintenance/optimization-log.md`](docs/maintenance/optimization-log.md) | Log | Documentation/layout maintenance and verification boundaries |
| [`targets/cep/README.md`](targets/cep/README.md) | Guide | CEP development, build, and safe local mounting |
| [`targets/cep/bin/README.md`](targets/cep/bin/README.md) | Guide | CEP encoder tools and runtime requirements |
| [`AGENTS.md`](AGENTS.md) | Convention | Dev / commit / release conventions (humans and agents) |
| [`docs/compose/ROADMAP-isparta-next.md`](docs/compose/ROADMAP-isparta-next.md) | Archived | Electron modernization history (no current tasks) |
| [`docs/PLAN-GUIDE-PAGES.md`](docs/PLAN-GUIDE-PAGES.md) | Archived | Onboarding history index and lessons; no current plan |
| [`docs/CEP-ALIGNMENT.md`](docs/CEP-ALIGNMENT.md) | Archived | Historical shared CEP design; not current behavior |
| [`docs/EXEC-WAVE2.md`](docs/EXEC-WAVE2.md) | Archived | Dual-target adapter history; no current tasks |
| [`docs/compose/spec/`](docs/compose/spec/) | Archived | Historical Electron, frontend, interaction, and size-limit specifications |

## Tech stack

- **Desktop**: [Electron](https://www.electronjs.org/) 28  
- **UI**: Vue 2 · Vue Router · Vuex · vue-i18n · Sass  
- **Tooling**: Vue CLI 4 · vue-cli-plugin-electron-builder · electron-builder  
- **Engines**: APNG Tools (`apngasm` / `apngdis` / `apngopt` / `apngquant`), libwebp (`cwebp` / `dwebp` / `webpmux`), `gif2apng` / `apng2gif`  

## Architecture

From the renderer UI to the native CLIs, and across to the AE extension target — every edge maps to a real IPC / bridge / exec boundary:

<img src="docs/diagrams/architecture-en.svg" alt="iSparta-next architecture: the Vue UI talks to the Electron main process through a preload IPC whitelist; the main process drives the shared conversion core and spawns native CLIs. The same Vue UI and conversion core run inside the After Effects CEP panel via host/source adapters." width="880">

## Security architecture

- No `remote`; dialogs/menus via main-process IPC  
- `contextIsolation: true` · `nodeIntegration: false` · `sandbox: true`  
- Preload whitelist; FS and `execFile` prefer main process  
- Renderer loads local frame thumbs via `isparta-file` protocol  

Current implementation status and project history are linked in the docs map above.

## Languages

UI language in settings (follows the system by default):

- Follow system  
- 简体中文  
- 繁體中文  
- English  

## Contributing

Issues and PRs welcome.

1. Fork and branch  
2. `npm install && npm run dev`  
3. Keep `npm run lint` green  
4. Describe motivation and how you verified  

## Credits

### Current maintainer (iSparta-next)

- [yancongya](https://github.com/yancongya) — this repo (refactor, features, releases)

### Original authors

- [jeakey](https://github.com/jeakey)  
- [ccJUN](https://github.com/ccJUN)  
- [yikfun](https://github.com/yikfun)  

### Historical contributors / upstream forks

- [DreamPiggy](https://github.com/dreampiggy)  
- [Xheldon](https://github.com/Xheldon)  
- [bigxixi](https://github.com/bigxixi)  

Thanks to everyone who contributed to iSparta and its community forks.

### Third-party tools

- [apngasm](http://apngasm.sourceforge.net/)  
- [APNG Optimizer](https://sourceforge.net/projects/apng/files/APNG_Optimizer/)  
- [apng2webp](https://github.com/Benny-/apng2webp)  
- [pngout](http://advsys.net/ken/utils.htm)  
- [pngquant](https://pngquant.org/)  
- [libwebp](https://developers.google.com/speed/webp/)  

## License

**License: MIT** — full text in [`LICENSE`](LICENSE).

Copyright (c) 2026 [yancongya](https://github.com/yancongya)
