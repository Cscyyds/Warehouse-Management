# -*- coding: utf-8 -*-
"""回归：角色编辑只提交「用户勾选且租户可见」的权限（模块限制不可见码剔除）。

背景：存量角色绑定于模块限制（module_restrict）启用之前，sys_role_permission 里
残留不可见码——权限树上不渲染、看似未勾选，但整包回传 tenant-roles/update 会被
后端以「权限对当前租户不可见（模块限制）」整批驳回（2026-10 天心租户角色编辑 400）。

本脚本以路由拦截模拟接口（无需真实后端/登录）：
- detail 返回的存量绑定混入不可见码（fin/sales/credit 族）+ 可见平台码 + 扫码枪码
  + INTERNAL_ONLY 码（knowledge:*，树上隐藏但接口可见、可绑定）；
- visible-permissions 平台归属不返回不可见码（模块态过滤的后端口径）；
- 断言保存 payload：不可见码（含 expandRolePermissionIds 联动补出的 fin 科目族）
  全部剔除，可见码/扫码枪码/INTERNAL_ONLY 码保留。

用法：python scripts/test-role-invisible-perms-filter.py [--base-url http://localhost:3000]
"""
import argparse
import json
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://localhost:3000')
args = parser.parse_args()
artifacts = Path(tempfile.mkdtemp(prefix='wms-role-invis-'))

# —— 场景数据（口径对齐生产事故：fin=REQUIRE_FINANCE，sales/credit=REQUIRE_PURCHASE_SALES）——
INVISIBLE_FIN = ['perm_api_fin_query_subject', 'perm_api_fin_search_subject',
                 'perm_api_fin_detail_subject', 'perm_api_fin_subject_assoc_query']
INVISIBLE_SALES = 'perm_api_sales_list_order'
INVISIBLE_CREDIT = 'perm_api_crm_credit_adjust'
VISIBLE_PLATFORM = 'perm_api_prod_list_category'   # 产品分类查询：无模块限制，可见
SCANNER = 'perm_scanner_inbound_operation'         # 扫码枪归属绑定
INTERNAL = 'knowledge:search'                      # INTERNAL_ONLY：树上隐藏、接口可见
# detail 存量绑定只给 fin_query_subject 一个码：科目管理页 view 四码联动补出另外三个
# （复刻生产：107 个已绑 + 3 个联动补出 = 报错 110）
DETAIL_PERMS = [INVISIBLE_FIN[0], INVISIBLE_SALES, INVISIBLE_CREDIT,
                VISIBLE_PLATFORM, SCANNER, INTERNAL]


class Fixture:
    def __init__(self):
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
            reply({'role_code': 'role-invis-test'})
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
                        {'perm_code': SCANNER, 'perm_name': '扫码枪入库作业'}]}]}]})
                return
            # 平台归属：模块限制过滤后的可见集——不含 fin/sales/credit 族；
            # INTERNAL_ONLY（knowledge:*）接口仍返回（树上由前端分组隐藏）
            permissions = [
                {'perm_code': VISIBLE_PLATFORM, 'perm_name': '产品分类查询'},
                {'perm_code': INTERNAL, 'perm_name': '知识库检索'},
                {'perm_code': 'perm_api_prod_create_category', 'perm_name': '产品分类新增'},
            ]
            reply({'menus': [{'menu_id': 'menu_product', 'menu_name': '产品管理', 'buttons': [
                {'button_id': 'btn_prod_category', 'button_name': '产品分类', 'permissions': permissions}]}]})
        elif path.endswith('/tenant-trade/mode'):
            # 天心形态租户（采销关、财务关）：fin/sales/credit 族均不可见的模块态
            reply({'purchase_sales_mode': 'TIANXIN', 'finance_module_enabled': False,
                   'purchase_sales_module_enabled': False})
        elif path.endswith('/tenant-roles/detail'):
            reply({'role': [{'role_code': 'role-invis-test', 'role_name': '不可见绑定回归',
                             'role_type': 'EMPLOYEE', 'status': 1, 'is_system': 0, 'sort_no': 1,
                             'remark': None, 'permission_id': DETAIL_PERMS}]})
        else:
            reply([])


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    fixture = Fixture()
    try:
        context = browser.new_context(viewport={'width': 1500, 'height': 1050}, service_workers='block')
        context.add_init_script("localStorage.setItem('token', 'role-invis-test');")
        context.route('**/*', fixture.handle)
        page = context.new_page()
        page.set_default_timeout(15000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        # 打开编辑页（生产复现路径：不点树、直接保存）
        page.goto(args.base_url + '/common/add?type=role&id=role-invis-test&mode=edit',
                  wait_until='domcontentloaded')
        page.wait_for_selector('.inline-check-tree')
        page.get_by_role('button', name='保存', exact=True).click()
        expect(page.locator('.el-message--success').last).to_be_visible()
        for _ in range(40):
            if fixture.saved:
                break
            page.wait_for_timeout(250)
        assert fixture.saved, 'no update request captured'
        saved = set(json.loads(fixture.saved[-1]['permission_id'][0]))

        must_keep = [VISIBLE_PLATFORM, SCANNER, INTERNAL]
        must_drop = INVISIBLE_FIN + [INVISIBLE_SALES, INVISIBLE_CREDIT]
        for code in must_keep:
            assert code in saved, f'visible/other-owner binding dropped: {code} not in {sorted(saved)}'
        for code in must_drop:
            assert code not in saved, f'invisible binding leaked to payload: {code} in {sorted(saved)}'
        assert not errors, errors
        assert not fixture.unexpected_writes, fixture.unexpected_writes
        page.screenshot(path=str(artifacts / 'edit-saved.png'), full_page=True)
        print(f'PASS: invisible perms dropped ({len(must_drop)} codes incl. expanded fin subject family); '
              f'visible/scanner/internal-only kept')
        context.close()
        print('Artifacts:', artifacts)
    finally:
        browser.close()
