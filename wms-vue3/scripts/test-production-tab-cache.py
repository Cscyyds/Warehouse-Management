import argparse
import json
import re
import tempfile
import traceback
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
args = parser.parse_args()
artifacts = Path(tempfile.mkdtemp(prefix='wms-production-cache-'))
DOC_A = 'finished-goods-stockin'
DOC_B = 'production-picking'


class Fixture:
    def __init__(self):
        self.requests = []
        self.writes = []
        self.mode = 'normal'

    def handle(self, route):
        request = route.request
        parsed = urlparse(request.url)
        if not parsed.path.startswith(('/api/', '/scanner-api/')):
            if parsed.netloc != urlparse(args.base_url).netloc:
                route.abort()
            else:
                route.continue_()
            return
        query = parse_qs(parsed.query)
        self.requests.append((parsed.path, query))
        if request.method != 'GET':
            self.writes.append((request.method, parsed.path))
            route.abort()
            return

        def reply(data, status=200):
            route.fulfill(status=status, content_type='application/json', body=json.dumps({
                'success': status == 200, 'code': status, 'message': '模拟接口', 'data': data,
            }, ensure_ascii=False))

        path = parsed.path
        if path.endswith('/my-permissions'):
            reply({'menus': [
                {'menu_id': 'menu_production', 'menu_name': '生产管理', 'buttons': [
                    {'button_id': 'btn_production', 'button_name': '生产查询', 'permissions': [
                        {'perm_code': 'perm_production_view'}, {'perm_code': 'perm_production_manage'},
                    ]},
                ]},
                {'menu_id': 'menu_employee', 'menu_name': '员工管理', 'buttons': [
                    {'button_id': 'btn_logs', 'button_name': '访问日志', 'permissions': [
                        {'perm_code': 'perm_api_emp_query_op_logs'}, {'perm_code': 'perm_api_emp_detail_op_log'},
                    ]},
                ]},
            ]})
        elif path.endswith('/tenant-trade/mode'):
            reply({'purchase_sales_mode': 'NATIVE', 'finance_module_enabled': True, 'purchase_sales_module_enabled': True})
        elif path.endswith('/tenant-production/overview'):
            reply({'enabled': True, 'channel_code': 'TIANXIN', 'channel_name': '天心', 'sync_interval_seconds': 600, 'sync_window_days': 7, 'docs': []})
        elif '/sync/settings' in path:
            reply({'sync_interval_seconds': 600, 'sync_window_days': 7, 'interval_bounds': {'min': 300, 'max': 172800}, 'window_bounds': {'min': 1, 'max': 180}})
        elif '/tenant-production/unbound-products' in path:
            reply({'items': [], 'total': 0, 'summary': {'missing_count': 0, 'pending_rebind_count': 0, 'item_total': 0}})
        elif '/tenant-production/' in path:
            doc = path.split('/tenant-production/')[1].split('/')[0]
            page = int(query.get('page', ['1'])[0])
            size = int(query.get('page_size', ['20'])[0])
            bill_id = query.get('bill_id', [f'{doc}-1'])[0]
            if '/items/' in path:
                items = [{'wms_item_id': f'{bill_id}-item-{i}', 'erp_item_seq': i, 'prd_no': f'P{i}', 'qty': i,
                          'erp_deleted': 0, 'product': {'product_code': f'P{i}', 'product_name': f'缓存测试物料{i}'}}
                         for i in range((page - 1) * size + 1, page * size + 1)]
                reply({'items': items, 'total': 240, 'page': page, 'page_size': size})
            elif path.endswith('/detail'):
                reply({'bill': {'wms_bill_id': bill_id, 'erp_bill_no': bill_id, 'erp_bill_date': '2026-09-23', 'erp_lock_status': 0},
                       'items': [], 'item_total': 240, 'erp_refresh': {'status': 'UNCHANGED'}})
            else:
                if self.mode == 'error':
                    reply(None, 503)
                    return
                bills = [] if self.mode == 'empty' else [
                    {'wms_bill_id': f'{doc}-{i}', 'erp_bill_no': f'{doc}-{i}', 'erp_bill_date': '2026-09-23',
                     'item_count': 240, 'total_qty': i * 10, 'erp_lock_status': 0, 'synced_at': '2026-09-23 10:00:00'}
                    for i in range((page - 1) * size + 1, page * size + 1)
                ]
                reply({'bills': bills, 'total': 0 if self.mode == 'empty' else 120, 'page': page, 'page_size': size})
        else:
            reply({})

    def production_count(self):
        return sum('/tenant-production/' in path for path, _ in self.requests)


def settle(page):
    page.wait_for_load_state('networkidle')
    page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')


def tab(page, title):
    return page.locator('.tab-item').filter(has_text=re.compile(f'^{re.escape(title)}$'))


def side(page, title):
    item = page.locator('.side-menu .el-menu-item').filter(has_text=re.compile(f'^{re.escape(title)}$'))
    if not item.is_visible():
        page.locator('.side-menu .el-sub-menu__title').filter(has_text='生产单据').click()
    item.click()
    settle(page)


def filter_input(page):
    if not page.locator('.filter-row').is_visible():
        page.get_by_role('button', name='筛选', exact=True).click()
    return page.locator('.filter-row .el-input__inner').last


def numbered_page(page, number):
    page.locator('.el-pager li').filter(has_text=re.compile(f'^{number}$')).click()
    settle(page)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 800}, service_workers='block')
    context.add_init_script("localStorage.setItem('token', 'mock-production-cache-test'); localStorage.setItem('operator_name', '缓存回归测试');")
    fixture = Fixture()
    context.route('**/*', fixture.handle)
    page = context.new_page()
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto(f'{args.base_url}/system/logs')
        settle(page)
        page.locator('.top-nav .nav-item').filter(has_text='生产管理').click()
        side(page, '成品缴库单')
        expect(page.locator('.panel-header h3')).to_have_text('成品缴库单')
        page.screenshot(path=str(artifacts / 'initial.png'), full_page=True)

        field = filter_input(page)
        date_inputs = page.locator('.el-date-editor input')
        date_inputs.nth(0).fill('2026-09-01')
        date_inputs.nth(1).fill('2026-09-23')
        date_inputs.nth(1).press('Enter')
        field.click()
        settle(page)
        page.locator('th').filter(has_text='同步时间').locator('.sort-caret.descending').click()
        settle(page)
        numbered_page(page, 3)
        field.fill('保留成品草稿')
        expect(page.locator('.el-pager li.is-active')).to_have_text('3')
        page.locator('.list-content-panel').evaluate('(el) => { el.scrollTop = 240 }')
        saved_scroll = page.locator('.list-content-panel').evaluate('(el) => el.scrollTop')
        assert saved_scroll > 0, 'Fixture must produce a scrollable table panel'
        count = fixture.production_count()
        side(page, '生产领料单')
        filter_input(page).fill('保留领料草稿')
        numbered_page(page, 2)
        after_b = fixture.production_count()
        tab(page, '成品缴库单').click()
        settle(page)
        assert fixture.production_count() == after_b
        expect(page.locator('.filter-row .el-input__inner').last).to_have_value('保留成品草稿')
        expect(page.locator('.el-pager li.is-active')).to_have_text('3')
        expect(page.locator('th.descending')).to_contain_text('同步时间')
        expect(date_inputs.nth(0)).to_have_value('2026-09-01')
        expect(date_inputs.nth(1)).to_have_value('2026-09-23')
        assert abs(page.locator('.list-content-panel').evaluate('(el) => el.scrollTop') - saved_scroll) < 2
        assert after_b > count
        print('PASS: list filters, dates, sorting, page, scroll and request count')

        page.locator('.el-table__body .el-table__row').first.get_by_role('button', name='详情', exact=True).click()
        expect(page.locator('.detail-billno')).to_contain_text(DOC_A)
        expect(page.locator('.el-table__body .el-table__row')).to_have_count(20)
        settle(page)
        detail_a_url = page.url
        numbered_page(page, 3)
        page.locator('.el-table__body .el-table__row').first.locator('.el-checkbox').click()
        page.locator('.items-toolbar input.el-input__inner').fill('保留明细草稿')
        page.locator('.main-content').evaluate('(el) => { el.scrollTop = 420 }')
        detail_scroll = page.locator('.main-content').evaluate('(el) => el.scrollTop')
        assert detail_scroll > 0
        tab(page, '生产领料单').click()
        expect(page.locator('.panel-header h3')).to_have_text('生产领料单')
        settle(page)
        page.locator('.el-table__body .el-table__row').first.get_by_role('button', name='详情', exact=True).click()
        expect(page.locator('.detail-billno')).to_contain_text(DOC_B)
        expect(page.locator('.el-table__body .el-table__row')).to_have_count(20)
        settle(page)
        count = fixture.production_count()
        tab(page, '生产单据详情').nth(0).click()
        expect(page.locator('.detail-billno')).to_contain_text(DOC_A)
        settle(page)
        assert page.url == detail_a_url
        assert fixture.production_count() == count, (count, fixture.production_count())
        expect(page.locator('.items-toolbar input.el-input__inner')).to_have_value('保留明细草稿')
        expect(page.get_by_role('button', name='批量删除（1）', exact=True)).to_be_enabled()
        expect(page.locator('.el-table__body .el-table__row').first.get_by_role('checkbox')).to_be_checked()
        expect(page.locator('.el-pager li.is-active')).to_have_text('3')
        restored_scroll = page.locator('.main-content').evaluate('(el) => el.scrollTop')
        assert abs(restored_scroll - detail_scroll) < 2, (restored_scroll, detail_scroll)
        page.screenshot(path=str(artifacts / 'retained-detail.png'), full_page=True)
        print('PASS: details remain independent; selection, page and main scroll restored')

        side(page, '生产概览')
        settings = page.locator('.settings-form input.el-input__inner').first
        settings.fill('900')
        settings.press('Tab')
        side(page, '未绑品号清单')
        filter_input(page).fill('未绑筛选草稿')
        count = fixture.production_count()
        tab(page, '生产概览').click()
        settle(page)
        expect(settings).to_have_value('900')
        tab(page, '未绑品号清单').click()
        settle(page)
        expect(page.locator('.filter-row .el-input__inner').last).to_have_value('未绑筛选草稿')
        assert fixture.production_count() == count
        print('PASS: overview draft and unbound-product filters retained')

        tab(page, '生产领料单').locator('.tab-close').click()
        settle(page)
        side(page, '生产领料单')
        expect(filter_input(page)).to_have_value('')
        expect(page.locator('.el-pager li.is-active')).to_have_text('1')
        count = fixture.production_count()
        page.get_by_role('button', name='刷新', exact=True).click()
        settle(page)
        assert fixture.production_count() == count + 1
        print('PASS: close/reopen resets state and manual refresh still requests data')

        for mode in ['empty', 'error']:
            fixture.mode = mode
            page.get_by_role('button', name='刷新', exact=True).click()
            settle(page)
            filter_input(page).fill(f'{mode}-draft')
            count = fixture.production_count()
            tab(page, '生产概览').click()
            settle(page)
            tab(page, '生产领料单').click()
            settle(page)
            expect(page.locator('.filter-row .el-input__inner').last).to_have_value(f'{mode}-draft')
            assert fixture.production_count() == count
        fixture.mode = 'normal'
        print('PASS: empty and failed responses do not cause reloads on tab switches')

        page.reload()
        settle(page)
        expect(filter_input(page)).to_have_value('')
        assert not errors, errors
        assert not fixture.writes, fixture.writes
        print('PASS: browser reload clears page cache; no runtime errors or backend writes')
        print('Artifacts:', artifacts)
    except Exception as error:
        print('Failure:', repr(error), flush=True)
        traceback.print_exc()
        page.screenshot(path=str(artifacts / 'failure.png'), full_page=True)
        print('Current URL:', page.url)
        print('Runtime errors:', errors)
        print('Recent API requests:', fixture.requests[-12:])
        print('Artifacts:', artifacts)
        raise
    finally:
        context.route('**/*', lambda route: route.abort())
        context.unroute('**/*', fixture.handle)
        browser.close()
