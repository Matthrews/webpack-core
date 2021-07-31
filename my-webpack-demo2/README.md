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

### 如何将多个文件打包成一个
