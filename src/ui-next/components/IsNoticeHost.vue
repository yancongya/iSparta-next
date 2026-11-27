<template>
  <div class="is-notice" aria-live="polite">
    <transition-group name="is-notice">
      <div
        v-for="item in items"
        :key="item.id"
        class="is-notice-item"
        :class="'is-notice-item--' + item.type"
        @mouseenter="pause(item)"
        @mouseleave="resume(item)"
      >
        <span class="is-notice-item__badge">
          <is-icon :name="item.icon" :spin="item.icon === 'loader'" size="sm" />
        </span>

        <div class="is-notice-item__body">
          <strong v-if="item.title" class="is-notice-item__title">{{ item.title }}</strong>
          <span v-if="item.text" :title="item.text" class="is-notice-item__text">{{ item.text }}</span>
        </div>

        <button
          v-if="item.closable && !item.action"
          type="button"
          class="is-notice-item__ok"
          @click="close(item.id)"
        >{{ $t('gotIt') }}</button>

        <span
          v-if="item.duration"
          class="is-notice-item__bar"
          :class="{ 'is-paused': item.paused }"
          :style="{ animationDuration: item.duration + 'ms' }"
        ></span>
      </div>
    </transition-group>
  </div>
</template>

<script>
import IsIcon from './ui/IsIcon.vue'
import notice from '../notice'

export default {
  name: 'IsNoticeHost',
  components: { IsIcon },
  mounted () {
    // 必须挂到 body：面板里的 IsDialog 会 teleport 到 body（z-index 2000），
    // 而本容器若留在 .ib 内，会被 dialog 的层叠上下文压住——toast 明明生成了
    // 却被弹窗盖住看不见（日志面板打开时点「复制全部」就是这种情况）。
    // 与 dialog 同级后 z-index 3000 才真正生效，任何弹窗打开时提示都能露出。
    if (this.$el && this.$el.parentNode !== document.body) {
      document.body.appendChild(this.$el)
    }
  },
  computed: {
    items () {
      return notice.state.items
    }
  },
  methods: {
    close (id) {
      notice.close(id)
    },
    // 倒计时由 notice.js 统一持有，这里只负责冻结/恢复进度条的 CSS 动画
    pause (item) {
      item.paused = true
      notice.pause(item.id)
    },
    resume (item) {
      item.paused = false
      notice.resume(item.id)
    }
  }
}
</script>
