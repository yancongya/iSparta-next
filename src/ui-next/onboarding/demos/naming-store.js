/**
 * 命名演示的跨页共享状态。
 *
 * 为什么需要它：「文件名切分」与「输出路径」拆成了两页，但两者本来是同一条链路 ——
 * 路径里的 {name} 变量取的就是切分后的结果。用一份 Vue.observable 单例把它串起来，
 * 用户在切分页取消掉的词，翻到路径页立刻能看到真实路径变短。
 *
 * 纯演示：**不落任何持久化**，也不与真实输出命名联动。
 */
import Vue from 'vue'

/** 未接线时的兜底名字（与两页演示里的初始值一致） */
export const FALLBACK_NAME = '示例贴纸行走循环高清v3'

/** 切分页写入、路径页读取 */
export const naming = Vue.observable({ name: FALLBACK_NAME })

export function setName (v) {
  naming.name = v || FALLBACK_NAME
  return naming.name
}

export default { naming, setName, FALLBACK_NAME }
