import * as fs from 'fs'

const code = `var b = require('./b.js');exports.default = 'a';`

const code2 = `function(require, module, exports){${code}}`

const result = `{"code": "${code2}"}`

fs.writeFileSync('./result_fun.json', result, 'utf-8')

const raw_contents = fs.readFileSync('./result_fun.json', { encoding: 'utf-8' })

const { code: func } = JSON.parse(raw_contents)


console.log(func)

