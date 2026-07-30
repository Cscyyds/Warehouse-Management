/**
 * 模块：高德地图行政区划（后端代理）
 * 源接口：app/api/v1/endpoints/tenant_amap.py
 * 功能：由后端持有高德 Key 并拉取省→市树，前端只调用此接口，避免 Key 泄露。
 */
import { get } from '@/utils/request'
import type { ApiResponse } from '@/utils/request'

/** 行政区划节点（与 tree-select 的 {name,value,children} 结构一致） */
export interface AmapRegionNode {
  name: string
  value: string
  children?: AmapRegionNode[]
}

/** 获取高德行政区划省→市树（subdistrict: 1=省，2=省+市，3=省+市+区） */
export function getAmapDivisions(params: {
  subdistrict?: number
}): Promise<ApiResponse<{ tree: AmapRegionNode[] }>> {
  return get<{ tree: AmapRegionNode[] }>('/api/v1/amap/divisions', params as Record<string, unknown>)
}
