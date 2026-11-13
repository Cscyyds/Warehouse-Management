/**
 * PDF 链路的统一请求出口。
 *
 * 为什么需要：PDF 链路历史上用裸 fetch，不经过 axios 拦截器，令牌过期时
 * 前端感知不到——只会在某一个接口弹一句后端原文（如"登录令牌已过期"），
 * 页面继续停留在失效会话里。这里统一兜住：请求带了令牌却收到 401，就判定
 * 会话失效，清掉该会话并通知路由跳对应登录页。
 *
 * 会话读写与有效性判定见 utils/session.ts（单一来源）。
 */
import { activeKind, authHeaders, handleSessionExpired } from './session';

export { authHeaders };

/** 走本包装的请求是否带了令牌（没带令牌的 401 是"本来就没登录"，不该清会话）。 */
function sentAuthorization(init?: RequestInit): boolean {
  try {
    return new Headers(init?.headers || {}).has('Authorization');
  } catch {
    return false;
  }
}

/** PDF 链路统一 fetch：401 且请求带了令牌 → 判定会话失效。 */
export async function pdfFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const resp = await fetch(input, init);
  if (resp.status === 401 && sentAuthorization(init)) {
    const kind = activeKind();
    if (kind) handleSessionExpired(kind);
  }
  return resp;
}
