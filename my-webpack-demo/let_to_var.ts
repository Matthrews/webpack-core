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
console.log(result.code); // 还会自动加分号
/**
 * var a = 'let';
 * var b = 2;
 */
