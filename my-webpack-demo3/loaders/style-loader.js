/**
 * 将JS代码插入style标签
 * @param code JS
 * @returns {string}  JS
 */
const transform = code => `
  if (document) {
    const style = document.createElement('style')
    style.innerHTML = ${JSON.stringify(code)}
    style.type = 'text/css'
    document.head.appendChild(style)
  }
  export default str
`
module.exports = transform