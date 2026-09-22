/**
 * 自绘组件库统一出口
 *
 * 两种用法：
 *   1. 全局注册：main.js 里 Vue.use(UIComponents)，模板直接写 <is-button>
 *   2. 按需引入：import IsButton from '@/ui-next/components/ui/IsButton.vue'
 *
 * 命名约定：组件用 IsXxx（PascalCase），模板里写 is-xxx。
 * 不要用 ISXxx —— eslint-plugin-vue 会把连续大写转成 i-s-xxx 而误报「已注册但未使用」。
 */

import IsIcon from './IsIcon.vue'
import IsButton from './IsButton.vue'
import IsCheckbox from './IsCheckbox.vue'
import IsCheckboxGroup from './IsCheckboxGroup.vue'
import IsTag from './IsTag.vue'
import IsInput from './IsInput.vue'
import IsInputNumber from './IsInputNumber.vue'
import IsForm from './IsForm.vue'
import IsFormItem from './IsFormItem.vue'
import IsDialog from './IsDialog.vue'
import IsSegmented from './IsSegmented.vue'
import IsSwitch from './IsSwitch.vue'
import IsNumberTween from './IsNumberTween.vue'
import IsProgress from './IsProgress.vue'
import IsScrollFade from './IsScrollFade.vue'
import IsAlert from './IsAlert.vue'

export {
  IsIcon,
  IsButton,
  IsCheckbox,
  IsCheckboxGroup,
  IsTag,
  IsInput,
  IsInputNumber,
  IsForm,
  IsFormItem,
  IsDialog,
  IsSegmented,
  IsSwitch,
  IsNumberTween,
  IsProgress,
  IsScrollFade,
  IsAlert
}

const components = [
  ['IsIcon', IsIcon],
  ['IsButton', IsButton],
  ['IsCheckbox', IsCheckbox],
  ['IsCheckboxGroup', IsCheckboxGroup],
  ['IsTag', IsTag],
  ['IsInput', IsInput],
  ['IsInputNumber', IsInputNumber],
  ['IsForm', IsForm],
  ['IsFormItem', IsFormItem],
  ['IsDialog', IsDialog],
  ['IsSegmented', IsSegmented],
  ['IsSwitch', IsSwitch],
  ['IsNumberTween', IsNumberTween],
  ['IsProgress', IsProgress],
  ['IsScrollFade', IsScrollFade],
  ['IsAlert', IsAlert]
]

export default {
  install (Vue) {
    if (this._installed) return
    this._installed = true
    components.forEach(function (pair) {
      Vue.component(pair[0], pair[1])
    })
  }
}
