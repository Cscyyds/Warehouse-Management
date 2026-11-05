"""打印任务页分页 + 确认已打印后离场的浏览器验证（无后端依赖）。

做法与 test-print-task-service-brand.py 一致：vite 开发服务器托管一个只挂载
WarehousePrintTask.vue 的页面，Playwright 把 printTask.ts / printerModel.ts /
useNmPrint / useXpPrint 全部替换为内存实现，其余请求一律 abort，绝不触碰真实后端。

用法：先启动 dev server（npm run dev），再执行
  python scripts/test-print-task-pagination.py --base-url http://localhost:3000
"""
import argparse
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
parser.add_argument('--channel', default='', help='本机未装 Playwright 自带 chromium 时可传 chrome / msedge')
parser.add_argument('--screenshot', default='', help='可选：把第 2 页的界面截图保存到该路径')
args = parser.parse_args()

HTML = '''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/element-plus/dist/index.css">
</head><body><div id="app"></div><script type="module">
import { createApp } from '/node_modules/.vite/deps/vue.js';
import ElementPlus from '/node_modules/.vite/deps/element-plus.js';
import Page from '/src/views/warehouse/WarehousePrintTask.vue';
createApp(Page).use(ElementPlus).mount('#app');
</script></body></html>'''

API = '''
const models = MODELS;
export async function getVisiblePrinterList() { return { data: { list: models } }; }
export async function getVisiblePrinterDetail(code) {
  return { data: { ...models.find(m => m.model_code === code), density_default: 8,
    supported_print_modes: ['热敏'], supported_label_types: ['间隙纸'],
    label_specs: [{ spec_id: 'spec', spec_name: '70x50', width_mm: 70, height_mm: 50, is_default: 1 }] } };
}
'''.replace('MODELS', """[{'model_code': 'JC', 'model_name': '精臣测试型号', 'brand': '精臣'}]""")

HOOK = '''
import { ref } from '/node_modules/.vite/deps/vue.js';
export const __DOWNLOAD__ = '';
export const USB_DRIVER_DOWNLOAD_URL = '';
export function HOOK_NAME() {
  const state = {
    serviceConnected: ref(CONNECTED), sdkInited: ref(false), connecting: ref(false), serviceError: ref(''),
    printing: ref(false), ready: ref(CONNECTED), printerName: ref(''), printerList: ref([]), progress: ref(null),
    printError: ref(''), agentVersion: ref(''), discovering: ref(false), discoveredDevices: ref([]),
    connMode: ref('usb'), netHost: ref(''), netPort: ref(9100),
    connectService: async () => true, refreshStatus: async () => {}, refreshPrinters: async () => {},
    connectPrinter: async () => {}, detectPrinter: async () => {}, ensureReady: async () => true,
    selectConnection: async () => true, discoverDevices: async () => [],
    print: async () => true, preview: async () => '',
  };
  window.STATE_NAME = state;
  return state;
}
'''

# 45 条待打印任务：20/页 = 3 页（末页 5 条），100/页 = 1 页
TASKS = '''
const store = Array.from({ length: 45 }, (_, index) => ({
  print_task_id: `ptask_${index + 1}`, task_no: `PT20260924${String(index + 1).padStart(3, '0')}`,
  batch_id: 'test-batch', biz_type: 'LOCATION', biz_type_desc: '货位条码', biz_id: `loc_${index + 1}`,
  biz_desc: `货位${index + 1}`, print_qty: 1, print_params: null, summary: {},
  source: 'REPRINT', source_desc: '补打', status: 'PENDING', is_generative: false,
  created_by_name: '测试人员', created_at: `2026-09-24 10:${String(index).padStart(2, '0')}:00`,
}));
window.__listCalls = [];
window.__printed = [];
export async function listPrintTasks(query) {
  window.__listCalls.push({ ...query });
  const page = query.page || 1;
  const size = query.page_size || 20;
  const pending = store.filter(item => item.status === 'PENDING');
  return { list: pending.slice((page - 1) * size, page * size), total: pending.length, page, page_size: size };
}
export async function markPrintTaskPrinted(printTaskId) {
  window.__printed.push(printTaskId);
  const row = store.find(item => item.print_task_id === printTaskId);
  row.status = 'PRINTED';
  return { print_task_id: printTaskId, task_no: row.task_no, status: 'PRINTED', printed_at: '2026-09-24 12:00:00' };
}
export function cancelPrintTask() { throw Error('Unexpected cancel'); }
export function fetchTaskPrintData() { throw Error('Unexpected print'); }
'''


def route_request(route):
    path = urlsplit(route.request.url).path
    if path == '/__print_task_pagination_test__':
        route.fulfill(content_type='text/html', body=HTML)
    elif path.endswith('/api/modules/printerModel.ts'):
        route.fulfill(content_type='application/javascript', body=API)
    elif path.endswith('/utils/nmPrint/useNmPrint.ts'):
        body = HOOK.replace('__DOWNLOAD__', 'PRINT_SERVICE_DOWNLOAD_URL').replace('HOOK_NAME', 'useNmPrint').replace('STATE_NAME', 'nmState').replace('CONNECTED', 'true')
        route.fulfill(content_type='application/javascript', body=body)
    elif path.endswith('/utils/xpPrint/useXpPrint.ts'):
        body = HOOK.replace('__DOWNLOAD__', 'XP_AGENT_DOWNLOAD_URL').replace('HOOK_NAME', 'useXpPrint').replace('STATE_NAME', 'xpState').replace('CONNECTED', 'false')
        route.fulfill(content_type='application/javascript', body=body)
    elif path.endswith('/api/modules/printTask.ts'):
        route.fulfill(content_type='application/javascript', body=TASKS)
    elif path.startswith(('/api/', '/scanner-api/')) or urlsplit(route.request.url).netloc != urlsplit(args.base_url).netloc:
        route.abort()
    else:
        route.continue_()


def last_call(page):
    return page.evaluate('window.__listCalls')[len(page.evaluate('window.__listCalls')) - 1]


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel=args.channel or None)
    context = browser.new_context(service_workers='block', viewport={'width': 1440, 'height': 900})
    context.route('**/*', route_request)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(args.base_url + '/__print_task_pagination_test__')
        page.wait_for_load_state('networkidle')
        assert not errors, errors
        rows = page.locator('.el-table__row')
        total = page.locator('.el-pagination__total')

        # 1. 进入页面：按 20 条/页查第 1 页，顺序即服务端 created_at 升序（先进先打印）
        first = page.evaluate('window.__listCalls')[0]
        assert first['page'] == 1 and first['page_size'] == 20, first
        assert first['status'] == 'PENDING' and first['biz_type'] is None, first
        expect(rows).to_have_count(20)
        expect(rows.first).to_contain_text('PT20260924001')
        expect(rows.last).to_contain_text('PT20260924020')
        expect(total).to_contain_text('45')

        # 2. 翻到第 2 页：重新查询，拿到第 21~40 条而不是本地切片出的同一批数据
        page.locator('.el-pager li', has_text='2').first.click()
        expect(rows).to_have_count(20)
        expect(rows.first).to_contain_text('PT20260924021')
        second = last_call(page)
        assert second['page'] == 2 and second['page_size'] == 20, second
        if args.screenshot:
            page.screenshot(path=args.screenshot, full_page=True)

        # 3. 末页只剩 5 条，且总数与分页器一致
        page.locator('.el-pager li', has_text='3').first.click()
        expect(rows).to_have_count(5)
        expect(rows.first).to_contain_text('PT20260924041')
        third = last_call(page)
        assert third['page'] == 3, third

        # 4. 换每页条数（100 = 后端上限）：回到第 1 页重新查询，45 条一次展示
        page.locator('.el-pagination .el-select').click()
        page.locator('.el-select-dropdown__item').last.click()
        expect(rows).to_have_count(45)
        fourth = last_call(page)
        assert fourth['page'] == 1 and fourth['page_size'] == 100, fourth
        expect(total).to_contain_text('45')

        # 5. 浏览器确认已打印的任务立刻离开待打印列表，且总数同步减一
        first_row = rows.first
        expect(first_row).to_contain_text('PT20260924001')
        first_row.locator('.row-actions__more').click()
        page.get_by_role('menuitem', name='确认已打印').click()
        expect(rows).to_have_count(44)
        expect(rows.filter(has_text='PT20260924001')).to_have_count(0)
        expect(total).to_contain_text('44')
        assert page.evaluate('window.__printed') == ['ptask_1'], page.evaluate('window.__printed')

        assert not errors, errors
        print('PASS: 服务端分页（第1/2/末页 + 换页大小回第1页）、总数展示、确认已打印后离场；未访问后端与打印机')
    finally:
        context.route('**/*', lambda route: route.abort())
        context.unroute('**/*', route_request)
        browser.close()
