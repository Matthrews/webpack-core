import b from './b.js'

const a = {
  value: 'a',
  getB: () => b.value + ' from a.js'
}
export default a