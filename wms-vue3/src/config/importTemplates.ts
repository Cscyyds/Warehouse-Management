/**
 * 批量导入示例模板（Excel）下载地址。
 *
 * 背景：这些模板原先作为静态资源放在 `public/templates/` 下随前端一起分发，
 * 现统一迁到百度云 BOS，与 `config/downloads.ts`（打印客户端安装包）是同一个桶。
 *
 * 取值：`VITE_DOWNLOAD_BASE_URL` 有值则用它（结尾斜杠会被规整掉），否则用下面内置的默认域名兜底，
 * 避免漏配时下载链接退化成站内相对路径（必然 404）。
 *
 * ⚠️ 各常量拼接的对象 Key 必须与云桶里的**实际文件名完全一致**（BOS 的 Key 区分大小写）。
 *    换模板版本时改这里的 Key 即可，无需动组件。
 * ⚠️ 用户下载时看到的中文文件名由调用方的 `template-name` 控制，与本文件无关。
 */

import type { ImportTaskType } from '@/api/modules/batchImport'

/** 百度云 BOS 桶地址（与 nuomi_wms/.env 的 BAIDU_BOS_ENDPOINT 保持一致） */
const DEFAULT_CLOUD_BASE = 'https://nuomiwms.gz.bcebos.com'

const TEMPLATE_BASE = (import.meta.env.VITE_DOWNLOAD_BASE_URL || DEFAULT_CLOUD_BASE).trim().replace(/\/+$/, '')

/**
 * 各导入场景的模板下载地址（键与 `BatchImportDialog` 的 `taskType` 对齐）。
 *
 * 新增导入场景时在此登记即可，页面侧只引用 `IMPORT_TEMPLATES[key]`，不再各自拼 URL。
 */
export const IMPORT_TEMPLATES = {
  employee: `${TEMPLATE_BASE}/employee-import-template.xlsx`,
  product: `${TEMPLATE_BASE}/product-import-template.xlsx`,
  customer: `${TEMPLATE_BASE}/customer-import-template.xlsx`,
  supplier: `${TEMPLATE_BASE}/supplier-import-template.xlsx`,
  'sales-order': `${TEMPLATE_BASE}/sales-order-import-template.xlsx`,
  'purchase-order': `${TEMPLATE_BASE}/purchase-order-import-template.xlsx`,
  'plastic-box': `${TEMPLATE_BASE}/plastic-box-import-template.xlsx`,
  'external-item-no': `${TEMPLATE_BASE}/external-item-no-import-template.xlsx`,
  // 三个批量维护正式模板（2026-10-28 用户提供，E2E 必填版）。托管在 aster-link-wms 桶
  // （与 TEMPLATE_BASE 的 nuomiwms 桶不同），因此登记完整绝对 URL，不走 TEMPLATE_BASE 拼接。
  'product-update': 'https://aster-link-wms.gz.bcebos.com/example/E2E_2_%E4%BA%A7%E5%93%81%E8%B5%84%E6%96%99%E6%89%B9%E9%87%8F%E6%9B%B4%E6%96%B0_%E5%BF%85%E5%A1%AB%E7%89%88.xlsx',
  'product-supplier': 'https://aster-link-wms.gz.bcebos.com/example/E2E_1_%E4%BE%9B%E5%BA%94%E5%95%86%E6%89%B9%E9%87%8F%E7%BB%B4%E6%8A%A4_%E5%BF%85%E5%A1%AB%E7%89%88.xlsx',
  'product-sale-price': 'https://aster-link-wms.gz.bcebos.com/example/E2E_3_%E5%AE%A2%E6%88%B7%E5%AE%9A%E4%BB%B7%E6%89%B9%E9%87%8F%E7%BB%B4%E6%8A%A4_%E5%BF%85%E5%A1%AB%E7%89%88.xlsx',
} satisfies Record<ImportTaskType, string>
