<template>
<section class="mod-list">
  <template v-for="(project,index) in projectList">
    <div class="item" v-bind:class="{active:project.isSelected}" :data-index="index" :key="'item-' + index + '-' + (project.basic && project.basic.type)" @contextmenu="itemRightClick(project.basic,index)">
      <div class="check" @click.stop="toggleSelect(index)">
        <el-checkbox :value="!!project.isSelected" style="pointer-events:none"></el-checkbox>
      </div>
      <div class="thumb">
        <img :src="thumbFor(project.basic && project.basic.fileList && project.basic.fileList[0])" />
      </div>
      <div class="info">
        <div class="input">
          <el-tag :type="getLabel(project.basic && project.basic.type)" size="mini">{{ project.basic && project.basic.type }}</el-tag>
          <p class="inputPath" :title="'输入目录：'+(project.basic && project.basic.inputPath)">{{ (project.basic && project.basic.inputPath) | basePath }}</p>
          <i class="el-icon-setting" v-if="project.basic && project.basic.type=='PNGs'" @click="onDelaySetting(project)"></i>
        </div>
        <div class="output">
          <i class="el-icon-edit"></i>
          <p class="outputPath" @click="changeFold(project.basic && project.basic.outputPath,index)" :title="'输出目录：'+(project.basic && project.basic.outputPath)">{{ (project.basic && project.basic.outputPath) | basePath }}</p>
        </div>
      </div>
      <div class="status" :class="processStatus(project.process && project.process.schedule)" ><i class="el-icon-loading" v-if="project.process && project.process.schedule > 0 && project.process.schedule < 1"></i>{{ project.process && project.process.text }}</div>
      <div class="progress" :class="{fail:isFail(project.process && project.process.schedule)}" >
        <span class="precent" :class="{ani:isStarted(project.process && project.process.schedule)}" :style="{width: processPrecent(project.process && project.process.schedule) + '%' }"></span>
      </div>
    </div>
  </template>
  <dialay-dialog v-if="dialogFormVisible" :project="delayProject" @close="dialogFormVisible=false"></dialay-dialog>
  <div class="open-folder" v-on:click="openFolder">
    打开目录...
  </div>
</section>
</template>
<script>
import { path, fs, ipc } from '../../util/node-env'
import _ from 'lodash'
const rightMenu = require('./menu')

import DelayDialog from  '../delayDialog/index.vue'
import { f as fsOperate } from '../drag/file.js'
export default {
  components:{
    'dialay-dialog':DelayDialog
  },
  data () {
    return {
      dialogFormVisible:false,
      delayProject:null,
      thumbCache: {}
    }
  },

  created () {
    // 回应修改输出目录的操作
    ipc.on('change-item-fold', (path, order) => {
      
      if(path[0]){
        this.$store.dispatch('editBasic', {
          outputPath: path[0]
        })
      }
      
    })
    // 回应CTRL+A全选操作
    ipc.on('selectAll', () => {
      this.$store.dispatch('allSelect')
    })
    // 回应CTRL+Backspace删除操作
    ipc.on('delItem', () => {
      this.$store.dispatch('remove')
    })
  },
  computed: {
    selectedList () {
      var data = this.$store.getters.getterSelected
      return data
    },
    isMultiItems () {
      return this.selectedList.length > 1
    },
    selectedIndex () {
      var data = this.$store.getters.getterSelectedIndex
      return data
    },
    projectList () {
      return this.$store.getters.getterItems
    },
    isLocked () {
      var data = this.$store.getters.getterLocked
      return data
    }
  },
  methods: {
    // 生成降采样缩略图，避免长列表直接加载全尺寸原图导致的内存占用
    thumbFor (filePath) {
      if (!filePath) { return '' }
      var cached = this.thumbCache[filePath]
      if (cached) { return cached }
      var placeholder = 'file://' + filePath
      var self = this
      var size = 120
      var img = new Image()
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          var ctx = canvas.getContext('2d')
          var scale = Math.min(size / img.width, size / img.height)
          var w = Math.max(1, Math.round(img.width * scale))
          var h = Math.max(1, Math.round(img.height * scale))
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
          self.$set(self.thumbCache, filePath, canvas.toDataURL('image/png'))
        } catch (e) {
          self.$set(self.thumbCache, filePath, placeholder)
        }
      }
      img.onerror = function () {
        self.$set(self.thumbCache, filePath, placeholder)
      }
      img.src = placeholder
      return placeholder
    },
    // 映射标签样式
    getLabel (label) {
      var labelMap = {
        'PNGs': 'primary',
        'APNG': 'success',
        'GIF': 'warning'
      }
      // console.log(label)
      return labelMap[label]
    },
    isStarted (schedule) {
      if (schedule > 0 && schedule < 1) {
        return true
      } else {
        return false
      }
    },
    processStatus (schedule) {
      if (schedule == 1) {
        return 'success'
      } else if (schedule == -1) {
        return 'fail'
      } else {
        return ''
      }
    },
    isFail (schedule) {
      if (schedule == -1) {
        return true
      } else {
        return false
      }
    },
    processPrecent (schedule) {
      // console.log(schedule);
      if (schedule === undefined || schedule === null || isNaN(schedule)) {
        return 0
      }
      switch (schedule) {
        case -1:
          return 100
        default:
          return schedule * 100
      }
    },
    // 勾选/取消勾选单个项目
    toggleSelect (index) {
      if (this.isLocked) {
        return false
      }
      this.$store.dispatch('multiSelect', index)
    },
    itemRightClick (currentItem, index) {
      // console.log(rightMenu)
      var locale =this.$i18n.messages[this.$i18n.locale]
      // console.log(locale);
      this.$store.dispatch('setSelected', index)
      // console.log(this.isMultiItems)
      if (this.isMultiItems) {
        window.setTimeout(() => {
          rightMenu.default.init(this.$store, currentItem, index, true ,locale)
        }, 10)
      } else {
        window.setTimeout(() => {
          rightMenu.default.init(this.$store, currentItem, index, false ,locale)
        }, 10)
      }
    },
    changeFold (outputPath, index) {
      if (this.isLocked) {
        return false
      }
      ipc.send('change-item-fold', outputPath, index)
    },
    openFolder(){
      ipc.invoke('dialog:openFiles', {
        properties: [ 'openFile', 'openDirectory', 'multiSelections' ]
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return false }
        this.muFileList = result.filePaths
        fsOperate.readerFiles(this.muFileList).then((ars) => {
          var Obj = {}
          for (var i in ars) {
            // 数字自然排序：修复 file_10 排在 file_2 前导致帧错乱
            ars[i].basic.fileList.sort((a, b) => {
              const _a = a.replace(/(\d+)/g, (e) => '0'.repeat(8 - Math.min(e.length, 8)) + e)
              const _b = b.replace(/(\d+)/g, (e) => '0'.repeat(8 - Math.min(e.length, 8)) + e)
              return _a > _b ? 1 : -1
            })
            Obj.basic = ars[i].basic
            Obj.options = ars[i].options
            this.$store.dispatch('add', Obj)
          }
        })
      })
    },
    onDelaySetting(project){
      this.delayProject=project;
      this.dialogFormVisible=true; 
    }
  }
}
</script>

<style lang="scss">
@import "./projectList.scss";
</style>
