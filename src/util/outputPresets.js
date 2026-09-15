/**
 * 输出路径预设的读写
 *
 * 独立 storage 键（与 uiSideW 同一模式），不塞进 globalSetting.options：
 * ITEMS_ADD 会把全局配置整个 clone 进每条任务，塞进去会让每个任务背一份预设副本。
 * 读写失败一律降级为「空预设」，绝不抛错打断渲染。
 */

import { storage } from './node-env'
import {
  emptyPresets,
  normalizePresets,
  presetList,
  activePresetIdOf,
  setBuiltinTemplate,
  resetBuiltinTemplate,
  upsertCustomPreset,
  removeCustomPreset
} from './outputPath'

const KEY = 'outputPresets'

export function loadPresets () {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) { return emptyPresets() }
    return normalizePresets(JSON.parse(raw))
  } catch (e) {
    return emptyPresets()
  }
}

export function savePresets (presets) {
  try {
    storage.setItem(KEY, JSON.stringify(normalizePresets(presets)))
  } catch (e) { /* 桥未就绪时静默：下次启动回到空预设，不影响功能 */ }
}

export {
  presetList,
  activePresetIdOf,
  setBuiltinTemplate,
  resetBuiltinTemplate,
  upsertCustomPreset,
  removeCustomPreset
}
