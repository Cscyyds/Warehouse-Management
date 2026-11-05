"""Generate administrator route hints after checking the upgrade inventory."""
from pathlib import Path
from auditUpgradeRoutes import ROOT, PLAN, inventory, declared_routes

entries = inventory(PLAN.read_text(encoding='utf-8'))
routes = declared_routes()
for ident, method, path, _ in entries:
    if len(routes.get((method, path), [])) != 1:
        raise SystemExit(f'{ident}: 路由声明核验未通过，未生成候选')
paths = sorted({path for _, _, path, _ in entries if not path.startswith('/platform-')})
target = ROOT / 'admin-web/src/config/sensitiveInterfacePaths.generated.ts'
target.parent.mkdir(exist_ok=True)
target.write_text('/** 自动生成：python wms-vue3/scripts/genSensitiveInterfacePaths.py。\n'
                  ' * 来自升级清单与已挂载后端路由，仅辅助选择，不证明参数路径已命中。 */\n'
                  'export const SENSITIVE_INTERFACE_PATHS = [\n'
                  + ''.join(f'  {path!r},\n' for path in paths) + '] as const\n', encoding='utf-8')
print(f'Generated {len(paths)} verified route hints')
