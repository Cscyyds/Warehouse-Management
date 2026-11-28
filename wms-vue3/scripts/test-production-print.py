import argparse
import json
import re
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
args = parser.parse_args()

DOCS = [
    ('finished-goods-stockin', '成品缴库单'),
    ('production-picking', '生产领料单'),
    ('production-return', '生产退料单'),
    ('production-supplement', '生产补料单'),
    ('non-production-picking', '非生产领料单'),
    ('non-production-return', '非生产退料单'),
    ('outsourcing-picking', '托工领料单'),
    ('outsourcing-return', '托工退料单'),
    ('outsourcing-supplement', '托工补料单'),
    ('outsourcing-receipt', '托外加工缴回单'),
    ('material-cutting', '物料切割单'),
    ('outsourcing-chargeback', '托工退回单'),
    ('sales-return', '销售退回单'),
]
PDF = b'%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'


class Fixture:
    def __init__(self):
        self.pdf_requests = []
        self.create_requests = []
        self.marked = []
        self.unexpected_writes = []
        self.tasks = []
        self.queue_permission = True
        self.pdf_error = False
        self.hold_pdf = False
        self.pending_pdf = None
        self.create_mode = 'normal'

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
        query = parse_qs(parsed.query)

        def reply(data, status=200, message='模拟接口'):
            route.fulfill(status=status, content_type='application/json', body=json.dumps({
                'success': status == 200, 'code': status, 'message': message, 'data': data,
            }, ensure_ascii=False))

        if path.endswith('/print-tasks') and request.method == 'POST':
            form = parse_qs(request.post_data or '')
            items = json.loads(form['items'][0])
            self.create_requests.append((form, items))
            if self.create_mode == 'error':
                reply(None, 503, '模拟创建失败')
                return
            created, skipped, invalid = [], [], []
            for index, item in enumerate(items):
                biz_id = item['biz_id']
                if self.create_mode == 'invalid' or (self.create_mode == 'partial' and index == 1):
                    invalid.append({'biz_id': biz_id, 'reason': '单据无有效明细'})
                elif any(task['biz_id'] == biz_id and task['status'] == 'PENDING' for task in self.tasks):
                    skipped.append({'biz_id': biz_id, 'reason': '已存在待打印任务'})
                else:
                    task_id = f'ptask_{len(self.tasks) + 1}'
                    task = {
                        'print_task_id': task_id, 'task_no': task_id, 'batch_id': form['batch_no'][0],
                        'biz_type': item['biz_type'], 'biz_type_desc': '生产单据箱贴',
                        'biz_id': biz_id, 'biz_desc': item['biz_desc'], 'print_qty': 25,
                        'print_params': item['params'], 'summary': {'doc_name': dict(DOCS)[item['params']['doc_key']]},
                        'source': form['source'][0], 'source_desc': '生产单据批量打印',
                        'status': 'PENDING', 'is_generative': False, 'created_by_name': '打印回归测试',
                        'created_at': '2026-09-24 10:00:00',
                    }
                    self.tasks.append(task)
                    created.append({key: task[key] for key in ('print_task_id', 'task_no', 'biz_type', 'biz_id', 'biz_desc')})
            reply({'batch_id': form['batch_no'][0], 'created': created, 'skipped': skipped,
                   'invalid': invalid, 'total_pending': len(self.tasks)})
        elif path.endswith('/print-tasks/printed') and request.method == 'POST':
            task_id = parse_qs(request.post_data or '')['print_task_id'][0]
            self.marked.append(task_id)
            task = next(task for task in self.tasks if task['print_task_id'] == task_id)
            task['status'] = 'PRINTED'
            reply({'print_task_id': task_id, 'status': 'PRINTED', 'printed_at': '2026-09-24 10:01:00'})
        elif request.method != 'GET':
            self.unexpected_writes.append((request.method, path))
            route.abort()
        elif path.endswith('/my-permissions'):
            codes = ['perm_production_view', 'perm_production_manage']
            if self.queue_permission:
                codes.append('perm_scanner_print_task_all')
            reply({'menus': [
                {'menu_id': menu, 'menu_name': name, 'buttons': [
                    {'button_id': 'test_print', 'button_name': '打印',
                     'permissions': [{'perm_code': code} for code in codes]},
                ]}
                for menu, name in [('menu_production', '生产管理'), ('menu_wms', '仓库管理')]
            ]})
        elif path.endswith('/tenant-trade/mode'):
            reply({'purchase_sales_mode': 'NATIVE', 'finance_module_enabled': True, 'purchase_sales_module_enabled': True})
        elif path.endswith('/tenant-production/overview'):
            reply({'enabled': True, 'channel_code': 'TIANXIN', 'channel_name': '天心', 'docs': []})
        elif '/tenant-production/' in path and path.endswith('/print/pdf'):
            doc = path.split('/tenant-production/')[1].split('/')[0]
            self.pdf_requests.append((doc, query))
            if self.hold_pdf:
                self.pending_pdf = route
            elif self.pdf_error:
                reply('单据无有效明细', 400, '打印失败')
            else:
                route.fulfill(content_type='application/pdf', body=PDF)
        elif '/tenant-production/' in path and path.endswith(('/list', '/search')):
            doc = path.split('/tenant-production/')[1].split('/')[0]
            bills = [{'wms_bill_id': f'prdh_{doc}_{i}', 'erp_bill_no': f'TEST-{i}',
                      'erp_bill_date': '2026-09-24', 'item_count': 25, 'total_qty': 500,
                      'erp_lock_status': 0, 'synced_at': '2026-09-24 10:00:00'} for i in range(1, 4)]
            reply({'bills': bills, 'total': len(bills), 'page': 1, 'page_size': 20})
        elif path.endswith('/print-tasks'):
            tasks = [task for task in self.tasks if task['status'] == query.get('status', ['PENDING'])[0]]
            reply({'list': tasks, 'total': len(tasks), 'page': 1, 'page_size': 20})
        elif 'printer' in path:
            reply({'list': [], 'total': 0})
        else:
            reply({})


def rows(page):
    return page.locator('.el-table__body .el-table__row')


def toolbar_print(page):
    return page.locator('.panel-header').get_by_role('button', name=re.compile(r'^(批量)?打印'))


def dialog_button(page, label):
    return page.locator('.el-message-box').get_by_role('button', name=label, exact=True)


def open_doc(page, doc, name):
    page.goto(f'{args.base_url}/production/{doc}', wait_until='domcontentloaded')
    expect(page.locator('.panel-header h3')).to_have_text(name)
    expect(rows(page)).to_have_count(3)


def download(page, action, file_name):
    with page.expect_download() as result:
        action()
    assert result.value.suggested_filename == file_name, result.value.suggested_filename
    assert Path(result.value.path()).read_bytes().startswith(b'%PDF')


def start_batch(page):
    toolbar_print(page).click()
    expect(page.locator('.el-message-box')).to_contain_text('2 张')
    dialog_button(page, '加入打印任务').click()


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chromium', headless=True, args=['--renderer-process-limit=1'])
    print('Browser started', flush=True)
    context = browser.new_context(viewport={'width': 1600, 'height': 950}, service_workers='block')
    context.add_init_script("localStorage.setItem('token', 'mock-production-print'); localStorage.setItem('operator_name', '打印回归测试');")
    context.route_web_socket('**/*', lambda socket: socket.close())
    fixture = Fixture()
    context.route('**/*', fixture.handle)
    page = context.new_page()
    page.set_default_timeout(15000)
    errors, console_errors = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    artifacts = Path(tempfile.mkdtemp(prefix='wms-production-print-'))
    try:
        for doc, name in DOCS:
            fixture.tasks.clear()
            open_doc(page, doc, name)
            expect(toolbar_print(page)).to_be_disabled()
            before_create = len(fixture.create_requests)
            before_pdf = len(fixture.pdf_requests)
            download(page, lambda: rows(page).first.get_by_role('button', name='打印', exact=True).click(), f'{name}_TEST-1.pdf')
            assert fixture.pdf_requests[-1] == (doc, {'bill_id': [f'prdh_{doc}_1']})
            rows(page).first.get_by_role('checkbox').check()
            expect(toolbar_print(page)).to_have_text('打印（1）')
            download(page, lambda: toolbar_print(page).click(), f'{name}_TEST-1.pdf')
            assert len(fixture.create_requests) == before_create
            assert len(fixture.pdf_requests) == before_pdf + 2
            expect(page.locator('.el-message-box')).to_have_count(0)
            rows(page).nth(1).get_by_role('checkbox').check()
            expect(toolbar_print(page)).to_have_text('批量打印（2）')
            start_batch(page)
            expect(page.locator('.el-message-box')).to_contain_text('已加入打印任务：2 张单据')
            form, items = fixture.create_requests[-1]
            assert form['source'] == ['PRODUCTION_BILL_PRINT'] and form['batch_no'][0]
            assert [item['biz_id'] for item in items] == [f'prdh_{doc}_1', f'prdh_{doc}_2']
            assert all(item['biz_type'] == 'PRODUCTION_BILL_LABEL' and item['params'] == {'doc_key': doc} for item in items)
            assert len(fixture.create_requests) == before_create + 1
            assert len(fixture.pdf_requests) == before_pdf + 2
            dialog_button(page, '留在本页').click()
            expect(toolbar_print(page)).not_to_have_class(re.compile('is-loading'))
            print(f'PASS: {doc}: empty selection, row PDF, one selected PDF, multiple queued', flush=True)

        doc, name = DOCS[-1]
        page.screenshot(path=str(artifacts / 'multiple-selected.png'), full_page=True)
        before = len(fixture.create_requests)
        toolbar_print(page).click()
        dialog_button(page, '取消').click()
        expect(toolbar_print(page)).not_to_have_class(re.compile('is-loading'))
        assert len(fixture.create_requests) == before
        start_batch(page)
        expect(page.locator('.el-message--info').last).to_contain_text('跳过 2 张')
        expect(toolbar_print(page)).not_to_have_class(re.compile('is-loading'))
        expect(page.locator('.el-message-box')).to_have_count(0)
        print('PASS: cancel does not submit; pending duplicates are reported as skipped', flush=True)

        for mode, severity, message in [('invalid', 'error', '失败 2 张'), ('partial', 'warning', '失败 1 张'), ('error', 'error', '模拟创建失败')]:
            fixture.tasks.clear()
            fixture.create_mode = mode
            start_batch(page)
            expect(page.locator(f'.el-message--{severity}').last).to_contain_text(message)
            if mode == 'partial':
                expect(page.locator('.el-message-box')).to_contain_text('已加入打印任务：1 张单据')
                dialog_button(page, '留在本页').click()
            expect(toolbar_print(page)).not_to_have_class(re.compile('is-loading'))
            expect(rows(page).first.get_by_role('checkbox')).to_be_checked()
        fixture.create_mode = 'normal'
        print('PASS: invalid, partially accepted and failed queue requests retain selection and accurate messages', flush=True)

        rows(page).nth(1).get_by_role('checkbox').uncheck()
        fixture.pdf_error = True
        before = len(fixture.create_requests)
        toolbar_print(page).click()
        expect(page.locator('.el-message--error').last).to_contain_text('单据无有效明细')
        expect(toolbar_print(page)).not_to_have_class(re.compile('is-loading'))
        assert len(fixture.create_requests) == before
        fixture.pdf_error = False
        fixture.hold_pdf = True
        before_pdf = len(fixture.pdf_requests)
        toolbar_print(page).evaluate('(button) => { button.click(); button.click(); }')
        expect(toolbar_print(page)).to_have_class(re.compile('is-loading'))
        expect(rows(page).nth(1).get_by_role('button', name='打印', exact=True)).to_be_disabled()
        page.wait_for_function("document.querySelector('.el-table__row .el-button.is-loading') !== null")
        assert fixture.pending_pdf is not None
        rows(page).first.get_by_role('button', name='打印', exact=True).evaluate('(button) => button.click()')
        download(page, lambda: fixture.pending_pdf.fulfill(content_type='application/pdf', body=PDF), f'{name}_TEST-1.pdf')
        fixture.hold_pdf = False
        fixture.pending_pdf = None
        expect(toolbar_print(page)).not_to_have_class(re.compile('is-loading'))
        assert len(fixture.pdf_requests) == before_pdf + 1
        assert len(fixture.create_requests) == before
        print('PASS: PDF errors allow retry; repeated clicks produce only one download request, never a queue task', flush=True)

        fixture.queue_permission = False
        open_doc(page, doc, name)
        rows(page).first.get_by_role('checkbox').check()
        expect(toolbar_print(page)).to_be_visible()
        download(page, lambda: toolbar_print(page).click(), f'{name}_TEST-1.pdf')
        rows(page).nth(1).get_by_role('checkbox').check()
        expect(toolbar_print(page)).to_be_hidden()
        rows(page).nth(1).get_by_role('checkbox').uncheck()
        expect(toolbar_print(page)).to_be_visible()
        assert len(fixture.create_requests) == before
        print('PASS: single PDF requires only production permission; queue permission still gates multiple selection', flush=True)

        fixture.queue_permission = True
        fixture.tasks.clear()
        open_doc(page, doc, name)
        rows(page).first.get_by_role('checkbox').check()
        rows(page).nth(1).get_by_role('checkbox').check()
        start_batch(page)
        dialog_button(page, '前往打印任务').click()
        expect(page).to_have_url(re.compile('/warehouse/print-task$'))
        page.get_by_role('button', name='刷新', exact=True).click()
        expect(rows(page)).to_have_count(2)
        before_marked = len(fixture.marked)
        download(page, lambda: rows(page).first.get_by_role('button', name='打印', exact=True).click(), 'TEST-1.pdf')
        assert len(fixture.marked) == before_marked
        assert all(task['status'] == 'PENDING' for task in fixture.tasks)
        rows(page).first.get_by_role('checkbox').check()
        rows(page).nth(1).get_by_role('checkbox').check()
        page.get_by_role('button', name='打印选中（2）', exact=True).click()
        download(page, lambda: dialog_button(page, '开始打印').click(), f'{name}_箱贴批量2张单据.pdf')
        assert fixture.pdf_requests[-1] == (doc, {'bill_ids': [f'prdh_{doc}_1,prdh_{doc}_2']})
        assert len(fixture.marked) == before_marked
        dialog_button(page, '稍后手动确认').click()
        expect(rows(page)).to_have_count(2)
        expect(rows(page).first).to_contain_text('待打印')
        page.screenshot(path=str(artifacts / 'queue-pending.png'), full_page=True)
        assert not errors, errors
        assert not fixture.unexpected_writes, fixture.unexpected_writes
        assert all('Failed to load resource' in error and ('400' in error or '503' in error) for error in console_errors), console_errors
        print('PASS: queued PDF single/merged download, no automatic printed status; no runtime errors or real backend/printer traffic', flush=True)
        print('Artifacts:', artifacts)
    except Exception:
        page.screenshot(path=str(artifacts / 'failure.png'), full_page=True)
        print('URL:', page.url)
        print('Runtime errors:', errors)
        print('Console errors:', console_errors)
        print('Artifacts:', artifacts)
        raise
    finally:
        context.close()
        browser.close()
