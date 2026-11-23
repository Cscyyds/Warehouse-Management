import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const cache = new Map()
function loadConfig(path) {
  if (cache.has(path)) return cache.get(path)
  const exports = {}
  cache.set(path, exports)
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'exports', output)(name => loadConfig(resolve(dirname(path), `${name}.ts`)), exports)
  return exports
}

const { resolvePermDisplayLabel } = loadConfig(resolve(here, 'permissionUrlMap.ts'))

test('扫码枪权限在后端返回权限码时显示对应中文', () => {
  const labels = {
    perm_scanner_prd_inbound_all: '生产入库作业全部权限',
    perm_scanner_prd_outbound_all: '生产出库作业全部权限',
    perm_scanner_inbound_place: '入库上架',
    perm_scanner_inbound_scan: '入库扫描与确认',
    perm_scanner_outbound_pick: '出库拣货',
    perm_scanner_outbound_scan: '出库扫描',
    perm_scanner_other_inbound_operation: '其他入库作业与查询',
    perm_scanner_borrow_operation: '借出借入作业与查询',
    perm_scanner_distribution_inbound_all: '集散位入库作业全部权限',
    perm_scanner_distribution_outbound_all: '集散位取货权限',
    perm_scanner_ext_itemno_all: '外部品号查询产品',
    perm_scanner_print_task_all: '打印任务全部权限',
  }
  for (const [code, label] of Object.entries(labels)) {
    assert.equal(resolvePermDisplayLabel(code, code), label, code)
    assert.equal(resolvePermDisplayLabel(code), label, code)
  }
})

test('优先显示后端提供的中文名称，未知权限保留原码', () => {
  assert.equal(resolvePermDisplayLabel('perm_scanner_prd_inbound_all', '生产入库自定义名称'), '生产入库自定义名称')
  assert.equal(resolvePermDisplayLabel('perm_scanner_unknown', 'perm_scanner_unknown'), 'perm_scanner_unknown')
})
