# Wave 2 execution history

> **Archived:** the work breakdown and checkboxes below the original adapter design are retired. This file remains only for source-comment anchors; current behavior and acceptance are documented in `AGENTS.md`, `PLAN-DUAL-TARGET.md`, and `CEP-UPGRADE-SCOPE.md`.

## 2.1 `hostAdapter`

Historical interface concept. Current host capabilities are defined in `src/util/host-env.js`; agent guidance is in `AGENTS.md` §8.1.

## 2.2 `sourceAdapter`

Historical input-source concept. Current event wiring must be checked across `Home.vue`, `compTree.vue`, and `src/cep/comp-source.js`; adapter methods alone do not prove a user-facing path is connected.
