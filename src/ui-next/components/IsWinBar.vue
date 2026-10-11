<template>
  <!-- 主窗口自绘顶栏：左品牌名 + 版本号，右窗口按钮。
       整条是拖拽区（frameless 窗口必须靠它拖动），按钮与品牌点击要显式 no-drag。 -->
  <header
    class="wbar"
    :class="{ 'is-mac': isMac, 'is-expanded': maximized }"
    @dblclick="onDblClick"
  >
    <div class="wbar__brand" :title="appName" @click="openLanding">
      <!--
        logo 直接用已有位图资源，不内联 SVG path。
        ⚠ 内联过一次，被手工改动搞坏了（8.564363 被插入空格，圆弧半径失真 →
        圆形压成竖橄榄），且修路径要逐字符比对唯一源。位图由scripts/build-app-icons.js
        从 public/icons/icon-brand.svg 生成，改设计只动 SVG 一处。
        显示 16px 用 64px 源，留足高分屏余量。
      -->
      <span class="wbar__mark" aria-hidden="true">
        <img src="app://./icons/icon-64.png" width="16" height="16" alt="" decoding="async" />
      </span>
      <span class="wbar__name">{{ appName }}</span>
      <span class="wbar__ver mono">{{ appVersion }}</span>
    </div>

    <div class="wbar__spacer" />

    <!-- 工具按钮插槽：空态的视图切换/帮助/设置/主题插这里，与窗口按钮同行 -->
    <slot name="tools" />

    <!-- mac 有原生红绿灯（titleBarStyle:hiddenInset），不自绘窗口按钮 -->
    <div v-if="canControlWindow" class="wbar__wins">
      <button
        type="button"
        class="wbar__btn"
        :title="$t('obWinMinimize')"
        :aria-label="$t('obWinMinimize')"
        @click.stop="winMinimize"
      >
        <is-icon name="minus" size="xs" />
      </button>
      <button
        type="button"
        class="wbar__btn"
        :title="maximized ? $t('obWinRestore') : $t('obWinMaximize')"
        :aria-label="maximized ? $t('obWinRestore') : $t('obWinMaximize')"
        @click.stop="winToggleMaximize"
      >
        <is-icon :name="maximized ? 'copy' : 'square'" size="xs" />
      </button>
      <button
        type="button"
        class="wbar__btn wbar__btn--danger"
        :title="$t('obWinClose')"
        :aria-label="$t('obWinClose')"
        @click.stop="winClose"
      >
        <is-icon name="close" size="xs" />
      </button>
    </div>
  </header>
</template>

<script>
/**
 * 主窗口自绘顶栏（桌面 frameless 窗口）。
 *
 * 窗口动作走 windowApi.window 的 win:* 三个通道，最大化状态靠
 * onMaximizedChange 回推。
 *
 * 拖拽与双击
 * ----------
 * .wbar 整条是 -webkit-app-region: drag，窗口才能被拖动；按钮必须显式
 * no-drag，否则按下会被拖拽吞掉（引导窗踩过这个坑）。
 *
 * 双击拖拽区 = 最大化/还原。原生窗口是系统行为，自绘后没了；
 * 而 -webkit-app-region: drag 会吃掉鼠标事件，所以把监听挂在 document
 * 上、用「两次 mouseup 的间隔 + 位置落在顶栏内」自己判定，而不是指望
 * 元素的 dblclick。
 *
 * mac 不自绘窗口按钮：titleBarStyle:'hiddenInset' 下系统自带红绿灯，
 * 再画一套会重复。但红绿灯压在顶栏左上角，所以要给品牌区留出左侧内边距。
 */
import IsIcon from './ui/IsIcon.vue'
import hostAdapter from '../../util/host-env'
import { APP_NAME, APP_VERSION, LANDING_URL } from '../../brand'

const DBL_CLICK_MS = 400
const BAR_HEIGHT = 40

function windowApi () {
  return (typeof window !== 'undefined' && window.ispartaAPI) || null
}

export default {
  name: 'IsWinBar',
  components: { IsIcon },
  data () {
    return {
      maximized: false,
      lastUp: 0,
      lastUpY: -1
    }
  },
  computed: {
    appName () {
      return APP_NAME
    },
    appVersion () {
      return APP_VERSION
    },
    isMac () {
      if (typeof navigator === 'undefined') { return false }
      return /mac|darwin/i.test(String(navigator.platform || navigator.userAgent || ''))
    },
    canControlWindow () {
      // mac 走系统红绿灯，不自绘；窗口 API 不存在时也不画
      return !this.isMac && !!(windowApi() && windowApi().window)
    }
  },
  mounted () {
    var api = windowApi()
    if (api && api.window && typeof api.window.onMaximizedChange === 'function') {
      this.unwatchMax = api.window.onMaximizedChange((v) => { this.maximized = v })
    }
    document.addEventListener('mouseup', this.onDocMouseUp, true)
  },
  beforeDestroy () {
    if (this.unwatchMax) { this.unwatchMax() }
    document.removeEventListener('mouseup', this.onDocMouseUp, true)
  },
  methods: {
    openLanding () {
      hostAdapter.openExternal(LANDING_URL)
    },
    winMinimize () {
      var api = windowApi()
      if (api && api.window) { api.window.minimize() }
    },
    winToggleMaximize () {
      var api = windowApi()
      if (api && api.window) { api.window.toggleMaximize() }
    },
    winClose () {
      var api = windowApi()
      if (api && api.window) { api.window.close() }
    },
    /**
     * 双击拖拽区最大化。
     * 监听 document 而不是 .wbar —— drag 区域吃掉鼠标事件，元素级
     * dblclick 不触发。只认「两次 mouseup 都落在顶栏高度内」的快速点击。
     */
    onDocMouseUp (ev) {
      if (ev.button !== 0) { return }
      var top = this.$el ? this.$el.getBoundingClientRect().top : 0
      if (ev.clientY > top + BAR_HEIGHT || ev.clientY < top) { return }
      var now = Date.now()
      if (now - this.lastUp < DBL_CLICK_MS && Math.abs(ev.clientY - this.lastUpY) < 12) {
        this.winToggleMaximize()
        this.lastUp = 0
        return
      }
      this.lastUp = now
      this.lastUpY = ev.clientY
    },
    onDblClick () {
      // 兜底：无 drag 的浏览器/CEP 预览环境下元素级 dblclick 能触发
      if (this.canControlWindow) { this.winToggleMaximize() }
    }
  }
}
</script>

<style scoped>
.wbar {
  /* 整条是拖拽区，frameless 窗口才拖得动 */
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  flex: none;
  height: 40px;
  padding: 0 0 0 12px;
  background: var(--is-panel);
  border-bottom: 1px solid var(--is-border);
  user-select: none;
  -webkit-user-select: none;
}

/* mac 的系统红绿灯压在左上角，品牌区要让开，否则盖住图标 */
.wbar.is-mac { padding-left: 82px; }

/* mac 全屏/最大化时红绿灯隐藏，padding 收掉，品牌左移 */
.wbar.is-mac.is-expanded { padding-left: 12px; }

.wbar__brand {
  display: inline-flex;
  cursor: pointer;
  transition: color var(--is-dur-fast) var(--is-ease-std);
}

.wbar__brand:hover {
  color: var(--is-accent);
  align-items: center;
  gap: 7px;
  min-width: 0;
  /* 品牌本身可点（跳落地页）但不算拖拽区 */
  -webkit-app-region: no-drag;
}

.wbar__mark {
  display: inline-flex;
  flex: none;
  line-height: 0;
}

.wbar__mark img { display: block; }

.wbar__name {
  color: var(--is-text);
  font-size: var(--is-fs-sm);
  font-weight: var(--is-fw-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}

/* 版本号弱化成角标：品牌名是识别主体，抢权重反而看不清是哪一版 */
.wbar__ver {
  color: var(--is-text-3);
  font-size: var(--is-fs-xs);
  letter-spacing: 0.04em;
}

.wbar__spacer {
  flex: 1 1 auto;
  min-width: 0;
}

.wbar__wins {
  display: flex;
  flex: none;
  align-self: stretch;
  white-space: nowrap;
  /* 按钮必须退出拖拽区，否则点击被拖拽吞掉 */
  -webkit-app-region: no-drag;
}

.wbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--is-text-2);
  cursor: pointer;
  transition: background-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

.wbar__btn:hover {
  background: var(--is-inset);
  color: var(--is-text);
}

.wbar__btn--danger:hover {
  background: var(--is-warn, #c2410c);
  color: #fff;
}
</style>
