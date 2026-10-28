// 边识别边审核纯逻辑单测（reviewStream.ts）。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/reviewStream.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBatches, mergeArrivals } from './reviewStream.ts';

const item = (id) => ({ source_crop_id: id, description: `d-${id}` });

test('chunkBatches：8 张/批，尾批余量，空列表返回空', () => {
  assert.deepEqual(chunkBatches([]), []);
  assert.deepEqual(chunkBatches(Array.from({ length: 20 }, (_, i) => item(`c${i}`))).map(b => b.items.length), [8, 8, 4]);
  assert.deepEqual(chunkBatches([item('a')]).map(b => b.items.length), [1]);
});

test('mergeArrivals：新到货 append 为新批次，按 id 去重，不回填既有批', () => {
  const existing = [{ items: [item('a'), item('b')] }, { items: [item('c')] }];
  const { batches, appended } = mergeArrivals(existing, [item('c'), item('d'), item('e'), item('a')]);
  assert.equal(appended, 2);   // c/a 已知去重，d/e 新到
  assert.deepEqual(batches.map(b => b.items.map(x => x.source_crop_id)), [['a', 'b'], ['c'], ['d', 'e']]);
  // 原批次对象不被修改
  assert.deepEqual(existing.map(b => b.items.map(x => x.source_crop_id)), [['a', 'b'], ['c']]);
});

test('mergeArrivals：空到货 / 占位空批清理 / 全空安全', () => {
  const existing = [{ items: [] }];   // 无待审时的占位空批
  const r1 = mergeArrivals(existing, [item('x')]);
  assert.deepEqual(r1.batches.map(b => b.items.map(x => x.source_crop_id)), [['x']]);
  assert.equal(r1.appended, 1);
  const r2 = mergeArrivals(existing, []);
  assert.equal(r2.appended, 0);
  const r3 = mergeArrivals([], [item('y')]);
  assert.deepEqual(r3.batches.map(b => b.items.length), [1]);
  const r4 = mergeArrivals([], []);
  assert.deepEqual(r4, { batches: [], appended: 0 });
});

test('mergeArrivals：超过 8 张的新到货按 8 张切批', () => {
  const arrivals = Array.from({ length: 10 }, (_, i) => item(`n${i}`));
  const { batches, appended } = mergeArrivals([{ items: [item('a')] }], arrivals);
  assert.equal(appended, 10);
  assert.deepEqual(batches.map(b => b.items.length), [1, 8, 2]);
});
