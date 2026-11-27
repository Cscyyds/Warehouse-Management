/**
 * 塑料盒展示文本：只用名称（`box_name`）。
 *
 * 背景：详情页/列表页早期写法把 `box_code` 与 `box_name` 拼接
 * （`[box_code, box_name].filter(Boolean).join(' ')`），而现网塑建档案绝大多数
 * 「名称=编码」（实测 9040 条里 9031 条两者相同），于是渲染成
 * `SLH141754 SLH141754` 两段重复值。
 * 产品口径：绑定塑料盒只显示名称这一列，不再拼编码；仅当名称缺失时回退编码，
 * 避免出现空白单元格（现网 box_name 恒有值，回退只是兜底）。
 *
 * 示例：
 * `formatPlasticBoxName('SLH141754', 'SLH141754')` → `'SLH141754'`；
 * `formatPlasticBoxName('PBOX001', '1号塑料盒')` → `'1号塑料盒'`；
 * `formatPlasticBoxName('PBOX001', '')` → `'PBOX001'`。
 */
export function formatPlasticBoxName(code?: string | null, name?: string | null): string {
  const boxName = String(name ?? '').trim()
  if (boxName) return boxName
  return String(code ?? '').trim()
}
