import argparse
import json
import re
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:3012')
args = parser.parse_args()
MODEL = {
    'model_code': 'test-pdf', 'model_name': '模拟PDF打印机', 'brand': '精臣',
    'has_preview_capability': 0, 'density_default': 8, 'density_min': 1, 'density_max': 15,
    'supported_print_modes': ['热敏'], 'supported_label_types': ['间隙纸'],
    'label_specs': [{'spec_id': 'spec_1', 'spec_name': '标准', 'width_mm': 70, 'height_mm': 50, 'is_default': 1}],
}


def task(number, created_at, status='PENDING'):
    return {
        'print_task_id': f'ptask_{number}', 'task_no': f'PT20260924{number:03}', 'batch_id': 'test-batch',
        'biz_type': 'LOCATION', 'biz_type_desc': '货位条码', 'biz_id': f'loc_{number}',
        'biz_desc': f'货位{number}', 'print_qty': 3, 'print_params': None, 'summary': {},
        'source': 'REPRINT', 'source_desc': '补打', 'status': status, 'is_generative': False,
        'created_by_name': '测试人员', 'created_at': created_at,
    }


class Fixture:
    def __init__(self):
        self.queue_calls = []
        self.print_calls = []
        self.list_calls = []
        self.unexpected_writes = []
        self.added = []
        self.location_count = 3
        self.queue_error = False

    def tree(self):
        locations = [{'location_id': f'loc_{i}', 'location_name': f'货位{i}', 'location_no': f'A{i:02}', 'status': 1}
                     for i in range(1, self.location_count + 1)]
        if self.location_count == 3:
            locations[0]['children'] = [locations.pop(1)]
        return [{'warehouse_id': 'wh_1', 'warehouse_name': '测试仓库', 'status': 1, 'children': locations}]

    def handle(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        path = parsed.path
        if not path.startswith(('/api/', '/scanner-api/')):
            if parsed.netloc == urlsplit(args.base_url).netloc:
                route.continue_()
            else:
                route.abort()
            return

        def reply(data, status=200, message='模拟接口'):
            route.fulfill(status=status, content_type='application/json', body=json.dumps({
                'success': status == 200, 'code': status, 'message': message, 'data': data,
            }, ensure_ascii=False))

        if path.endswith('/my-permissions'):
            codes = ['perm_api_wms_search_location', 'perm_api_wms_detail_location',
                     'perm_api_wms_query_warehouse', 'perm_api_wms_search_warehouse',
                     'perm_api_tenant_printer_models_query', 'perm_api_tenant_printer_models_detail']
            reply({'menus': [{'menu_id': 'menu_wms', 'menu_name': '仓库管理', 'buttons': [
                {'button_id': 'test_print', 'button_name': '打印', 'permissions': [{'perm_code': code} for code in codes]},
            ]}]})
        elif path.endswith('/tenant-trade/mode'):
            reply({'purchase_sales_mode': 'NATIVE', 'finance_module_enabled': True, 'purchase_sales_module_enabled': True})
        elif path.endswith('/tenant-warehouses/query'):
            reply({'warehouse': self.tree(), 'total': 1, 'page': 1, 'page_size': 20})
        elif path.endswith('/tenant-printer-models/query'):
            reply({'list': [MODEL], 'total': 1, 'page': 1, 'page_size': 100})
        elif path.endswith('/tenant-printer-models/detail'):
            reply(MODEL)
        elif path.endswith('/locations/print') and request.method == 'POST':
            form = parse_qs(request.post_data)
            self.print_calls.append(form)
            reply({'printer_has_preview_capability': False, 'sdk_type': None, 'print_data': None,
                   'pdf_url': args.base_url + '/__test-label.pdf', 'expire_seconds': 300, 'print_mode': 'PRINT'})
        elif path.endswith('/print-tasks') and request.method == 'POST':
            form = parse_qs(request.post_data)
            self.queue_calls.append(form)
            if self.queue_error:
                reply(None, 503, '模拟入队失败')
                return
            items = json.loads(form['items'][0])
            self.added = [task(11 + i, '2026-09-24 11:00:00') for i in range(len(items))]
            reply({'batch_id': form['batch_no'][0], 'created': self.added, 'skipped': [], 'invalid': [], 'total_pending': 5})
        elif path.endswith('/print-tasks'):
            query = parse_qs(parsed.query)
            self.list_calls.append(query)
            status = query.get('status', ['PENDING'])[0]
            result = [task(1, '2026-09-24 09:00:00', status), task(2, '2026-09-24 10:00:00', status), task(10, '2026-09-24 10:00:00', status)]
            if status == 'PENDING':
                result += self.added
            reply({'list': result, 'total': len(result), 'page': 1, 'page_size': 100})
        elif '/temp' in path and request.method == 'POST':
            reply({})
        elif request.method != 'GET':
            self.unexpected_writes.append((request.method, path))
            route.abort()
        else:
            reply({})


def rows(page):
    return page.locator('.el-table__body .el-table__row')


def queue_button(page):
    return page.locator('.el-dialog:visible').get_by_role('button', name='提交到打印队列', exact=True)


def confirm(page, text):
    page.locator('.el-message-box').get_by_role('button', name=text, exact=True).click()


def assert_task_order(page, numbers):
    expect(rows(page)).to_have_count(len(numbers))
    for i, number in enumerate(numbers):
        expect(rows(page).nth(i)).to_contain_text(f'PT20260924{number:03}')


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chromium', headless=True, args=['--renderer-process-limit=1'])
    context = browser.new_context(viewport={'width': 1600, 'height': 1000}, service_workers='block')
    context.add_init_script("localStorage.setItem('token', 'mock-location-print'); localStorage.setItem('operator_name', '库位测试');")
    context.route_web_socket('**/*', lambda socket: socket.close())
    fixture = Fixture()
    context.route('**/*', fixture.handle)
    page = context.new_page()
    page.set_default_timeout(15000)
    errors = []
    console_errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    artifacts = Path(tempfile.mkdtemp(prefix='wms-location-print-'))
    try:
        page.goto(args.base_url + '/warehouse/location', wait_until='domcontentloaded')
        expect(rows(page)).to_have_count(4)
        expect(page.get_by_role('button', name='库位打印', exact=True)).to_be_disabled()
        expect(rows(page).nth(0).get_by_role('checkbox')).to_be_disabled()
        rows(page).nth(1).get_by_role('checkbox').check()
        expect(rows(page).nth(2).get_by_role('checkbox')).not_to_be_checked()
        page.get_by_role('button', name='库位打印（1）', exact=True).click()
        dialog = page.locator('.el-dialog:visible')
        expect(dialog).to_contain_text('1 条')
        dialog.locator('.el-select').first.click()
        page.get_by_role('option', name='模拟PDF打印机', exact=True).click()
        expect(dialog.get_by_role('button', name='打印', exact=True)).to_be_enabled()
        dialog.get_by_role('button', name='打印', exact=True).click()
        expect(dialog.get_by_role('link', name='下载第 1 个')).to_have_attribute('href', args.base_url + '/__test-label.pdf')
        assert fixture.print_calls[-1]['location_id'] == ['loc_1']
        assert fixture.print_calls[-1]['print_mode'] == ['PRINT']
        assert not fixture.queue_calls
        dialog.get_by_role('button', name='取消', exact=True).click()
        print('PASS: warehouse cannot be selected; parent selection is independent; one location uses direct print, not queue', flush=True)

        rows(page).nth(2).get_by_role('checkbox').check()
        page.get_by_role('button', name='批量打印（2）', exact=True).click()
        expect(dialog.locator('.batch-queue-alert')).to_be_visible()
        expect(dialog.locator('.el-select')).to_have_count(0)
        dialog.get_by_role('spinbutton').fill('3')
        dialog.get_by_role('spinbutton').press('Tab')
        queue_button(page).click()
        confirm(page, '取消')
        assert not fixture.queue_calls
        fixture.queue_error = True
        queue_button(page).click()
        confirm(page, '确认提交')
        expect(page.locator('.el-message--error').last).to_contain_text('模拟入队失败')
        expect(queue_button(page)).to_be_enabled()
        fixture.queue_error = False
        queue_button(page).click()
        confirm(page, '确认提交')
        expect(page.locator('.el-message-box')).to_contain_text('已提交 2 条打印任务')
        assert len(fixture.queue_calls) == 2
        assert fixture.queue_calls[0]['batch_no'] == fixture.queue_calls[1]['batch_no']
        form = fixture.queue_calls[-1]
        assert form['source'] == ['REPRINT']
        items = json.loads(form['items'][0])
        assert [item['biz_id'] for item in items] == ['loc_1', 'loc_2']
        assert all(item['biz_type'] == 'LOCATION' and item['print_qty'] == 3 for item in items)
        assert len(fixture.print_calls) == 1
        confirm(page, '去打印任务页')
        expect(page).to_have_url(re.compile('/warehouse/print-task$'))
        assert_task_order(page, [12, 11, 10, 2, 1])
        page.get_by_role('button', name='刷新', exact=True).click()
        assert_task_order(page, [12, 11, 10, 2, 1])
        page.screenshot(path=str(artifacts / 'newest-first.png'), full_page=True)
        print('PASS: batch LOCATION/REPRINT payload, copies, cancellation, failed request retry and task-page navigation', flush=True)

        for label in ['已打印', '已取消']:
            page.get_by_role('tab', name=label, exact=True).click()
            assert_task_order(page, [10, 2, 1])
        page.get_by_role('tab', name='待打印', exact=True).click()
        assert_task_order(page, [12, 11, 10, 2, 1])
        page.locator('.page-header__right .el-select').click()
        page.get_by_role('option', name='货位条码', exact=True).click()
        expect(page.locator('.page-header__right .el-select')).to_contain_text('货位条码')
        assert_task_order(page, [12, 11, 10, 2, 1])
        assert fixture.list_calls[-1]['biz_type'] == ['LOCATION']
        assert all(query['page'] == ['1'] and query['page_size'] == ['100'] for query in fixture.list_calls)
        print('PASS: newest-first ordering survives refresh, status and type filters; same-time task numbers sort numerically', flush=True)

        page.goto(args.base_url + '/warehouse/location', wait_until='domcontentloaded')
        expect(rows(page)).to_have_count(4)
        rows(page).nth(1).get_by_role('checkbox').check()
        page.get_by_role('button', name='重置', exact=True).click()
        expect(page.get_by_role('button', name='库位打印', exact=True)).to_be_disabled()
        expect(rows(page).nth(1).get_by_role('checkbox')).not_to_be_checked()
        fixture.location_count = 101
        page.reload(wait_until='domcontentloaded')
        expect(rows(page)).to_have_count(102)
        page.locator('.el-table__header').get_by_role('checkbox').check()
        page.get_by_role('button', name='批量打印（101）', exact=True).click()
        expect(page.locator('.el-message--warning').last).to_contain_text('单次最多提交 100 个库位')
        expect(page.locator('.el-dialog:visible')).to_have_count(0)
        assert len(fixture.queue_calls) == 2
        assert not fixture.unexpected_writes, fixture.unexpected_writes
        assert not errors, errors
        assert all('Failed to load resource' in text and '503' in text for text in console_errors), console_errors
        print('PASS: refresh clears selection and selecting over 100 locations is rejected without requests', flush=True)
        print('Artifacts:', artifacts, flush=True)
    except Exception:
        print('URL:', page.url, 'Runtime errors:', errors, 'Console errors:', console_errors, flush=True)
        page.screenshot(path=str(artifacts / 'failure.png'), full_page=True)
        print('Artifacts:', artifacts, flush=True)
        raise
    finally:
        context.close()
        browser.close()
