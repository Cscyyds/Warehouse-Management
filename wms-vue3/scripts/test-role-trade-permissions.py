import argparse
import json
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
args = parser.parse_args()
artifacts = Path(tempfile.mkdtemp(prefix='wms-role-trade-'))
DOCS = [('pur_trade_po', '采购订单', 'pur_list_order'), ('pur_trade_pr', '采购退货单', 'pur_list_return'),
        ('sales_trade_so', '销售订单', 'sales_list_order'), ('sales_trade_sr', '销售退货单', 'sales_list_return')]
ACTIONS = ['list', 'search', 'detail', 'items_list', 'items_search', 'sync_refresh']
SCANNER = 'perm_scanner_inbound_operation'
SUPPLIER = 'perm_api_pur_list_supplier'
OLD_IDS = [SUPPLIER, SCANNER, 'perm_api_pur_list_order', 'perm_api_pur_trade_po_list']


class Fixture:
    def __init__(self):
        self.mode = 'TIANXIN'
        self.saved = []
        self.unexpected_writes = []

    def handle(self, route):
        request = route.request
        url = urlsplit(request.url)
        if url.netloc != urlsplit(args.base_url).netloc:
            route.abort()
            return
        if not url.path.startswith(('/api/', '/scanner-api/')):
            route.continue_()
            return
        query = parse_qs(url.query)

        def reply(data, status=200):
            route.fulfill(status=status, content_type='application/json', body=json.dumps({
                'success': status == 200, 'code': status, 'message': '模拟接口', 'data': data,
            }, ensure_ascii=False))

        if request.method == 'POST' and url.path.endswith('/tenant-roles/update'):
            self.saved.append(parse_qs(request.post_data))
            reply({})
            return
        if request.method != 'GET':
            self.unexpected_writes.append(url.path)
            route.abort()
            return
        path = url.path
        if path.endswith('/my-permissions'):
            reply({'menus': []})
        elif path.endswith('/visible-permissions'):
            if query.get('permission_owner') == ['WMS_SCANNER']:
                reply({'menus': [{'menu_id': 'menu_scanner_inbound', 'menu_name': '扫码枪入库', 'buttons': [
                    {'button_id': 'btn_scanner_inbound_operation', 'button_name': '入库作业', 'permissions': [
                        {'perm_code': SCANNER, 'perm_name': '扫码枪权限测试'}]}]}]})
                return
            permissions = [{'perm_code': SUPPLIER, 'perm_name': '供应商查询测试'}]
            for prefix, title, native in DOCS:
                permissions.append({'perm_code': 'perm_api_' + native, 'perm_name': title + 'WMS查询测试'})
                permissions.extend({'perm_code': f'perm_api_{prefix}_{action}', 'perm_name': f'perm_api_{prefix}_{action}'} for action in ACTIONS)
            reply({'menus': [{'menu_id': 'menu_purchase', 'menu_name': '采购管理', 'buttons': [
                {'button_id': 'btn_test', 'button_name': '测试', 'permissions': permissions}]}]})
        elif path.endswith('/tenant-trade/mode'):
            if self.mode is None:
                reply(None, 503)
            else:
                reply({'purchase_sales_mode': self.mode, 'finance_module_enabled': True, 'purchase_sales_module_enabled': True})
        elif path.endswith('/tenant-roles/detail'):
            reply({'role': [{'role_code': 'role-test', 'role_name': '模式过滤回归', 'role_type': 'EMPLOYEE', 'status': 1,
                             'is_system': 0, 'permission_id': OLD_IDS}]})
        else:
            reply([])


def node(page, key):
    return page.locator(f'.inline-check-tree .el-tree-node[data-key="{key}"]')


def open_page(browser, fixture, readonly):
    context = browser.new_context(viewport={'width': 1500, 'height': 1050}, service_workers='block')
    context.add_init_script("localStorage.setItem('token', 'role-trade-test');")
    context.route('**/*', fixture.handle)
    page = context.new_page()
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    suffix = '&mode=edit' if not readonly else ''
    page.goto(args.base_url + f'/common/add?type=role&id=role-test{suffix}&readonly={1 if readonly else 0}',
              wait_until='domcontentloaded')
    page.wait_for_selector('.inline-tree-mode-hint')
    return context, page, errors


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    fixture = Fixture()
    try:
        for mode, expected in [('TIANXIN', '当前为天心模式'), ('NATIVE', '当前为 WMS 模式'), (None, '未获取')]:
            fixture.mode = mode
            context, page, errors = open_page(browser, fixture, readonly=True)
            try:
                expect(page.locator('.inline-tree-mode-hint')).to_contain_text(expected)
                page.get_by_role('button', name='全部展开', exact=True).click()
                for prefix, title, native in DOCS:
                    wms, trade = node(page, 'page:' + title), node(page, 'page:' + title + '（天心）')
                    if mode == 'TIANXIN':
                        expect(wms).to_have_count(0)
                        expect(trade).to_be_visible()
                        expect(node(page, 'perm_api_' + native)).to_have_count(0)
                    elif mode == 'NATIVE':
                        expect(wms).to_be_visible()
                        expect(trade).to_have_count(0)
                        for action in ACTIONS:
                            expect(node(page, f'perm_api_{prefix}_{action}')).to_have_count(0)
                    else:
                        expect(wms).to_be_visible()
                        expect(trade).to_be_visible()
                expect(node(page, 'page:供应商档案')).to_be_visible()
                ids = page.eval_on_selector_all('.inline-check-tree .el-tree-node', 'ns => ns.map(n => n.dataset.key)')
                assert len(ids) == len(set(ids)), 'Duplicate tree node keys'
                assert not errors, errors
                page.screenshot(path=str(artifacts / f'{mode}-readonly.png'), full_page=True)
                print(f'PASS: mode={mode} filters paired document pages, keeps shared pages, no duplicate nodes')
            finally:
                context.close()

        for mode, hidden, visible, drop in [
            ('TIANXIN', 'perm_api_pur_list_order', 'perm_api_pur_trade_po_list', 'perm_api_pur_trade_po_sync_refresh'),
            ('NATIVE', 'perm_api_pur_trade_po_list', 'perm_api_pur_list_order', None),
        ]:
            fixture.mode = mode
            fixture.saved.clear()
            context, page, errors = open_page(browser, fixture, readonly=False)
            try:
                page.get_by_text('扫码枪', exact=True).click()
                page.get_by_role('button', name='全部展开', exact=True).click()
                expect(page.get_by_text('扫码枪权限测试', exact=True)).to_be_visible()
                expect(page.locator('.inline-tree-mode-hint')).to_have_count(0)
                page.get_by_text('平台', exact=True).click()
                expect(page.locator('.inline-tree-mode-hint')).to_be_visible()
                page.get_by_role('button', name='全部展开', exact=True).click()
                expect(node(page, visible)).to_be_visible()
                if drop:
                    leaf = node(page, drop)
                    expect(leaf.locator('> .el-tree-node__content .el-checkbox input')).not_to_be_checked()
                    leaf.locator('> .el-tree-node__content .el-checkbox').click()
                    expect(leaf.locator('> .el-tree-node__content .el-checkbox input')).to_be_checked()
                page.get_by_role('button', name='保存', exact=True).click()
                expect(page.locator('.el-message--success').last).to_be_visible()
                for _ in range(40):
                    if fixture.saved:
                        break
                    page.wait_for_timeout(250)
                assert fixture.saved, 'no update request captured'
                saved_ids = set(json.loads(fixture.saved[-1]['permission_id'][0]))
                assert hidden in saved_ids, f'hidden binding dropped from payload: {saved_ids}'
                assert visible in saved_ids, f'checked binding lost: {saved_ids}'
                assert SCANNER in saved_ids, f'other-owner binding dropped: {saved_ids}'
                if drop:
                    assert drop in saved_ids, f'newly checked permission missing: {saved_ids}'
                assert not errors, errors
                assert not fixture.unexpected_writes, fixture.unexpected_writes
                print(f'PASS: mode={mode} save keeps hidden {hidden} + scanner; visible check edit={bool(drop)}')
            finally:
                context.close()
        print('Artifacts:', artifacts)
    finally:
        browser.close()
