// 惰性预估调度器：把「打盘 / IPC」类的重计算推迟到浏览器空闲、分批执行，
// 避免 v-for 首次渲染时同步对每个任务调 statSize 造成卡顿与压力。
//
// 用法（组件内）：
//   this._lazy = createLazyEstimate({
//     compute: (key, args) => ({ stamp: stampOf(args), value: heavyCalc(args) }),
//     onFlush: () => { this.estimateVersion++ }   // 触发模板重渲染
//   })
//   模板调 estimateOf(x) → void this.estimateVersion（建依赖）→ this._lazy.get(key, x, stamp)
//
// - get 命中缓存直接返回；miss 时登记待算并返回旧值（首帧为 null）
// - 同一 key 只调度一次；stamp 变化触发重算
// - requestIdleCallback 不可用（CEP/旧内核）时 setTimeout 兜底
// - 每批尽量控制在 1 个空闲片内，未算完自动排下一片

export function createLazyEstimate (options) {
  const opts = options || {}
  const compute = typeof opts.compute === 'function' ? opts.compute : function () { return null }
  const onFlush = typeof opts.onFlush === 'function' ? opts.onFlush : null
  const batch = Math.max(1, Number(opts.batch) || 4)

  const cache = new Map()   // key -> { stamp, value }
  const pending = new Map() // key -> { args, stamp }
  let queued = false
  let disposed = false

  const hasRIC = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
  const ric = hasRIC
    ? (fn) => window.requestIdleCallback(fn, { timeout: 1200 })
    : (fn) => setTimeout(fn, 0)

  function flush (deadline) {
    queued = false
    if (disposed) return
    let changed = false
    let done = 0
    for (const entry of pending) {
      const key = entry[0]
      const job = entry[1]
      // 空闲时间不足且已处理过一批，剩下的排到下一片，避免长任务卡帧
      if (done >= batch) break
      if (deadline && typeof deadline.timeRemaining === 'function' &&
          deadline.timeRemaining() <= 0 && done > 0) break
      pending.delete(key)
      const result = compute(key, job.args)
      if (result && result.stamp !== job.stamp) continue // 期间配置又变了，交给后续 get 重调度
      cache.set(key, result || { stamp: job.stamp, value: null })
      changed = true
      done++
    }
    if (changed && onFlush) onFlush()
    if (pending.size) schedule()
  }

  function schedule () {
    if (disposed || queued || !pending.size) return
    queued = true
    ric(flush)
  }

  return {
    /** 读缓存；miss/失效时登记待算，返回旧值或 null */
    get (key, args, stamp) {
      if (disposed) return null
      const hit = cache.get(key)
      if (hit && hit.stamp === stamp) return hit.value
      pending.set(key, { args: args, stamp: stamp })
      schedule()
      return hit ? hit.value : null
    },
    /** 主动作废某个 key（产物重试后可调用） */
    invalidate (key) {
      cache.delete(key)
      pending.delete(key)
    },
    /** 清空并停止后续调度（组件销毁时调用） */
    dispose () {
      disposed = true
      pending.clear()
      cache.clear()
    }
  }
}
