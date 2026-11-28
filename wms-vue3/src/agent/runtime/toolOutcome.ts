export type WmsToolOutcomeSeverity = 'success' | 'incomplete' | 'error'

export interface WmsToolOutcome {
  marker: 'wms-tool-outcome'
  ok: boolean
  severity: WmsToolOutcomeSeverity
  code: string
  message: string
  pageId?: string
  mode?: 'list' | 'create'
  actionId?: string
}

type NewWmsToolOutcome = Omit<WmsToolOutcome, 'marker'>

export function serializeWmsToolOutcome(outcome: NewWmsToolOutcome): string {
  return JSON.stringify({ marker: 'wms-tool-outcome', ...outcome } satisfies WmsToolOutcome)
}

export function parseWmsToolOutcome(value: unknown): WmsToolOutcome | undefined {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return undefined

  try {
    const parsed = JSON.parse(value) as Partial<WmsToolOutcome>
    if (
      parsed.marker !== 'wms-tool-outcome'
      || typeof parsed.ok !== 'boolean'
      || !['success', 'incomplete', 'error'].includes(String(parsed.severity))
      || typeof parsed.code !== 'string'
      || typeof parsed.message !== 'string'
    ) {
      return undefined
    }
    return parsed as WmsToolOutcome
  } catch {
    return undefined
  }
}
