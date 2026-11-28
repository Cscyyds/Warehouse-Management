"""打印任务 UI 与真实前端 API 封装联调；拦截后端和本机服务，绝不实际出纸。

先运行 Vite，再执行 python scripts/test-print-task-features.py --base-url http://127.0.0.1:3017
"""
import argparse
import json
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:3017')
parser.add_argument('--channel', default='')
parser.add_argument('--screenshot', default='')
args = parser.parse_args()

HTML = '''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/element-plus/dist/index.css"></head>
<body><div id="app"></div><script type="module">
import { createApp } from '/node_modules/.vite/deps/vue.js';
import ElementPlus from '/node_modules/.vite/deps/element-plus.js';
import Page from '/src/views/warehouse/WarehousePrintTask.vue';
createApp(Page).use(ElementPlus).mount('#app');
</script></body></html>'''

MODEL = '''
const model = { model_code: 'XP', model_name: '测试打印机', brand: '芯烨', density_default: 8,
 supported_print_modes: ['热敏'], supported_label_types: ['间隙纸'],
 label_specs: [{ spec_id: 'spec', spec_name: '70x50', width_mm: 70, height_mm: 50, is_default: 1 }] };
export async function getVisiblePrinterList() { return { data: { list: [model] } }; }
export async function getVisiblePrinterDetail() { return { data: model }; }
'''

HOOK = '''
import { ref } from '/node_modules/.vite/deps/vue.js';
export const PRINT_SERVICE_DOWNLOAD_URL = '', USB_DRIVER_DOWNLOAD_URL = '', XP_AGENT_DOWNLOAD_URL = '';
export const XP_CHANNEL_BRANDS = ['芯烨', 'TSC'];
export function HOOK_NAME() {
  return {
    serviceConnected: ref(true), sdkInited: ref(true), connecting: ref(false), serviceError: ref(''),
    printing: ref(false), ready: ref(true), printerName: ref('模拟打印机'), printerList: ref([]),
    printError: ref(''), agentVersion: ref('1.3.0'), discovering: ref(false), discoveredDevices: ref([]),
    connMode: ref('usb'), winPrinter: ref(''), netHost: ref(''), netPort: ref(9100),
    connectService: async () => true, refreshStatus: async () => {}, refreshPrinters: async () => {},
    connectPrinter: async () => true, detectPrinter: async () => true, ensureReady: async () => true,
    selectConnection: async () => true, discoverDevices: async () => [],
    print: async (...args) => { window.__printCalls = [...(window.__printCalls || []), args]; return true; },
    preview: async () => '',
  };
}
'''


def task(index, status='PENDING', generative=False):
    return dict(print_task_id=f'pt_{index}', task_no=f'PT{index}', batch_id='batch',
                biz_type='INBOUND_PURCHASE' if generative else 'LOCATION', biz_type_desc='采购入库条码' if generative else '货位条码',
                biz_id=f'loc_{index}', biz_desc=f'货位{index}', print_qty=1,
                print_params={'items': []} if generative else None,
                summary={'product_name': '目标产品' if index == 41 else '普通产品'},
                source='REPRINT', source_desc='补打', status=status, is_generative=generative,
                created_by='u1', created_by_name='测试', created_at='2026-10-25 09:00:00',
                printed_by_name='测试' if status == 'PRINTED' else None,
                printed_at='2026-10-25 10:00:00' if status == 'PRINTED' else None, cancel_reason=None)


store = [task(index) for index in range(1, 44)] + [task(100, 'PRINTED'), task(101, 'PRINTED', True), task(200, 'CANCELED')]
calls = []
PRINT_RESULT = dict(printer_has_preview_capability=True, sdk_type='XP', print_data={'tspl_commands': ['ORIGINAL_BARCODE']}, pdf_url=None)


def route_request(route):
    parsed = urlsplit(route.request.url)
    path = parsed.path
    if path == '/__print_task_features_test__':
        route.fulfill(content_type='text/html', body=HTML)
    elif path.endswith('/api/modules/printerModel.ts'):
        route.fulfill(content_type='application/javascript', body=MODEL)
    elif path.endswith('/utils/nmPrint/useNmPrint.ts') or path.endswith('/utils/xpPrint/useXpPrint.ts'):
        hook = 'useNmPrint' if 'nmPrint' in path else 'useXpPrint'
        route.fulfill(content_type='application/javascript', body=HOOK.replace('HOOK_NAME', hook))
    elif path.startswith('/api/v1/') or '/api/v1/' in path:
        calls.append((route.request.method, path, parse_qs(parsed.query), route.request.post_data))
        if path.endswith('/print-tasks') and route.request.method == 'GET':
            query = parse_qs(parsed.query)
            status = query.get('status', ['PENDING'])[0]
            keyword = query.get('keyword', [''])[0]
            number, size = int(query.get('page', ['1'])[0]), int(query.get('page_size', ['20'])[0])
            rows = [row for row in store if row['status'] == status and
                    (not keyword or keyword in row['biz_desc'] or keyword in row['summary']['product_name'])]
            data = dict(list=rows[(number - 1) * size:number * size], total=len(rows), page=number, page_size=size)
        elif path.endswith('/print-tasks/print-data'):
            data = [{'key': '0', 'label': '原条码', 'qty': 1, 'result': PRINT_RESULT}]
        elif path.endswith('/locations/print'):
            data = PRINT_RESULT
        else:
            route.abort()
            return
        route.fulfill(content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
                      body=json.dumps({'success': True, 'message': '成功', 'data': data}))
    elif parsed.netloc != urlsplit(args.base_url).netloc:
        route.abort()
    else:
        route.continue_()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, channel=args.channel or None)
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, service_workers='block')
    context.route('**/*', route_request)
    page = context.new_page()
    errors = []
    console_errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    try:
        page.goto(args.base_url + '/__print_task_features_test__')
        expect(page.locator('.el-table__body tbody tr')).to_have_count(20)
        expect(page.get_by_text('打印机型号', exact=True)).to_be_visible()
        settings = page.locator('.settings-card').bounding_box()
        tabs = page.locator('.status-tabs').bounding_box()
        assert settings['y'] + settings['height'] <= tabs['y']
        page.locator('.btn-next').click()
        expect(page.locator('.el-table__body tbody tr').first).to_contain_text('PT21')
        search = page.get_by_placeholder('搜索内容摘要、条码 / 对象')
        search.fill('目标产品')
        search.press('Enter')
        expect(page.locator('.el-table__body tbody tr')).to_have_count(1)
        expect(page.locator('.el-table__body tbody tr').first).to_contain_text('PT41')
        assert calls[-1][2]['keyword'] == ['目标产品'] and calls[-1][2]['page'] == ['1']
        search.fill('')
        search.press('Enter')
        expect(page.locator('.el-table__body tbody tr')).to_have_count(20)
        page.get_by_role('tab', name='已打印', exact=True).click()
        expect(page.get_by_text('打印机型号', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='重新打印', exact=True)).to_have_count(2)
        page.get_by_role('button', name='重新打印', exact=True).first.click()
        page.wait_for_function('window.__printCalls?.length === 1')
        expect(page.get_by_role('button', name='重新打印', exact=True).last).to_be_enabled()
        page.get_by_role('button', name='重新打印', exact=True).last.click()
        page.wait_for_function('window.__printCalls?.length === 2')
        assert any(path.endswith('/print-tasks/print-data') for _, path, _, _ in calls)
        assert not any(path.endswith('/print-tasks/printed') or
                       (method == 'POST' and path.endswith('/print-tasks')) for method, path, _, _ in calls)
        expect(page.locator('.el-table__body tbody tr')).to_have_count(2)
        if args.screenshot:
            page.screenshot(path=args.screenshot, full_page=True)
        page.get_by_role('tab', name='已取消', exact=True).click()
        expect(page.get_by_text('打印机型号', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='重新打印', exact=True)).to_have_count(0)
        assert not errors, errors
        print('PASS: settings above tabs, three-tab persistence, server search/paging, normal and inbound reprint, no task creation/status writeback')
    except Exception:
        print('Browser errors:', errors, console_errors)
        print('Page text:', page.locator('body').inner_text()[:1200])
        raise
    finally:
        browser.close()
