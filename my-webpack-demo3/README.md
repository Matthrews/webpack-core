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
