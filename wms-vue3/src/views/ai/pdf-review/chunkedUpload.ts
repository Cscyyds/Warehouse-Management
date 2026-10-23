// 大 PDF 分块上传器（PDF 分块上传方案 A，2026-10-23）。
// 纯逻辑：网络调用全部经 opts 回调注入（init/chunk/finalize），不依赖 Vue 与
// 全局状态，node --test 可直接单测（见 chunkedUpload.test.mjs）；index.vue 的
// uploadFileChunked 负责把回调绑到真实 fetch + authHeaders。
//
// 后端契约（Coze_Connect main.py，/api/v1/files/upload/pdf/*）：
// - init     JSON {file_name, file_size, content_type}
//            → {upload_id, chunk_size, total_chunks, expires_at}
// - chunk    multipart {upload_id, index, sha256, file}；sha256 = 块内容 SHA-256
//            hex；定长切块：前 N-1 块恒等 chunk_size、末块为余量（后端按此校验块长）
// - finalize JSON {upload_id} → {file_url, file_name, ...}（与单发上传同构）
//
// 语义（方案 §2.2 / §4 F2）：块级重试 1s/2s/4s 退避 ×3 后向上抛；并发度默认 2；
// 取消经 AbortSignal（异常 name='AbortError'，与页面既有取消分支一致）。
// 会话级断点续传（status 探测 localStorage 里的 upload_id）留二期，本期刷新即放弃。

/** 可上传对象：浏览器 File 及测试替身都满足此形状（slice 零拷贝）。 */
export interface ChunkedUploadFile {
  name: string;
  size: number;
  type: string;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

export interface ChunkedUploadResult {
  file_url: string;
  file_name?: string;
  [key: string]: unknown;
}

export interface ChunkedUploadOpts {
  init: (payload: {
    file_name: string;
    file_size: number;
    content_type: string;
  }) => Promise<{ upload_id: string; chunk_size: number; total_chunks: number }>;
  chunk: (fields: {
    upload_id: string;
    index: number;
    sha256: string;
    blob: unknown;
  }) => Promise<unknown>;
  finalize: (upload_id: string) => Promise<ChunkedUploadResult>;
  /** 进度回调：按已完成块数计，0~100。 */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  /** 在途块数，默认 2。 */
  concurrency?: number;
  /** 单块尝试上限（含首次），默认 3；失败按基数 1s/2s/4s 退避。 */
  maxRetries?: number;
  /** 退避基数毫秒，默认 1000（单测注入 1 避免真实等待）。 */
  retryBaseDelayMs?: number;
  /** SHA-256 摘要，默认 crypto.subtle（单测注入确定性替身）。 */
  digest?: (buf: ArrayBuffer) => Promise<ArrayBuffer>;
}

/** 总块数：定长切块，fileSize 恰好整除时不存在零长末块。 */
export function totalChunks(fileSize: number, chunkSize: number): number {
  if (chunkSize <= 0) throw new Error('chunkSize 必须为正数');
  if (fileSize < 0) throw new Error('fileSize 不能为负数');
  return Math.ceil(fileSize / chunkSize);
}

/** 第 index 块的字节长度：前 N-1 块恒等 chunkSize，末块为余量。 */
export function chunkLength(fileSize: number, chunkSize: number, index: number): number {
  const total = totalChunks(fileSize, chunkSize);
  if (index < 0 || index >= total) throw new Error(`index ${index} 越界（总块数 ${total}）`);
  return index < total - 1 ? chunkSize : fileSize - (total - 1) * chunkSize;
}

/** 进度百分比（按块数），与后端 progress 口径一致（四舍五入取整）。 */
export function progressPercent(done: number, total: number): number {
  return total <= 0 ? 0 : Math.round((done * 100) / total);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('上传已取消', 'AbortError');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('上传已取消', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('上传已取消', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function defaultDigest(buf: ArrayBuffer): Promise<ArrayBuffer> {
  return await crypto.subtle.digest('SHA-256', buf);
}

async function withRetries<T>(
  fn: () => Promise<T>,
  opts: { maxRetries: number; baseDelayMs: number; signal?: AbortSignal; describe: string }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < opts.maxRetries; attempt += 1) {
    throwIfAborted(opts.signal);
    try {
      return await fn();
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error;
      lastError = error;
      if (attempt < opts.maxRetries - 1) await sleep(opts.baseDelayMs * 2 ** attempt, opts.signal);
    }
  }
  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${opts.describe}（已重试 ${opts.maxRetries} 次）：${reason}`);
}

/**
 * 分块上传主流程：init → 并发切块上传（逐块 SHA-256）→ finalize。
 * 返回 finalize 结果（file_url 等，与单发上传同构），由调用方写入 pdfUrl/pdfName。
 */
export async function chunkedUpload(
  file: ChunkedUploadFile,
  opts: ChunkedUploadOpts
): Promise<ChunkedUploadResult> {
  const signal = opts.signal;
  const concurrency = Math.max(1, opts.concurrency ?? 2);
  const maxRetries = Math.max(1, opts.maxRetries ?? 3);
  const baseDelayMs = opts.retryBaseDelayMs ?? 1000;
  const digest = opts.digest ?? defaultDigest;

  throwIfAborted(signal);
  const initResult = await opts.init({
    file_name: file.name,
    file_size: file.size,
    content_type: file.type || 'application/pdf'
  });
  const uploadId = initResult.upload_id;
  const chunkSize = initResult.chunk_size;
  const total = initResult.total_chunks;
  if (!uploadId || !chunkSize) throw new Error('分块上传初始化返回不完整（缺少 upload_id/chunk_size）');
  const expectedTotal = totalChunks(file.size, chunkSize);
  if (total !== expectedTotal) {
    throw new Error(`服务端 total_chunks=${total} 与本地切块 ${expectedTotal} 不一致（chunk_size=${chunkSize}）`);
  }

  let nextIndex = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= total) return;
      throwIfAborted(signal);

      const offset = index * chunkSize;
      const length = chunkLength(file.size, chunkSize, index);
      const blob = file.slice(offset, offset + length);
      const sha = toHex(await digest(await blob.arrayBuffer()));

      await withRetries(
        () => opts.chunk({ upload_id: uploadId, index, sha256: sha, blob }),
        { maxRetries, baseDelayMs, signal, describe: `块 ${index} 上传失败` }
      );
      done += 1;
      opts.onProgress?.(progressPercent(done, total));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));

  throwIfAborted(signal);
  const result = await opts.finalize(uploadId);
  if (!result?.file_url) throw new Error('分块上传完成但未返回 file_url');
  return result;
}
