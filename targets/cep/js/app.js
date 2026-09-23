/* 已废弃：编码走 src/util/processor，面板入口为 ui/index.html（npm run build:cep）。
   保留空实现以免旧 index.html 引用报错。 */
(function () {
  'use strict'
  if (typeof console !== 'undefined' && console.info) {
    console.info('[iSparta CEP] js/app.js is retired; use ui/ (Vue) + processor.')
  }
})()
