/**
 * 守卫：源码中「真实发出的」/api/v1/* 请求是否都在权限字典中登记。
 *
 * 为什么需要这道守卫：
 *   前端 v-perm 在端点未登记时 **fail-open**（按钮照常显示，仅 DEV 下 console.warn），
 *   后端 require_tenant_employee_access 的配置完整性校验却 **fail-closed**
 *   （sys_api_function 查不到路径+方法 → 403「功能暂不可用」，对管理员同样生效）。
 *   于是未登记端点的表现是「按钮看得见、点下去报错」，很容易长期潜伏。
 *
 * 与 permissionUrlMap.test.mjs 的分工：
 *   那道守卫只扫 .vue 里的 `v-perm="'...'"` 字面量，扫不到 api/modules 里真正发出的请求，
 *   也发现不了「页面调了接口却没写 v-perm」。本守卫补的就是这一段。
 *
 * 运行：npm run test:api-perm-coverage
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(HERE, '..')
const GENERATED_FILE = join(HERE, 'permissionUrlMap.generated.ts')
const OVERRIDES_FILE = join(HERE, 'permissionUrlMap.ts')

/**
 * 有意不做按钮级权限控制的端点：认证 / 公共能力。
 * 这些接口后端不走 sys_api_function 配置校验，登记反而会阻断登录等基础流程。
 */
const INTENTIONALLY_UNREGISTERED = [
  'GET /api/v1/captcha',
  'POST /api/v1/verification-codes/send',
  'GET /api/v1/amap/divisions',
  'GET /api/v1/tenant-employees/my-permissions',
]

/**
 * 已知缺口基线：确实未登记、且属于待修项。
 * 修好一项就删一行——测试会校验「清单与实测结果完全一致」，
 * 既防止清单腐烂，也强制在缺口修复后同步收敛。
 */
const KNOWN_GAPS = [
  'GET /api/v1/tenant-admin-users/detail',
  'PUT /api/v1/tenant-admin-users/*',
  'POST /api/v1/platform-organizations',
  'POST /api/v1/platform-posts',
  'POST /api/v1/tenant-customers/prepayment-logs',
]

/** 直接正则抽取字典 key，避免测试依赖 TS 加载器 */
function readEndpointKeys(filePath, sectionMarker) {
  const text = readFileSync(filePath, 'utf8')
  const start = sectionMarker ? text.indexOf(sectionMarker) : 0
  const section = start >= 0 ? text.slice(start) : text
  const keys = new Set()
  for (const matched of section.matchAll(/^\s{2}'([A-Z]+ \/[^']*)':/gm)) keys.add(matched[1])
  return keys
}

function collectSourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      out.push(...collectSourceFiles(full))
    } else if (/\.(ts|vue|js)$/.test(entry) && !entry.endsWith('.test.mjs')) {
      out.push(full)
    }
  }
  return out
}

/** 抽取 get/post/put/del('...') 形式的 /api/v1/* 调用，模板变量归一化为通配 */
function extractCalls(text) {
  const out = []
  const re = /\b(get|post|put|del|delete|patch)\s*(?:<[^>()]*>)?\s*\(\s*(['"`])(\/api\/v1\/[^'"`]*)\2/g
  for (const matched of text.matchAll(re)) {
    const method = matched[1].toUpperCase() === 'DELETE' ? 'DEL' : matched[1].toUpperCase()
    const path = matched[3].replace(/\$\{[^}]*\}/g, '*').split('?')[0].replace(/\/+$/, '')
    out.push({ method, path })
  }
  return out
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 双向通配匹配：字典侧或调用侧任一带 * 均可命中 */
function matches(pattern, path) {
  if (pattern === path) return true
  if (!pattern.includes('*') && !path.includes('*')) return false
  const asRe = (p) => new RegExp('^' + escapeRe(p).replace(/\\\*/g, '[^/]*') + '$')
  return asRe(pattern).test(path) || asRe(path).test(pattern)
}

const registered = new Set([
  ...readEndpointKeys(GENERATED_FILE, 'API_PERM_BY_ENDPOINT'),
  ...readEndpointKeys(OVERRIDES_FILE, 'ENDPOINT_PERM_OVERRIDES'),
])

function isCovered(method, path) {
  for (const key of registered) {
    const [keyMethod, keyPath] = key.split(' ')
    if (keyMethod !== method) continue
    if (matches(keyPath, path)) return true
  }
  return false
}

/** 扫描全量源码，返回未登记端点的稳定排序清单 */
function collectUnregistered() {
  const seen = new Map()
  for (const file of collectSourceFiles(SRC_DIR)) {
    const text = readFileSync(file, 'utf8')
    for (const { method, path } of extractCalls(text)) {
      const key = `${method} ${path}`
      if (isCovered(method, path)) continue
      if (!seen.has(key)) seen.set(key, [])
      seen.get(key).push(relative(SRC_DIR, file).replace(/\\/g, '/'))
    }
  }
  return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

const unregistered = collectUnregistered()

test('权限字典可用（条目数量与同路径多方法区分）', () => {
  assert.ok(registered.size > 100, `字典条目过少：${registered.size}`)
  assert.ok(registered.has('GET /api/v1/tenant-visit-tasks'))
  assert.ok(registered.has('POST /api/v1/tenant-visit-tasks'))
})

test('没有出现「基线之外」的未登记端点', () => {
  const allowed = new Set([...INTENTIONALLY_UNREGISTERED, ...KNOWN_GAPS])
  const fresh = unregistered.filter(([key]) => !allowed.has(key))
  assert.deepEqual(
    fresh.map(([key, files]) => `${key}  ← ${files.join(', ')}`),
    [],
    '以下端点在源码中被调用，但既未登记权限字典、也不在白名单/基线中：\n' +
      '请在 nuomi_wms/docs/菜单按钮功能权限初始化SQL.md 追加 button+api+permission 三件套，' +
      '再运行 npm run gen:perm-url-map；若确属无需权限的公共接口，请加入 INTENTIONALLY_UNREGISTERED。'
  )
})

test('基线清单与实测结果一致（修好后需同步收敛）', () => {
  const actual = unregistered.map(([key]) => key)
  const declared = [...KNOWN_GAPS].sort((a, b) => a.localeCompare(b))
  const alreadyFixed = declared.filter((key) => !actual.includes(key))
  const undeclared = actual.filter((key) => !declared.includes(key) && !INTENTIONALLY_UNREGISTERED.includes(key))
  assert.deepEqual(
    { alreadyFixed, undeclared },
    { alreadyFixed: [], undeclared: [] },
    'KNOWN_GAPS 已与实测不符：alreadyFixed 表示缺口已修复、请从清单删除；undeclared 表示出现新缺口、请补登记。'
  )
})

test('基线缺口清单保持可见（仅提示，不失败）', () => {
  if (KNOWN_GAPS.length) {
    console.log(`\n[api-perm-coverage] 待修缺口 ${KNOWN_GAPS.length} 项：`)
    for (const [key, files] of unregistered) {
      if (KNOWN_GAPS.includes(key)) console.log(`  - ${key}  ← ${files.join(', ')}`)
    }
  }
})
