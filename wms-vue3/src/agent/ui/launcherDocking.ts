export type LauncherDockSide = 'left' | 'right' | null

export function resolveLauncherDockSide(
  x: number,
  launcherWidth: number,
  viewportWidth: number,
  threshold: number,
): LauncherDockSide {
  const leftGap = Math.max(0, x)
  const rightGap = Math.max(0, viewportWidth - x - launcherWidth)
  const nearestGap = Math.min(leftGap, rightGap)
  if (nearestGap > threshold) return null
  return leftGap <= rightGap ? 'left' : 'right'
}

export function getDockedLauncherX(
  side: Exclude<LauncherDockSide, null>,
  launcherWidth: number,
  viewportWidth: number,
): number {
  return side === 'left' ? 0 : Math.max(0, viewportWidth - launcherWidth)
}
