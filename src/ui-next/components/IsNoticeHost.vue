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
          <span v-if="item.text" class="is-notice-item__text">{{ item.text }}</span>
          <div v-if="item.action" class="is-notice-item__actions">
            <is-button size="sm" type="text" @click="item.action.onCancel()">
              {{ item.action.cancelText || $t('cancel') }}
            </is-button>
            <is-button size="sm" type="primary" @click="item.action.onConfirm()">
              {{ item.action.confirmText || $t('confrim') }}
            </is-button>
          </div>
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
import IsButton from './ui/IsButton.vue'
import notice from '../notice'

export default {
  name: 'IsNoticeHost',
  components: { IsIcon, IsButton },
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
