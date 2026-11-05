// 大 PDF 分块上传器单测（chunkedUpload.ts）——与 jobStatus.test.mjs 同款 node:test 模式。
// 覆盖方案 §6 测试计划 9/10：切块数学、init→chunk→finalize 顺序与载荷、
// 块失败退避重试后成功、abort 取消；另锁并发度与重试耗尽语义。
//
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/chunkedUpload.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkedUpload,
  chunkLength,
  progressPercent,
  totalChunks,
} from './chunkedUpload.ts';

// ── 测试替身 ──────────────────────────────────────────

/** 确定性摘要替身：32 字节 = (块长度 + i) mod 256，避免依赖真实 crypto。 */
function fakeDigest(buf) {
  const len = buf.byteLength;
  return Promise.resolve(
    new Uint8Array(32).map((_, i) => (len + i) & 0xff).buffer
  );
}
function fakeDigestHex(len) {
  return Array.from({ length: 32 }, (_, i) => ((len + i) & 0xff).toString(16).padStart(2, '0')).join('');
}

function fakeFile(bytes, name = '诺米2024灯光画册_完整版.pdf', type = 'application/pdf') {
  return {
    name,
    size: bytes.length,
    type,
    slice(start, end) { return new Blob([bytes.slice(start, end)]); }
  };
}

/** 记录调用序列的三个回调；init 返回固定 chunk_size。 */
function makeAdapters(chunkSize, calls, { chunkImpl } = {}) {
  return {
    init: async (payload) => {
      calls.push({ kind: 'init', payload });
      const total = Math.ceil(payload.file_size / chunkSize);
      return { upload_id: 'e3b0c44298fc1c149afbf4c8996fb924', chunk_size: chunkSize, total_chunks: total };
    },
    chunk: chunkImpl || (async (fields) => {
      calls.push({ kind: 'chunk', fields });
      return { index: fields.index, received_bytes: 0, progress: 0 };
    }),
    finalize: async (upload_id) => {
      calls.push({ kind: 'finalize', upload_id });
      return { file_url: 'https://bos.example.com/uploads/fake.pdf', file_name: '诺米2024灯光画册_完整版.pdf' };
    }
  };
}

const baseOpts = { retryBaseDelayMs: 1, digest: fakeDigest };

// ── 9. 切块数学 ───────────────────────────────────────

test('切块数学：总块数 / 末块余量 / 整除时无零长末块', () => {
  assert.equal(totalChunks(20, 8), 3);
  assert.equal(chunkLength(20, 8, 0), 8);
  assert.equal(chunkLength(20, 8, 1), 8);
  assert.equal(chunkLength(20, 8, 2), 4);   // 末块余量
  assert.equal(totalChunks(24, 8), 3);       // 恰好整除
  assert.equal(chunkLength(24, 8, 2), 8);    // 不存在零长末块
  assert.equal(totalChunks(8, 8), 1);
  assert.equal(chunkLength(8, 8, 0), 8);
  assert.throws(() => chunkLength(20, 8, 3), /越界/);
  assert.throws(() => totalChunks(20, 0), /正数/);
});

test('进度百分比：与后端口径一致（按块数四舍五入）', () => {
  assert.equal(progressPercent(1, 3), 33);
  assert.equal(progressPercent(2, 3), 67);
  assert.equal(progressPercent(3, 3), 100);
  assert.equal(progressPercent(0, 0), 0);
});

// ── 10. mock 回调：顺序 / 载荷 / 重试 / abort ─────────

test('全流程：init 一次 → 逐块（index/sha256/blob 长度）→ finalize 一次，进度递增至 100', async () => {
  const bytes = new Uint8Array(20);            // chunk_size=8 → 3 块（8/8/4）
  const calls = [];
  const progress = [];
  const result = await chunkedUpload(fakeFile(bytes), {
    ...makeAdapters(8, calls),
    ...baseOpts,
    concurrency: 1,                             // 串行保证调用顺序确定
    onProgress: (p) => progress.push(p)
  });

  assert.equal(result.file_url, 'https://bos.example.com/uploads/fake.pdf');
  assert.equal(calls[0].kind, 'init');
  assert.deepEqual(calls[0].payload, {
    file_name: '诺米2024灯光画册_完整版.pdf', file_size: 20, content_type: 'application/pdf'
  });

  const chunkCalls = calls.filter((c) => c.kind === 'chunk');
  assert.equal(chunkCalls.length, 3);
  chunkCalls.forEach((c, i) => {
    assert.equal(c.fields.upload_id, 'e3b0c44298fc1c149afbf4c8996fb924');
    assert.equal(c.fields.index, i);
    assert.equal(c.fields.blob.size, chunkLength(20, 8, i));
    // sha256 与注入摘要一致（hex(长度+i)），payload 字段齐全
    assert.equal(c.fields.sha256, fakeDigestHex(chunkLength(20, 8, i)));
  });

  assert.equal(calls.at(-1).kind, 'finalize');
  assert.equal(calls.at(-1).upload_id, 'e3b0c44298fc1c149afbf4c8996fb924');
  assert.deepEqual(progress, [33, 67, 100]);
});

test('块失败退避重试后成功：单块共尝试 3 次，整体仍成功', async () => {
  const bytes = new Uint8Array(16);            // chunk_size=8 → 2 块
  const calls = [];
  const attemptsByIndex = { 0: 0, 1: 0 };
  const adapters = makeAdapters(8, calls, {
    chunkImpl: async (fields) => {
      attemptsByIndex[fields.index] += 1;
      if (fields.index === 1 && attemptsByIndex[1] < 3) {
        throw new Error('网络抖动');
      }
      return { index: fields.index };
    }
  });

  const result = await chunkedUpload(fakeFile(bytes), {
    ...adapters, ...baseOpts, concurrency: 1, maxRetries: 3
  });
  assert.equal(result.file_url, 'https://bos.example.com/uploads/fake.pdf');
  assert.equal(attemptsByIndex[0], 1);          // 好块不重试
  assert.equal(attemptsByIndex[1], 3);          // 第 3 次成功
});

test('重试耗尽向上抛：错误信息带块号与尝试次数', async () => {
  const bytes = new Uint8Array(8);             // 1 块
  const calls = [];
  const adapters = makeAdapters(8, calls, {
    chunkImpl: async () => { throw new Error('服务端 502'); }
  });
  await assert.rejects(
    chunkedUpload(fakeFile(bytes), { ...adapters, ...baseOpts, maxRetries: 3 }),
    /块 0 上传失败（已重试 3 次）.*服务端 502/
  );
  assert.equal(calls.filter((c) => c.kind === 'finalize').length, 0);
});

test('abort：开始前已取消 → 直接 AbortError，零网络调用', async () => {
  const calls = [];
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    chunkedUpload(fakeFile(new Uint8Array(16)), {
      ...makeAdapters(8, calls), ...baseOpts, signal: controller.signal
    }),
    (e) => e.name === 'AbortError'
  );
  assert.equal(calls.length, 0);
});

test('abort：上传途中取消 → AbortError，不再 finalize', async () => {
  const calls = [];
  const controller = new AbortController();
  const adapters = makeAdapters(8, calls, {
    chunkImpl: async (fields) => {
      if (fields.index === 0) controller.abort();   // 第一块在途时用户取消
      return { index: fields.index };
    }
  });
  await assert.rejects(
    chunkedUpload(fakeFile(new Uint8Array(24)), {   // 3 块
      ...adapters, ...baseOpts, signal: controller.signal
    }),
    (e) => e.name === 'AbortError'
  );
  assert.equal(calls.filter((c) => c.kind === 'finalize').length, 0);
});

test('并发度：concurrency=2 时在途块峰值恰为 2（乱序在途、完成数不丢）', async () => {
  const bytes = new Uint8Array(32);            // chunk_size=8 → 4 块
  const calls = [];
  let active = 0;
  let maxActive = 0;
  let doneCount = 0;
  const progress = [];
  const adapters = makeAdapters(8, calls, {
    chunkImpl: async (fields) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 15));
      active -= 1;
      doneCount += 1;
      return { index: fields.index };
    }
  });
  await chunkedUpload(fakeFile(bytes), {
    ...adapters, ...baseOpts, concurrency: 2,
    onProgress: (p) => progress.push(p)
  });
  assert.equal(maxActive, 2);                   // 恰有两个块同时在途
  assert.equal(doneCount, 4);
  assert.equal(progress.at(-1), 100);
  assert.equal(calls.filter((c) => c.kind === 'finalize').length, 1);
});

test('契约护栏：服务端 total_chunks 与本地切块不一致 → 报错不发块', async () => {
  const calls = [];
  const adapters = makeAdapters(8, calls);
  adapters.init = async () => ({ upload_id: 'x'.repeat(32), chunk_size: 8, total_chunks: 99 });
  await assert.rejects(
    chunkedUpload(fakeFile(new Uint8Array(16)), { ...adapters, ...baseOpts }),
    /total_chunks=99 与本地切块 2 不一致/
  );
  assert.equal(calls.filter((c) => c.kind === 'chunk').length, 0);
});
