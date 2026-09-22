// 整仓 lint（vue-cli 不接受任意路径参数时避免把 json 当源码解析）
module.exports = {
  '*': () => 'npm run lint'
}
