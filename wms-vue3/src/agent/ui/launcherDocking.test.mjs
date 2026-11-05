import assert from 'node:assert/strict'
import test from 'node:test'
import { getDockedLauncherX, resolveLauncherDockSide } from './launcherDocking.ts'

test('docks to the nearest horizontal edge within the threshold', () => {
  assert.equal(resolveLauncherDockSide(8, 120, 1200, 36), 'left')
  assert.equal(resolveLauncherDockSide(1060, 120, 1200, 36), 'right')
})

test('does not dock when the launcher is away from both edges', () => {
  assert.equal(resolveLauncherDockSide(540, 120, 1200, 36), null)
})

test('places a docked launcher flush with its selected edge', () => {
  assert.equal(getDockedLauncherX('left', 120, 1200), 0)
  assert.equal(getDockedLauncherX('right', 120, 1200), 1080)
})
