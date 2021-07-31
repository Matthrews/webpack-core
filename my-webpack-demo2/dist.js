var depRelation = [{
  key: 'index.js',
  deps: ['a.js', 'b.js'],
  code: function(require, module, exports) {
    'use strict'

    var _a = _interopRequireDefault(require('./a.js'))

    var _b = _interopRequireDefault(require('./b.js'))

    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { 'default': obj }
    }

    console.log(_a['default'].getB())
    console.log(_b['default'].getA())
  }
}, {
  key: 'a.js',
  deps: ['b.js'],
  code: function(require, module, exports) {
    'use strict'

    Object.defineProperty(exports, '__esModule', {
      value: true
    })
    exports['default'] = void 0

    var _b = _interopRequireDefault(require('./b.js'))

    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { 'default': obj }
    }

    var a = {
      value: 'a',
      getB: function getB() {
        return _b['default'].value + ' from a.js'
      }
    }
    var _default = a
    exports['default'] = _default
  }
}, {
  key: 'b.js',
  deps: ['a.js'],
  code: function(require, module, exports) {
    'use strict'

    Object.defineProperty(exports, '__esModule', {
      value: true
    })
    exports['default'] = void 0

    var _a = _interopRequireDefault(require('./a.js'))

    function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { 'default': obj }
    }

    var b = {
      value: 'b',
      getA: function getA() {
        return _a['default'].value + ' from b.js'
      }
    }
    var _default = b
    exports['default'] = _default
  }
}]
var modules = {}
execute(depRelation[0].key)

function execute(key) {
  // 如果已经 require 过，就直接返回上次的结果
  if (modules[key]) {
    return modules[key]
  }
  // 找到要执行的项目
  var item = depRelation.find(i => i.key === key)
  // 找不到就报错，中断执行
  if (!item) {
    throw new Error(`${item} is not found`)
  }
  // 把相对路径变成项目路径
  var pathToKey = (path) => {
    var dirname = key.substring(0, key.lastIndexOf('/') + 1)
    var projectPath = (dirname + path).replace(/\.\//g, '').replace(/\/\//, '/')
    return projectPath
  }
  // 创建 require 函数
  var require = (path) => {
    return execute(pathToKey(path))
  }
  // 初始化当前模块
  modules[key] = { __esModule: true }
  // 初始化 module 方便 code 往 module.exports 上添加属性
  var module = { exports: modules[key] }
  // 调用 code 函数，往 module.exports 上添加导出属性
  // 第二个参数 module 大部分时候是无用的，主要用于兼容旧代码
  item.code(require, module, module.exports)
  // 返回当前模块
  return modules[key]
}