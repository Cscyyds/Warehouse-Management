// 审核卡片图片类型枚举（英文 value + 中文 label）。
// 后端 image_type 存英文枚举值；param 需后端枚举同步放行（pdf_schemas.ImageType 已含）。
// 抽为共享模块：审核卡片（ReviewCard）与新增卡片编辑器（index.vue）共用同一份口径。
export const IMAGE_TYPE_LABELS: Record<string, string> = {
  main: '主图',
  install: '安装图',
  detail: '细节图',
  size: '尺寸图',
  param: '参数图',
  structure: '结构图',
  other: '其他'
};

export function typeLabel(value: string): string {
  return IMAGE_TYPE_LABELS[value] || value || '其他';
}
