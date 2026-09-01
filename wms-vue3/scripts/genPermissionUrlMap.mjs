/**
 * 从后端权限初始化 SQL 生成前端「接口 URL → perm_code」字典。
 *
 * 数据源：nuomi_wms/docs/菜单按钮功能权限初始化SQL.md
 * 产物：  src/config/permissionUrlMap.generated.ts
 *
 * 关联链：sys_permission.function_id（单值或 JSON 数组）
 *         → sys_api_function.api_id → api_path + http_method
 *
 * 运行：npm run gen:perm-url-map
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SQL_FILE = resolve(HERE, '../../../nuomi_wms/docs/菜单按钮功能权限初始化SQL.md')
const OUT_FILE = resolve(HERE, '../src/config/permissionUrlMap.generated.ts')

/** wms-vue3 只消费 WMS 平台归属，WMS_SCANNER 属扫码枪端 */
const OWNER = 'WMS_PLATFORM'

/** 拆分 SQL VALUES 元组：按顶层逗号切分，正确处理 '' 转义与括号嵌套 */
function splitSqlTuple(body) {
  const out = []
  let buf = ''
  let inStr = false
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") { buf += "''"; i++; continue }
        inStr = false
      }
      buf += ch
      continue
    }
    if (ch === "'") { inStr = true; buf += ch; continue }
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; continue }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

/** SQL 字面量 → JS 值；NULL/函数调用返回 null */
function parseSqlValue(raw) {
  const token = raw.trim()
  if (/^null$/i.test(token)) return null
  if (token.startsWith("'")) return token.slice(1, -1).replace(/''/g, "'")
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token)
  return null
}

/** 解析 INSERT 语句为 { 列名: 值 }，列数与值数不匹配时返回 null */
function parseInsert(line) {
  const matched = line.match(/^INSERT\s+(?:IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\);?\s*$/i)
  if (!matched) return null
  const [, table, columnPart, valuePart] = matched
  const columns = columnPart.split(',').map(col => col.trim())
  const values = splitSqlTuple(valuePart)
  if (columns.length !== values.length) return null
  const row = {}
  columns.forEach((col, idx) => { row[col] = parseSqlValue(values[idx]) })
  return { table, row }
}

/** 解析 `DELETE FROM t WHERE col IN (...)`（可跨行，调用方已拼成单行） */
function parseDelete(statement) {
  const matched = statement.match(/^DELETE\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s+IN\s*\((.*)\)\s*;?\s*$/is)
  if (!matched) return null
  const [, table, column, listPart] = matched
  const ids = splitSqlTuple(listPart).map(parseSqlValue).filter(Boolean)
  return { table, column, ids }
}

/** function_id 兼容单值（'api_x'）与 JSON 数组（'["api_x","api_y"]'） */
function parseFunctionIds(raw) {
  if (!raw) return []
  const text = String(raw).trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
      return []
    }
  }
  return [text]
}

/** 端点 key：`METHOD /path`，去 query 与末尾斜杠 */
function endpointKey(method, path) {
  const cleanPath = String(path).split('?')[0].replace(/\/+$/, '') || '/'
  return `${String(method).toUpperCase()} ${cleanPath}`
}

/** 按 `;` 结尾聚合成完整语句：文档中 DELETE ... IN (...) 跨多行书写 */
function* iterateStatements(sqlText) {
  let buffer = ''
  for (const rawLine of sqlText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('--')) continue
    buffer = buffer ? `${buffer} ${line}` : line
    if (line.endsWith(';')) {
      yield buffer
      buffer = ''
    }
  }
  if (buffer) yield buffer
}

/**
 * 顺序回放 SQL：INSERT 累积、DELETE 撤销，保证与最终库态一致
 * （文档末尾有打印机权限的整段 DELETE 修订）。
 */
function replaySql(sqlText) {
  const apis = new Map()   // api_id → { path, method, name, desc }
  const perms = new Map()  // perm_code → { permName, functionIds }

  for (const statement of iterateStatements(sqlText)) {
    const inserted = parseInsert(statement)
    if (inserted) {
      const { table, row } = inserted
      if (row.permission_owner !== OWNER) continue
      if (table === 'sys_api_function' && row.api_id && row.api_path) {
        apis.set(String(row.api_id), {
          path: String(row.api_path),
          method: String(row.http_method || 'POST'),
          name: String(row.api_name || row.api_id),
          desc: String(row.api_function || ''),
        })
      } else if (table === 'sys_permission' && row.perm_code) {
        perms.set(String(row.perm_code), {
          permName: String(row.perm_name || row.perm_code),
          functionIds: parseFunctionIds(row.function_id),
        })
      }
      continue
    }
    const deleted = parseDelete(statement)
    if (!deleted) continue
    if (deleted.table === 'sys_api_function' && deleted.column === 'api_id') {
      deleted.ids.forEach(id => apis.delete(id))
    } else if (deleted.table === 'sys_permission' && deleted.column === 'perm_code') {
      deleted.ids.forEach(code => perms.delete(code))
    }
  }
  return { apis, perms }
}

/** 聚合成端点视图：一个端点可被多个 perm_code 覆盖（命中任一即有权） */
function buildEndpointIndex({ apis, perms }) {
  const index = new Map() // endpoint → { apiIds:Set, permCodes:Set, permNames:Set, descs:Set }
  for (const [permCode, perm] of perms) {
    for (const apiId of perm.functionIds) {
      const api = apis.get(apiId)
      if (!api) continue // 权限指向按钮 ID 或已删接口，无 URL 可绑
      const key = endpointKey(api.method, api.path)
      const entry = index.get(key) || { apiIds: new Set(), permCodes: new Set(), permNames: new Set(), descs: new Set() }
      entry.apiIds.add(apiId)
      entry.permCodes.add(permCode)
      entry.permNames.add(perm.permName)
      if (api.desc) entry.descs.add(api.desc)
      index.set(key, entry)
    }
  }
  return index
}

const quote = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function renderFile(index) {
  const keys = [...index.keys()].sort()
  const permLines = keys.map(key => {
    const codes = [...index.get(key).permCodes].sort().map(quote).join(', ')
    return `  ${quote(key)}: [${codes}],`
  })
  const metaLines = keys.map(key => {
    const entry = index.get(key)
    const apiIds = [...entry.apiIds].sort().map(quote).join(', ')
    const permNames = [...entry.permNames].sort().map(quote).join(', ')
    const desc = quote([...entry.descs].sort().join(' / '))
    return `  ${quote(key)}: { apiIds: [${apiIds}], permNames: [${permNames}], desc: ${desc} },`
  })

  return `/**
 * 【自动生成，请勿手改】接口 URL → 权限码字典
 *
 * 生成命令：npm run gen:perm-url-map
 * 数据源：  nuomi_wms/docs/菜单按钮功能权限初始化SQL.md（permission_owner=${OWNER}）
 *
 * key 形如 \`METHOD /path\`：同一路径可能挂不同 HTTP 方法的独立权限
 * （例：\`GET /api/v1/tenant-visit-tasks\` 与 \`POST /api/v1/tenant-visit-tasks\`）。
 * 后端 my-permissions 只返回 perm_code，不返回 api_path，故映射关系必须由前端持有。
 */

/** 端点 → 可放行的权限码集合（命中任一即视为有权） */
export const API_PERM_BY_ENDPOINT: Record<string, string[]> = {
${permLines.join('\n')}
}

/** 端点元信息：仅用于排查与 IDE 提示，不参与权限判定 */
export const API_META_BY_ENDPOINT: Record<string, { apiIds: string[]; permNames: string[]; desc: string }> = {
${metaLines.join('\n')}
}
`
}

const sqlText = readFileSync(SQL_FILE, 'utf8')
const replayed = replaySql(sqlText)
const endpointIndex = buildEndpointIndex(replayed)
mkdirSync(dirname(OUT_FILE), { recursive: true })
writeFileSync(OUT_FILE, renderFile(endpointIndex), 'utf8')

const boundPerms = new Set()
for (const entry of endpointIndex.values()) entry.permCodes.forEach(code => boundPerms.add(code))
console.log(`[perm-url-map] 接口 ${replayed.apis.size} 个，权限 ${replayed.perms.size} 个`)
console.log(`[perm-url-map] 生成端点 ${endpointIndex.size} 个，覆盖权限 ${boundPerms.size} 个`)
console.log(`[perm-url-map] 输出 ${OUT_FILE}`)
