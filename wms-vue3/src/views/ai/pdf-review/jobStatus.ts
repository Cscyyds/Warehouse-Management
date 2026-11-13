/**
 * PDF 解析任务状态词汇表（UI 唯一出口）。
 *
 * 背景：任务在服务端异步推进，`pdf_extraction_job.status` 有 9 个取值，
 * 而「最近任务」卡片只需要让用户一眼看出处在哪一步。此前状态以中文快照
 * 存进 localStorage（rememberJob 的 hint），只在页面轮询时刷新 → 用户离开
 * 页面后状态永久冻结。改造后 localStorage 只存**后端原始 status**，
 * 中文一律由本模块派生，避免文案在多处各写一份。
 *
 * 徽标口径（2026-11-05 修订）：解析中 / 待审核 / 已完成 三态；
 * 失败、已取消 作为终态异常；
 * 「已过期」= 三个实例地址全部 404 且持久归档也查不到（检查点已被清理），
 * 单独成桶，不再降级成「状态未知」——否则过期任务会一直挂着「待审核」。
 * 「状态未知」只留给请求失败/服务不可达这类**无法下结论**的情形。
 */

export type JobBucketKey = 'parsing' | 'review' | 'done' | 'failed' | 'expired' | 'unknown';

/** 后端 pdf_extraction_job.status 的真实取值 + 两个前端派生值 */
export type PdfJobStatus =
  | 'ready' | 'processing' | 'merging' | 'review_pending'
  | 'publishing' | 'publish_partial' | 'published' | 'failed' | 'canceled'
  | 'expired' | 'unknown';

export interface RecentJob {
  job_id: string;
  pdf_name: string;
  status: PdfJobStatus;
  /** 状态变更时刻（不是创建时刻），卡片上「x 分钟前」用它 */
  statusAt: number;
  added_at: number;
  /** 任务类型：catalog=产品画册（默认）；supplement=补充说明。
   *  旧记录无此字段（probe 后回填），缺省按 catalog 展示。 */
  taskType?: string;
}

interface BucketMeta {
  text: string;
  /** 卡片右侧动作词：让「点一下会发生什么」可见 */
  action: string;
}

const BUCKET_META: Record<JobBucketKey, BucketMeta> = {
  parsing: { text: '解析中', action: '查看进度' },
  review: { text: '待审核', action: '继续审核' },
  done: { text: '已完成', action: '查看结果' },
  failed: { text: '失败', action: '查看' },
  // 过期任务点开只会再吃一次 404，动作词不引导继续审核
  expired: { text: '已过期', action: '' },
  unknown: { text: '状态未知', action: '' },
};

const STATUS_BUCKET: Record<PdfJobStatus, JobBucketKey> = {
  ready: 'parsing',
  processing: 'parsing',
  merging: 'parsing',
  review_pending: 'review',
  // 发布中/部分失败：审核已交、图片正在渲染，对用户就是「已完成」
  publishing: 'done',
  publish_partial: 'done',
  published: 'done',
  failed: 'failed',
  canceled: 'failed',
  expired: 'expired',
  unknown: 'unknown',
};

/** 细粒度中文（提示文案/结果页沿用），勿与徽标三态文案混用 */
const STATUS_TEXT: Record<PdfJobStatus, string> = {
  ready: '处理中',
  processing: '处理中',
  merging: '处理中',
  review_pending: '待审核',
  publishing: '发布中',
  publish_partial: '部分失败',
  published: '已完成',
  failed: '失败',
  canceled: '已取消',
  expired: '已过期',
  unknown: '状态未知',
};

/** 归入「已完成」但尚未收尾时的副标（徽标仍是已完成） */
const STATUS_SUB: Partial<Record<PdfJobStatus, string>> = {
  publishing: '发布中…',
  publish_partial: '部分失败',
  expired: '服务端已清理',
};

/** 旧记录迁移：历史 hint 是写入时刻的中文快照 */
const LEGACY_HINT: Record<string, PdfJobStatus> = {
  处理中: 'processing',
  待审核: 'review_pending',
  发布中: 'publishing',
  部分失败: 'publish_partial',
  已完成: 'published',
  失败: 'failed',
  已取消: 'canceled',
};

/** 终态：不会再变，也是活跃任务记录该被清掉的判据 */
const TERMINAL: PdfJobStatus[] = ['published', 'failed', 'canceled'];

export function normalizeJobStatus(value: unknown): PdfJobStatus | '' {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return s in STATUS_BUCKET ? (s as PdfJobStatus) : '';
}

export function jobBucketKey(status: unknown): JobBucketKey {
  const s = normalizeJobStatus(status);
  return s ? STATUS_BUCKET[s] : 'unknown';
}

export function jobBucketLabel(status: unknown): string {
  return BUCKET_META[jobBucketKey(status)].text;
}

export function jobBucketAction(status: unknown): string {
  return BUCKET_META[jobBucketKey(status)].action;
}

export function jobStatusText(status: unknown): string {
  const s = normalizeJobStatus(status);
  return s ? STATUS_TEXT[s] : STATUS_TEXT.unknown;
}

export function jobStatusSub(status: unknown): string {
  const s = normalizeJobStatus(status);
  return (s && STATUS_SUB[s]) || '';
}

export function isTerminalJobStatus(status: unknown): boolean {
  const s = normalizeJobStatus(status);
  return !!s && TERMINAL.includes(s);
}

/**
 * 轮询收口判据：状态已有定论，无需再向服务端确认。
 *
 * 终态之外，'expired' 同样是定论——它只在三个实例地址全部 404、且持久归档
 * 也查不到时才落定（见 probeJobStatus）；检查点清理只发生在终态任务上、
 * 归档只增不减，故再查只会重复拿到同一批 404。
 *
 * 注意与 isTerminalJobStatus 的区别：后者是「任务是否已到终态」的判据，
 * expired 属于「数据已不存在」而非业务终态，故不并入 TERMINAL；
 * 但两者都算 settled，探测到即停止重复请求。
 */
export function isSettledJobStatus(status: unknown): boolean {
  const s = normalizeJobStatus(status);
  return isTerminalJobStatus(s) || s === 'expired';
}

/** 任务类型中文（历史任务卡片徽标）：仅 agent 引擎存在 supplement；未知/缺省按画册 */
export function jobTypeLabel(taskType: unknown): string {
  return String(taskType || '').trim().toLowerCase() === 'supplement' ? '补充说明' : '产品画册';
}

/**
 * 最近任务记录归一化：兼容旧结构（只有中文 hint），并补齐缺失字段。
 * 非法记录返回 null，由调用方过滤。
 */
export function normalizeRecentJob(raw: unknown): RecentJob | null {
  const rec = raw as Partial<RecentJob> & { hint?: unknown } | null;
  if (!rec || typeof rec !== 'object' || !rec.job_id) return null;
  let status = normalizeJobStatus(rec.status);
  if (!status) {
    status = LEGACY_HINT[String(rec.hint ?? '').trim()] || 'unknown';
  }
  const addedAt = Number(rec.added_at) || Date.now();
  return {
    job_id: String(rec.job_id),
    pdf_name: String(rec.pdf_name || 'PDF document'),
    status,
    statusAt: Number(rec.statusAt) || addedAt,
    added_at: addedAt,
  };
}
