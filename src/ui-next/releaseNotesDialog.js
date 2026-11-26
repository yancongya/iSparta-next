/**
 * 更新日志弹窗的全局开关（桌面与 CEP 共用）。
 *
 * 与 notice.confirmState 同一模式：Home 只挂一个 <is-release-notes-dialog>，
 * 任何入口（通用设置「关于」、后续控制台等）import openReleaseNotes 即可唤起，
 * 不必各自复制一份弹窗实例。
 */
import Vue from 'vue'
import { currentVersion } from '../util/releaseNotes'

export const releaseNotesState = Vue.observable({
  visible: false,
  version: ''
})

export function openReleaseNotes (version) {
  releaseNotesState.version = version || currentVersion()
  releaseNotesState.visible = true
}

export function closeReleaseNotes () {
  releaseNotesState.visible = false
}
