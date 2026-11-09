/**
 * CEP 浏览器预览 mockup 模式（dev only，显式开关）
 *
 * 开启：http://127.0.0.1:8082/?mock=1 （或 ?mockup=1）
 * 作用：纯浏览器里没有 AE 宿主，桥拿不到工程数据，任务列表/合成树都是空的。
 *       本模式用一组固定假数据把「任务 / 合成树 / 输出格式开关」全部点亮，
 *       只开浏览器就能调 CEP 的 UI 交互，不必开 AE 面板。
 *
 * 边界（对应 AGENTS.md「CEP 铁律：禁 mock」）：
 * - 仅 NODE_ENV=development 生效；生产构建时 installMockup 的判断被 DefinePlugin 折叠
 * - 必须显式带 URL 参数；真实 CEP 面板、不带参数的浏览器预览完全不受影响
 * - 本模块只提供 AE 侧假应答，ispartaAPI 仍由 src/util/mock-bridge.js 安装
 * - 必须是 src/cep/main.js 的第一个 import：ensure-bridge / store 都在模块顶层求值
 */
/* global window */

const PROJECT_PATH = '/mock/Project/示例工程.aep'

/** 长名 + 短名混排，覆盖「名字省略但三个格式子列不被挤压」的验收场景 */
const COMPS = [
  { index: 1, name: '主视觉_Banner_1920x1080', width: 1920, height: 1080, fps: 25, frames: 125 },
  { index: 2, name: '这是个特别长的合成名称_用于验证省略号与三个格式图标不会被挤压_ABCDEFGHIJKLMNOP', width: 1080, height: 1080, fps: 30, frames: 90 },
  { index: 3, name: 'Loading_循环动效', width: 512, height: 512, fps: 24, frames: 48 },
  { index: 4, name: '字幕条_下三分之一', width: 1920, height: 240, fps: 25, frames: 75 },
  { index: 5, name: '转场_粒子', width: 1280, height: 720, fps: 60, frames: 180 },
  { index: 6, name: 'UI_图标序列', width: 256, height: 256, fps: 12, frames: 36 }
]

function comp (c) {
  return Object.assign({ type: 'composition', projectPath: PROJECT_PATH }, c)
}

function projectTree () {
  return {
    projectPath: PROJECT_PATH,
    children: [{
      type: 'root',
      name: '示例工程',
      children: [
        { type: 'folder', name: '主视觉', children: [comp(COMPS[0]), comp(COMPS[1])] },
        { type: 'folder', name: '动效', children: [comp(COMPS[2]), comp(COMPS[4])] },
        comp(COMPS[3]),
        comp(COMPS[5])
      ]
    }]
  }
}

/** comp-source.evalJson / host-env 都按 script 名分派，返回值必须是 Promise */
function evalJson (script) {
  const s = String(script || '')
  if (s.indexOf('ispartaGetProjectTree') === 0) return Promise.resolve(projectTree())
  if (s.indexOf('ispartaGetCompositions') === 0) return Promise.resolve(COMPS.map(comp))
  if (s.indexOf('ispartaGetProjectStatus') === 0) {
    return Promise.resolve({ ok: true, code: 'ok', projectPath: PROJECT_PATH })
  }
  if (s.indexOf('ispartaGetSelectedComps') === 0) return Promise.resolve({ ok: true, comps: [] })
  if (s.indexOf('ispartaRevealComp') === 0) return Promise.resolve({ ok: true })
  if (s.indexOf('ispartaPickOutputFolder') === 0) return Promise.resolve({ ok: false })
  // 其余 jsx（渲序列等）在 UI 调试里不会真跑；给 ok 让调用方走正常分支
  return Promise.resolve({ ok: true })
}

export function installMockup () {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return false
  const search = (window.location && window.location.search) || ''
  if (!/[?&](?:mock|mockup)=1(?:&|$)/.test(search)) return false

  // ensure-bridge 见到这个标志就让位，mock-bridge 见到它就强制接管 ispartaAPI
  window.__ispartaMockup = true
  // 覆盖外链 cs.js 在纯浏览器里挂的宿主对象；host-env 据此识别为 CEP（显示合成树）
  window.ispartaCS = {
    evalJson: evalJson,
    evalScript: function () { return Promise.resolve('true') },
    openURLInDefaultBrowser: function () { return true }
  }
  try {
    // eslint-disable-next-line no-console
    console.info('[mockup] CEP 假数据模式已启用：任务种子 + 示例合成树（仅开发预览）')
  } catch (e) { /* ignore */ }
  return true
}

installMockup()

export default installMockup
