/**
 * 省份 + 城市数据源
 *
 * 两种数据源（互不替代、各自失败时明确报错）：
 *  - 行政区划：后端数据库，走 GET /api/v1/tenant-areas/query（树形）
 *  - 高德地图：由后端持有高德 Web 服务 Key 并拉取，前端只调 GET /api/v1/amap/divisions
 *              （Key 不暴露给前端，避免泄露）
 *
 * 通过 regionMode 切换；切换后立即按所选来源重新加载下拉数据。
 *
 * 节点结构（关键）：
 *  - name  ：下拉树中「可见」的短名（省份/城市），如「深圳市」「广东省」，用于还原层级显示。
 *  - label ：选中后输入框显示 + 选择项匹配用的完整路径「省 / 市」，如「广东省 / 深圳市」。
 *  - value ：提交值，完整路径「省 / 市」（与后端 city 字段纯文本格式兼容）。
 * 父级（省份）节点标记为 disabled，仅作分组标题，强制只能选到末级（市/区）。
 */
import { ref } from 'vue'
import { getAreaList } from '@/api/modules/area'
import { getAmapDivisions } from '@/api/modules/amap'

export type RegionMode = 'division' | 'amap'

/** 实际使用的数据源（供 UI 反馈） */
export const lastSource = ref<'division' | 'amap'>('division')

const MODE_KEY = 'wms_region_mode'

/** 当前数据源模式（响应式，供 UI 单选绑定）。仅接受合法值，避免旧缓存串档。 */
export const regionMode = ref<RegionMode>(
  localStorage.getItem(MODE_KEY) === 'amap' ? 'amap' : 'division',
)

export function setRegionMode(mode: RegionMode) {
  regionMode.value = mode
  localStorage.setItem(MODE_KEY, mode)
}

interface RegionNode {
  /** 下拉树可见短名（省/市） */
  name: string
  /** 选中后输入框显示的完整路径（省 / 市） */
  label: string
  /** 提交值：完整路径（省 / 市） */
  value: string
  children: RegionNode[]
  /** 父级（省份）节点置灰，仅作分组标题，禁止单独选中 */
  disabled?: boolean
}

/** 路径分隔符，与占位符「请选择省份 / 城市」保持一致 */
const SEP = ' / '

/**
 * 将任意「省→市」树形节点递归转换：
 *  - name ：自身短名（下拉树可见，用于还原层级）。
 *  - label/value ：「父路径 + 自身名」完整路径（如「广东省 / 深圳市」），
 *    输入框显示与提交值均为「省份 / 城市」。
 *  - 含子节点的节点（省份）标记为 disabled，仅末级（市/区）可选。
 */
function buildPathNode(raw: any, parentPath = ''): RegionNode {
  const ownName = raw?.area_name ?? raw?.name ?? raw?.value ?? ''
  const path = parentPath ? `${parentPath}${SEP}${ownName}` : ownName
  const rawChildren = Array.isArray(raw?.children) ? raw.children : []
  const children = rawChildren.length
    ? rawChildren.map((c: any) => buildPathNode(c, path))
    : []
  return {
    name: ownName,
    label: path,
    value: path,
    children,
    disabled: children.length > 0,
  }
}

/** 从后端行政区划接口加载树（省→市，可能含更深的区/街道层级） */
async function loadDivisionTree(): Promise<RegionNode[]> {
  const res = await getAreaList({ page_size: 100 })
  const list: any[] = res?.data?.area ?? []
  if (!Array.isArray(list) || list.length === 0) {
    lastSource.value = 'division'
    return []
  }
  lastSource.value = 'division'
  return list.map(item => buildPathNode(item))
}

/**
 * 从高德地图行政区划接口（后端代理 GET /api/v1/amap/divisions）加载 省→市 两级树。
 * 后端持有高德 Web 服务 Key，前端不接触 Key。
 */
async function loadAmapTree(): Promise<RegionNode[]> {
  const res = await getAmapDivisions({ subdistrict: 2 })
  const tree: any[] = res?.data?.tree ?? []
  if (!tree.length) throw new Error('高德返回为空')
  lastSource.value = 'amap'
  return tree.map(node => buildPathNode(node))
}

/**
 * 加载城市树（统一入口）
 * - 'division'：后端数据库行政区划（GET /api/v1/tenant-areas/query）
 * - 'amap'：高德 Web API（经后端代理 GET /api/v1/amap/divisions）
 * 任一失败都向上抛错，由调用方给出明确提示，不做静默替换。
 *
 * 返回的节点 name/label/value 含义见文件头说明。
 */
export async function loadCityTree(): Promise<RegionNode[]> {
  return regionMode.value === 'amap' ? await loadAmapTree() : await loadDivisionTree()
}
