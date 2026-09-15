<template>
  <div class="is-preset" :class="{ 'is-disabled': disabled }">
    <transition-group name="is-preset-list" tag="div" class="is-preset__row">
      <span
        v-for="p in presets"
        :key="p.id"
        class="is-preset__slot"
      >
        <!-- 内联编辑：名字（仅自定义预设）+ 模板 -->
        <span v-if="editing === p.id" class="is-preset__form" @click.stop>
          <input
            v-if="!p.builtin"
            ref="labelIn"
            v-model.trim="form.label"
            class="is-preset__in is-preset__in--label"
            :placeholder="$t('presetNamePh')"
            maxlength="16"
            @keydown.esc="cancelEdit"
            @keydown.enter="confirmEdit"
          />
          <input
            ref="tplIn"
            v-model.trim="form.template"
            class="is-preset__in is-preset__in--tpl"
            placeholder="{srcPath}"
            @keydown.esc="cancelEdit"
            @keydown.enter="confirmEdit"
          />
          <button type="button" class="is-preset__mini is-preset__mini--ok" :aria-label="$t('confirm')" @click.stop="confirmEdit">
            <is-icon name="check" size="xs" />
          </button>
          <button type="button" class="is-preset__mini" :aria-label="$t('cancel')" @click.stop="cancelEdit">
            <is-icon name="close" size="xs" />
          </button>
        </span>

        <!-- 常态胶囊：外层用 span 承载，避免 button 套 button 的非法结构 -->
        <span
          v-else
          class="is-preset__chip"
          :class="{ 'is-active': p.id === activeId, 'is-modified': p.modified }"
        >
          <button
            type="button"
            class="is-preset__main"
            :disabled="disabled"
            v-tip="tipFor(p)"
            @click="apply(p)"
          >
            {{ labelOf(p) }}
          </button>
          <span class="is-preset__acts">
            <button
              v-if="p.builtin && p.modified"
              type="button"
              class="is-preset__act"
              v-tip="$t('presetResetTip')"
              :aria-label="$t('presetReset')"
              @click.stop="resetBuiltin(p)"
            ><is-icon name="refresh" size="xs" /></button>
            <button
              type="button"
              class="is-preset__act"
              v-tip="$t('presetEditTip')"
              :aria-label="$t('presetEdit')"
              @click.stop="startEdit(p)"
            ><is-icon name="edit" size="xs" /></button>
            <button
              v-if="!p.builtin"
              type="button"
              class="is-preset__act is-preset__act--danger"
              v-tip="$t('presetDeleteTip')"
              :aria-label="$t('presetDelete')"
              @click.stop="remove(p)"
            ><is-icon name="trash" size="xs" /></button>
          </span>
        </span>
      </span>
    </transition-group>

    <!-- 新建：放在 transition-group 外，避免参与排序动画 -->
    <span v-if="editing === NEW" class="is-preset__form is-preset__form--new">
      <input
        ref="labelIn"
        v-model.trim="form.label"
        class="is-preset__in is-preset__in--label"
        :placeholder="$t('presetNamePh')"
        maxlength="16"
        @keydown.esc="cancelEdit"
        @keydown.enter="confirmEdit"
      />
      <input
        ref="tplIn"
        v-model.trim="form.template"
        class="is-preset__in is-preset__in--tpl"
        placeholder="{srcPath}"
        @keydown.esc="cancelEdit"
        @keydown.enter="confirmEdit"
      />
      <button type="button" class="is-preset__mini is-preset__mini--ok" :aria-label="$t('confirm')" @click.stop="confirmEdit">
        <is-icon name="check" size="xs" />
      </button>
      <button type="button" class="is-preset__mini" :aria-label="$t('cancel')" @click.stop="cancelEdit">
        <is-icon name="close" size="xs" />
      </button>
    </span>
    <button
      v-else
      type="button"
      class="is-preset__add"
      :disabled="disabled"
      v-tip="$t('presetAddTip')"
      @click="startNew"
    >
      <is-icon name="plus" size="xs" />
      <span>{{ $t('presetAdd') }}</span>
    </button>
  </div>
</template>

<!--
  输出路径预设条：内置 + 用户自定义胶囊，支持新增 / 重命名 / 改模板 / 删除 / 恢复默认。
  模板仍是唯一真相源——胶囊点击只是把模板写进「变量路径」，删除预设不影响已有任务。
  hover 气泡直接显示「该模板对当前任务解析后的真实路径」，比抽象模板名更直观。
-->
<script>
import IsIcon from './ui/IsIcon.vue'
import { resolveVars } from '../../util/outputPath'

const NEW = '__new__'

export default {
  name: 'IsPresetBar',
  components: { IsIcon },
  props: {
    // presetList() 的结果
    presets: { type: Array, default () { return [] } },
    // 当前模板命中的预设 id（'' 表示未收藏的自定义路径）
    activeId: { type: String, default: '' },
    // outputContext(item)：用于 hover 气泡展示解析后的真实路径
    ctx: { type: Object, default: null },
    // 当前「变量路径」内容：新建预设时作为预填值
    currentTemplate: { type: String, default: '' },
    disabled: { type: Boolean, default: false }
  },
  data () {
    return {
      NEW: NEW,
      editing: null,
      form: { id: '', label: '', template: '' }
    }
  },
  methods: {
    labelOf (p) {
      return p.builtin ? this.$t(p.labelKey) : (p.label || this.$t('presetUnnamed'))
    },
    tipFor (p) {
      if (!this.ctx) { return p.template }
      const resolved = resolveVars(p.template, this.ctx)
      return resolved ? resolved + '\n' + p.template : p.template
    },
    apply (p) {
      this.$emit('apply', p)
    },
    resetBuiltin (p) {
      this.$emit('reset', p)
    },
    remove (p) {
      this.$emit('remove', p)
    },
    startEdit (p) {
      this.editing = p.id
      this.form = { id: p.id, label: p.builtin ? '' : p.label, template: p.template }
      this.focusForm(p.builtin)
    },
    startNew () {
      this.editing = NEW
      // 新建时预填当前「变量路径」：最常见的动作就是把手头这条路径收藏成预设
      this.form = { id: '', label: '', template: this.currentTemplate || '' }
      this.focusForm(false)
    },
    focusForm (skipLabel) {
      this.$nextTick(() => {
        const el = skipLabel ? this.$refs.tplIn : this.$refs.labelIn
        const target = Array.isArray(el) ? el[0] : el
        if (target && target.focus) { target.focus() }
      })
    },
    cancelEdit () {
      this.editing = null
      this.form = { id: '', label: '', template: '' }
    },
    confirmEdit () {
      const tpl = String(this.form.template || '').trim()
      if (!tpl) { return }
      this.$emit('save', {
        id: this.editing === NEW ? '' : this.editing,
        label: this.form.label,
        template: tpl,
        builtin: this.editing !== NEW && this.isBuiltinId(this.editing)
      })
      this.cancelEdit()
    },
    isBuiltinId (id) {
      return id === 'output' || id === 'beside'
    }
  }
}
</script>
