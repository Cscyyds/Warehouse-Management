import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import auditUpgradeRoutes as audit


class RouteAuditTests(unittest.TestCase):
    def test_inventory_rejects_missing_number(self):
        plan = audit.PLAN.read_text(encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '编号不完整'):
            audit.inventory(plan.replace('| N01 |', '| N00 |', 1))

    def test_only_mounted_routes_and_both_prefixes_are_counted(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            endpoints = root / 'endpoints'
            endpoints.mkdir()
            (endpoints / 'active.py').write_text("""
from fastapi import APIRouter
router = APIRouter(prefix='/inner')
@router.get('/items')
def get_items(): pass
""", encoding='utf-8')
            (endpoints / 'inactive.py').write_text("""
from fastapi import APIRouter
router = APIRouter()
@router.get('/unmounted')
def get_items(): pass
""", encoding='utf-8')
            router = root / 'router.py'
            router.write_text("""
from app.api.v1.endpoints.active import router as active_router
from app.api.v1.endpoints.inactive import router as inactive_router
api_v1_router.include_router(active_router, prefix='/outer')
""", encoding='utf-8')
            with patch.object(audit, 'ROUTER', router), patch.object(audit, 'ENDPOINTS', endpoints):
                routes = audit.declared_routes()
            self.assertEqual(routes[('GET', '/outer/inner/items')][0][0], 'active.py')
            self.assertNotIn(('GET', '/unmounted'), routes)
            self.assertNotIn(('GET', '/items'), routes)


if __name__ == '__main__':
    unittest.main()
