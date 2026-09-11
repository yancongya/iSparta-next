<template>
  <span class="is-tag" :class="'is-tag--' + tone">
    <is-icon v-if="icon" :name="icon" size="xs" />
    <slot />
  </span>
</template>

<script>
import IsIcon from './IsIcon.vue'

export default {
  name: 'IsTag',
  components: { IsIcon },
  props: {
    // accent | ok | warn | bad | cool | violet | plain（对应 .is-tag--* 变体）
    tone: { type: String, default: 'plain' },
    icon: { type: String, default: '' }
  }
}
</script>
