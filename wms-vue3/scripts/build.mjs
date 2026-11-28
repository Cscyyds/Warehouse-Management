import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const env = { ...process.env }
if (process.platform === 'win32') {
  // esbuild may be unable to remove files from the Windows system temp directory.
  const tempDir = resolve('node_modules/.cache/wms-build-temp')
  mkdirSync(tempDir, { recursive: true })
  env.TEMP = tempDir
  env.TMP = tempDir
}

for (const args of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', '-b'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.config.ts'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
