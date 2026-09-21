/**
 * 从 brand SVG 生成应用图标：icon.png / icon.ico / icon.icns
 * 配色：圆 #c8f542，播放三角与文字 #0c0f0e（仅改色，路径不变）
 */
const fs = require('fs')
const path = require('path')
const { createCanvas, loadImage } = (() => {
  try { return require('canvas') } catch (e) { return { createCanvas: null, loadImage: null } }
})()

const OUT = path.join(__dirname, '..', 'public', 'icons')
const SVG = path.join(OUT, 'icon-brand.svg')

async function trySharp () {
  const sharp = require('sharp')
  const svgBuf = fs.readFileSync(SVG)
  const png1024 = await sharp(svgBuf, { density: 300 })
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(OUT, 'icon-1024.png'), png1024)
  await sharp(png1024).resize(512, 512).png().toFile(path.join(OUT, 'icon.png'))
  await sharp(png1024).resize(256, 256).png().toFile(path.join(OUT, 'icon-256.png'))
  await sharp(png1024).resize(128, 128).png().toFile(path.join(OUT, 'icon-128.png'))
  await sharp(png1024).resize(64, 64).png().toFile(path.join(OUT, 'icon-64.png'))
  await sharp(png1024).resize(48, 48).png().toFile(path.join(OUT, 'icon-48.png'))
  await sharp(png1024).resize(32, 32).png().toFile(path.join(OUT, 'icon-32.png'))
  console.log('sharp: PNG sizes ok')
  return true
}

async function tryPlaywrightChrome () {
  // fallback: 用已安装的 chrome/electron 渲染 SVG — 由外部脚本处理
  return false
}

module.exports = { trySharp, OUT, SVG }

if (require.main === module) {
  trySharp().catch((e) => {
    console.error('sharp failed', e)
    process.exitCode = 1
  })
}
