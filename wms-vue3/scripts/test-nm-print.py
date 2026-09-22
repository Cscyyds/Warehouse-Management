"""Browser regressions against the running Vite server; no backend or printer needed."""

import argparse
import re
import sys
import unittest
from datetime import datetime, timezone
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


BASE_URL = "http://127.0.0.1:3000"
WARNING = "未检测到本机打印服务"

HTML = r"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<link rel="stylesheet" href="/node_modules/element-plus/dist/index.css">
<style>*:not(.is-loading), *::before, *::after { transition: none !important; animation: none !important; }</style>
</head><body><div id="app"></div>
<script type="module">
import { createApp, h, nextTick, ref } from '/node_modules/.vite/deps/vue.js';
import ElementPlus from '/node_modules/.vite/deps/element-plus.js';
import PrintLabelDialog from '/src/components/PrintLabelDialog.vue';
import { NmSocket } from '/src/utils/nmPrint/Socket.ts';
window.NmSocket = NmSocket;
window.nextPrintTick = nextTick;
// Mount only after Python installs the clock, including initially-open dialogs.
window.mountPrintTest = ({ kind = 'product', initial = false } = {}) => {
  const app = createApp({
    setup() {
      window.openDialog = ref(initial);
      window.printKind = ref(kind);
      return () => h('main', [
        h('button', { id: 'open-test', onClick: () => { window.openDialog.value = true; } }, 'Open test'),
        h(PrintLabelDialog, {
          ref: instance => { if (instance) window.nm = instance.$.setupState.nm; },
          modelValue: window.openDialog.value,
          'onUpdate:modelValue': value => { window.openDialog.value = value; },
          kind: window.printKind.value,
          rows: [{ id: 'test-row', title: '测试条码', subtitle: 'TEST-001' }],
        }),
      ]);
    },
  });
  app.use(ElementPlus);
  app.mount('#app');
};
window.printTestReady = true;
</script></body></html>
"""

API_STUB = r"""
window.businessCalls = [];
window.useSdkOutput = false;
const model = {
  model_code: 'TEST-PDF', model_name: '测试打印机（情况B）',
  has_preview_capability: false, density_min: 1, density_max: 15, density_default: 8,
  supported_print_modes: ['热敏'], supported_label_types: ['间隙纸'],
  label_specs: [{ spec_id: 'test-spec', spec_name: '测试规格', width_mm: 40, height_mm: 30, is_default: 1 }],
};
function record(api, args) { window.businessCalls.push({ api, args }); }
function currentModel() { return { ...model, has_preview_capability: window.useSdkOutput ? 1 : 0 }; }
export async function getVisiblePrinterList(params) {
  record('getVisiblePrinterList', [params]);
  return { data: { list: [currentModel()], total: 1 } };
}
export async function getVisiblePrinterDetail(code) {
  record('getVisiblePrinterDetail', [code]);
  return { data: currentModel() };
}
function preview(api, id, params) {
  record(api, [id, params]);
  if (window.useSdkOutput) {
    return Promise.resolve({
      printer_has_preview_capability: true,
      print_data: { InitDrawingBoardParam: { width: 320, height: 240, dpi: 203 }, elements: [] },
    });
  }
  return Promise.resolve({
    printer_has_preview_capability: false,
    pdf_url: `${location.origin}/__fake_pdf__/${api}.pdf`, expire_seconds: 300,
  });
}
export const printPlasticBox = (id, params) => preview('printPlasticBox', id, params);
export const printProductBarcode = (id, params) => preview('printProductBarcode', id, params);
export const printLocationBarcode = (id, params) => preview('printLocationBarcode', id, params);
export async function deletePrintTempFiles(urls) {
  record('deletePrintTempFiles', [urls]);
  return { data: null };
}
"""

FAKE_WEBSOCKET = r"""
(() => {
  const NativeWebSocket = window.WebSocket;
  window.serviceAvailable = true;
  window.printSocketOptions = { autoAck: false, delay: 1, dropFirstInit: false, handshakeNever: false };
  window.deviceAvailable = false;
  window.deviceReplies = {};
  window.printSockets = [];
  window.printRequests = [];
  window.printSocketEvents = [];
  window.maxActivePrintSockets = 0;
  window.nativeSocketUrls = [];
  function track() {
    const active = window.printSockets.filter(ws => ws.readyState === 0 || ws.readyState === 1).length;
    window.maxActivePrintSockets = Math.max(window.maxActivePrintSockets, active);
  }
  class FakeWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    constructor(url, protocols) {
      super();
      if (!String(url).includes(':37989')) {
        window.nativeSocketUrls.push(String(url));
        return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
      }
      this.url = String(url);
      this.readyState = 0;
      this.bufferedAmount = 0;
      this.protocol = '';
      this.extensions = '';
      this.binaryType = 'blob';
      this.id = window.printSockets.length;
      this.closeCalls = 0;
      window.printSockets.push(this);
      track();
      if (!window.printSocketOptions.handshakeNever) {
        setTimeout(() => {
          if (this.readyState !== 0) return;
          if (window.serviceAvailable) {
            this.readyState = 1;
            track();
            this.emit('open');
          } else {
            this.fail();
          }
        }, 1);
      }
    }
    emit(type, data) {
      window.printSocketEvents.push({ socketId: this.id, type, at: Date.now() });
      const event = type === 'message' ? new MessageEvent(type, { data }) : new Event(type);
      this[`on${type}`]?.(event);
      this.dispatchEvent(event);
    }
    send(raw) {
      if (this.readyState !== 1) throw new Error('FakeWebSocket.send on non-OPEN socket');
      const command = JSON.parse(raw);
      const request = { ...command, socketId: this.id, at: Date.now() };
      window.printRequests.push(request);
      const options = window.printSocketOptions;
      if (command.apiName === 'initSdk') {
        const first = window.printRequests.filter(item => item.apiName === 'initSdk').length === 1;
        if (options.dropFirstInit && first) return;
      }
      if (options.autoAck) {
        const reply = window.deviceReplies[command.apiName];
        if (reply === null) return;
        const info = command.apiName === 'getAllPrinters'
          ? JSON.stringify(window.deviceAvailable ? { TestPrinter: '123' } : {})
          : command.apiName === 'generateImagePreviewImage'
            ? JSON.stringify({ ImageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMrsAAAAASUVORK5CYII=' })
            : '';
        setTimeout(() => this.ack(command.apiName, reply?.errorCode ?? 0, reply?.info ?? info), options.delay);
      }
    }
    ack(apiName = 'initSdk', errorCode = 0, info = '') {
      if (this.readyState === 1) {
        this.emit('message', JSON.stringify({ apiName, resultAck: { errorCode, info } }));
      }
    }
    fail() {
      if (this.readyState >= 2) return;
      this.emit('error');
      this.close();
    }
    close() {
      this.closeCalls += 1;
      if (this.readyState >= 2) return;
      this.readyState = 2;
      track();
      // Browser close events are asynchronous, including explicit close().
      setTimeout(() => {
        this.readyState = 3;
        track();
        this.emit('close');
      }, 1);
    }
  }
  Object.assign(FakeWebSocket.prototype, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = FakeWebSocket;
})();
"""


class NmPrintBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(headless=True)
        except Exception:
            cls.playwright.stop()
            raise
        expect.set_options(timeout=1500)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1200, "height": 1000}, service_workers="block")
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.page.set_default_timeout(5000)
        self.errors = []
        self.unexpected_requests = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.route("**/*", self.guard_network)
        self.page.route("**/__print_test__", lambda route: route.fulfill(content_type="text/html", body=HTML))
        self.page.route(re.compile(r"/src/api/index\.ts(?:\?.*)?$"), lambda route: route.fulfill(content_type="text/javascript", body=API_STUB))
        self.page.add_init_script(FAKE_WEBSOCKET)
        self.page.goto(BASE_URL.rstrip("/") + "/__print_test__")
        self.page.wait_for_load_state("networkidle")
        self.assertTrue(self.page.evaluate("window.printTestReady === true"), self.errors)
        now = datetime(2026, 1, 1, tzinfo=timezone.utc)
        self.page.clock.install(time=now)
        self.page.clock.pause_at(now)

    def tearDown(self):
        self.assertEqual(self.errors, [], "Unexpected browser runtime errors")
        self.assertEqual(self.unexpected_requests, [], "Backend, external or PDF request escaped the harness")
        if not self.page.is_closed():
            self.assertLessEqual(self.page.evaluate("window.maxActivePrintSockets"), 1, "Leaked concurrent CONNECTING/OPEN sockets")

    def guard_network(self, route):
        url = urlsplit(route.request.url)
        allowed = urlsplit(BASE_URL)
        static = ("/src/", "/node_modules/", "/@vite/", "/@id/", "/@fs/")
        if (url.scheme, url.netloc) == (allowed.scheme, allowed.netloc) and url.path.startswith(static):
            route.continue_()
        else:
            self.unexpected_requests.append(route.request.url)
            route.abort()

    def mount(self, *, kind="product", initial=False, available=True, **socket_options):
        self.page.evaluate("""options => {
            window.serviceAvailable = options.available;
            Object.assign(window.printSocketOptions, options.socket);
            window.mountPrintTest(options.mount);
        }""", {"available": available, "socket": socket_options, "mount": {"kind": kind, "initial": initial}})
        self.flush()

    def flush(self):
        self.page.evaluate("() => window.nextPrintTick()")

    def advance(self, milliseconds):
        self.page.clock.run_for(milliseconds)
        self.flush()

    def open_dialog(self):
        self.page.locator("#open-test").click(force=True)
        self.flush()

    def close_dialog(self):
        dialog = self.page.get_by_role("dialog")
        dialog.get_by_role("button", name="取消", exact=True).click(force=True)
        self.advance(50)
        expect(dialog).not_to_be_visible()

    def state(self):
        return self.page.evaluate("""() => ({
            connecting: nm.connecting.value, connected: nm.serviceConnected.value,
            sdkInited: nm.sdkInited.value, printerName: nm.printerName.value,
        })""")

    def init_requests(self):
        return self.page.evaluate("printRequests.filter(request => request.apiName === 'initSdk')")

    def assert_loading(self):
        self.assertTrue(self.state()["connecting"], self.state())
        # Inspect the visible service banner, not an unrelated model/PDF spinner.
        banner = self.page.locator(".service-alert:visible")
        expect(banner).to_be_visible()
        spinner = banner.locator(".is-loading").first
        expect(spinner).to_be_visible()
        self.assertNotEqual(spinner.evaluate("el => getComputedStyle(el).animationName"), "none")
        expect(banner).not_to_contain_text(WARNING)
        expect(banner).not_to_contain_text("安装后")

    def assert_warning(self, message=WARNING):
        self.assertFalse(self.state()["connecting"], self.state())
        self.assertFalse(self.state()["connected"], self.state())
        banner = self.page.locator(".service-alert:visible")
        expect(banner).to_contain_text(message)
        expect(banner).to_have_class(re.compile(r".*el-alert--warning.*"))
        expect(banner.get_by_role("button", name="重新检测")).to_be_enabled()

    def ack(self, socket_id=None):
        self.page.evaluate("""id => {
            const ws = id === null ? printSockets.findLast(item => item.readyState === 1) : printSockets[id];
            if (!ws) throw new Error('No OPEN print socket to acknowledge');
            ws.ack('initSdk');
        }""", socket_id)
        self.flush()

    def assert_ready(self):
        self.assertEqual(self.state(), {"connecting": False, "connected": True, "sdkInited": True, "printerName": ""})
        banner = self.page.locator(".service-alert:visible")
        expect(banner).to_have_count(1)
        expect(banner).to_have_class(re.compile(r".*el-alert--success.*"))
        expect(banner).to_contain_text("已连接本机打印服务")
        expect(banner.locator(".is-loading")).to_have_count(0)

    def retry(self):
        self.page.locator(".service-alert").get_by_role("button", name="重新检测").click(force=True)
        self.flush()

    def test_first_open_shows_loading_until_sdk_ack(self):
        self.mount()
        self.open_dialog()
        self.assert_loading()
        self.advance(5)
        self.assert_loading()
        self.assertEqual(len(self.init_requests()), 1)
        self.ack()
        self.assert_ready()

    def test_initially_open_dialog_also_detects(self):
        self.mount(initial=True)
        self.assert_loading()
        self.advance(5)
        self.assertEqual(len(self.init_requests()), 1)
        self.ack()
        self.assert_ready()

    def test_open_pending_concurrent_calls_share_one_init(self):
        self.mount()
        self.open_dialog()
        self.advance(5)
        self.assertEqual(len(self.init_requests()), 1, "onopen and connectService must not both initialize")
        self.page.evaluate("""() => {
            window.connectResults = [];
            for (let i = 0; i < 5; i++) nm.connectService().then(value => connectResults.push(value));
        }""")
        self.flush()
        self.assertEqual(len(self.init_requests()), 1, "OPEN fast path must share pending SDK initialization")
        self.assert_loading()
        self.ack()
        self.assert_ready()
        self.assertEqual(self.page.evaluate("connectResults"), [True] * 5)
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)

    def test_close_reopen_reuses_socket_and_sdk(self):
        self.mount()
        self.open_dialog()
        self.advance(5)
        self.ack()
        self.assert_ready()
        self.close_dialog()
        self.advance(20)
        self.open_dialog()
        self.advance(20)
        self.assert_ready()
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)
        self.assertEqual(len(self.init_requests()), 1)

    def test_missing_service_three_attempts_then_manual_retry(self):
        self.mount(available=False)
        self.open_dialog()
        self.advance(2450)
        self.assert_warning()
        self.assertEqual(self.page.evaluate("printSockets.length"), 3)
        self.assertEqual(self.init_requests(), [])
        self.retry()
        self.assert_loading()
        self.page.evaluate("window.serviceAvailable = true")
        self.advance(5)
        self.assert_loading()
        self.ack()
        self.assert_ready()
        self.advance(6500)
        self.assert_ready()
        self.assertEqual(self.page.evaluate("printSockets.length"), 4, "Old error/close reconnect timers must be cancelled")
        self.assertEqual(len(self.init_requests()), 1)

    def test_late_service_auto_reconnect_is_single_and_loading(self):
        self.mount(available=False)
        self.open_dialog()
        self.advance(2450)
        self.assert_warning()
        self.assertEqual(self.page.evaluate("printSockets.length"), 3)
        self.page.evaluate("window.serviceAvailable = true")
        self.advance(3100)
        self.assertEqual(self.page.evaluate("printSockets.length"), 4)
        self.assertEqual(len(self.init_requests()), 1)
        self.assert_loading()
        self.ack()
        self.assert_ready()
        self.advance(6500)
        self.assertEqual(self.page.evaluate("printSockets.length"), 4)
        self.assertEqual(len(self.init_requests()), 1)
        self.assert_ready()

    def test_disconnect_invalidates_sdk_and_reinitializes(self):
        self.mount()
        self.open_dialog()
        self.advance(5)
        self.ack()
        self.assert_ready()
        self.page.evaluate("printSockets[0].fail()")
        self.advance(5)
        self.assertFalse(self.state()["sdkInited"], "SDK state belongs to the disconnected socket")
        self.assertFalse(self.state()["connected"])
        self.advance(3010)
        self.assertEqual(self.page.evaluate("printSockets.length"), 2)
        self.assertEqual(len(self.init_requests()), 2, "New connection must perform fresh initSdk")
        self.assert_loading()
        self.ack()
        self.assert_ready()
        self.advance(3100)
        self.assertEqual(self.page.evaluate("printSockets.length"), 2)

    def test_never_open_handshake_is_closed_without_leaks(self):
        self.mount(handshakeNever=True)
        self.open_dialog()
        self.assertTrue(self.state()["connecting"])
        self.advance(10000)
        self.assert_warning()
        self.assertEqual(self.page.evaluate("printSockets.length"), 3)
        self.assertEqual(self.init_requests(), [])
        self.assertTrue(self.page.evaluate("printSockets.every(ws => ws.readyState === 3 && ws.closeCalls > 0)"), "Every expired handshake must close its underlying socket")
        self.page.evaluate("printSocketOptions.handshakeNever = false")
        self.retry()
        self.assert_loading()
        self.advance(5)
        self.ack()
        self.assert_ready()

    def test_sdk_timeout_is_bounded_and_manual_retry_recovers(self):
        self.mount()
        self.open_dialog()
        self.advance(5)
        self.assertEqual(len(self.init_requests()), 1)
        self.advance(10000)
        self.assert_loading()
        self.advance(600)
        self.assertEqual(len(self.init_requests()), 2)
        self.advance(10600)
        self.assertEqual(len(self.init_requests()), 3)
        self.assert_loading()
        self.advance(10000)
        self.assert_warning("初始化超时")
        expect(self.page.locator(".service-alert")).not_to_contain_text(WARNING)
        self.assertFalse(self.state()["sdkInited"])
        self.advance(20000)
        self.assertEqual(len(self.init_requests()), 3, "Three init attempts total, not three per outer connect attempt")
        self.retry()
        self.assert_loading()
        self.assertEqual(len(self.init_requests()), 4)
        self.ack()
        self.assert_ready()
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)

    def test_first_init_command_can_be_dropped(self):
        self.mount(autoAck=True, delay=25, dropFirstInit=True)
        self.open_dialog()
        self.advance(5)
        self.assertEqual(len(self.init_requests()), 1)
        self.advance(10000)
        self.assert_loading()
        self.advance(650)
        self.assert_ready()
        self.assertEqual(len(self.init_requests()), 2)
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)

    def test_socket_open_is_shared_and_close_cancels_reconnect(self):
        self.page.evaluate("""() => {
            window.rawSocket = new NmSocket();
            const first = rawSocket.open();
            const second = rawSocket.open();
            window.sameOpenPromise = first === second;
        }""")
        self.assertTrue(self.page.evaluate("sameOpenPromise"))
        self.advance(5)
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)
        self.page.evaluate("""() => {
            window.closedRequestCode = null;
            rawSocket.send({apiName: 'initSdk'}).then(result => closedRequestCode = result.resultAck.errorCode);
            rawSocket.close();
        }""")
        self.advance(6500)
        self.assertEqual(self.page.evaluate("closedRequestCode"), 23)
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)
        self.page.evaluate("() => { void rawSocket.open(); }")
        self.advance(5)
        self.assertEqual(self.page.evaluate("printSockets.length"), 2)
        self.page.evaluate("rawSocket.close()")

    def test_close_cancels_pending_handshake(self):
        self.page.evaluate("""() => {
            printSocketOptions.handshakeNever = true;
            window.rawSocket = new NmSocket();
            window.openRejected = false;
            rawSocket.open().catch(() => { openRejected = true; });
            rawSocket.close();
        }""")
        self.advance(6500)
        self.assertTrue(self.page.evaluate("openRejected"))
        self.assertEqual(self.page.evaluate("printSockets.length"), 1)
        self.assertEqual(self.page.evaluate("printSockets[0].readyState"), 3)

    def test_sdk_error_is_not_reported_as_missing_service(self):
        self.mount()
        self.open_dialog()
        self.advance(5)
        self.page.evaluate("printSockets[0].ack('initSdk', 6)")
        self.flush()
        self.assert_warning("初始化失败")
        expect(self.page.locator(".service-alert")).not_to_contain_text(WARNING)
        self.advance(32000)
        self.assertEqual(len(self.init_requests()), 1)
        self.retry()
        self.assert_loading()
        self.ack()
        self.assert_ready()

    def test_disconnect_during_init_ignores_old_response(self):
        self.mount()
        self.open_dialog()
        self.advance(5)
        self.page.evaluate("""() => {
            window.oldMessageHandler = printSockets[0].onmessage;
            printSockets[0].fail();
        }""")
        self.advance(1250)
        self.assertEqual(len(self.init_requests()), 2)
        self.page.evaluate("""() => oldMessageHandler({data: JSON.stringify({
            apiName: 'initSdk', resultAck: {errorCode: 0}
        })})""")
        self.flush()
        self.assert_loading()
        self.assertFalse(self.state()["sdkInited"])
        self.ack()
        self.assert_ready()

    def prepare_device_action(self, *, available=False):
        self.page.evaluate("available => { useSdkOutput = true; deviceAvailable = available; }", available)
        self.mount(autoAck=True)
        self.open_dialog()
        self.advance(5)
        self.assert_ready()
        selector = self.page.locator(".el-form-item").filter(has_text="打印机型号").locator(".el-select")
        selector.click(force=True)
        self.advance(32)
        self.page.get_by_role("option", name="测试打印机（情况B）").click(force=True)
        self.flush()

    def assert_device_message(self, message):
        messages = self.page.locator(".el-message:visible")
        expect(messages).to_have_count(1)
        expect(messages).to_contain_text(message)
        expect(messages).not_to_contain_text("Console")
        expect(self.page.locator(".service-alert")).to_contain_text("已连接本机打印服务")
        expect(self.page.get_by_role("button", name="预览", exact=True)).not_to_have_class(re.compile(r".*is-loading.*"))
        expect(self.page.get_by_role("button", name="打印", exact=True)).not_to_have_class(re.compile(r".*is-loading.*"))

    def use_real_print_http_with_network_failure(self):
        real_api = """
            export {getVisiblePrinterList, getVisiblePrinterDetail} from '/__printer_models_fixture__';
            export {printPlasticBox, printProductBarcode, printLocationBarcode, deletePrintTempFiles}
                from '/src/api/modules/scannerPrint.ts';
        """
        self.page.route("**/__printer_models_fixture__", lambda route: route.fulfill(content_type="text/javascript", body=API_STUB))
        self.page.route(re.compile(r"/src/api/index\.ts(?:\?.*)?$"), lambda route: route.fulfill(content_type="text/javascript", body=real_api))
        self.failed_print_requests = []

        def abort_print(route):
            self.failed_print_requests.append(route.request.url)
            route.abort("failed")

        self.page.route(re.compile(r"/api/v1/tenant-wms/[^/]+/print(?:\?.*)?$"), abort_print)
        self.page.reload()
        self.page.wait_for_load_state("networkidle")
        self.assertTrue(self.page.evaluate("window.printTestReady === true"), self.errors)
        self.page.evaluate("""() => {
            window.seenPrintMessages = [];
            const seen = new WeakSet();
            new MutationObserver(() => {
                document.querySelectorAll('.el-message').forEach(node => {
                    if (!seen.has(node)) { seen.add(node); seenPrintMessages.push(node.textContent.trim()); }
                });
            }).observe(document.body, {childList: true, subtree: true});
        }""")

    def test_missing_device_precedes_real_http_network_error(self):
        self.use_real_print_http_with_network_failure()
        self.prepare_device_action()
        for action in ("预览", "打印"):
            with self.subTest(action=action):
                self.page.get_by_role("button", name=action, exact=True).click(force=True)
                self.advance(3050)
                self.assert_device_message(f"未连接打印设备，无法{action}")
                self.assertEqual(self.failed_print_requests, [], "Device failure must stop before HTTP/interceptor")
                self.assertFalse(any("Network Error" in msg for msg in self.page.evaluate("seenPrintMessages")))
                self.advance(3500)

    def test_real_network_failure_is_not_misreported_as_missing_device(self):
        self.use_real_print_http_with_network_failure()
        self.prepare_device_action(available=True)
        self.page.get_by_role("button", name="预览", exact=True).click(force=True)
        self.advance(50)
        expect(self.page.locator(".el-message:visible")).to_contain_text("无法连接条码打印后台服务")
        self.assertGreaterEqual(len(self.failed_print_requests), 1)
        self.assertGreaterEqual(self.page.evaluate("printRequests.filter(r => r.apiName === 'getAllPrinters').length"), 1)
        self.assertFalse(any("未连接打印设备" in msg or "Network Error" in msg for msg in self.page.evaluate("seenPrintMessages")))

    def test_missing_device_blocks_both_actions_with_one_message(self):
        self.prepare_device_action()
        for action in ("预览", "打印"):
            with self.subTest(action=action):
                self.page.get_by_role("button", name=action, exact=True).click(force=True)
                self.advance(3050)
                self.assert_device_message("未连接打印设备，无法")
                self.assertEqual(self.page.evaluate("printRequests.filter(r => ['startJob', 'generateImagePreviewImage'].includes(r.apiName)).length"), 0)
                self.advance(3500)

    def test_device_detection_timeout_is_not_missing_device(self):
        self.prepare_device_action()
        self.page.evaluate("deviceReplies.getAllPrinters = null")
        for action in ("预览", "打印"):
            with self.subTest(action=action):
                self.page.get_by_role("button", name=action, exact=True).click(force=True)
                self.advance(33100)
                self.assert_device_message("打印机检测超时")
                expect(self.page.locator(".el-message")).not_to_contain_text("未连接打印设备")
                self.advance(3500)

    def test_device_selection_failure_shows_one_actionable_message(self):
        self.prepare_device_action(available=True)
        self.page.evaluate("deviceReplies.selectPrinter = {errorCode: 6, info: 'Device busy'}")
        self.page.get_by_role("button", name="打印", exact=True).click(force=True)
        self.advance(50)
        self.assert_device_message("打印机连接失败")
        self.assertEqual(self.page.evaluate("printRequests.filter(r => r.apiName === 'startJob').length"), 0)

    def test_cached_device_does_not_bypass_detection(self):
        self.prepare_device_action()
        self.page.evaluate("""() => {
            nm.printerName.value = 'TestPrinter';
            nm.printerList.value = [{name:'TestPrinter', port:123}];
        }""")
        self.page.get_by_role("button", name="打印", exact=True).click(force=True)
        self.advance(3050)
        self.assert_device_message("未连接打印设备，无法")
        self.assertEqual(self.state()["printerName"], "")
        self.assertEqual(self.page.evaluate("printRequests.filter(r => r.apiName === 'startJob').length"), 0)

    def test_connecting_device_recovers_preview_without_reload(self):
        self.prepare_device_action()
        self.page.get_by_role("button", name="预览", exact=True).click(force=True)
        self.advance(3050)
        self.assert_device_message("未连接打印设备")
        self.advance(3500)
        self.page.evaluate("deviceAvailable = true")
        self.page.get_by_role("button", name="预览", exact=True).click(force=True)
        self.advance(50)
        expect(self.page.locator(".preview-box img")).to_be_visible()
        expect(self.page.locator(".el-message:visible")).to_have_count(0)
        self.assertEqual(self.page.evaluate("printRequests.filter(r => r.apiName === 'selectPrinter').length"), 0)
        self.page.evaluate("deviceAvailable = false")
        self.page.get_by_role("button", name="预览", exact=True).click(force=True)
        self.advance(3050)
        self.assert_device_message("未连接打印设备")

    def test_preview_sdk_failure_does_not_duplicate_generic_error(self):
        self.prepare_device_action(available=True)
        self.page.evaluate("deviceReplies.InitDrawingBoard = {errorCode: 6}")
        self.page.get_by_role("button", name="预览", exact=True).click(force=True)
        self.advance(50)
        self.assert_device_message("打印异常")

    def test_connected_device_allows_printing(self):
        self.prepare_device_action(available=True)
        self.page.get_by_role("button", name="打印", exact=True).click(force=True)
        self.advance(100)
        commands = self.page.evaluate("printRequests.map(r => r.apiName)")
        self.assertLess(commands.index("getAllPrinters"), commands.index("selectPrinter"))
        self.assertLess(commands.index("selectPrinter"), commands.index("startJob"))
        expect(self.page.locator(".el-message--error")).to_have_count(0)
        expect(self.page.get_by_role("dialog")).not_to_be_visible()

    def test_all_kinds_show_loading(self):
        self.mount()
        for kind, title in (("product", "产品条码打印"), ("location", "货位条码打印"), ("plasticBox", "塑料盒条码打印")):
            with self.subTest(kind=kind):
                self.page.evaluate("kind => { printKind.value = kind; }", kind)
                self.open_dialog()
                expect(self.page.get_by_role("dialog")).to_contain_text(title)
                self.assert_loading()
                self.close_dialog()
                self.advance(5)
        self.assertEqual(len(self.init_requests()), 1)
        self.ack()
        self.assertFalse(self.state()["connecting"])

    def test_case_b_preview_during_detection_and_after_failure(self):
        self.mount(available=False)
        self.open_dialog()
        for phase in ("detecting", "failed"):
            if phase == "failed":
                self.advance(2450)
                self.assert_warning()
            else:
                self.assert_loading()
            for kind, api in (("product", "printProductBarcode"), ("location", "printLocationBarcode"), ("plasticBox", "printPlasticBox")):
                with self.subTest(phase=phase, kind=kind):
                    self.page.evaluate("kind => { printKind.value = kind; }", kind)
                    self.flush()
                    selector = self.page.locator(".el-form-item").filter(has_text="打印机型号").locator(".el-select")
                    selector.click(force=True)
                    self.advance(32)
                    self.page.get_by_role("option", name="测试打印机（情况B）").click(force=True)
                    self.flush()
                    preview = self.page.get_by_role("button", name="预览", exact=True)
                    expect(preview).to_be_enabled()
                    preview.click(force=True)
                    self.flush()
                    link = self.page.get_by_role("link", name="下载 PDF 打印")
                    expect(link).to_be_visible()
                    expect(link).to_have_attribute("href", BASE_URL.rstrip("/") + f"/__fake_pdf__/{api}.pdf")
                    calls = self.page.evaluate("api => businessCalls.filter(call => call.api === api)", api)
                    self.assertEqual(len(calls), 1 if phase == "detecting" else 2)
                    self.assertEqual(calls[-1]["args"], ["test-row", {
                        "printer_model_code": "TEST-PDF", "label_spec_id": "test-spec", "print_mode": "PREVIEW",
                        "print_mode_hardware": "热敏", "label_type": "间隙纸", "print_qty": 1, "density": 8,
                    }])
                    self.assertEqual(len(self.context.pages), 1, "Never open the PDF")
        self.assertEqual(self.init_requests(), [], "Case B preview must not invoke SDK printing")
        self.close_dialog()
        cleanup = self.page.evaluate("businessCalls.filter(call => call.api === 'deletePrintTempFiles')")
        self.assertEqual(len(cleanup), 1)
        self.assertEqual(cleanup[0]["args"], [[BASE_URL.rstrip("/") + "/__fake_pdf__/printPlasticBox.pdf"]])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=BASE_URL, help="Existing Vite server (default: %(default)s)")
    args, test_args = parser.parse_known_args()
    BASE_URL = args.base_url.rstrip("/")
    unittest.main(argv=[sys.argv[0], *test_args], verbosity=2)
