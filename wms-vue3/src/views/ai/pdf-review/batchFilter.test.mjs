// 条件批量决策纯逻辑单测（batchFilter.ts）。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/batchFilter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveDesc,
  effectiveType,
  filterOptionValues,
  matchReviewItems,
} from './batchFilter.ts';

const ITEMS = [
  { source_crop_id: 'c1', product_name: 'D215 三节轨', image_type: 'structure', description: 'D215 结构图' },
  { source_crop_id: 'c2', product_name: 'D215 三节轨', image_type: 'detail', description: '滑轨细节' },
  { source_crop_id: 'c3', product_name: 'D306 铰链', image_type: 'structure', description: 'D306 安装图' },
  { source_crop_id: 'c4', product_name: 'D306 铰链', image_type: 'detail', description: '' },
];

test('matchReviewItems：按类型/产品/关键词筛选，且只含未决项', () => {
  assert.deepEqual(
    matchReviewItems(ITEMS, { image_type: 'structure' }, {}).map(i => i.source_crop_id),
    ['c1', 'c3']
  );
  assert.deepEqual(
    matchReviewItems(ITEMS, { product_name: 'D215 三节轨' }, {}).map(i => i.source_crop_id),
    ['c1', 'c2']
  );
  assert.deepEqual(
    matchReviewItems(ITEMS, { keyword: '滑轨' }, {}).map(i => i.source_crop_id),
    ['c2']   // 描述命中；产品名含「轨」不等于关键词命中
  );
  // 已决策项不参与（只补未决，与「全部通过」同口径）
  assert.deepEqual(
    matchReviewItems(ITEMS, { image_type: 'structure' }, { c1: { action: 'approve' } }).map(i => i.source_crop_id),
    ['c3']
  );
  // 组合条件取交集
  assert.deepEqual(
    matchReviewItems(ITEMS, { image_type: 'detail', product_name: 'D306 铰链' }, {}).map(i => i.source_crop_id),
    ['c4']
  );
  // 空筛选 = 全部未决
  assert.equal(matchReviewItems(ITEMS, {}, {}).length, 4);
});

test('matchReviewItems：修订后的类型/描述参与筛选（生效值口径）', () => {
  const edits = { c1: { image_type: 'detail' }, c3: { description: '改成安装关键词' } };
  assert.deepEqual(
    matchReviewItems(ITEMS, { image_type: 'detail' }, {}, edits).map(i => i.source_crop_id),
    ['c1', 'c2', 'c4']   // c1 改成 detail 后命中
  );
  assert.deepEqual(
    matchReviewItems(ITEMS, { keyword: '安装关键词' }, {}, edits).map(i => i.source_crop_id),
    ['c3']
  );
});

test('effectiveType/effectiveDesc：修订优先于 AI 原始值（含主动清空）', () => {
  const edits = { c4: { description: '' } };
  assert.equal(effectiveDesc(ITEMS[3], edits), '');
  assert.equal(effectiveDesc(ITEMS[3]), '');
  assert.equal(effectiveDesc(ITEMS[0], {}), 'D215 结构图');
  assert.equal(effectiveType(ITEMS[0], undefined), 'structure');
});

test('filterOptionValues：类型/产品去重排序', () => {
  const { imageTypes, productNames } = filterOptionValues(ITEMS);
  assert.deepEqual(imageTypes, ['detail', 'structure']);
  assert.deepEqual(productNames, ['D215 三节轨', 'D306 铰链']);
});
