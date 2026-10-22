# Onboarding implementation history

> **Archived:** the implementation plan and its task checklist are retired. This short note only preserves code-comment anchors and points to the current source; it is not a current plan or acceptance record.

## 4. Onboarding UI

Current components live under `src/ui-next/onboarding/`; routing and entry behavior are implemented by `src/router.js`, `src/cep/main.js`, and `src/ui-next/views/RootGate.vue`.

## 5.1 Root routing

The desktop root route and CEP entry both mount `RootGate`, which chooses the workbench or onboarding flow according to host and first-run state. The source files above are authoritative.

## 5.9 System language migration

`src/store/index.js` contains the one-time migration from the legacy `zh-cn` default to system language. This section records the reason for the source comment; it is not a migration instruction.

## 5.10 Preview lessons

The still-used headless preview lessons are maintained in [`maintenance/optimization-log.md`](maintenance/optimization-log.md#onboarding-preview-lessons). Do not restore the old task checklist from Git history.
