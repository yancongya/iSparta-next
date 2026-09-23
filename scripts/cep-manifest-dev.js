/**
 * CEP 开发态入口切换
 * on  → MainPath=./dev-hmr.html（再跳 8082；MainPath 禁止 http://，否则重启 AE 扩展消失）
 * off → MainPath=./ui/index.html（配 build:cep）
 * 面板无 Ctrl+R：刷新=关面板再开
 */
const fs = require('fs')
const path = require('path')

const MANIFEST = path.join(__dirname, '..', 'targets', 'cep', 'CSXS', 'manifest.xml')
const on = process.argv[2] === 'on'
// on：./dev-hmr.html（本地跳转 HMR）。MainPath 禁止写 http://，否则重启 AE 扩展可能消失
const target = on ? './dev-hmr.html' : './ui/index.html'

var xml = fs.readFileSync(MANIFEST, 'utf8')
var next = xml.replace(/<MainPath>[^<]*<\/MainPath>/, '<MainPath>' + target + '</MainPath>')
fs.writeFileSync(MANIFEST, next)
console.log('[cep-manifest-dev] MainPath → ' + target)
console.log(on
  ? '  请 npm run serve:cep 后在 AE 重开面板（HMR）'
  : '  请 npm run build:cep 后在 AE 重开面板')
