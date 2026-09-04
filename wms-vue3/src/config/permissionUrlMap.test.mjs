/**
 * 一致性守卫：确保所有 .vue 中书写的 v-perm URL 都在权限字典里。
 *
 * URL 未登记时 v-perm 会 fail-open（不隐藏），拼错的 URL 不会报错、只会静默放行，
 * 因此这层断言是全量铺开后唯一能兜住拼写错误的手段。
 *
 * 运行：npm run test:perm-url-map
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const VIEWS_DIR = resolve(HERE, '../views')
const GENERATED_FILE = resolve(HERE, 'permissionUrlMap.generated.ts')
const OVERRIDES_FILE = resolve(HERE, 'permissionUrlMap.ts')

/** 直接正则抽取字典 key，避免测试依赖 TS 加载器 */
function readEndpointKeys(filePath, sectionMarker) {
  const text = readFileSync(filePath, 'utf8')
  const start = sectionMarker ? text.indexOf(sectionMarker) : 0
  const section = start >= 0 ? text.slice(start) : text
  const keys = new Set()
  for (const matched of section.matchAll(/^\s{2}'([A-Z]+ \/[^']*)':/gm)) keys.add(matched[1])
  return keys
}

function collectVueFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectVueFiles(full))
    else if (entry.endsWith('.vue')) out.push(full)
  }
  return out
}

/** 提取 v-perm="'...'" 中的字面量，跳过绑定表达式（如 v-perm="scene.endpoint"） */
function collectPermLiterals(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const out = []
  for (const matched of text.matchAll(/v-perm="'([^']+)'"/g)) out.push(matched[1])
  return out
}

const registered = new Set([
  ...readEndpointKeys(GENERATED_FILE, 'API_PERM_BY_ENDPOINT'),
  ...readEndpointKeys(OVERRIDES_FILE, 'ENDPOINT_PERM_OVERRIDES'),
])
const registeredPaths = new Set([...registered].map(key => key.split(' ')[1]))

test('生成字典非空且区分同路径不同方法', () => {
  assert.ok(registered.size > 100, `字典条目过少：${registered.size}`)
  assert.ok(registered.has('GET /api/v1/tenant-visit-tasks'))
  assert.ok(registered.has('POST /api/v1/tenant-visit-tasks'))
})

test('已废弃的 tenant-printers 权限不在字典中', () => {
  const stale = [...registered].filter(key => key.includes('/api/v1/tenant-printers'))
  assert.deepEqual(stale, [])
})

test('所有 .vue 中的 v-perm URL 均已登记', () => {
  const unregistered = []
  for (const file of collectVueFiles(VIEWS_DIR)) {
    for (const literal of collectPermLiterals(file)) {
      const isEndpoint = literal.startsWith('/') || /^[A-Za-z]+\s+\//.test(literal)
      if (!isEndpoint) continue // 旧关键词模式，由 hasButtonPerm 处理
      const [maybeMethod, maybePath] = literal.split(/\s+/)
      const hit = maybePath
        ? registered.has(`${maybeMethod.toUpperCase()} ${maybePath}`)
        : registeredPaths.has(literal)
      if (!hit) unregistered.push(`${file}: ${literal}`)
    }
  }
  assert.deepEqual(unregistered, [], `以下 v-perm URL 未在权限字典中登记：\n${unregistered.join('\n')}`)
})
