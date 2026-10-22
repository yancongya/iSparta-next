# Documentation and layout maintenance

## 2026-10-22 — dual-target docs and navigation

- Replaced stale CEP interaction claims with the verified current flow: project compositions sync into tasks, tree selection mirrors task selection, and double-click calls the AE reveal adapter. The tree drag payload and `comp-source` drop/paste helpers are not connected to the `Home.vue` drop/paste handlers.
- Updated the Windows development mount instructions to stop when either a user-level target or system-level product copy exists. The instructions no longer recursively delete an existing extension directory. Windows NSIS and macOS pkg install system-level copies; the user-level mount is for development and must not coexist with the same product ID.
- Updated `AGENTS.md`, both READMEs, `PLAN-DUAL-TARGET.md`, `CEP-UPGRADE-SCOPE.md`, `ACCEPTANCE-RUNBOOK.md`, and the CEP README so current status, host boundaries, build paths, and manual acceptance point to the right source.
- Replaced obsolete execution, desktop/CEP alignment, and onboarding plans with short archived notes; removed the duplicate acceptance checklist. Preserved the onboarding preview lessons still referenced by `scripts/dev/verify-onboarding-window.mjs`; Git history retains the superseded planning detail.
- Directory audit found no safe value in moving runtime or build directories. `src/` remains the source; `targets/cep/` contains the CEP shell plus a tracked UI build mirror; `public/bin/` and `static/bin/` serve distinct runtime/package paths; `build/`, `dist/`, and `scripts/` have hardcoded consumers. Preserve those boundaries unless callers and packaging checks are changed together.
- Architecture assessment: this is one Vue 2 + processor product with Electron and CEP host adapters. It has a shared desktop/CEP installer/update path, but also standalone CEP ZIP artifacts. A shared version/release does not eliminate per-host artifact and real-host acceptance requirements.

### Verification boundary

Documentation and local link checks do not prove installation or runtime behavior in After Effects. The Windows/macOS and AE acceptance rows in `ACCEPTANCE-RUNBOOK.md` remain user-device checks; do not mark them complete from source inspection or CI alone.

## Onboarding preview lessons

These are retained from the completed onboarding plan because the preview/check tooling still relies on them; they are implementation lessons, not a current task list.

| Pitfall | Verified handling |
| --- | --- |
| Theme token attached to the wrong DOM level | Put the theme class on `documentElement`; CSS custom properties inherit downward. |
| Electron misdetected as plain Node in headless capture | Remove `ELECTRON_RUN_AS_NODE` before starting the capture process. |
| GPU process crashes in headless capture | Use SwiftShader with `--no-sandbox --in-process-gpu --use-gl=swiftshader --disable-gpu-sandbox`. |
| Screenshot and computed styles show a stale frame | Cross-check multiple readings from the same state; do not trust one capture signal alone. |
| SVG remains bright in dark mode | Use theme tokens for all SVG colors. |
| SVG rotation/orbit moves out of frame | Do not place orbiting elements inside translated groups; set `transform-box: fill-box` on rotating/scaling elements. |
| `'system'` is assigned directly to vue-i18n | Resolve the system locale before assigning it to vue-i18n. |
| Reduced-motion leaves animated content hidden | Animated elements must reach a visible final state when motion is disabled. |

The remaining preview command and artifact-boundary checks live in `scripts/dev/verify-onboarding-window.mjs` and the current `AGENTS.md` preview/build guidance.
