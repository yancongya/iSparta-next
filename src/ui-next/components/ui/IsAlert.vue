<template>
  <div class="is-alert" :class="'is-alert--' + variant" role="alert">
    <is-icon v-if="iconName" class="is-alert__icon" :name="iconName" size="sm" />
    <div class="is-alert__body">
      <strong v-if="title || $slots.title" class="is-alert__title">
        <slot name="title">{{ title }}</slot>
      </strong>
      <p v-if="description || $slots.default" class="is-alert__desc">
        <slot>{{ description }}</slot>
      </p>
      <div v-if="$slots.action" class="is-alert__action">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

<script>
import IsIcon from './IsIcon.vue'

const ICONS = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert',
  danger: 'x-circle'
}

export default {
  name: 'IsAlert',
  components: { IsIcon },
  props: {
    // info | success | warning | danger
    variant: { type: String, default: 'info' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: '' }
  },
  computed: {
    iconName () {
      return this.icon || ICONS[this.variant] || ICONS.info
    }
  }
}
</script>
