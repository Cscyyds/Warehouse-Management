"""Exercise the change-password form with isolated, mocked backend requests.

Usage: python scripts/test-change-password-autofill.py [base_url] [browser_executable]
"""
import base64
import json
import sys
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

base_url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3000'
browser_executable = sys.argv[2] if len(sys.argv) > 2 else None
payload = base64.urlsafe_b64encode(json.dumps({'exp': 4102444800}).encode()).decode().rstrip('=')
token = f'test.{payload}.test'

with sync_playwright() as playwright:
    options = {'headless': True}
    if browser_executable:
        options['executable_path'] = browser_executable
    browser = playwright.chromium.launch(**options)
    context = browser.new_context(service_workers='block')
    context.add_init_script(f"localStorage.setItem('token', '{token}'); localStorage.setItem('auth_kind', 'wms');")

    def intercept(route):
        url = urlsplit(route.request.url)
        if url.path.startswith(('/api/', '/scanner-api/')):
            data = {}
            if url.path.endswith(('/my-permissions', '/visible-permissions')):
                data = {'menus': []}
            elif url.path.endswith('/purposes'):
                data = {'supported_channels': ['EMAIL']}
            elif url.path.endswith('/me'):
                data = {'email': 'test@example.test'}
            elif url.path.endswith('/captcha'):
                data = {'image_data': '', 'captcha_id': 'test'}
            route.fulfill(status=200, content_type='application/json', body=json.dumps({
                'success': True, 'code': 200, 'data': data,
            }))
        else:
            route.continue_()

    context.route('**/*', intercept)
    page = context.new_page()
    page.goto(base_url + '/profile/change-password', wait_until='domcontentloaded')
    inputs = page.locator('.pwd-form input')
    expect(inputs).to_have_count(4)
    for index in (0, 1):
        expect(inputs.nth(index)).to_have_attribute('autocomplete', 'new-password')
    for index in (2, 3):
        expect(inputs.nth(index)).to_have_attribute('autocomplete', 'off')
    for index in range(4):
        expect(inputs.nth(index)).to_have_value('')

    for index, value in enumerate(('new-password-123', 'new-password-123', '1234', '654321')):
        inputs.nth(index).fill(value)
        expect(inputs.nth(index)).to_have_value(value)
    page.locator('.header-tab').filter(has_text='个人信息').click()
    page.wait_for_url('**/profile')
    page.locator('.header-tab').filter(has_text='修改密码').click()
    page.wait_for_url('**/profile/change-password')
    expect(inputs).to_have_count(4)
    for index in range(4):
        expect(inputs.nth(index)).to_have_value('')
    print('PASS: new-password autocomplete, manual input and fresh values on navigation')
    browser.close()
