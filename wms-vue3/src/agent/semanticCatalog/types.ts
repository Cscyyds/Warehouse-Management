export interface AgentSemanticCapability {
  id: string
  kind: 'read' | 'write'
  description: string
  keywords: string[]
}

export interface AgentSemanticPageMetadata {
  description: string
  keywords: string[]
  intentExamples: string[]
  excludedIntents: string[]
  capabilities?: AgentSemanticCapability[]
  agentPageId?: string
}

export type AgentSemanticPageMap = Record<string, AgentSemanticPageMetadata>

export function semanticPage(
  description: string,
  keywords: string[],
  intentExamples: string[],
  excludedIntents: string[] = [],
  extra: Pick<AgentSemanticPageMetadata, 'capabilities' | 'agentPageId'> = {},
): AgentSemanticPageMetadata {
  return {
    description,
    keywords,
    intentExamples,
    excludedIntents,
    ...extra,
  }
}
