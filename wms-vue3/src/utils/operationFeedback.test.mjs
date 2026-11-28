import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { ref } from 'vue'
import { buildErrorDialogContent, errorDialogCopyText } from './errorDialogModel.ts'

function handlers(file, names, bindings) {
  bindings = { ...bindings, confirmAction: bindings.confirmAction ?? bindings.ElMessageBox?.confirm, promptAction: bindings.promptAction ?? bindings.ElMessageBox?.prompt }
  const { descriptor } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
  const source = ts.createSourceFile(file, descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
  const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
  assert.equal(functions.length, names.length)
  const code = ts.transpileModule(functions.map(node => node.getText(source)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  return new Function(...Object.keys(bindings), `${code}; return {${names.join(',')}}`)(...Object.values(bindings))
}

function feedback() {
  const dialogs = [], messages = []
  return {
    dialogs, messages,
    showErrorDialog: (message, options) => dialogs.push(buildErrorDialogContent(message, options)),
    showMessage: (message, type = 'info') => messages.push([type, message]),
    ElMessage: Object.fromEntries(['success', 'warning', 'info'].map(kind => [kind, message => messages.push([kind, message])])),
    ElNotification: options => messages.push(['notification', options]),
  }
}

test('同步失败明细最多展示和复制五条，全部成功继续使用成功气泡', () => {
  const f = feedback()
  const h = handlers('../views/trade/TradeBillList.vue', ['syncIssueSummary', 'notifySyncResult'], f)
  const failed = Array.from({ length: 8 }, (_, i) => ({ bill_no: `B${i + 1}`, reasons: [`原因${i + 1}`], raw: 'SECRET' }))
  h.notifySyncResult({ status: 'FAILED', failed_bills: failed }, 'ERP 通信异常')
  assert.equal(f.dialogs.length, 1)
  assert.equal(f.dialogs[0].details.length, 5)
  assert.doesNotMatch(errorDialogCopyText(f.dialogs[0]), /SECRET|原因6/)
  assert.equal(f.messages.length, 0)
  h.notifySyncResult({ rejected: [failed[0]], failed_bills: [] }, '部分同步完成')
  assert.equal(f.dialogs.length, 2)
  h.notifySyncResult({ rejected: [], failed_bills: [] }, '同步完成')
  assert.deepEqual(f.messages, [['success', '同步完成']])
})

test('同步重试失败使用窗口，转后台与无失败记录使用信息气泡', () => {
  const f = feedback()
  const h = handlers('../views/trade/SyncRejectPanel.vue', ['retryIssueSummary', 'notifyRetryResult', 'notifyRetryBackground'], f)
  h.notifyRetryResult('仍有失败', [{ erp_bill_no: 'B1', action: 'failed', reasons: ['连接失败'] }])
  assert.match(f.dialogs[0].details[0], /连接失败/)
  h.notifyRetryResult('无需重试', [])
  h.notifyRetryBackground('后台执行中')
  assert.equal(f.dialogs.length, 1)
  assert.deepEqual(f.messages.map(([kind]) => kind), ['info', 'info'])
})

test('原生删除确认改为异步后，取消和关闭不能执行单删或批删', async () => {
  const calls = []
  const h = handlers('../views/ai/pdf-review/index.vue', ['deleteJob', 'deleteJobs'], {
    showConfirmDialog: async () => false,
    deleteJobBackend: async id => { calls.push(id); return { result: 'deleted' } },
    forgetJob: () => assert.fail('取消后不能移除任务记录'),
    notify: () => assert.fail('取消后不应显示操作成功'),
  })
  await h.deleteJob('A', '图册 A')
  await h.deleteJobs(['A', 'B'])
  assert.deepEqual(calls, [])
})

test('批删确认只操作确认时的目标，并保留去重与失败反馈', async () => {
  const ids = ['A', 'A', 'B'], calls = [], forgotten = [], messages = []
  const h = handlers('../views/ai/pdf-review/index.vue', ['deleteJobs'], {
    showConfirmDialog: async () => { ids.push('C'); return true },
    deleteJobBackend: async id => { calls.push(id); return { result: id === 'A' ? 'deleted' : 'failed' } },
    forgetJob: id => forgotten.push(id), notify: (...args) => messages.push(args), logger: { info() {} },
  })
  await h.deleteJobs(ids)
  assert.deepEqual(calls, ['A', 'B'])
  assert.deepEqual(forgotten, ['A'])
  assert.equal(messages[0][1], true)
})

test('知识库覆盖确认期间任务切换，不能向新任务提交旧数据', async () => {
  const jobId = ref('A')
  const h = handlers('../views/ai/pdf-review/index.vue', ['importKnowledge'], {
    jobId, exportState: ref({ state: 'ready' }), kbBusy: () => false, kbState: ref({ state: 'validated' }),
    confirmKbReplace: async () => { jobId.value = 'B'; return true },
    blankKbState: () => assert.fail('目标变化时不能重置校验状态'),
  })
  await h.importKnowledge()
})

test('产品补录引导仅在确认后跳转，稍后处理保持原页', async () => {
  const paths = []; let confirmed = false
  const h = handlers('../views/production/UnboundProducts.vue', ['guideMissing'], {
    showConfirmDialog: async () => confirmed, router: { push: async path => paths.push(path) },
  })
  await h.guideMissing({ prd_no: 'P1', bill_count: 1, item_count: 2 })
  assert.deepEqual(paths, [])
  confirmed = true
  await h.guideMissing({ prd_no: 'P1', bill_count: 1, item_count: 2 })
  assert.deepEqual(paths, ['/product/info'])
})

test('图册工作台简单上传校验使用气泡，不创建错误窗口或导入任务', async () => {
  const f = feedback()
  const h = handlers('../views/ai/pdf-review/index.vue', ['notify', 'uploadKbFile'], {
    ...f, jobId: ref('A'), kbBusy: () => false, KB_UPLOAD_MAX_BYTES: 100 * 1024 * 1024,
    confirmKbReplace: () => assert.fail('文件校验失败不能进入导入确认'),
  })
  await h.uploadKbFile({ name: 'invalid.pdf', size: 5 })
  await h.uploadKbFile({ name: 'large.xlsx', size: 101 * 1024 * 1024 })
  assert.equal(f.dialogs.length, 0)
  assert.deepEqual(f.messages.map(([kind]) => kind), ['warning', 'warning'])
})

test('打印提交失败使用窗口，成功提交继续提供打印任务页跳转确认', async () => {
  const f = feedback(), confirmations = [], routes = []
  const h = handlers('../components/PrintLabelDialog.vue', ['reportBatchResult'], {
    ...f, router: { push: async path => routes.push(path) },
    ElMessageBox: { confirm: async (...args) => confirmations.push(args) },
  })
  await h.reportBatchResult({ created: [], skipped: Array.from({ length: 8 }, (_, i) => ({ reason: `原因${i + 1}` })), invalid: [] })
  assert.equal(f.dialogs[0].title, '提交失败')
  assert.equal(f.dialogs[0].details.length, 5)
  assert.equal(confirmations.length, 0)
  await h.reportBatchResult({ created: [{}], skipped: [], invalid: [] })
  assert.equal(confirmations.length, 1)
  assert.deepEqual(routes, ['/warehouse/print-task'])
})

test('打印中断立即停止后续标签，窗口保留已打印数量和重试说明', async () => {
  const f = feedback(), attempted = [], printingNow = ref(false)
  const h = handlers('../components/PrintLabelDialog.vue', ['handlePrint'], {
    ...f, outputMode: ref('LOCAL'), canSubmit: ref(true), preparing: ref(false), printingNow,
    nm: { printing: ref(false), printError: ref('缺纸') }, xp: { printing: ref(false) },
    isBatchMode: ref(false), isXpBrand: ref(false), currentModel: ref(null),
    props: { rows: [{ id: '1', title: '标签一' }, { id: '2', title: '标签二' }, { id: '3', title: '标签三' }] },
    sdkLog() {}, batchHint: ref(''), pdfUrls: ref([]),
    callPrintApi: async (_mode, row) => { attempted.push(row.id); return {} },
    printRowDirect: async () => attempted.length === 1 ? 'ok' : 'fail',
    emit: () => assert.fail('中断后不能报告全部完成'),
  })
  await h.handlePrint()
  assert.deepEqual(attempted, ['1', '2'])
  assert.equal(f.dialogs[0].title, '打印中断')
  assert.match(f.dialogs[0].reason, /已打印 1 条.*标签二.*缺纸/)
  assert.match(f.dialogs[0].reason, /重试会从头打印全部 3 条/)
  assert.equal(printingNow.value, false)
  assert.equal(f.messages.length, 0)
})

for (const status of ['FAILED', 'PREPARE_FAILED', 'SUBMITTED', 'UNKNOWN', 'PRINTED']) {
  test(`云打印 ${status} 区分实际失败与受理状态，保留原请求的重试行为`, async () => {
    const f = feedback(), removed = []
    const h = handlers('../views/warehouse/WarehousePrintTask.vue', ['executePrintTask'], {
      ...f, printingTaskId: ref(''), outputMode: ref('CLOUD'), cloudPrinterId: ref('printer'), cloudCodeStyle: ref('QRCODE'), infoSwitch: ref(true),
      prepareCloudPrintRequest: async () => ({ request_id: 'original' }),
      submitCloudPrint: async () => ({ status }), queryCloudJob: async () => ({ status }), cloudJobMessage: job => job.status,
      localStorage: { removeItem: key => removed.push(key) },
    })
    const result = await h.executePrintTask({ print_task_id: 'task', status: 'PENDING' })
    const failed = status === 'FAILED' || status === 'PREPARE_FAILED'
    assert.equal(f.dialogs.length, failed ? 1 : 0)
    assert.equal(f.messages.length, failed ? 0 : 1)
    assert.equal(result, status === 'PRINTED' || status === 'SUBMITTED')
    assert.equal(removed.length, status === 'PRINTED' ? 1 : 0)
  })
}
