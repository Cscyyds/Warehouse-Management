export type AgentFormPageMode = 'create' | 'edit' | 'readonly'

export interface AgentFormPageIdentity {
  id: string
  title: string
  mode: AgentFormPageMode
  description: string
}

export interface AgentFormPageQuery {
  type?: unknown
  mode?: unknown
  readonly?: unknown
  title?: unknown
}

// /common/add 一个路由承载全部业务表单（设计文档 §11.4.3）：页面身份由
// route.query 的 type 与 mode 推导；缺 type 时无法定位业务场景，不注册。
export function deriveAgentFormPageIdentity(
  query: AgentFormPageQuery,
): AgentFormPageIdentity | undefined {
  const type = typeof query.type === 'string' ? query.type.trim() : ''
  if (!type) return undefined

  const title = typeof query.title === 'string' && query.title.trim()
    ? query.title.trim()
    : '业务表单'
  const mode: AgentFormPageMode = query.readonly === '1'
    ? 'readonly'
    : query.mode === 'edit'
      ? 'edit'
      : 'create'

  return {
    id: `${type}.form`,
    title,
    mode,
    description: `用于填写「${title}」业务表单（模式：${mode}）；列表查询请使用对应的列表页面。`,
  }
}
