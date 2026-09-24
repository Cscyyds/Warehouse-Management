import argparse
import ast
import importlib.util
import os
import sys
import unittest
import urllib.request
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[1]
BACKEND = FRONTEND.parents[1] / 'nuomi_wms'
# 模板已迁到百度云 BOS（前端登记表见 src/config/importTemplates.ts）。本地目录仍优先（便于离线开发），
# 本地缺失时回落到云端，确保校验的始终是用户实际下载到的那份文件。
TEMPLATE_DIR = FRONTEND / 'public/templates'
CLOUD_TEMPLATE_BASE = os.environ.get(
    'WMS_TEMPLATE_BASE_URL', 'https://nuomiwms.gz.bcebos.com',
).rstrip('/')


@lru_cache(maxsize=None)
def load_template(template):
    local = TEMPLATE_DIR / f'{template}-import-template.xlsx'
    if local.exists():
        return local.read_bytes()
    url = f'{CLOUD_TEMPLATE_BASE}/{template}-import-template.xlsx'
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()

# Load only the real parser, without importing the application or its endpoints.
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    '_template_excel_import', BACKEND / 'app/utils/excel_import.py',
)
excel_import = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = excel_import
spec.loader.exec_module(excel_import)
parse_excel_file = excel_import.parse_excel_file
parse_excel_sheets = excel_import.parse_excel_sheets

CONTRACT_SOURCES = {
    'product': ('tenant_product_management.py', 'import_products_endpoint', '_run_product_import_task'),
    'employee': ('tenant_employee_management.py', 'import_tenant_users_endpoint', '_run_employee_import_task'),
    'customer': ('tenant_crm_management.py', 'import_customers_endpoint', '_run_customer_import_task'),
    'supplier': ('tenant_purchase_management.py', 'import_suppliers_endpoint', '_run_supplier_import_task'),
    'purchase-order': ('tenant_purchase_management.py', 'import_purchase_orders_endpoint', '_run_purchase_order_import_task'),
    'sales-order': ('tenant_sales_order_management.py', 'import_sales_orders_endpoint', '_run_sales_order_import_task'),
}


@lru_cache(maxsize=None)
def read_endpoint_ast(filename):
    source = BACKEND / 'app/api/v1/endpoints' / filename
    return ast.parse(source.read_text(encoding='utf-8-sig'))


def assignments(nodes):
    values = {}
    for node in nodes:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    values[target.id] = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            values[node.target.id] = node.value
    return values


def resolve_literal(node, values):
    if isinstance(node, ast.Name):
        return resolve_literal(values[node.id], values)
    if isinstance(node, ast.Dict):
        return {
            resolve_literal(key, values): resolve_literal(value, values)
            for key, value in zip(node.keys, node.values)
        }
    return ast.literal_eval(node)


def load_contracts(template):
    filename, submit, worker = CONTRACT_SOURCES[template]
    tree = read_endpoint_ast(filename)
    contracts = {}
    for name in (submit, worker):
        functions = [
            node for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name
        ]
        if len(functions) != 1:
            raise AssertionError(f'{filename}: expected one function named {name}')
        function = functions[0]
        calls = [
            node for node in ast.walk(function)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
            and node.func.id in ('parse_excel_file', 'parse_excel_sheets')
        ]
        if len(calls) != 1:
            raise AssertionError(f'{name}: expected one Excel parser call')
        call = calls[0]
        argument = 'required_headers' if call.func.id == 'parse_excel_file' else 'sheet_configs'
        expression = next(keyword.value for keyword in call.keywords if keyword.arg == argument)
        values = assignments(tree.body)
        values.update(assignments(ast.walk(function)))
        required = resolve_literal(expression, values)
        header_lists = required.values() if argument == 'sheet_configs' else [required]
        if not required or any(
            not isinstance(headers, list) or not headers
            or not all(isinstance(header, str) and header for header in headers)
            for headers in header_lists
        ):
            raise AssertionError(f'{name}: invalid {argument} contract')
        contracts[name] = (call.func.id, {argument: required})
    return contracts


def parse_template(content, contract):
    parser_name, kwargs = contract
    if parser_name == 'parse_excel_file':
        return {'active': parse_excel_file(file_bytes=content, **kwargs)}
    return parse_excel_sheets(file_bytes=content, **kwargs)


class ImportTemplateTests(unittest.TestCase):
    def check_template(self, template):
        content = load_template(template)
        contracts = load_contracts(template)
        self.assertEqual(len(contracts), 2)
        for name, contract in contracts.items():
            with self.subTest(template=template, contract=name):
                try:
                    sheets = parse_template(content, contract)
                except ValueError as exc:
                    self.fail(str(exc))
                self.assertEqual(len(sheets), 2 if template.endswith('-order') else 1)
                for headers, rows, total in sheets.values():
                    self.assertEqual(total, len(rows))
                    if template == 'product':
                        self.assertNotIn('毛利控制比例', headers)
                        self.assertGreater(total, 0)
                # Other templates are structure-only: no business validation or DB writes.

    def test_downloaded_template_passes_actual_submission_and_worker_parser(self):
        self.check_template('product')

    def test_employee_template(self):
        self.check_template('employee')

    def test_customer_template(self):
        self.check_template('customer')

    def test_supplier_template(self):
        self.check_template('supplier')

    def test_purchase_order_template(self):
        self.check_template('purchase-order')

    def test_sales_order_template(self):
        self.check_template('sales-order')

    def test_example_prices_follow_current_contract(self):
        content = load_template('product')
        contract = load_contracts('product')['import_products_endpoint']
        _, rows, _ = parse_template(content, contract)['active']
        self.assertGreater(len(rows), 0)
        for row in rows:
            with self.subTest(row=row.row_number):
                self.assertGreaterEqual(Decimal(row.get('最低销售金额')), Decimal(row.get('预设出厂价')))
                prices = row.get('供应商预设采购价').split(';')
                self.assertEqual(len(prices), len(row.get('供应商名称').split(';')))
                for price in prices:
                    self.assertGreater(Decimal(price), 0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Validate template structure with the real backend Excel parsers.')
    parser.add_argument('--template-dir', type=Path, default=TEMPLATE_DIR,
                        help='Directory containing the six frontend-named .xlsx templates (default: public/templates).')
    options, unittest_args = parser.parse_known_args()
    TEMPLATE_DIR = options.template_dir.resolve()
    unittest.main(argv=[sys.argv[0], *unittest_args])
