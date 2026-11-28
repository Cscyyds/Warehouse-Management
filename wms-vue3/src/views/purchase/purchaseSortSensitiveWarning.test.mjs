import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as Vue from 'vue'
import * as Pinia from 'pinia'
import { normalizeApiError } from '../../utils/apiError.ts'
import * as paths from '../../utils/sensitiveFields.ts'

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function load(code, imports) { const result = {}; new Function('require', 'exports', code)(name => imports[name], result); return result }
const template = readFileSync(new URL('./PurchaseGenericList.vue', import.meta.url), 'utf8')
const condition = template.match(/<el-alert v-if="([^"]+)" title="字段权限状态未确认/)[1]
const showsWarning = new Function('type', 'listFieldBinding', 'listFields', `return ${condition}`)

test('采购订单正倒序刷新期间不误报权限失败，真正失败时仍提示并阻止导出', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window'), oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  globalThis.window = new EventTarget(); globalThis.localStorage = { getItem: () => 'session' }
  const requests = []
  const storeMod = load(compile('../../stores/sensitiveField.ts'), { vue: Vue, pinia: Pinia, '@/config/sensitiveFieldFeatures': { sensitiveFieldsEnabled: true }, '@/api/modules/sensitiveField': { getSensitiveRestrictions: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) }, '@/utils/apiError': { normalizeApiError }, '@/utils/sensitiveFields': paths })
  Pinia.setActivePinia(Pinia.createPinia())
  const store = storeMod.useSensitiveFieldStore()
  const vue = { ...Vue, onActivated() {}, onDeactivated() {} }
  const { useSensitiveFields } = load(compile('../../composables/useSensitiveFields.ts'), { vue, '@/config/sensitiveFieldFeatures': { sensitiveFieldsEnabled: true }, '@/stores/sensitiveField': { useSensitiveFieldStore: () => store }, '@/utils/sensitiveFields': paths })
  const { useTableSort } = load(compile('../../composables/useTableSort.ts'), { vue: Vue })
  const scope = Vue.effectScope(); let fields, sort
  try {
    scope.run(() => { fields = useSensitiveFields({ interfacePath: () => '/tenant-purchase-orders/list' }); sort = useTableSort(() => void fields.refresh()) })
    const ready = { data: { interface_url: '/tenant-purchase-orders/list', is_restricted: false, restricted_fields: [] } }
    requests[0].resolve(ready); await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick()
    assert.equal(fields.confirmed.value, true)
    for (const order of ['ascending', 'descending']) {
      sort.handleSortChange({ prop: 'order_no', order })
      assert.equal(fields.confirmed.value, false, '刷新中仍禁止导出')
      assert.equal(showsWarning('order', {}, fields), false, '正常刷新不应显示失败警告')
      requests.at(-1).resolve(ready); await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick()
      assert.equal(fields.confirmed.value, true)
    }
    sort.handleSortChange({ prop: 'order_no', order: 'ascending' })
    requests.at(-1).reject({ response: { status: 403, data: { message: '无权限' } } }); await Vue.nextTick(); await Promise.resolve(); await Vue.nextTick()
    assert.equal(fields.confirmed.value, false)
    assert.equal(showsWarning('order', {}, fields), true)
  } finally {
    scope.stop(); store.$dispose(); Pinia.setActivePinia(undefined)
    for (const [key, old] of [['window', oldWindow], ['localStorage', oldStorage]]) old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key]
  }
})
