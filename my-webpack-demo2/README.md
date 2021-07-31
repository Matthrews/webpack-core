# 解析 webpack 核心——Webpack 原理

## Webpack 要解决的两个问题

- 编译 import 和 export 关键字

- 将多个文件打包成一个

### 如何编译 import 和 export 关键字

1. 不同浏览器功能不同

- 现代浏览器可以通过`<script type="module">来支持 import/export`
- `IE 8~15`不支持 `import/export`

2. 兼容策略

- 激进兼容策略 把代码全部放到`<script type="module">`里面

- 缺点 不被`IE 8~15`支持；而且会导致文件请求过多

- 平稳兼容策略 把关键字转译为普通代码(通过转译函数完成)，并把所有文件打包成一个文件

- 缺点 需要写复杂代码来完成这件事情

3. 那么怎么写这个转译函数？

- `@babel/core`已经帮我们做了

- 示例

```js
// project_1/index.js
import a from './a.js'
import b from './b.js'

console.log(a.getB())
console.log(b.getA())

// project_1/a.js
import b from './b.js'

const a = {
  value: 'a',
  getB: () => b.value + ' from a.js'
}
export default a

// project_1/b.js
import a from './a.js'

const b = {
  value: 'b',
  getA: () => a.value + ' from b.js'
}
export default b
```

执行`node -r ts-node/register bundler_1.ts`结果如下

```js
duplicated dependency: a.js
duplicated dependency: b.js
{
  'index.js': {
    deps: [ 'a.js', 'b.js' ],
    code: '"use strict";\n' +
      '\n' +
      'var _a = _interopRequireDefault(require("./a.js"));\n' +
      '\n' +
      'var _b = _interopRequireDefault(require("./b.js"));\n' +
      '\n' +
      'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }\n' +
      '\n' +
      'console.log(_a["default"].getB());\n' +
      'console.log(_b["default"].getA());'
  },
  'a.js': {
    deps: [ 'b.js' ],
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports["default"] = void 0;\n' +
      '\n' +
      'var _b = _interopRequireDefault(require("./b.js"));\n' +
      '\n' +
      'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }\n' +
      '\n' +
      'var a = {\n' +
      "  value: 'a',\n" +
      '  getB: function getB() {\n' +
      `    return _b["default"].value + ' from a.js';\n` +
      '  }\n' +
      '};\n' +
      'var _default = a;\n' +
      'exports["default"] = _default;'
  },
  'b.js': {
    deps: [ 'a.js' ],
    code: '"use strict";\n' +
      '\n' +
      'Object.defineProperty(exports, "__esModule", {\n' +
      '  value: true\n' +
      '});\n' +
      'exports["default"] = void 0;\n' +
      '\n' +
      'var _a = _interopRequireDefault(require("./a.js"));\n' +
      '\n' +
      'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }\n' +
      '\n' +
      'var b = {\n' +
      "  value: 'b',\n" +
      '  getA: function getA() {\n' +
      `    return _a["default"].value + ' from b.js';\n` +
      '  }\n' +
      '};\n' +
      'var _default = b;\n' +
      'exports["default"] = _default;'
  }
}
```

- 核心代码如下

```js
"use strict";

Object.defineProperty(exports, "__esModule", { value: true }); // 疑惑1

exports["default"] = void 0; // 疑惑2

var _b = _interopRequireDefault(require("./b.js")); // 细节1

function _interopRequireDefault(obj) {
  // 细节1
  return obj && obj.__esModule ? obj : { default: obj }; // 细节1
}

var a = {
  value: "a",
  getB: function getB() {
    return _b["default"].value + " from a.js"; // 细节1
  },
};

var _default = a; // 细节2

exports["default"] = _default; // 细节2

// 疑惑1
// Object.defineProperty(exports, "__esModule", { value: true })等同于exports.__esModule = true
// ESM与CJS区分

// 疑惑2
// exports["default"] = void 0;等同于exports["default"] = undefined
// 清空exports["default"]的值

// 细节1
// import b from './b.js' 变成了
// var _b = _interopRequireDefault(require("./b.js"))

// b.value 变成了
// _b['default'].value

// 解释 _interopRequireDefault(module)
// _ 下划线前缀是为了避免与其他变量重名
// 该函数的意图是给模块添加 'default'
// 为什么要加 default：CommonJS 模块没有默认导出，加上方便兼容
// 内部实现：return m && m.__esModule ? m : { "default": m }
// 其他 _interop 开头的函数大多都是为了兼容旧代码

// 细节2
// var _default = a; exports["default"] = _default;
// 相当于exports["default"] = a
```

4. 总结

- import 关键字会变成 require 函数

- export 关键字会变成 exports 对象

- 本质：ESModule 语法变成了 CommonJS 规则

- 但是目前我们不知道 require 函数怎么写，先不管，假设 require 已经写好了

### 如何将多个文件打包成一个

1. 打包后的文件会是什么样子的？

- 肯定包含所有模块，并且能执行所有模块

- 预想如下

```js
var depRelation = [
  {key: 'index.js', deps: ['a.js', 'b.js'], code: function... },
  {key: 'a.js', deps: ['b.js'], code: function... },
  {key: 'b.js', deps: ['a.js'], code: function... }
]
// 为什么把 depRelation 从对象改为数组？
// 因为数组的第一项就是入口，而对象没有第一项的概念
execute(depRelation[0].key) // 执行入口文件
function execute(key){
  var item = depRelation.find(i => i.key === key)
  item.code(???) // 执行 item 的代码，因此 code 最好是个函数，方便执行
  // 但是目前还不知道要传什么参数给 code
  // 代码待完善......
}
```

- 现在有三个问题待解决

  - depRelation 是对象，需要变成一个数组

  - code 是字符串，需要变成一个函数, 函数遵循 CJS2 规范

  - execute 函数待完善

- 解决上述第一个问题

  将

  `depRelation[key] = { deps: [], code: es5Code }`

  改为了

  `const item = { key, deps: [], code: es5Code } depRelation.push(item)`

```js
// bundler_2.ts

// 请确保你的 Node 版本大于等于 14
// 请先运行 yarn 或 npm i 来安装依赖
// 然后使用 node -r ts-node/register 文件路径 来运行，
// 如果需要调试，可以加一个选项 --inspect-brk，再打开 Chrome 开发者工具，点击 Node 图标即可调试
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { readFileSync } from "fs";
import { resolve, relative, dirname } from "path";
import * as babel from "@babel/core";

// 设置根目录
const projectRoot = resolve(__dirname, "project_1");
// 类型声明
type DepRelation = { key: string, deps: string[], code: string }[];
// 初始化一个空的 depRelation，用于收集依赖
const depRelation: DepRelation = []; // 数组！

// 将入口文件的绝对路径传入函数，如 D:\demo\fixture_1\index.js
collectCodeAndDeps(resolve(projectRoot, "index.js"));

console.log(depRelation);
console.log("done");

function collectCodeAndDeps(filepath: string) {
  const key = getProjectPath(filepath); // 文件的项目路径，如 index.js
  if (depRelation.find((i) => i.key === key)) {
    console.warn(`duplicated dependency: ${key}`); // 注意，重复依赖不一定是循环依赖
    return;
  }
  // 获取文件内容，将内容放至 depRelation
  const code = readFileSync(filepath).toString();
  const { code: es5Code } = babel.transform(code, {
    presets: ["@babel/preset-env"],
  });
  // 初始化 depRelation[key]
  const item = { key, deps: [], code: es5Code };
  depRelation.push(item);
  // 将代码转为 AST
  const ast = parse(code, { sourceType: "module" });
  // 分析文件依赖，将内容放至 depRelation
  traverse(ast, {
    enter: (path) => {
      if (path.node.type === "ImportDeclaration") {
        // path.node.source.value 往往是一个相对路径，如 ./a.js，需要先把它转为一个绝对路径
        const depAbsolutePath = resolve(
          dirname(filepath),
          path.node.source.value
        );
        // 然后转为项目路径
        const depProjectPath = getProjectPath(depAbsolutePath);
        // 把依赖写进 depRelation
        item.deps.push(depProjectPath);
        collectCodeAndDeps(depAbsolutePath);
      }
    },
  });
}

// 获取文件相对于根目录的相对路径
function getProjectPath(path: string) {
  return relative(projectRoot, path).replace(/\\/g, "/");
}
```

可以执行`node -r ts-node/register bundler_2.ts`看看

- 解决上述第二个问题

  - 把 code 字符串外面包一个 `function(require, module, exports){...}`

  - 执行`node project_2/string_code_to_function.js`把`{code: ${code2}}`写到文件`project_2/result_fun.json`里

  - 最终文件里面的 code 就是函数, 代码参见`project_2`

2. 打包后的文件会是什么样子的？
