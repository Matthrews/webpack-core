// 代码不应该是一个单独的文件吗？
// 那么如何把代码变成一个单独的文件呢

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
