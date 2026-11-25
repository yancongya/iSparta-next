/**
 * L1 沙箱用的 bridge 形状 path。
 *
 * 为什么要这个：renderer 里没有 node 的 path 对象，拿到的 path 来自 preload /
 * cep-bridge / mock-bridge 三套 bridge，方法面只有 join / dirname / basename / sep
 * （契约见 docs/BRIDGE.md §2.3）。如果 L1 沙箱注入真 node path（含 extname /
 * resolve 等），renderer 代码里越界调用这些方法就会在沙箱里「绿灯」，
 * 而真机（桌面 Electron）上直接抛 "path.extname is not a function"。
 *
 * 所以沙箱必须注入与 bridge 同形状的 path：只有 join/dirname/basename/sep。
 * 越界调用会在沙箱里立刻炸出来，而不是等到真机。
 */
const path = require('path')

/** 与 bridge 一致的 path 方法面（改 bridge 契约时这里要同步） */
const BRIDGE_PATH_METHODS = ['join', 'dirname', 'basename', 'sep']

/**
 * 把 node 的 path 实现裁剪成 bridge 形状。
 * @param {object} impl node path 实现（path.posix / path.win32 / path）
 */
function bridgePath (impl) {
  return {
    join: (...a) => impl.join(...a),
    dirname: (p) => impl.dirname(p),
    basename: (p, ext) => impl.basename(p, ext),
    get sep () { return impl.sep }
  }
}

module.exports = { bridgePath, BRIDGE_PATH_METHODS }
