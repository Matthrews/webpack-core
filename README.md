# 解析 webpack 核心——Babel 原理

## Babel 做了什么，怎么做的？

- Babel 将 ESNextCode 代码转换成了浏览器兼容的 ES5Code

- 其过程(code --(1)-> ast --(2)-> ast2 --(3)-> code2)

  - parse: 把代码 ESNextCode 变成 AST

  - traverse: 遍历 AST 进行修改得到 AST2

  - generate: 把 AST2 变成代码 ES5Code

- 示例`let_to_var.ts`

```typescript
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
/**
 * 运行 node -r ts-node/register --inspect-brk let_to_var.ts 浏览器Node里面看下数据结构
 */
const code = `let a = 'let'; let b = 2`;
// Step1 parse  把代码code变成AST
const ast = parse(code, { sourceType: "module" });
// console.log('ast', ast)

// Step2 traverse  遍历AST进行修改
traverse(ast, {
  enter: (item) => {
    if (item.node.type === "VariableDeclaration") {
      if (item.node.kind === "let") {
        item.node.kind = "var";
      }
    }
  },
});

// Step3 generate  把AST代码变成code2
const result = generate(ast, {}, code);
// console.log(result.code);
```

运行`node -r ts-node/register --inspect-brk let_to_var.ts`
![bash](https://cdn.jsdelivr.net/gh/Matthrews/zm_cdn/images/webpack-1.png)
![Node Debugger](https://cdn.jsdelivr.net/gh/Matthrews/zm_cdn/images/webpack-2.png)
最终结果：

```js
// let转为了var，还给代码加了分号
var a = "let";
var b = 2;
```

## 为什么非得使用 AST

- 你很难用正则表达式来替换，正则很容易把 let a = 'let' 变成 var a = 'var'

- 你需要识别每个单词的意思，才能做到只修改用于声明变量的 let，而 AST 能明确地告诉你每个 let 的意思

## 能不能自动把代码转为 ES5Code 并单独文件输出？

- 使用 `@babel/core` 和 `@babel/preset-env` 即可

- 代码如下：

```typescript
// test.js
let a = "let";
let b = 2;
const c = 3;
var set = new Set([1, 2, 3]);
console.log(set);

// file_to_es5.ts
import { parse } from "@babel/parser";
import * as babel from "@babel/core";
import * as fs from "fs";

const code = fs.readFileSync("./test.js").toString();

const ast = parse(code, { sourceType: "module" });

babel
  .transformFromAstAsync(ast, code, {
    presets: [
      // 注意此处是一个数组，如果有options的话
      // useBuiltIns有三种选项：usage entry false
      // 具体参考：https://babel.docschina.org/docs/en/6.26.3/babel-polyfill/
      ["@babel/preset-env", { useBuiltIns: "usage", corejs: 2 }],
    ],
  })
  .then(({ code }) => {
    fs.writeFileSync("./test.es5.js", code);
  });
```

执行`node -r ts-node/register file_to_es5.ts`生成文件如下：

```js
// test.es5.js
"use strict";

require("core-js/modules/web.dom.iterable");

require("core-js/modules/es6.array.iterator");

require("core-js/modules/es6.object.to-string");

require("core-js/modules/es6.string.iterator");

require("core-js/modules/es6.set");

var a = "let";
var b = 2;
var c = 3;
var set = new Set([1, 2, 3]);
console.log(set);
```

> 注意：Babel 默认只转换新的 JavaScript 语法，而不转换新的 API。 例如，Iterator、Generator、Set、Maps、Proxy、Reflect、Symbol、Promise 等全局对象，以及一些定义在全局对象上的方法（比如 Object.assign）都不会转译。 如果想使用这些新的对象和方法，则需要为当前环境提供一个 polyfill
> 具体：`yarn add babel-polyfill core-js@2`

## Babel 还做了什么?

> 分析 JS 文件的依赖关系

- 简单依赖`project_1`

```js
// deps_1.ts
// 请确保你的 Node 版本大于等于 14
// 请先运行 yarn 或 npm i 来安装依赖
// 然后使用 node -r ts-node/register 文件路径 来运行，
// 如果需要调试，可以加一个选项 --inspect-brk，再打开 Chrome 开发者工具，点击 Node 图标即可调试
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import { readFileSync } from 'fs'
import { resolve, relative, dirname } from 'path'

// 设置根目录
const projectRoot = resolve(__dirname, 'project_1')
// 类型声明
type DepRelation = { [key: string]: { deps: string[], code: string } }
// 初始化一个空的 depRelation，用于收集依赖
const depRelation: DepRelation = {}

// 将入口文件的绝对路径传入函数，如 D:\demo\fixture_1\index.js
collectCodeAndDeps(resolve(projectRoot, 'index.js'))

console.log(depRelation)
console.log('done')

function collectCodeAndDeps(filepath: string) {
  const key = getProjectPath(filepath) // 文件的项目路径，如 index.js
  // 获取文件内容，将内容放至 depRelation
  const code = readFileSync(filepath).toString()
  // 初始化 depRelation[key]
  depRelation[key] = { deps: [], code: code }
  // 将代码转为 AST
  const ast = parse(code, { sourceType: 'module' })
  // 分析文件依赖，将内容放至 depRelation
  traverse(ast, {
    enter: path => {
      if (path.node.type === 'ImportDeclaration') {
        // path.node.source.value 往往是一个相对路径，如 ./a.js，需要先把它转为一个绝对路径
        const depAbsolutePath = resolve(dirname(filepath), path.node.source.value)
        // 然后转为项目路径
        const depProjectPath = getProjectPath(depAbsolutePath)
        // 把依赖写进 depRelation
        depRelation[key].deps.push(depProjectPath)
      }
    }
  })
}

// 获取文件相对于根目录的相对路径
function getProjectPath(path: string) {
  return relative(projectRoot, path).replace(/\\/g, '/')
}

// project_1/a.js
const a = {
  value: 1
}
export default a

// project_1/b.js
const b = {
  value: 2
}
export default b

// project_1/index.js
import a from './a.js'
import b from './b.js'

console.log(a.value + b.value)
```

执行`node -r ts-node/register deps_1.ts`结果输出如下：

```js
{
  'index.js': {
    deps: [ 'a.js', 'b.js' ],
    code: "import a from './a.js'\r\n" +
      "import b from './b.js'\r\n" +
      '\r\n' +
      'console.log(a.value + b.value)'
  }
}
```
