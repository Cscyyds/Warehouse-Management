/**
 * 会话存储（前端会话模型的单一来源）：WMS 员工与 pdf_agent 独立账号分槽。
 *
 * 为什么要分槽：此前两类会话共用 localStorage['token'] 一个槽，谁后登录谁
 * 覆盖谁——独立账号登录会顶掉 WMS 员工的令牌，反之亦然；想切回另一类会话
 * 只能重新登录。两类会话的令牌、有效期、归属都不同，混在一个槽里必然串号。
 *
 * 存储结构：
 *   wms_token / pdf_token           两类会话各自的令牌（真实状态）
 *   wms_<field> / pdf_<field>       两类会话各自的展示字段
 *   token / operator_* / auth_kind  活动会话镜像（既有代码读这些键，语义不变）
 *
 * 令牌有效性按 JWT 的 exp 判定（不验签，仅本地预判）：解析失败按已过期处理。
 */

export type SessionKind = 'wms' | 'pdf_agent';

export const SESSION_FIELDS = [
  'operator_id',
  'operator_name',
  'operator_type',
  'company_id',
  'login_name',
] as const;

export type SessionField = (typeof SESSION_FIELDS)[number];

export interface SessionState {
  kind: SessionKind;
  token: string;
  operator_id: string;
  operator_name: string;
  operator_type: string;
  company_id: string;
  login_name: string;
  /** 令牌是否仍在有效期内（exp 未过）。 */
  usable: boolean;
}

const SLOT_KEYS: Record<SessionKind, { token: string; prefix: string }> = {
  wms: { token: 'wms_token', prefix: 'wms_' },
  pdf_agent: { token: 'pdf_token', prefix: 'pdf_' },
};

/** 活动会话镜像的键（既有代码读 localStorage['token'] 等，语义保持不变）。 */
const ACTIVE_TOKEN_KEY = 'token';
const ACTIVE_KIND_KEY = 'auth_kind';

/** 令牌过期后的余量：与登录页的本地预判保持一致，避免临界点反复失效。 */
const EXPIRY_SKEW_MS = 30_000;

function store(): Storage {
  return (globalThis as unknown as { localStorage: Storage }).localStorage;
}

/** 读 JWT 的 exp（毫秒时间戳）；解析失败按 0（已过期）处理。 */
export function tokenExpiresAt(token: string): number {
  try {
    const part = (token.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const json = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
      ),
    );
    return Number(json.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

/** 令牌是否可用：存在且未过期（含余量）。 */
export function isTokenUsable(token: string, skewMs: number = EXPIRY_SKEW_MS): boolean {
  return !!token && tokenExpiresAt(token) > Date.now() + skewMs;
}

/** 读某个会话槽；无令牌返回 null。 */
export function readSession(kind: SessionKind): SessionState | null {
  const slot = SLOT_KEYS[kind];
  const token = store().getItem(slot.token) || '';
  if (!token) return null;
  const state = { kind, token, usable: isTokenUsable(token) } as SessionState;
  for (const field of SESSION_FIELDS) {
    state[field] = store().getItem(`${slot.prefix}${field}`) || '';
  }
  return state;
}

/** 当前活动会话的来源；'' 表示没有活动会话。 */
export function activeKind(): SessionKind | '' {
  const kind = store().getItem(ACTIVE_KIND_KEY) || '';
  return kind === 'wms' || kind === 'pdf_agent' ? kind : '';
}

/** 当前活动会话（读镜像）；没有活动会话返回 null。 */
export function activeSession(): SessionState | null {
  const kind = activeKind();
  if (!kind) return null;
  const token = store().getItem(ACTIVE_TOKEN_KEY) || '';
  if (!token) return null;
  const state = { kind, token, usable: isTokenUsable(token) } as SessionState;
  for (const field of SESSION_FIELDS) {
    state[field] = store().getItem(field) || '';
  }
  return state;
}

/** 把某个会话槽的内容写进活动镜像（切会话用）。 */
function applyMirror(state: SessionState): void {
  const s = store();
  s.setItem(ACTIVE_TOKEN_KEY, state.token);
  s.setItem(ACTIVE_KIND_KEY, state.kind);
  for (const field of SESSION_FIELDS) {
    s.setItem(field, state[field] || '');
  }
}

/**
 * 保存会话：写自己的槽，并同步为活动会话。
 * payload 至少要有 token；其余为展示字段。
 */
export function saveSession(
  kind: SessionKind,
  payload: { token: string } & Partial<Record<SessionField, string>>,
): SessionState {
  const slot = SLOT_KEYS[kind];
  const s = store();
  s.setItem(slot.token, payload.token);
  const state = {
    kind,
    token: payload.token,
    operator_id: payload.operator_id || '',
    operator_name: payload.operator_name || '',
    operator_type: payload.operator_type || '',
    company_id: payload.company_id || '',
    login_name: payload.login_name || '',
    usable: isTokenUsable(payload.token),
  } as SessionState;
  for (const field of SESSION_FIELDS) {
    s.setItem(`${slot.prefix}${field}`, state[field]);
  }
  applyMirror(state);
  return state;
}

/**
 * 切换到另一个已保存的会话：把该槽恢复为活动会话。
 * 槽不存在或令牌已过期返回 null（调用方据此走重新登录）。
 */
export function activateSession(kind: SessionKind): SessionState | null {
  const state = readSession(kind);
  if (!state || !state.usable) return null;
  applyMirror(state);
  return state;
}

/** 清某个会话槽；若是活动会话，连带清掉活动镜像。 */
export function clearSession(kind: SessionKind): void {
  const slot = SLOT_KEYS[kind];
  const s = store();
  s.removeItem(slot.token);
  for (const field of SESSION_FIELDS) {
    s.removeItem(`${slot.prefix}${field}`);
  }
  if (activeKind() === kind) {
    s.removeItem(ACTIVE_TOKEN_KEY);
    s.removeItem(ACTIVE_KIND_KEY);
    for (const field of SESSION_FIELDS) {
      s.removeItem(field);
    }
  }
}

// ── 会话失效通知 ──────────────────────────────────────
// 会话失效要跳哪个登录页由路由决定，但会话模块不能反向依赖路由（会成环），
// 故用回调注册：应用入口注册一次，其余模块只管触发。

type ExpiredHandler = (kind: SessionKind) => void;

let expiredHandler: ExpiredHandler | null = null;

export function onSessionExpired(handler: ExpiredHandler): void {
  expiredHandler = handler;
}

/** 会话已失效：清掉该会话并通知路由跳登录页。 */
export function handleSessionExpired(kind: SessionKind): void {
  clearSession(kind);
  expiredHandler?.(kind);
}

/** 请求头：按当前活动会话带令牌；没有会话就不带 Authorization。 */
export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = activeSession()?.token || '';
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}
