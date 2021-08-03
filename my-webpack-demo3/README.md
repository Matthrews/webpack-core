# 解析 webpack 核心——Loader 原理

> 我们再上一次的分享中已经做出了一个简易的打包器，但是我们只能加载 JS 不能加载 CSS
> 本次分享我们给出 css 加载思路并对 css-loader 和 style-loader 进行解析

## 如何加载 CSS

- 思路：目前`bundler_1.ts`只能加载 JS，想要加载 CSS，就需要将 CSS 转化为 JS
- 代码：

```js
// 如果文件路径以.css结尾，就把CSS改为JS，并自动加载到head里
if (/\.css$/.test(filepath)) {
  code = `
         const str = ${JSON.stringify(code)}
         if (document) {
           const style = document.createElement('style')
           style.innerHTML = str
           style.type = 'text/css'
           document.head.appendChild(style)
         }
         export default str
       `;
}
```

## 创建一个 CSS loader

```js
// bundler_1.ts
// 请确保你的 Node 版本大于等于 14
// 请先运行 yarn 或 npm i 来安装依赖
// 然后使用 node -r ts-node/register 文件路径 来运行，
// 如果需要调试，可以加一个选项 --inspect-brk，再打开 Chrome 开发者工具，点击 Node 图标即可调试
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { writeFileSync, readFileSync } from "fs";
import { resolve, relative, dirname, join } from "path";
import * as babel from "@babel/core";
import { mkdir } from "shelljs";
// 项目名称
const projectName = "project_css";
// 设置根目录
const projectRoot = resolve(__dirname, projectName);
// 类型声明
type DepRelation = { key: string, deps: string[], code: string }[];
// 初始化一个空的 depRelation，用于收集依赖
const depRelation: DepRelation = []; // 数组！

// 将入口文件的绝对路径传入函数，如 D:\demo\fixture_1\index.js
collectCodeAndDeps(resolve(projectRoot, "index.js"));

// Note：这是本次新增的代码
// 创建dist目录
const dir = `./${projectName}/dist`;
mkdir("-p", dir);

// Note：这是本次新增的代码
// 再创建bundle文件
writeFileSync(join(dir, "bundle.js"), generateCode());
console.log("done");

function generateCode() {
  let code = "";
  code +=
    "var depRelation = [" +
    depRelation
      .map((item) => {
        const { key, deps, code } = item;
        return `{
      key: ${JSON.stringify(key)},
      deps: ${JSON.stringify(deps)},
      code: function(require, module, exports){
        ${code}
      }
    }`;
      })
      .join(",") +
    "];\n";
  code += "var modules = {};\n";
  code += `execute(depRelation[0].key)\n`;
  code += `
  function execute(key) {
    if (modules[key]) { return modules[key] }
    var item = depRelation.find(i => i.key === key)
    if (!item) { throw new Error(\`\${item} is not found\`) }
    var pathToKey = (path) => {
      var dirname = key.substring(0, key.lastIndexOf('/') + 1)
      var projectPath = (dirname + path).replace(\/\\.\\\/\/g, '').replace(\/\\\/\\\/\/, '/')
      return projectPath
    }
    var require = (path) => {
      return execute(pathToKey(path))
    }
    modules[key] = { __esModule: true }
    var module = { exports: modules[key] }
    item.code(require, module, module.exports)
    return modules[key]
  }
  `;
  return code;
}

function collectCodeAndDeps(filepath: string) {
  const key = getProjectPath(filepath); // 文件的项目路径，如 index.js
  if (depRelation.find((i) => i.key === key)) {
    // 注意，重复依赖不一定是循环依赖
    return;
  }
  // 获取文件内容，将内容放至 depRelation
  let code = readFileSync(filepath).toString();
  // Note：这是本次新增的代码
  // 如果文件路径以.css结尾，就把CSS改为JS，并自动加载到head里
  if (/\.css$/.test(filepath)) {
    code = `
      const str = ${JSON.stringify(code)}
      if (document) {
        const style = document.createElement('style')
        style.innerHTML = str
        style.type = 'text/css'
        document.head.appendChild(style)
      }
      export default str
    `;
  }
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

// project_css/index.js
import a from './a.js'
import b from './b.js'
import './style.css'

console.log(a.getB())
console.log(b.getA())

// project_css/a.js
import b from './b.js'

const a = {
  value: 'a',
  getB: () => b.value + ' from a.js'
}
export default a

// project_css/b.js
import a from './a.js'

const b = {
  value: 'b',
  getA: () => a.value + ' from b.js'
}
export default b

// project_css/style.css
body {
    color: red;
}
```

运行`node -r ts-node/register bundler_1.ts`打包成功后`project_css`目录下会新增文件`bundle.js`

我们可以看到`CSS`部分代码成功打包进去了

```js
// project_css/dist/bundle.js  部分代码
exports["default"] = _default;
      }
    },{
      key: "style.css",
      deps: [],
      code: function(require, module, exports){
        "use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var str = "body {\r\n    color: red;\r\n}";

if (document) {
  var style = document.createElement('style');
  style.innerHTML = str;
  style.type = 'text/css';
  document.head.appendChild(style);
}

var _default = str;
exports["default"] = _default;
      }
    }];
```

我们可以再`dist`目录下创建一个`index.html`引入打包后文件`bundle.js`浏览器运行看看效果
![index.html](https://cdn.jsdelivr.net/gh/Matthrews/zm_cdn/images/webpack-4.png)

## Loader 长什么样

> 参考：[如何编写一个 loader](https://www.webpackjs.com/contribute/writing-a-loader/)

> [如何编写一个 loader](https://zhuanlan.zhihu.com/p/102729238)

- loader 本质上是导出为函数的 JavaScript 模块

- loader runner 会调用此函数，然后将上一个 loader 产生的结果或者资源文件传入进去

- 函数中的 this 作为上下文会被 webpack 填充，并且 loader runner 中包含一些实用的方法，比如可以使 loader 调用方式变为异步，或者获取 query 参数

- 同步 Loaders

```js
// sync-loader.js
module.exports = function (content, map, meta) {
  return someSyncOperation(content);
};

// sync-loader-with-multiple-results.js
module.exports = function (content, map, meta) {
  this.callback(null, someSyncOperation(content), map, meta);
  return; // 当调用 callback() 函数时，总是返回 undefined
};
```

- 异步 Loaders

```js
// async-loader.js
module.exports = function (content, map, meta) {
  var callback = this.async();
  someAsyncOperation(content, function (err, result) {
    if (err) return callback(err);
    callback(null, result, map, meta);
  });
};

// async-loader-with-multiple-results.js
module.exports = function (content, map, meta) {
  var callback = this.async();
  someAsyncOperation(content, function (err, result, sourceMaps, meta) {
    if (err) return callback(err);
    callback(null, result, sourceMaps, meta);
  });
};
```

- 返回 Buffer 的 Loaders

```js
// raw-loader.js
module.exports = function (content) {
  assert(content instanceof Buffer);
  return someSyncOperation(content);
  // 返回值也可以是一个 `Buffer`
  // 即使不是 "raw"，loader 也没问题
};
module.exports.raw = true;
```

- 提前结束的 Pitch Loaders

对于以下 use 配置：

```js
module.exports = {
  //...
  module: {
    rules: [
      {
        //...
        use: ["a-loader", "b-loader", "c-loader"],
      },
    ],
  },
};
```

将会发生这些步骤：

```text
|- a-loader `pitch`
  |- b-loader `pitch`
    |- c-loader `pitch`
      |- requested module is picked up as a dependency
    |- c-loader normal execution
  |- b-loader normal execution
|- a-loader normal execution
```

简单来说，pitch 钩子函数同步 data 数据和共享前面信息, 如果某个 loader 在 pitch 方法中给出一个结果，那么这个过程会回过身来，并跳过剩下的 loader

如果 b-loader 的 pitch 方法返回了一些东西：

```js
module.exports = function (content) {
  return someSyncOperation(content);
};

module.exports.pitch = function (remainingRequest, precedingRequest, data) {
  if (someCondition()) {
    return (
      "module.exports = require(" +
      JSON.stringify("-!" + remainingRequest) +
      ");"
    );
  }
};
```

上面的步骤将被缩短为：

```text
|- a-loader `pitch`
  |- b-loader `pitch` returns a module
|- a-loader normal execution
```

## 目前 Loader 存在的问题

- 不符合单一职责原则

```js
// 优化后打包核心代码如下
// bundler_css_loader.ts
if (/\.css$/.test(filepath)) {
  code = require("./loaders/css-loader")(code);
  code = require("./loaders/style-loader")(code);
}

// loaders/css-loader.js
/**
 * 将CSS代码变换成JS代码
 * @param code CSS
 * @returns {string}  JS
 */
const transform = (code) => `
  const str = ${JSON.stringify(code)}
  export default str
`;
module.exports = transform;

// loaders/style-loader.js
/**
 * 将JS代码插入style标签
 * @param code JS
 * @returns {string}  JS
 */
const transform = (code) => `
  if (document) {
    const style = document.createElement('style')
    style.innerHTML = ${JSON.stringify(code)}
    style.type = 'text/css'
    document.head.appendChild(style)
  }
  export default str
`;
module.exports = transform;
```

## 阅读源码前必读

[看源码的一点方法论](https://matthrews.github.io/bloger/2020/12/08/%E7%9C%8B%E6%BA%90%E7%A0%81%E7%9A%84%E4%B8%80%E7%82%B9%E6%96%B9%E6%B3%95%E8%AE%BA/)

## raw-loader 和 file-loader 源码阅读

> raw-loader@0.1.5

> file-loader@0.8.2

```js
// raw-loader
module.exports = function () {
  var args = Array.prototype.slice.call(arguments);
  args = args.join("");
  this.values = [args];
  return "module.exports = " + JSON.stringify(args);
};

// file-loader
module.exports = function (content) {
  this.cacheable && this.cacheable();
  if (!this.emitFile)
    throw new Error("emitFile is required from module system");
  var query = loaderUtils.parseQuery(this.query);
  var url = loaderUtils.interpolateName(this, query.name || "[hash].[ext]", {
    context: query.context || this.options.context,
    content: content,
    regExp: query.regExp,
  });
  this.emitFile(url, content);
  return "module.exports = __webpack_public_path__ + " + JSON.stringify(url);
};
module.exports.raw = true;
```

## css-loader 和 style-loader 源码阅读

> style-loader@0.13.0

> css-loader@0.28.4

- css-loader 和 style-loader 都做了什么，怎么做的？

下载 style-loader 源码切换到就一点的版本，进入源码找到入口文件`index.js`，代码折叠后

```js
// 省略不重要代码
module.exports = function () {
  // 这是一个空函数
};
module.exports.pitch = function (remainingRequest) {
  // ...
};
```

> 就简单两个函数，导出了一个空函数，并且在空函数对象上挂了一个 `pitch` 函数, 在 `pitch` 阶段完成`<style>`标签挂载 DOM，关于`pitch` 可以看看上文

`pitch` 函数核心代码如下, 源码注释也很清楚

```js
// 省略不重要代码
var query = loaderUtils.parseQuery(this.query);
return [
  "// style-loader: Adds some css to the DOM by adding a <style> tag",
  "",
  "// load the styles",
  "var content = require(" +
    loaderUtils.stringifyRequest(this, "!!" + remainingRequest) +
    ");",
  "if(typeof content === 'string') content = [[module.id, content, '']];",
  "// add the styles to the DOM",
  "var update = require(" +
    loaderUtils.stringifyRequest(
      this,
      "!" + path.join(__dirname, "addStyles.js")
    ) +
    ")(content, " +
    JSON.stringify(query) +
    ");",
].join("\n");
```

> 原理式通过 JS 将`<style>`标签插到 DOM 里，首先加载 style 内容，然后插入 DOM， 插入 DOM 核心实现是`addStyles.js`,其核心代码如下：

```js
// 省略不重要代码
module.exports = function (list, options) {
  var styles = listToStyles(list);
  addStylesToDom(styles, options);

  return function update(newList) {
    // update 逻辑
  };
};
```

> 可以看到，核心就是`addStylesToDom`函数，再进入就是`addStyle`函数

```js
function createStyleElement(options) {
  var styleElement = document.createElement("style");
  styleElement.type = "text/css";
  insertStyleElement(options, styleElement);
  return styleElement;
}

function addStyle(obj, options) {
  var styleElement, update, remove;

  if (options.singleton) {
    var styleIndex = singletonCounter++;
    styleElement =
      singletonElement || (singletonElement = createStyleElement(options));
    update = applyToSingletonTag.bind(null, styleElement, styleIndex, false);
    remove = applyToSingletonTag.bind(null, styleElement, styleIndex, true);
  } else if (
    obj.sourceMap &&
    typeof URL === "function" &&
    typeof URL.createObjectURL === "function" &&
    typeof URL.revokeObjectURL === "function" &&
    typeof Blob === "function" &&
    typeof btoa === "function"
  ) {
    styleElement = createLinkElement(options);
    update = updateLink.bind(null, styleElement);
    remove = function () {
      removeStyleElement(styleElement);
      if (styleElement.href) URL.revokeObjectURL(styleElement.href);
    };
  } else {
    // 看到这里就够了，然后再看到createStyleElement就和我们预期的一样了
    styleElement = createStyleElement(options);
    update = applyToTag.bind(null, styleElement);
    remove = function () {
      removeStyleElement(styleElement);
    };
  }

  update(obj);

  return function updateStyle(newObj) {
    if (newObj) {
      if (
        newObj.css === obj.css &&
        newObj.media === obj.media &&
        newObj.sourceMap === obj.sourceMap
      )
        return;
      update((obj = newObj));
    } else {
      remove();
    }
  };
}
```

> 看到`createStyleElement`我们就清楚了 style 是如何被插入 DOM 的

我们可以新建一个 demo 调试一下源码，进一步验证

## loader 面试题
