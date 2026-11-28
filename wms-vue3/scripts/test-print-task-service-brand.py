import argparse
import json
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
args = parser.parse_args()

HTML = '''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/element-plus/dist/index.css">
</head><body><div id="app"></div><script type="module">
import { createApp } from '/node_modules/.vite/deps/vue.js';
import ElementPlus from '/node_modules/.vite/deps/element-plus.js';
import Page from '/src/views/warehouse/WarehousePrintTask.vue';
createApp(Page).use(ElementPlus).mount('#app');
</script></body></html>'''

MODELS = [
    {'model_code': 'XP', 'model_name': '芯烨测试型号', 'brand': '芯烨'},
    {'model_code': 'JC', 'model_name': '精臣测试型号', 'brand': '精臣'},
]
API = '''
const models = MODELS;
export async function getVisiblePrinterList() { return { data: { list: models } }; }
export async function getVisiblePrinterDetail(code) {
  return { data: { ...models.find(m => m.model_code === code), density_default: 8,
    supported_print_modes: ['热敏'], supported_label_types: ['间隙纸'],
    label_specs: [{ spec_id: 'spec', spec_name: '70x50', width_mm: 70, height_mm: 50, is_default: 1 }] } };
}
'''.replace('MODELS', json.dumps(MODELS, ensure_ascii=False))

HOOK = '''
import { ref } from '/node_modules/.vite/deps/vue.js';
export const __DOWNLOAD__ = '';
export const USB_DRIVER_DOWNLOAD_URL = '';
export function HOOK_NAME() {
  const state = { serviceConnected: ref(CONNECTED), connecting: ref(false), printerName: ref(''),
    connectService: async () => {}, printing: ref(false) };
  window.STATE_NAME = state;
  return state;
}
'''


def route_request(route):
    path = urlsplit(route.request.url).path
    if path == '/__print_task_brand_test__':
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
        route.fulfill(content_type='application/javascript', body='''
export async function listPrintTasks() { return { list: [], total: 0 }; }
export function cancelPrintTask() { throw Error('Unexpected write'); }
export function markPrintTaskPrinted() { throw Error('Unexpected write'); }
export function fetchTaskPrintData() { throw Error('Unexpected print'); }
''')
    elif path.startswith(('/api/', '/scanner-api/')) or urlsplit(route.request.url).netloc != urlsplit(args.base_url).netloc:
        route.abort()
    else:
        route.continue_()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(service_workers='block', viewport={'width': 1440, 'height': 900})
    context.route('**/*', route_request)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(args.base_url + '/__print_task_brand_test__')
        page.wait_for_load_state('networkidle')
        assert not errors, errors
        expect(page.locator('.service-alert')).to_contain_text('未检测到芯烨本机打印代理')
        expect(page.locator('.service-ok')).to_have_count(0)
        page.evaluate('window.xpState.serviceConnected.value = true')
        expect(page.locator('.service-ok')).to_have_count(1)
        expect(page.locator('.service-ok')).to_contain_text('芯烨打印代理：已连接')
        page.locator('.settings-form .el-select').first.click()
        page.get_by_role('option', name='精臣测试型号（精臣）', exact=True).click()
        expect(page.locator('.service-ok')).to_have_count(1)
        expect(page.locator('.service-ok')).to_contain_text('精臣打印服务：已连接')
        page.evaluate('window.nmState.serviceConnected.value = false; window.nmState.connecting.value = true')
        expect(page.locator('.service-pending')).to_contain_text('精臣打印服务：检测中')
        expect(page.locator('.service-ok')).to_have_count(0)
        page.evaluate('window.nmState.connecting.value = false')
        expect(page.locator('.service-alert')).to_contain_text('未检测到本机打印服务（精臣直打需要）')
        page.locator('.settings-form .el-select').first.click()
        page.get_by_role('option', name='芯烨测试型号（芯烨）', exact=True).click()
        expect(page.locator('.service-ok')).to_contain_text('芯烨打印代理：已连接')
        expect(page.locator('.service-alert')).to_have_count(0)
        assert not errors, errors
        print('PASS: brand-specific status, both services connected, connecting and disconnected states; no backend or printer accessed')
    finally:
        context.route('**/*', lambda route: route.abort())
        context.unroute('**/*', route_request)
        browser.close()
