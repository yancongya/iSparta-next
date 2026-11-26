/**
 * 落地页 hero mock 加载契约（用户 11-26 反馈：加载卡顿、开始时左右两侧空白）
 * 根因：占位截图 1200x900（4:3）与 mock iframe 1440x900（16:10）比例不一致，
 * object-fit:contain 在宽屏舞台两侧各空 ~8%；iframe ready 后 visibility 硬切，观感像卡顿。
 * 本守卫锁住「占位与 mock 同比例 + 淡入过渡 + 尺寸同源」三条，防换图回退。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const html = read('landing/index.html')
const css = read('landing/styles.css')
const main = read('landing/main.js')

let passed = 0
let failed = 0
function ok (name, cond) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name) }
}

// 按 hero-shot 容器内带 fetchpriority 的图抓取：splash__logo 也带 high，
// 但在 hero 之前，不能再靠「第一个 fetchpriority=high」定位占位图。
const heroShot = (html.match(/<div class="hero-shot">[\s\S]*?<\/div>/) || [''])[0]
const heroImg = (heroShot.match(/<img[^>]+fetchpriority="high"[^>]*>/) || [''])[0]

// 1) 占位图与 mock iframe 同宽高比
ok('hero 占位使用宽幅图', /src="assets\/shots\/desktop-workspace-hd-wide\.webp"/.test(heroImg))
ok('占位图声明 1440x900（与 iframe 同比例）', /width="1440"\s+height="900"/.test(heroImg))
ok('宽幅占位图文件存在', fs.existsSync(path.join(ROOT, 'landing/assets/shots/desktop-workspace-hd-wide.webp')))
ok('占位图保持高优先级加载', /fetchpriority="high"/.test(heroImg))

// 2) mock 就绪淡入，不硬切
ok('mock 层初始隐藏且透明', /\.hero-demo\s*\{[^}]*visibility:\s*hidden[^}]*opacity:\s*0/.test(css))
ok('mock 层带 opacity 过渡', /\.hero-demo\s*\{[^}]*transition:\s*opacity/.test(css))
ok('就绪态可见且不透明', /\.hero-demo--ready\s*\{[^}]*visibility:\s*visible[^}]*opacity:\s*1/.test(css))
ok('收到 ready 消息后才加就绪类', /classList\.add\("hero-demo--ready"\)/.test(main) &&
  /event\.data\s*!==\s*"isparta-demo-ready"/.test(main))

// 3) iframe 尺寸取自占位图属性，比例不会各自漂移
ok('iframe 宽高取自占位图属性', /frame\.width\s*=\s*screenshot\.getAttribute\("width"\)/.test(main) &&
  /frame\.height\s*=\s*screenshot\.getAttribute\("height"\)/.test(main))
ok('宽屏下用 CSS 变量覆盖 iframe 宽为 1440', /--hero-demo-width:\s*1440/.test(css))

console.log('\nlanding-hero L1: ' + passed + ' passed, ' + failed + ' failed')
process.exit(failed ? 1 : 0)
