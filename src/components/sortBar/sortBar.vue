<template>
  <section class="mod-bar">
    <span class="bar-label">{{ $t('inputItems') }}<span v-if="itemCount" class="bar-count">（{{ itemCount }}）</span></span>
    <el-checkbox
      class="bar-selectall"
      :value="allChecked"
      :indeterminate="indeterminate"
      @change="toggleAll"
    >{{ $t('selectAll') }}</el-checkbox>
  </section>
</template>

<script>
  export default {
    computed: {
      items () {
        return this.$store.getters.getterItems
      },
      itemCount () {
        return this.items.length
      },
      selectedCount () {
        return this.$store.getters.getterSelected.length
      },
      allChecked () {
        return this.itemCount > 0 && this.selectedCount === this.itemCount
      },
      indeterminate () {
        return this.selectedCount > 0 && this.selectedCount < this.itemCount
      }
    },
    methods: {
      toggleAll () {
        if (this.$store.getters.getterLocked) {
          return false
        }
        if (this.allChecked) {
          this.$store.dispatch('noneSelect')
        } else {
          this.$store.dispatch('allSelect')
        }
      }
    }
  }
</script>

<style lang="scss">
.mod-bar{
  position:fixed;
  left:0;
  bottom:0;
  width:100%;
  height:40px;
  line-height:40px;
  border:1px solid #E4E4E4;
  background:#F2F2F2;
  padding:0 15px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  z-index: 100;
  .bar-label{
    font-size:13px;
    color:#5a5a5a;
  }
  .bar-count{
    color:#999;
  }
  .bar-selectall{
    margin-left:auto;
    margin-right:0;
  }
}
</style>
