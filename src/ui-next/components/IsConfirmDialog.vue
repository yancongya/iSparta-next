<template>
  <is-dialog
    :visible="state.visible"
    :title="state.title"
    width="440px"
    root-class="is-confirm-root"
    panel-class="is-confirm-panel"
    @close="cancel"
    @update:visible="onVisible"
  >
    <div class="is-confirm-dialog__body">
      <span class="is-confirm-dialog__badge" aria-hidden="true">
        <is-icon name="question" size="lg" />
      </span>
      <div class="is-confirm-dialog__text">{{ state.text }}</div>
    </div>

    <template slot="footer">
      <div class="is-confirm-dialog__acts" :class="{ 'is-confirm-dialog__acts--alt': !!state.altText }">
        <is-button type="text" @click="cancel">{{ state.cancelText || $t('cancel') }}</is-button>
        <is-button v-if="state.altText" type="danger" @click="alt">{{ state.altText }}</is-button>
        <is-button type="primary" @click="confirm">{{ state.confirmText || $t('confrim') }}</is-button>
      </div>
    </template>
  </is-dialog>
</template>

<!--
  统一询问确认弹窗（桌面 + CEP 共用，Home 里挂一次）。
  取代原来「带两个按钮的长条 toast」：询问是阻断操作，需要遮罩 + 居中面板 +
  完整多行路径，toast 胶囊承载不了。状态和 Promise 回填都在 notice.js 的 confirmState。
  - 取消按钮 / 点遮罩 / ESC / 右上关闭 → 一律 resolve(false)（安全方向：不执行危险操作）
  - 主按钮（primary） → resolve(true)
  - 备选按钮（danger，仅当 state.altText 有值时出现） → resolve(state.altValue)
    用于「两种后果都成立、必须让用户选」的场景（如覆盖源文件 vs 加后缀另存）：
    破坏性选项画成 danger 描边，推荐选项保持 primary。
-->
<script>
import IsDialog from './ui/IsDialog.vue'
import IsIcon from './ui/IsIcon.vue'
import IsButton from './ui/IsButton.vue'
import { confirmState, answerConfirm } from '../notice'

export default {
  name: 'IsConfirmDialog',
  components: { IsDialog, IsIcon, IsButton },
  data () {
    return { state: confirmState }
  },
  methods: {
    confirm () { answerConfirm(true) },
    cancel () { answerConfirm(false) },
    alt () { answerConfirm(this.state.altValue) },
    // IsDialog 内部 close() 会 emit update:visible(false)；遮罩点击/ESC/关闭按钮都走这里
    onVisible (v) { if (!v) this.cancel() }
  }
}
</script>

<style lang="scss">
@import "../styles/bp";

.is-confirm-panel {
  .is-dialog__body { padding-top: var(--is-s-4); }
}

.is-confirm-dialog {
  &__body {
    display: flex;
    align-items: flex-start;
    gap: var(--is-s-3);
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--is-cool-bg);
    color: var(--is-cool);
  }

  &__text {
    flex: 1;
    min-width: 0;
    max-height: 260px;
    overflow-y: auto;
    color: var(--is-text-2);
    font-size: var(--is-fs-md);
    line-height: 1.6;
    white-space: pre-line;
    word-break: break-all;
  }

  &__acts {
    display: flex;
    justify-content: flex-end;
    gap: var(--is-s-2);
  }
}

// CEP 面板常见 ~420px / 窄窗口：收紧四周留白、正文降档 + 限高，
// 长路径不把面板撑满；按钮仍单行、保持最小可点尺寸。
// 断点统一取 styles/_bp.scss，禁止手写邻近值。
@media (max-width: $bp-compact) {
  .is-dialog.is-confirm-root { padding: var(--is-s-3); }
  .is-confirm-panel {
    .is-dialog__header { padding: var(--is-s-3) var(--is-s-4); }
    .is-dialog__body { padding: var(--is-s-4); }
    .is-dialog__footer { padding: var(--is-s-3) var(--is-s-4); }
  }
  .is-confirm-dialog {
    &__badge { width: 34px; height: 34px; }
    &__text { max-height: 180px; font-size: var(--is-fs-sm); }
  }
}

// CEP 极窄 ≤$bp-narrow：两按钮平分宽度，避免长文案把「取消」挤出面板。
@media (max-width: $bp-narrow) {
  .is-confirm-dialog__acts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    .is-btn { width: 100%; }
  }
  // 三按钮（取消 / 破坏性备选 / 主操作）：主操作独占一行，其余两个并排，
  // 长文案（另存为 xxx_1.png）也不会把「取消」挤没。
  .is-confirm-dialog__acts--alt {
    .is-btn:last-child { grid-column: 1 / -1; }
  }
}
</style>
