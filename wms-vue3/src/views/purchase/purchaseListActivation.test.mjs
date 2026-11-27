import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const { descriptor } = parse(readFileSync(new URL('./PurchaseGenericList.vue', import.meta.url), 'utf8'))
const source = ts.createSourceFile('PurchaseGenericList.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const activation = source.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === 'onActivated').expression.arguments[0].getText(source)
const callback = ts.transpileModule(`const activate = ${activation}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText

test('采购入库缓存列表返回时重新查询，无敏感字段配置也能显示新单据', () => {
  let calls = 0
  let serverRows = ['receipt-old']
  let visibleRows = [...serverRows]
  const lifecycle = new Function('loadData', 'listFieldBinding', `let pageActive=false;let firstActivation=true;${callback};return {activate,isActive:()=>pageActive}`)(
    () => { calls++; visibleRows = [...serverRows] }, { value: undefined },
  )
  lifecycle.activate()
  assert.equal(calls, 0, '首次查询已由onMounted执行，不重复发送')
  serverRows = ['receipt-new', 'receipt-old']
  lifecycle.activate()
  assert.equal(lifecycle.isActive(), true)
  assert.equal(calls, 1)
  assert.deepEqual(visibleRows, ['receipt-new', 'receipt-old'])
  lifecycle.activate()
  assert.equal(calls, 2, '再次切回缓存标签仍获取最新数据')
})

test('已接敏感字段的采购列表仍在返回时刷新', () => {
  let calls=0
  const lifecycle=new Function('loadData','listFieldBinding',`let pageActive=false;let firstActivation=true;${callback};return {activate}`)(()=>{calls++},{value:{root:'purchase_order'}})
  lifecycle.activate();lifecycle.activate()
  assert.equal(calls,1)
})
