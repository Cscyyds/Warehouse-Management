// 会话存储单测（utils/session.ts）：分槽、exp 判定、切换、清理。
// 运行：node --experimental-strip-types --test src/utils/session.test.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── 假的 localStorage ──────────────────────────────────
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}
globalThis.localStorage = makeStorage();

// ── 造 JWT（只用到 payload，不验签）─────────────────────
function makeToken(expOffsetSec = 3600) {
  const payload = { exp: Math.floor(Date.now() / 1000) + expOffsetSec, operator_type: 'X' };
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`;
}

const {
  activeKind,
  activeSession,
  activateSession,
  authHeaders,
  clearSession,
  handleSessionExpired,
  isTokenUsable,
  onSessionExpired,
  readSession,
  saveSession,
  tokenExpiresAt,
} = await import('./session.ts');

beforeEach(() => {
  globalThis.localStorage.clear();
});

test('tokenExpiresAt：解析 exp；坏 token 按已过期处理', () => {
  assert.ok(tokenExpiresAt(makeToken(60)) > Date.now());
  assert.equal(tokenExpiresAt('not-a-jwt'), 0);
  assert.equal(tokenExpiresAt(''), 0);
});

test('isTokenUsable：过期的令牌不可用', () => {
  assert.equal(isTokenUsable(makeToken(60)), true);
  assert.equal(isTokenUsable(makeToken(-10)), false);
  assert.equal(isTokenUsable(''), false);
});

test('saveSession：写自己的槽并成为活动会话', () => {
  const token = makeToken();
  saveSession('pdf_agent', {
    token,
    operator_id: 'pdfu_1',
    operator_name: '甲',
    operator_type: 'PDF_AGENT',
    company_id: 'pdf_ind_1',
    login_name: 'pdf_tester',
  });
  assert.equal(globalThis.localStorage.getItem('pdf_token'), token);
  assert.equal(globalThis.localStorage.getItem('pdf_operator_id'), 'pdfu_1');
  // 活动镜像：既有代码读这些键
  assert.equal(globalThis.localStorage.getItem('token'), token);
  assert.equal(globalThis.localStorage.getItem('auth_kind'), 'pdf_agent');
  assert.equal(activeKind(), 'pdf_agent');
  assert.equal(activeSession()?.operator_id, 'pdfu_1');
});

test('分槽：WMS 与独立账号互不覆盖', () => {
  saveSession('pdf_agent', { token: makeToken(), operator_id: 'pdfu_1' });
  saveSession('wms', { token: makeToken(), operator_id: 'u_1' });
  // 两类会话各自留在自己的槽里
  assert.equal(readSession('pdf_agent')?.operator_id, 'pdfu_1');
  assert.equal(readSession('wms')?.operator_id, 'u_1');
  // 活动会话是最后一次登录的那一类
  assert.equal(activeKind(), 'wms');
  assert.equal(activeSession()?.operator_id, 'u_1');
});

test('activateSession：切回另一类会话不必重新登录', () => {
  saveSession('pdf_agent', { token: makeToken(), operator_id: 'pdfu_1' });
  saveSession('wms', { token: makeToken(), operator_id: 'u_1' });
  const back = activateSession('pdf_agent');
  assert.equal(back?.operator_id, 'pdfu_1');
  assert.equal(activeKind(), 'pdf_agent');
  assert.equal(globalThis.localStorage.getItem('token'), back?.token);
  assert.equal(globalThis.localStorage.getItem('operator_id'), 'pdfu_1');
  // WMS 槽仍在，随时能切回
  assert.ok(readSession('wms'));
});

test('activateSession：槽里的令牌已过期时返回 null（要求重新登录）', () => {
  saveSession('wms', { token: makeToken(-10), operator_id: 'u_1' });
  assert.equal(activateSession('wms'), null);
});

test('clearSession：只清自己那类会话，另一类保留', () => {
  saveSession('pdf_agent', { token: makeToken(), operator_id: 'pdfu_1' });
  saveSession('wms', { token: makeToken(), operator_id: 'u_1' });
  clearSession('pdf_agent');
  assert.equal(readSession('pdf_agent'), null);
  assert.ok(readSession('wms'));
  // 活动镜像不受影响（活动会话是 wms）
  assert.equal(activeKind(), 'wms');
  assert.ok(activeSession());
});

test('clearSession：清活动会话时连带清镜像', () => {
  saveSession('pdf_agent', { token: makeToken(), operator_id: 'pdfu_1' });
  clearSession('pdf_agent');
  assert.equal(activeKind(), '');
  assert.equal(activeSession(), null);
  assert.equal(globalThis.localStorage.getItem('token'), null);
});

test('authHeaders：按活动会话带令牌；没有会话就不带 Authorization', () => {
  assert.deepEqual(authHeaders({ 'X-Test': '1' }), { 'X-Test': '1' });
  saveSession('pdf_agent', { token: makeToken() });
  const h = authHeaders();
  assert.ok(String(h.Authorization).startsWith('Bearer '));
});

test('handleSessionExpired：清会话并通知路由跳转', () => {
  let notified = null;
  onSessionExpired((kind) => { notified = kind; });
  saveSession('pdf_agent', { token: makeToken(), operator_id: 'pdfu_1' });
  handleSessionExpired('pdf_agent');
  assert.equal(notified, 'pdf_agent');
  assert.equal(readSession('pdf_agent'), null);
  assert.equal(activeKind(), '');
});
