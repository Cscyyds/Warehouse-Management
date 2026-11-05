import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('./formConfigs.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('formConfigs.ts', source, ts.ScriptTarget.Latest, true)
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'validateProductFormTables')
const output = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const validate = new Function(`${output}; return validateProductFormTables`)()
const form = price => ({ min_sale_price: '20', sale_prices: [], product_suppliers: [{ supplier_id: 's1', supplier_name: '供应商', preset_purchase_price: price }] })
test('新增供应商预设价限制两位小数，非法精度不自动舍入', () => {
  assert.doesNotThrow(() => validate(form('12.50')))
  assert.throws(() => validate(form('12.501')), /最多保留2位/)
  assert.throws(() => validate(form('0')), /大于0/)
})
test('历史高精度价格未修改时可以保存其他资料，真正改价须符合两位精度', () => {
  assert.doesNotThrow(() => validate(form('12.3450'), { s1: '12.345' }))
  assert.throws(() => validate(form('12.3451'), { s1: '12.345' }), /最多保留2位/)
})
