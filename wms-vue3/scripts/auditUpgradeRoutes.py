"""Check the upgrade plan's route inventory against mounted local backend routers.

This checks route declarations only; it does not prove authorization, response
filtering, deployment state, or that a frontend page consumes the route.
"""
from __future__ import annotations

import ast
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT.parent / 'nuomi_wms'
PLAN = ROOT / 'docs' / '网站前端升级设计改造方案_20261027.md'
ROUTER = BACKEND / 'app' / 'api' / 'v1' / 'router.py'
ENDPOINTS = BACKEND / 'app' / 'api' / 'v1' / 'endpoints'


def mounted_modules() -> dict[str, str]:
    tree = ast.parse(ROUTER.read_text(encoding='utf-8'))
    imports: dict[str, str] = {}
    included: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith('app.api.v1.endpoints.'):
            for item in node.names:
                if item.name == 'router':
                    imports[item.asname or item.name] = node.module.rsplit('.', 1)[-1]
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and isinstance(node.func.value, ast.Name)
                and node.func.value.id == 'api_v1_router' and node.func.attr == 'include_router'
                and node.args and isinstance(node.args[0], ast.Name)):
            prefix = next((kw.value for kw in node.keywords if kw.arg == 'prefix'), None)
            if prefix is not None and not (isinstance(prefix, ast.Constant) and isinstance(prefix.value, str)):
                raise ValueError(f'不能静态解析 router 挂载前缀：{node.lineno}')
            included[node.args[0].id] = prefix.value if prefix is not None else ''
    return {module: included[alias] for alias, module in imports.items() if alias in included}


def declared_routes() -> dict[tuple[str, str], list[tuple[str, int]]]:
    routes: dict[tuple[str, str], list[tuple[str, int]]] = {}
    for module, mount_prefix in sorted(mounted_modules().items()):
        path = ENDPOINTS / f'{module}.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))
        router_prefix = ''
        for assignment in tree.body:
            if not (isinstance(assignment, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'router' for target in assignment.targets)
                    and isinstance(assignment.value, ast.Call) and isinstance(assignment.value.func, ast.Name)
                    and assignment.value.func.id == 'APIRouter'):
                continue
            prefix = next((kw.value for kw in assignment.value.keywords if kw.arg == 'prefix'), None)
            if prefix is not None and not (isinstance(prefix, ast.Constant) and isinstance(prefix.value, str)):
                raise ValueError(f'不能静态解析 {path.name} 的 router 前缀')
            router_prefix = prefix.value if prefix is not None else ''
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if not (isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute)
                        and isinstance(decorator.func.value, ast.Name) and decorator.func.value.id == 'router'
                        and decorator.func.attr in {'get', 'post', 'put', 'patch', 'delete'}
                        and decorator.args and isinstance(decorator.args[0], ast.Constant)
                        and isinstance(decorator.args[0].value, str)):
                    continue
                key = decorator.func.attr.upper(), mount_prefix + router_prefix + decorator.args[0].value
                routes.setdefault(key, []).append((path.name, decorator.lineno))
    return routes


def inventory(text: str) -> list[tuple[str, str, str, str | None]]:
    a = text.split('## 附录 A：', 1)[1].split('## 附录 B：', 1)[0]
    b = text.split('## 附录 B：', 1)[1].split('### B.1 ', 1)[0]
    result = []
    for line in a.splitlines():
        match = re.match(r'\|\s*(N\d+)\s*\|\s*(GET|POST)(?: JSON)?\s*\|\s*`([^`]+)`', line)
        if match:
            result.append((*match.groups(), None))
    for line in b.splitlines():
        match = re.match(r'\|\s*(B\d+)\s*\|\s*(GET|POST)\s*`([^`]+)`', line)
        if match:
            source = re.search(r'`([\w]+\.py):\d+`', line)
            if not source:
                raise ValueError(f'{match.group(1)} 缺少后端源码位置')
            result.append((*match.groups(), source.group(1)))
    expected = [*(f'N{i:02d}' for i in range(1, 38)), *(f'B{i:03d}' for i in range(1, 118))]
    ids = [item[0] for item in result]
    if ids != expected:
        raise ValueError(f'附录接口编号不完整或顺序不一致：{len(ids)} 项')
    return result


def main() -> int:
    routes = declared_routes()
    entries = inventory(PLAN.read_text(encoding='utf-8'))
    problems = []
    for ident, method, path, expected_file in entries:
        found = routes.get((method, path), [])
        if len(found) != 1:
            problems.append(f'{ident}: {method} {path} 找到 {len(found)} 个已挂载声明：{found}')
        elif expected_file and found[0][0] != expected_file:
            problems.append(f'{ident}: 方案记录 {expected_file}，实际声明 {found[0]}')
    if problems:
        print('\n'.join(problems))
        return 1
    print(f'已核对 {len(entries)} 项：37 个新增接口、117 个敏感接口均有唯一已挂载路由声明。')
    print('该检查不验证运行环境、鉴权、字段过滤、前端接入或业务结果。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
