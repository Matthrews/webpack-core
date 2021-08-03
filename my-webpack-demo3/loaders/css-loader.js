/**
 * 将CSS代码变换成JS代码
 * @param code CSS
 * @returns {string}  JS
 */
const transform = code => `
  const str = ${JSON.stringify(code)}
  export default str
`
module.exports = transform