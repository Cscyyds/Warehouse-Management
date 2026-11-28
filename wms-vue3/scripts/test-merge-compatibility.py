"""Headless merge regression with mocked APIs; never calls a real backend.

Usage: python scripts/test-merge-compatibility.py [base_url] [browser_executable]
"""
import json
import sys
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

base_url = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:3107'
browser_executable = sys.argv[2] if len(sys.argv) > 2 else None
trace = lambda number: {
    'inbound_type': 'PURCHASE_IN', 'inbound_biz_item_id': number,
    'inbound_doc_no': f'IN-{number}', 'inbound_order_no': f'PO-{number}',
}
row = {
    'merge_package_id': 'mpb_fixture', 'barcode_code': 'MP-FIXTURE',
    'product_code': 'P1', 'product_name': '合并回归产品', 'merge_qty': 2,
    'warehouse_status': 'INBOUND', 'barcode_status': 'VALID',
    'printed_qty': 7, 'outbound_type': 'SALES_OUT', 'outbound_doc_no': 'OUT-1',
}
detail = {
    **row, 'inbound_traces': [trace('1'), trace('2')],
    'current_position_info': {
        'position_code': 'POS-1', 'location_name': '货架名称', 'location_no': 'LOC-1',
        'floor_no': 1, 'position_no': 2, 'is_bound_plastic_box': True,
        'bound_plastic_box_info': {'box_code': 'BOX-CODE', 'box_name': '塑料盒名称'},
    },
}

with sync_playwright() as playwright:
    options = {'headless': True}
    if browser_executable:
        options['executable_path'] = browser_executable
    browser = playwright.chromium.launch(**options)
    for scenario in ('multiple', 'legacy', 'detail-only', 'list-only'):
        context = browser.new_context(service_workers='block')
        errors = []
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))

        def intercept(route):
            url = urlsplit(route.request.url)
            if url.path == '/__merge-regression':
                route.fulfill(content_type='text/html', body='<html><body></body></html>')
            elif url.path.startswith(('/api/', '/scanner-api/')):
                data = {}
                if url.path.endswith('/merge-packages/detail'):
                    if scenario == 'list-only':
                        route.fulfill(status=503, content_type='application/json', body='{"message":"fixture unavailable"}')
                        return
                    data = {**detail}
                    if scenario == 'legacy':
                        data.pop('inbound_traces')
                        data.update({'inbound_type': 'PURCHASE_IN', 'inbound_doc_no': None})
                elif url.path.endswith('/merge-packages/search'):
                    if scenario == 'detail-only':
                        route.fulfill(status=503, content_type='application/json', body='{"message":"fixture unavailable"}')
                        return
                    current = {**row, **(trace('legacy') if scenario == 'legacy' else {'inbound_traces': [trace('1'), trace('2')]})}
                    # 搜索是模糊匹配；相近 ID 排在前面时仍须使用本条的打印/出库数据。
                    data = {'list': [{**row, 'merge_package_id': 'mpb_fixture-other', 'printed_qty': 99, 'outbound_doc_no': 'WRONG'}, current], 'total': 2}
                route.fulfill(content_type='application/json', body=json.dumps({'success': True, 'code': 200, 'data': data}))
            elif url.netloc != urlsplit(base_url).netloc:
                route.abort()
            else:
                route.continue_()

        context.route('**/*', intercept)
        page.goto(base_url + '/__merge-regression')
        page.evaluate("async () => { const h = await import('/scripts/mergePackageUiHarness.ts'); await h.mountMergePackageDetailFixture() }")
        expect(page.get_by_text('合并回归产品', exact=True)).to_be_visible()
        if scenario != 'list-only':
            expect(page.get_by_text('塑料盒名称', exact=True)).to_be_visible()
            expect(page.get_by_text('货架名称', exact=True)).to_be_visible()
        if scenario == 'legacy':
            expect(page.get_by_text('IN-legacy', exact=True)).to_be_visible()
        else:
            expect(page.get_by_text('IN-1', exact=True)).to_be_visible()
            expect(page.get_by_text('IN-2', exact=True)).to_be_visible()
        if scenario != 'detail-only':
            expect(page.get_by_text('OUT-1', exact=True)).to_be_visible()
            expect(page.locator('.num-cell').filter(has_text='7')).to_be_visible()
        assert errors == [], errors
        print(f'PASS: merge detail {scenario}')
        context.close()
    browser.close()
