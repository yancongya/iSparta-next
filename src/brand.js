/**
 * 产品标识单一来源。
 * 显示名以 package.json 的 productName 为准；改名时先改那边，再同步 ARTIFACT_PREFIX。
 */
export const APP_NAME = 'iSparta-next'

/**
 * 版本号**从 package.json 读**，不再手写字面量。
 *
 * 原来这里是写死的 '3.4.0'，发版 bump 后没人同步 → CEP 端在没有 version.json 的
 * 场景（dev:cep 的 HMR 预览、桥读不到已安装清单）回退到它，于是面板显示成
 * 「上一个版本」。版本是 package.json 的事实，重复手写必然漂移。
 *
 * 取不到（极端的裁剪构建 / 路径异常）时回落到 '0.0.0'，让调用方走原有的
 * 「读不到就不显示版本」分支，而不是显示一个错的数字。
 */
function readPackageVersion () {
  try {
    // webpack 会把 JSON 内联进 bundle；CEP 面板与桌面共用同一份取值
    var pkg = require('../package.json')
    if (pkg && pkg.version) { return String(pkg.version) }
  } catch (e) { /* ignore */ }
  return '0.0.0'
}

export const APP_VERSION = readPackageVersion()
export const ARTIFACT_PREFIX = 'isparta-next'
export const APP_ID = 'io.github.isparta-next'
/** 产品落地页（帮助「?」按钮） */
export const LANDING_URL = 'https://yancongya.github.io/iSparta-next/'

export default APP_NAME
