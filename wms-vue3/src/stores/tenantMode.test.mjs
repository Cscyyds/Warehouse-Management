import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { createPinia, setActivePinia } = require('pinia')
const { build } = require('esbuild')
const root = fileURLToPath(new URL('../', import.meta.url))
const bundle = await build({
  entryPoints: [path.join(root, 'stores/tenantMode.ts')], bundle: true, write: false,
  platform: 'node', format: 'cjs', external: ['vue', 'pinia'],
  plugins: [{ name: 'mock-profile-network', setup(b) {
    b.onResolve({ filter: /^@\/api\/modules\/personnel$/ }, () => ({ path: 'profile', namespace: 'mock' }))
    b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const getMyProfile = () => globalThis.__tenantModeProfileRequest()' }))
    b.onResolve({ filter: /^@\// }, args => ({ path: path.join(root, args.path.slice(2)) + '.ts' }))
  } }],
})
const mod = { exports: {} }
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, mod, mod.exports)
const { useTenantModeStore } = mod.exports
const local = { tenant_mode: 'LOCAL', tenant_mode_revision: 2, available_modules: ['PURCHASE_SALES', 'FINANCE', 'PRODUCTION'] }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { resolve, promise } }
beforeEach(() => {
  const values = new Map([['token', 'a']])
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
  globalThis.sessionStorage = { removeItem() {} }
  setActivePinia(createPinia())
})
test('simultaneous module loads share one current-user request', async () => {
  let calls = 0; const response = deferred()
  globalThis.__tenantModeProfileRequest = () => { calls++; return response.promise }
  const store = useTenantModeStore()
  const a = store.load(), b = store.load()
  assert.equal(calls, 1)
  response.resolve({ data: local }); await Promise.all([a, b])
  assert.equal(store.mode, 'LOCAL'); assert.equal(store.revision, 2)
  assert.deepEqual([...store.availableModules], local.available_modules)
})
test('null or missing mode never defaults to LOCAL', async () => {
  globalThis.__tenantModeProfileRequest = async () => ({ data: { ...local, tenant_mode: null } })
  const store = useTenantModeStore(); await store.load()
  assert.equal(store.mode, null); assert.ok(store.loadError); assert.deepEqual([...store.availableModules], [])
})
test('late responses from a previous account cannot replace the new tenant', async () => {
  const old = deferred()
  globalThis.__tenantModeProfileRequest = () => old.promise
  const store = useTenantModeStore(); const pending = store.load()
  localStorage.setItem('token', 'b')
  globalThis.__tenantModeProfileRequest = async () => ({ data: { ...local, tenant_mode: 'TIANXIN', available_modules: ['BORROW'] } })
  await store.load()
  old.resolve({ data: local }); await pending
  assert.equal(store.mode, 'TIANXIN'); assert.deepEqual([...store.availableModules], ['BORROW'])
})
test('logout invalidates in-flight mode and a forced reload can recover', async () => {
  const response = deferred(); globalThis.__tenantModeProfileRequest = () => response.promise
  const store = useTenantModeStore(); const pending = store.load()
  store.reset(); response.resolve({ data: local }); await pending
  assert.equal(store.mode, null); assert.equal(store.isLoaded, false)
  globalThis.__tenantModeProfileRequest = async () => ({ data: local })
  await store.load(true); assert.equal(store.mode, 'LOCAL')
})
