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
  seqPresetList,
  activePresetIdOf,
  activeSeqDirPresetIdOf,
  activePresetOf,
  setBuiltinTemplate,
  setSeqDirBuiltinTemplate,
  resetBuiltinTemplate,
  upsertCustomPreset,
  removeCustomPreset
} from './outputPath'

const KEY = 'outputPresets'
// 序列帧目录的预设独立存放，避免与产物路径预设混用（两组语义不同）
export const SEQ_DIR_PRESETS_KEY = 'seqDirPresets'

export function loadPresets (key) {
  try {
    const raw = storage.getItem(key || KEY)
    if (!raw) { return emptyPresets() }
    return normalizePresets(JSON.parse(raw))
  } catch (e) {
    return emptyPresets()
  }
}

export function savePresets (presets, key) {
  try {
    storage.setItem(key || KEY, JSON.stringify(normalizePresets(presets)))
  } catch (e) { /* 桥未就绪时静默：下次启动回到空预设，不影响功能 */ }
}

export {
  presetList,
  seqPresetList,
  activePresetIdOf,
  activeSeqDirPresetIdOf,
  activePresetOf,
  setBuiltinTemplate,
  setSeqDirBuiltinTemplate,
  resetBuiltinTemplate,
  upsertCustomPreset,
  removeCustomPreset
}
