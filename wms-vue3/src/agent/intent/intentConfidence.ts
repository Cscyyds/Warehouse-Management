export interface ScoredIntentCandidate<T> {
  score: number
  value: T
}

export interface IntentConfidencePolicy {
  minimumScore: number
  minimumGap: number
}

export type IntentConfidenceDecision<T> =
  | { kind: 'confident'; top: ScoredIntentCandidate<T>; second?: ScoredIntentCandidate<T> }
  | { kind: 'ambiguous'; candidates: ScoredIntentCandidate<T>[] }
  | { kind: 'insufficient'; candidates: ScoredIntentCandidate<T>[] }

export const defaultIntentConfidencePolicy: IntentConfidencePolicy = {
  minimumScore: 120,
  minimumGap: 15,
}

export function decideIntentConfidence<T>(
  candidates: ScoredIntentCandidate<T>[],
  policy: IntentConfidencePolicy = defaultIntentConfidencePolicy,
): IntentConfidenceDecision<T> {
  const ranked = [...candidates].sort((left, right) => right.score - left.score)
  const top = ranked[0]
  const second = ranked[1]

  if (!top || top.score < policy.minimumScore) {
    return { kind: 'insufficient', candidates: ranked }
  }

  if (second && top.score - second.score < policy.minimumGap) {
    return { kind: 'ambiguous', candidates: ranked }
  }

  return { kind: 'confident', top, second }
}
