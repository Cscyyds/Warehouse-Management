import axios from 'axios'
import { SCANNER_API_BASE_URL } from './scannerPrint'
import { activeSession } from '@/utils/session'

export interface SimpleModeStatus {
  simple_mode_enabled: boolean
  simple_mode_revision?: number
}

/** 扫码服务的只读能力查询；不走主工程8000路由，也不把扫码服务401当作主站退出。 */
export async function getSimpleModeStatus(): Promise<SimpleModeStatus> {
  const token = activeSession()?.token
  const response = await axios.get('/api/v1/tenant-wms/simple-mode/status', {
    baseURL: SCANNER_API_BASE_URL,
    timeout: 10000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const body = response.data
  if (body?.success === false || typeof body?.data?.simple_mode_enabled !== 'boolean') {
    throw new Error(body?.message || '简易模式状态响应无效')
  }
  return body.data
}
