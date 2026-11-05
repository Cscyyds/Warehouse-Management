import argparse
import json
import os
import tempfile
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:3000')
args = parser.parse_args()
artifacts = Path(tempfile.mkdtemp(prefix='wms-import-tests-'))

TYPES = ['employee', 'product', 'customer', 'supplier', 'sales-order', 'purchase-order']

# 模板已迁到百度云 BOS（前端登记表见 src/config/importTemplates.ts），下载基准改为云端托管的那份。
CLOUD_TEMPLATE_BASE = os.environ.get('WMS_TEMPLATE_BASE_URL', 'https://nuomiwms.gz.bcebos.com').rstrip('/')


def cloud_template(kind):
    url = f'{CLOUD_TEMPLATE_BASE}/{kind}-import-template.xlsx'
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def task(kind, task_id='imp_history', status='FAILED_VALIDATION'):
    return dict(import_task_id=task_id, task_type=kind.upper().replace('-', '_'), task_type_name=kind,
                status=status, status_name=status, is_finished=status in ['SUCCESS', 'FAILED_VALIDATION', 'FAILED_SYSTEM'],
                file_name='九月导入.xlsx', file_url=None, file_size=2048, total_count=200,
                order_total=20 if 'order' in kind else None, item_total=180 if 'order' in kind else None,
                processed_count=200 if status != 'VALIDATING' else 80, success_count=200 if status == 'SUCCESS' else 0,
                error_count=120 if status == 'FAILED_VALIDATION' else 0, has_error=status == 'FAILED_VALIDATION',
                error_message='模拟系统异常，已回滚' if status == 'FAILED_SYSTEM' else None,
                latest_errors=[dict(sheet='数据', row=3, name='测试产品', reason='最近发现的错误')] if status == 'FAILED_VALIDATION' else [],
                created_by_name='测试员工', created_at='2026-09-22 10:00:00', updated_at='2026-09-22 10:01:00',
                started_at='2026-09-22 10:00:01', finished_at='2026-09-22 10:01:00' if status.startswith('FAILED') or status == 'SUCCESS' else None)


class Fixture:
    def __init__(self, kind):
        self.kind = kind
        self.requests = []
        self.submit_mode = 'success'
        self.detail_mode = 'normal'
        self.running = False
        self.submitted_reads = 0

    def handle(self, route):
        req = route.request
        parsed = urlparse(req.url)
        query = parse_qs(parsed.query)
        self.requests.append((req.method, parsed.path, query))
        def reply(data, status=200):
            route.fulfill(status=status, content_type='application/json', body=json.dumps(data, ensure_ascii=False))
        if req.method == 'POST':
            if self.submit_mode == 'network':
                route.abort('failed')
                return
            if self.submit_mode == 'quick':
                reply(dict(success=False, message='缺少必填表头', data={'errors': [{'row': 1, 'name': '名称', 'reason': '缺少名称列'}]}), 400)
                return
            reply(dict(success=True, message='任务已提交', data={**task(self.kind, 'imp_submitted', 'PENDING'), 'query_api': f'/api/v1/import-tasks/{self.kind}/list'}))
            return
        if '/import-tasks/' not in parsed.path:
            reply(dict(success=True, data=[]))
            return
        if parsed.path.endswith('/list'):
            rows = [task(self.kind), task(self.kind, 'imp_system', 'FAILED_SYSTEM'), task(self.kind, 'imp_success', 'SUCCESS')]
            if self.running:
                rows.insert(0, task(self.kind, 'imp_submitted', 'VALIDATING'))
            if query.get('status'):
                rows = [row for row in rows if row['status'] == query['status'][0]]
            reply(dict(success=True, data=dict(list=rows, total=33, page=int(query.get('page', ['1'])[0]), page_size=int(query.get('page_size', ['10'])[0]))))
            return
        if self.detail_mode == 'notfound':
            reply(dict(detail='导入任务不存在或已删除'), 400)
            return
        if self.detail_mode == 'error':
            reply(dict(success=False, message='模拟查询失败', data=None), 503)
            return
        task_id = query['import_task_id'][0]
        status = 'FAILED_VALIDATION'
        if task_id == 'imp_submitted':
            self.submitted_reads += 1
            status = 'VALIDATING' if self.running else ['VALIDATING', 'WRITING', 'SUCCESS'][min(self.submitted_reads - 1, 2)]
        elif task_id == 'imp_success':
            status = 'SUCCESS'
        elif task_id == 'imp_system':
            status = 'FAILED_SYSTEM'
        data = task(self.kind, task_id, status)
        page = int(query.get('error_page', ['1'])[0])
        size = int(query.get('error_page_size', ['50'])[0])
        def rows(total, name):
            return [dict(row=i + 2, name=f'{name}{i + 1}', reason='名称不存在，请修正。' + ('很长的错误描述；' * 25 if i == 0 else '')) for i in range((page - 1) * size, min(page * size, total))]
        count = 120 if status == 'FAILED_VALIDATION' else 0
        data.update(error_page=page, error_page_size=size)
        if 'order' in self.kind:
            key = self.kind.replace('-', '_')
            main_count, item_count = (3, 117) if count else (0, 0)
            data.update({key: dict(total=20, valid_count=20-main_count, invalid_count=main_count), key+'_item': dict(total=180, valid_count=180-item_count, invalid_count=item_count),
                         'errors': {key: rows(main_count, '主单'), key+'_item': rows(item_count, '明细')}})
        else:
            data.update(total_rows=200, valid_count=200-count, invalid_count=count, error_total=count, errors=rows(count, '产品'))
        reply(dict(success=True, data=data))


def open_harness(browser, kind='product', tab='records', extra=''):
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    fixture = Fixture(kind)
    context.route('**/api/v1/**', fixture.handle)
    context.route('**/__import_task_test__*', lambda route: route.fulfill(content_type='text/html', body='<html lang="zh"><body><div id="test-app"></div><script type="module" src="/scripts/import-task-browser-harness.ts"></script></body></html>'))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{args.base_url}/__import_task_test__?type={kind}&tab={tab}{extra}')
    page.wait_for_load_state('networkidle')
    if errors:
        raise AssertionError(errors)
    expect(page.get_by_role('dialog')).to_be_visible()
    return context, page, fixture, errors


def upload(page):
    page.locator('input[type=file]').set_input_files({'name': '测试导入.xlsx', 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'buffer': b'fixture-file'})
    page.get_by_role('button', name='提交导入', exact=True).click()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for kind in TYPES:
        context, page, fixture, errors = open_harness(browser, kind)
        expect(page.get_by_text('本租户的导入记录 · 最新提交优先')).to_be_visible()
        page.get_by_role('button', name='查看详情', exact=True).first.click()
        expect(page.get_by_text('本次导入全部驳回，未写入数据。请修正异常行后重新上传。')).to_be_visible()
        if 'order' in kind:
            tab = page.get_by_role('tab', name='销售明细（117）' if kind == 'sales-order' else '采购明细（117）')
            tab.click()
            expect(page.get_by_text('明细1', exact=True)).to_be_visible()
            page.locator('.error-pagination .btn-next').click()
            expect(page.get_by_text('明细51', exact=True)).to_be_visible()
            page.get_by_role('tab', name='销售主单（3）' if kind == 'sales-order' else '采购主单（3）').click()
            expect(page.get_by_text('主单1', exact=True)).to_be_visible()
            assert fixture.requests[-1][2]['error_page'] == ['1']
        else:
            page.locator('.error-pagination .btn-next').click()
            expect(page.get_by_text('产品51', exact=True)).to_be_visible()
            assert fixture.requests[-1][2]['error_page'] == ['2']
        if kind == 'sales-order':
            page.screenshot(path=str(artifacts / 'sales-detail.png'), full_page=True)
        page.get_by_role('button', name='返回导入记录').click()
        page.locator('.task-pagination .btn-next').click()
        page.wait_for_function("document.querySelector('.task-pagination .number.is-active')?.textContent === '2'")
        page.get_by_role('button', name='查看详情', exact=True).nth(1).click()
        expect(page.get_by_text('模拟系统异常，已回滚')).to_be_visible()
        page.get_by_role('button', name='返回导入记录').click()
        expect(page.locator('.task-pagination .number.is-active')).to_have_text('2')
        page.get_by_role('button', name='关闭', exact=True).click()
        page.get_by_role('button', name='重新打开测试窗口').click()
        expect(page.locator('.task-pagination .number.is-active')).to_have_text('2')
        assert not errors, errors
        assert any(f'/import-tasks/{kind}/list' in path for _, path, _ in fixture.requests)
        assert any(f'/import-tasks/{kind}/detail' in path for _, path, _ in fixture.requests)
        context.close()
        print(f'PASS {kind}: list, detail, pagination, failure, close/reopen')

    context, page, fixture, errors = open_harness(browser, 'sales-order', 'upload')
    upload(page)
    expect(page.get_by_text('已校验 80 / 200 行', exact=True)).to_be_visible()
    expect(page.locator('#completion-count')).to_have_text('0')
    expect(page.get_by_text('校验完成，正在写入。关闭窗口不影响后台执行，可稍后从导入记录查看。')).to_be_visible(timeout=5000)
    expect(page.locator('#completion-count')).to_have_text('0')
    expect(page.get_by_text('导入完成，已成功写入 200 行数据。')).to_be_visible(timeout=5000)
    expect(page.locator('#completion-count')).to_have_text('1')
    page.get_by_role('button', name='刷新状态').click()
    page.wait_for_load_state('networkidle')
    expect(page.locator('#completion-count')).to_have_text('1')
    assert len([r for r in fixture.requests if r[0] == 'POST']) == 1
    assert not errors, errors
    context.close()
    print('PASS async submission: validation -> writing -> success, completion emitted once')

    context, page, fixture, errors = open_harness(browser, 'product', 'upload')
    fixture.submit_mode = 'quick'
    upload(page)
    expect(page.get_by_text('缺少必填表头', exact=True)).to_be_visible()
    expect(page.get_by_text('缺少名称列', exact=True)).to_be_visible()
    assert not any(path.endswith('/detail') for _, path, _ in fixture.requests)
    fixture.submit_mode = 'network'
    page.get_by_role('button', name='提交导入', exact=True).click()
    expect(page.get_by_text('尚未确认任务是否已受理，请先查看导入记录再决定是否重新上传，避免重复导入。')).to_be_visible()
    assert len([r for r in fixture.requests if r[0] == 'POST']) == 2
    context.close()
    print('PASS submission rejection and uncertain network result do not create fake success')

    context, page, fixture, errors = open_harness(browser)
    fixture.detail_mode = 'error'
    page.get_by_role('button', name='查看详情', exact=True).first.click()
    expect(page.get_by_text('状态更新失败：模拟查询失败')).to_be_visible()
    fixture.detail_mode = 'normal'
    page.get_by_role('button', name='刷新状态').click()
    expect(page.get_by_text('本次导入全部驳回，未写入数据。请修正异常行后重新上传。')).to_be_visible()
    fixture.detail_mode = 'notfound'
    page.get_by_role('button', name='刷新状态').click()
    expect(page.get_by_text('状态更新失败：导入任务不存在或已删除')).to_be_visible()
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(artifacts / 'mobile-detail.png'), full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.evaluate("document.documentElement.classList.add('dark')")
    page.screenshot(path=str(artifacts / 'dark-detail.png'), full_page=True)
    assert not errors, errors
    context.close()
    print('PASS query failures, recovery, missing task, mobile and dark theme')

    context, page, fixture, errors = open_harness(browser, extra='&readOnly=true&detail=false')
    expect(page.get_by_role('button', name='查看详情', exact=True)).to_have_count(0)
    page.get_by_role('tab', name='上传文件').click()
    expect(page.get_by_text('当前账号或业务模式不允许上传，可查看已有导入记录。')).to_be_visible()
    expect(page.get_by_role('button', name='提交导入', exact=True)).to_have_count(0)
    assert not any(path.endswith('/detail') or method == 'POST' for method, path, _ in fixture.requests)
    context.close()
    print('PASS query-only permissions hide upload and detail actions')
    context, page, fixture, errors = open_harness(browser)
    page.locator('.task-filters .el-select').click()
    page.get_by_role('option', name='导入成功', exact=True).click()
    page.get_by_role('button', name='查询', exact=True).click()
    page.wait_for_load_state('networkidle')
    assert fixture.requests[-1][2]['status'] == ['SUCCESS']
    assert fixture.requests[-1][2]['page'] == ['1']
    expect(page.get_by_role('button', name='查看详情', exact=True)).to_have_count(1)
    page.get_by_role('button', name='重置', exact=True).click()
    page.wait_for_load_state('networkidle')
    assert 'status' not in fixture.requests[-1][2]
    page.locator('.task-filters').get_by_placeholder('开始时间', exact=True).fill('2026-09-01 00:00:00')
    page.locator('.task-filters').get_by_placeholder('开始时间', exact=True).press('Tab')
    page.locator('.task-filters').get_by_placeholder('结束时间', exact=True).fill('2026-09-22 23:59:59')
    page.locator('.task-filters').get_by_placeholder('结束时间', exact=True).press('Tab')
    with page.expect_response(lambda response: '/import-tasks/product/list' in response.url):
        page.get_by_role('button', name='查询', exact=True).click()
    assert fixture.requests[-1][2]['start_time'] == ['2026-09-01T00:00:00']
    assert fixture.requests[-1][2]['end_time'] == ['2026-09-22T23:59:59']
    expect(page.locator('.task-list .el-tag').first).to_have_text('校验失败')
    page.screenshot(path=str(artifacts / 'task-list.png'), full_page=True)
    page.get_by_role('button', name='查看详情', exact=True).first.click()
    page.get_by_text('本次导入全部驳回，未写入数据。请修正异常行后重新上传。').wait_for()
    page.locator('.import-workspace').evaluate('(element) => { element.scrollTop = 0 }')
    page.screenshot(path=str(artifacts / 'detail-top.png'), full_page=True)
    context.close()
    print('PASS server-side status filtering and reset')

    context, page, fixture, errors = open_harness(browser, tab='upload')
    fixture.running = True
    page.clock.install()
    upload(page)
    expect(page.get_by_text('已校验 80 / 200 行', exact=True)).to_be_visible()
    count = len(fixture.requests)
    page.evaluate("Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'))")
    page.clock.run_for(10000)
    assert len(fixture.requests) == count
    with page.expect_response(lambda response: '/import-tasks/product/detail' in response.url):
        page.evaluate("Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'))")
    assert len(fixture.requests) > count
    page.get_by_role('button', name='关闭', exact=True).click()
    page.wait_for_load_state('networkidle')
    count = len(fixture.requests)
    page.clock.run_for(10000)
    assert len(fixture.requests) == count
    assert not errors, errors
    context.close()
    print('PASS hidden page and closed window stop polling; visibility resumes it')

    for kind in TYPES:
        context, page, fixture, errors = open_harness(browser, kind, 'upload')
        with page.expect_download() as download_info:
            page.get_by_role('link', name='下载模板', exact=True).click()
        filename = f'{kind}-import-template.xlsx'
        target = artifacts / filename
        download_info.value.save_as(target)
        content = target.read_bytes()
        assert content[:2] == b'PK', f'{kind}: 下载内容不是 xlsx（可能命中 404 或错误页）'
        assert content == cloud_template(kind), f'{kind}: 下载内容与云端模板不一致'
        fixture.running = True
        upload(page)
        expect(page.get_by_text('已校验 80 / 200 行', exact=True)).to_be_visible()
        posts = [path for method, path, _ in fixture.requests if method == 'POST']
        resource = {'employee': 'tenant-users', 'product': 'tenant-products', 'customer': 'tenant-customers', 'supplier': 'tenant-suppliers', 'sales-order': 'tenant-sales-orders', 'purchase-order': 'tenant-purchase-orders'}[kind]
        assert posts == [f'/api/v1/{resource}/import']
        expect(page.locator('#completion-count')).to_have_text('0')
        context.close()
    print('PASS all six upload endpoints hand off to the matching task detail')
    browser.close()
print(f'Artifacts: {artifacts}')
