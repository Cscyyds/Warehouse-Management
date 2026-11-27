import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// 执行真实接口封装，截获最终 FormData；不向后端写入数据。
const calls = []
const source = readFileSync(new URL('./productionNative.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)(() => ({
  post: (url, body) => { calls.push({ url, body }); return Promise.resolve({ success: true }) },
  get: (url, body) => { calls.push({ url, body }); return Promise.resolve({ success: true }) },
}), module, module.exports)
const api = module.exports
const docs = ['production-picking', 'production-return', 'finished-goods-stockin']
const target = { bill_id: 'bill', expected_version: 2 }

test('三类单据的审核、删除、反审核和撤销发送均不发送已删除参数', async () => {
  for (const doc of docs) {
    for (const value of ['旧原因', '', null]) {
      for (const fn of ['auditNativeBills', 'deleteNativeBills', 'unauditNativeBills', 'cancelSendNativeBills', 'deleteNativeItems']) {
        for (const action of fn === 'auditNativeBills' ? ['PASS', 'REJECT'] : ['PASS']) {
          await api[fn](doc, { request_id: 'request', ...target,
            items: fn === 'deleteNativeItems' ? [{ item_id: 'item', expected_item_version: 1 }] : [target],
            action, reason: value, audit_remark: value,
          })
          const { body } = calls.at(-1)
          assert.equal(body.has('reason'), false, `${doc}/${fn}`)
          assert.equal(body.has('audit_remark'), false, `${doc}/${fn}`)
          assert.equal(body.get('request_id'), 'request')
          if (fn === 'auditNativeBills') assert.equal(body.get('action'), action)
        }
      }
    }
  }
})

test('退料新建、追加和编辑均剔除每行 return_reason，保留正常备注和版本', async () => {
  for (const fn of ['createNativeBill', 'appendNativeItems', 'updateNativeItems']) {
    const items = ['旧原因', '', null].map((return_reason, index) => ({
      item_id: `item${index}`, expected_item_version: 1, client_line_id: `line${index}`,
      source_picking_item_id: `source${index}`, return_qty: '1.25', return_reason, remark: '正常备注',
    }))
    await api[fn]('production-return', { request_id: 'request', ...target, bill_date: '2026-11-26',
      source_picking_id: 'source', expected_source_version: 3, items,
    })
    const body = calls.at(-1).body
    assert.equal(body.get('expected_source_version'), '3')
    const sent = JSON.parse(body.get('items'))
    for (const row of sent) {
      assert.equal(Object.hasOwn(row, 'return_reason'), false)
      assert.equal(row.remark, '正常备注')
      assert.equal(row.return_qty, '1.25')
      assert.equal(row.expected_item_version, 1)
    }
    assert.equal(items[0].return_reason, '旧原因', '不得修改调用方草稿')
  }
})

test('主单与明细查询严格区分列表和搜索参数', async () => {
  await api.searchNativeBills('production-return', { page: 2, page_size: 20,
    condition: { fields: ['bill_no'], values: { bill_no: 'SCTL' } }, sort_by: 'bill_date', sort_order: 'asc',
  })
  assert.equal(calls.at(-1).body.search_field, '["bill_no"]')
  assert.deepEqual(JSON.parse(calls.at(-1).body.search_value), { bill_no: 'SCTL' })
  await api.listNativeBills('production-return', { page: 1, page_size: 20 })
  assert.deepEqual(calls.at(-1).body, { page: 1, page_size: 20 })
})
