/**
 * 一致性守卫：页面 → 权限码映射表的正确性。
 *
 * 为什么必须守卫：页面可见性判定是 fail-closed 的（查询类权限未命中 → 页面隐藏），
 * 映射表里写错一个 perm_code 不会报错，只会让某个页面对所有人永久消失。
 * 相比 v-perm 的 fail-open（拼错 = 不隐藏，可容忍），这里的错误静默且致命。
 *
 * 同时用纯数据模拟验收用例（「只绑创建组织」场景），不依赖 TS 加载器与后端接口。
 *
 * 运行：npm run test:page-perm
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE_MAP_FILE = resolve(HERE, 'pagePermissionMap.ts')
const MENU_MAP_FILE = resolve(HERE, 'menuPermissionMap.ts')
const GENERATED_FILE = resolve(HERE, 'permissionUrlMap.generated.ts')

/**
 * 合法共享 view 权限的页面组合（页面的 title 集合，view 码归属精确匹配该集合即放行）：
 * 1. 同页面双标题别名：侧边栏标签与路由 meta.title 措辞不同（如「客户类型」/「客户类型设定」），
 *    本质是同一页面，共享 view 是正确语义；
 * 2. 同资源双页面（打印机设备页已废弃移除，现存仅客户类型等别名对）。
 * 出现其它 view 归属冲突时守卫报错，新增合法共享必须先在此登记，避免复制粘贴错误混进来。
 */
const SHARED_VIEW_ALLOWED = [
  // 别名双标题页面（同页两措辞，绑定共用分组）
  ['客户类型', '客户类型设定'],
  ['客户资料', '正式客户信息'],
  ['区域管理', '区域管理设定'],
  ['滞销产品', '滞销产品表'],
  ['对账单', '对账单管理'],
  // 跨页共享查询码一律走 deps（不进 view 组），不产生 view 归属冲突——
  // 出现其它冲突说明有人把跨页码放回了 view 组，应改为 deps 引用
]

/** 抽取 `const XXX_VIEW/XXX_WRITE = ['perm_...']` 形式的权限码分组（避免匹配注释里的说明文字） */
function readPermGroups(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const groups = {}
  for (const matched of text.matchAll(/^const ([A-Z][A-Z0-9_]*) = \[([^\]]*)\]/gm)) {
    const codes = [...matched[2].matchAll(/'([^']+)'/g)].map(m => m[1])
    if (codes.length && codes.every(code => code.startsWith('perm_'))) {
      groups[matched[1]] = codes
    }
  }
  return groups
}

/** 抽取页面标题 → 权限码分组名的绑定（如 '组织机构管理': { view: EMP_ORG_VIEW, ... }） */
function readPageBindings(filePath, groups) {
  const text = readFileSync(filePath, 'utf8')
  const bindings = {}
  // deps: 可选，格式 deps: [...DEP_X, ...DEP_Y]（跨页依赖分组引用，全部为大写常量）
  for (const matched of text.matchAll(/^\s{2}'([^']+)': \{ view: ([A-Z][A-Z0-9_]*)(?:, deps: \[(.*?)\], all:|\s*, all:)(.*?)\ \}/gm)) {
    const [, title, viewRef, depsExpr = '', allExpr] = matched
    const refsOf = expr => [...expr.matchAll(/([A-Z][A-Z0-9_]*)/g)].map(m => m[1])
    const all = refsOf(allExpr).flatMap(ref => groups[ref] || [])
    const deps = refsOf(depsExpr).flatMap(ref => groups[ref] || [])
    bindings[title] = { view: groups[viewRef] || [], deps, all }
  }
  return bindings
}

/** 后端字典里的全部 perm_code（映射表里的值必须都在这里，否则是拼写错误） */
function readKnownPermCodes(filePath) {
  const text = readFileSync(filePath, 'utf8')
  return new Set([...text.matchAll(/'(perm_[a-z0-9_]+)'/g)].map(m => m[1]))
}

/** 页面标题 → 模块菜单名（复用 menuPermissionMap 的真实映射） */
function readMenuByTitle(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const body = (text.match(/PAGE_MENU_BY_TITLE: Record<string, string> = \{([\s\S]*?)\n\}/) || [])[1] || ''
  const map = {}
  for (const matched of body.matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) map[matched[1]] = matched[2]
  return map
}

const groups = readPermGroups(PAGE_MAP_FILE)
const bindings = readPageBindings(PAGE_MAP_FILE, groups)
const knownCodes = readKnownPermCodes(GENERATED_FILE)
const menuByTitle = readMenuByTitle(MENU_MAP_FILE)

/** 纯数据版 isPageVisible，与 pagePermissionMap.ts 的实现保持同构 */
function visible(title, permCodes) {
  const menuName = menuByTitle[title]
  if (!menuName) return false // 模块菜单未映射（守卫：hasMenu 未命中）
  const binding = bindings[title]
  if (!binding || !binding.view.length) return true // 未登记 → 回退模块级
  return binding.view.some(code => permCodes.has(code))
}

test('映射表已登记且每个页面都有查询类权限', () => {
  assert.ok(Object.keys(bindings).length >= 55, `登记页面过少：${Object.keys(bindings).length}（应覆盖全部已映射模块）`)
  for (const [title, binding] of Object.entries(bindings)) {
    assert.ok(binding.view.length > 0, `${title} 缺少 view 权限，会导致页面永久不可见`)
  }
})

test('每个登记页面在 menuPermissionMap 都有模块归属', () => {
  const orphan = Object.keys(bindings).filter(title => !menuByTitle[title])
  assert.deepEqual(orphan, [], `以下页面未在 PAGE_MENU_BY_TITLE 登记，模块级判定会失败：\n${orphan.join('\n')}`)
})

test('所有权限码都是 perm_ 前缀且存在于后端字典（防拼写错误）', () => {
  const unknown = []
  for (const [title, binding] of Object.entries(bindings)) {
    for (const code of binding.all) {
      if (!code.startsWith('perm_')) unknown.push(`${title}: ${code}（非 perm_ 前缀）`)
      else if (!knownCodes.has(code)) unknown.push(`${title}: ${code}（后端字典不存在）`)
    }
  }
  assert.deepEqual(unknown, [], `映射表存在无效权限码：\n${unknown.join('\n')}`)
})

test('view 组是 all 组的子集', () => {
  for (const [title, binding] of Object.entries(bindings)) {
    const all = new Set(binding.all)
    const missing = binding.view.filter(code => !all.has(code))
    assert.deepEqual(missing, [], `${title} 的 view 未包含在 all 中：${missing.join(', ')}`)
  }
})

test('同一权限码不能同时作为多个页面的查询类权限（白名单除外）', () => {
  const owner = new Map()
  for (const [title, binding] of Object.entries(bindings)) {
    for (const code of binding.view) {
      if (!owner.has(code)) owner.set(code, new Set())
      owner.get(code).add(title)
    }
  }
  const conflicts = []
  for (const [code, titles] of owner) {
    if (titles.size < 2) continue
    const pages = [...titles].sort()
    const allowed = SHARED_VIEW_ALLOWED.some(entry => JSON.stringify([...entry].sort()) === JSON.stringify(pages))
    if (!allowed) conflicts.push(`${code} 同时属于：${pages.join('、')}`)
  }
  assert.deepEqual(conflicts, [], `查询类权限归属冲突（若属合法共享请在 SHARED_VIEW_ALLOWED 登记）：\n${conflicts.join('\n')}`)
})

test('验收用例：只绑「创建组织」时系统管理下所有页面都不可见', () => {
  const permCodes = new Set(['perm_api_emp_create_org'])
  const systemPages = ['人事资料管理', '组织机构管理', '岗位管理', '角色管理', '二级管理员', '行政区划', '访问日志', '在线用户']
  const visiblePages = systemPages.filter(title => visible(title, permCodes))
  assert.deepEqual(visiblePages, [], `严格语义失效，仍有页面可见：${visiblePages.join(', ')}`)
})

test('验收用例：绑定组织查询权限后只有组织机构管理可见', () => {
  const permCodes = new Set(['perm_api_emp_query_orgs'])
  const systemPages = ['人事资料管理', '组织机构管理', '岗位管理', '角色管理', '二级管理员', '行政区划', '访问日志', '在线用户']
  const visiblePages = systemPages.filter(title => visible(title, permCodes))
  assert.deepEqual(visiblePages, ['组织机构管理'], `实际可见：${visiblePages.join(', ')}`)
})

/**
 * 纯数据版 expandRolePermissionIds，与 pagePermissionMap.ts 的实现保持同构：
 * 触发器 = 本页自有码（all 去掉 deps）、匹配只对入参集做一轮（非迭代）、
 * 补全 = view + deps（不补同页其他写码，最小授权）。
 */
function expandSimulate(codes) {
  const original = new Set(codes)
  const picked = new Set(original)
  for (const binding of Object.values(bindings)) {
    const deps = binding.deps || []
    const trigger = binding.all.filter(code => !deps.includes(code))
    if (!trigger.some(code => original.has(code))) continue
    for (const code of binding.view) picked.add(code)
    for (const code of deps) picked.add(code)
  }
  return picked
}

test('联动：勾中写权限会自动带出同页查询权限', () => {
  const picked = expandSimulate(['perm_api_emp_create_org'])
  assert.ok(picked.has('perm_api_emp_query_orgs'), '联动未补出组织查询权限')
  assert.deepEqual(
    ['组织机构管理'].filter(t => visible(t, picked)),
    ['组织机构管理'],
    '联动补权后组织机构管理应可见'
  )
})

test('联动扩展用例：只绑「新增科目」时财务管理页面仅科目管理可见', () => {
  const picked = expandSimulate(['perm_api_fin_create_subject'])
  const financePages = ['科目管理', '银行账户', '其他收款', '收款单', '月结收款单', '预收款单', '付款单', '月结付款单', '预付款单', '其他付款']
  const visiblePages = financePages.filter(title => visible(title, picked))
  assert.deepEqual(visiblePages, ['科目管理'], `实际可见：${visiblePages.join(', ')}`)
})

test('联动依赖用例：勾「新增收款单」自动补出跨页依赖（科目/银行），取消后随之清除', () => {
  const picked = expandSimulate(['perm_api_fin_create_collection'])
  assert.ok(picked.has('perm_api_fin_query_subject'), '联动未补出跨页依赖：科目查询')
  assert.ok(picked.has('perm_api_fin_list_bank'), '联动未补出跨页依赖：银行账户查询')
  // 取消勾选（显式勾选集清空）→ 联动补出的码必须消失（否则树节点取消不掉）
  const cleared = expandSimulate([])
  assert.ok(!cleared.has('perm_api_fin_query_subject'), '取消勾选后科目查询仍被联动补回（无法取消问题）')
  assert.ok(!cleared.has('perm_api_fin_list_bank'), '取消勾选后银行账户查询仍被联动补回（无法取消问题）')
})

test('deps 组不得与 view 组重叠（deps 不参与页面可见性判定）', () => {
  const bad = []
  for (const [title, binding] of Object.entries(bindings)) {
    const overlap = (binding.deps || []).filter(code => binding.view.includes(code))
    if (overlap.length) bad.push(`${title}: ${overlap.join(', ')}`)
  }
  assert.deepEqual(bad, [], `以下页面的 deps 与 view 重叠（跨页码应只走 deps，可见性归归属页面）：\n${bad.join('\n')}`)
})

test('deps 组的每个码都必须有归属页面（在某个绑定的自有码中出现，保证树里有可见叶子）', () => {
  const homeless = []
  for (const [title, binding] of Object.entries(bindings)) {
    for (const code of binding.deps || []) {
      const hasHome = Object.values(bindings).some(other => {
        const otherDeps = other.deps || []
        const trigger = other.all.filter(c => !otherDeps.includes(c))
        return trigger.includes(code)
      })
      if (!hasHome) homeless.push(`${title}: ${code}`)
    }
  }
  assert.deepEqual(homeless, [], `以下 deps 码没有归属页面（叶子无处渲染，用户无法看到该权限）：\n${homeless.join('\n')}`)
})
