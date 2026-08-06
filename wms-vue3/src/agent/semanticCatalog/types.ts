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
  synonyms?: string[]
}

export type AgentSemanticPageMap = Record<string, AgentSemanticPageMetadata>

export function semanticPage(
  description: string,
  keywords: string[],
  intentExamples: string[],
  excludedIntents: string[] = [],
  extra: Pick<AgentSemanticPageMetadata, 'capabilities' | 'agentPageId' | 'synonyms'> = {},
): AgentSemanticPageMetadata {
  return {
    description,
    keywords,
    intentExamples,
    excludedIntents,
    ...extra,
  }
}
