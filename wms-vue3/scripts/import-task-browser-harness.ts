import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import '../src/styles/index.scss'
import BatchImportDialog from '../src/views/common/BatchImportDialog.vue'
import { IMPORT_TASK_APIS, importUsers, importProducts, importCustomers, importSuppliers, importSalesOrders, importPurchaseOrders, type ImportTaskType } from '../src/api/modules/batchImport'
import { usePermissionStore } from '../src/stores/permission'
import { resolvePermCodesByEndpoint } from '../src/config/permissionUrlMap'
import { IMPORT_TEMPLATES } from '../src/config/importTemplates'

const pinia = createPinia()
const permissions = usePermissionStore(pinia)
const params = new URLSearchParams(location.search)
const type = (params.get('type') || 'product') as ImportTaskType
const apis = IMPORT_TASK_APIS[type]
const readOnly = params.get('readOnly') === 'true'
const detailAllowed = params.get('detail') !== 'false'
permissions.permCodes = new Set([
  ...resolvePermCodesByEndpoint(`GET ${apis.list}`),
  ...(detailAllowed ? resolvePermCodesByEndpoint(`GET ${apis.detail}`) : []),
  ...(readOnly ? [] : resolvePermCodesByEndpoint(`POST ${apis.submit}`)),
])
const submit = { employee: importUsers, product: importProducts, customer: importCustomers, supplier: importSuppliers, 'sales-order': importSalesOrders, 'purchase-order': importPurchaseOrders }
const state = reactive({ visible: true, completed: 0 })
const app = createApp({
  setup: () => () => h('main', [
    h('button', { id: 'reopen', onClick: () => { state.visible = true } }, '重新打开测试窗口'),
    h('output', { id: 'completion-count' }, String(state.completed)),
    h(BatchImportDialog, {
      modelValue: state.visible,
      'onUpdate:modelValue': (value: boolean) => { state.visible = value },
      title: `${type} 导入`, taskType: type,
      initialTab: params.get('tab') === 'upload' ? 'upload' : 'records',
      templateUrl: IMPORT_TEMPLATES[type],
      templateName: `${({ employee: '员工', product: '产品', customer: '客户', supplier: '供应商', 'sales-order': '销售订单', 'purchase-order': '采购订单' })[type]}导入模板.xlsx`, importFn: submit[type],
      onSuccess: () => { state.completed++ },
    }),
  ]),
})
app.use(pinia).use(ElementPlus, { locale: zhCn }).mount('#test-app')
