// 人工新增卡片纯逻辑单测（manualCard.ts）——与 jobStatus.test.mjs 同款 node:test 模式。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addPageCandidatesFor,
  buildManualCardItem,
  manualCropDecision,
  manualCropEdit,
  mergeDraftManualCards,
  newManualCropId,
  splitProductsByBatch
} from './manualCard.ts';

test('newManualCropId：manual_ 前缀 + 唯一性', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newManualCropId()));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, /^manual_[0-9a-f]+$/);
});

test('buildManualCardItem：字段与快照 crop_binding 同构', () => {
  const item = buildManualCardItem({
    product_candidate_id: 'pc_aaa',
    product_name: '玻璃层板灯条',
    image_type: 'install',
    description: '  玻璃层板灯条安装说明示意图，含层板退位17mm  ',
    pdf_page_number: 3,
    pdf_bbox: [0.12, 0.34, 0.58, 0.71],
    preview_url: 'data:image/jpeg;base64,xxx'
  });
  assert.equal(item.manual, true);
  assert.equal(item.image_type, 'install');
  assert.equal(item.pdf_page_number, 3);
  assert.deepEqual(item.pdf_bbox, [0.12, 0.34, 0.58, 0.71]);
  assert.deepEqual(item.source_bbox, [0, 0, 1, 1]);
  // 描述 trim（提交载荷干净）
  assert.equal(item.description, '玻璃层板灯条安装说明示意图，含层板退位17mm');
  // 默认值
  const bare = buildManualCardItem({ product_candidate_id: 'pc_x', pdf_page_number: 1, pdf_bbox: [0, 0, 0.5, 0.5] });
  assert.equal(bare.image_type, 'other');
  assert.equal(bare.description, '');
});

test('manualCropDecision/manualCropEdit：提交载荷派生', () => {
  const item = buildManualCardItem({
    product_candidate_id: 'pc_aaa', image_type: 'size',
    description: '玻璃层板灯条尺寸标注图', pdf_page_number: 2,
    pdf_bbox: [0.1, 0.1, 0.4, 0.4]
  });
  assert.deepEqual(manualCropDecision(item), {
    source_crop_id: item.source_crop_id,
    action: 'approve',
    pdf_bbox: [0.1, 0.1, 0.4, 0.4],
    pdf_page_number: 2,
    product_candidate_id: 'pc_aaa'
  });
  assert.deepEqual(manualCropEdit(item), {
    description: '玻璃层板灯条尺寸标注图', image_type: 'size'
  });
});

test('mergeDraftManualCards：注入 + 跳过已存在 + 无目标批次不炸', () => {
  const batches = [{ items: [{ source_crop_id: 'sc_1' }, { source_crop_id: 'manual_a' }] }];
  const { injected } = mergeDraftManualCards(batches, [
    { source_crop_id: 'manual_a' },                    // 已存在：跳过
    { source_crop_id: 'manual_b', description: 'x' },  // 注入
    null,                                              // 脏数据：跳过
    { description: 'no id' }                           // 缺 id：跳过
  ]);
  assert.deepEqual(injected.map(c => c.source_crop_id), ['manual_b']);
  assert.equal(batches[0].items.length, 3);

  // 空批次数组：不注入也不抛
  const empty = mergeDraftManualCards([], [{ source_crop_id: 'manual_c' }]);
  assert.equal(empty.injected.length, 1);
});

test('splitProductsByBatch：按当前批次卡片的产品绑定收敛下拉', () => {
  const products = [
    { product_candidate_id: 'pc_a', product_name: '玻璃层板灯条' },
    { product_candidate_id: 'pc_b', product_name: '免焊门控灯条' },
    { product_candidate_id: 'pc_c', product_name: '吊柜感应灯条' }
  ];
  const items = [
    { source_crop_id: 'sc_1', product_candidate_id: 'pc_a' },
    { source_crop_id: 'sc_2', product_candidate_id: 'pc_b' },
    { source_crop_id: 'sc_3', product_candidate_id: 'pc_a' }  // 重复绑定只算一次
  ];
  const { inBatch, others } = splitProductsByBatch(items, products);
  assert.deepEqual(inBatch.map(p => p.product_candidate_id), ['pc_a', 'pc_b']);
  assert.deepEqual(others.map(p => p.product_candidate_id), ['pc_c']);

  // 本批无有效关联（空 id / 缺字段）→ inBatch 空，调用方回退全量
  const orphan = splitProductsByBatch(
    [{ product_candidate_id: '' }, {}],
    products
  );
  assert.equal(orphan.inBatch.length, 0);
  assert.equal(orphan.others.length, 3);
});

test('addPageCandidatesFor：本批卡片页码 ±1 收敛、去重升序', () => {
  const items = [
    { pdf_page_number: 13 },
    { pdf_page_number: 15 },
    { pdf_page_number: 13 },        // 重复页去重
    { pdf_page_number: null },      // 无页码跳过
    {}                              // 缺字段跳过
  ];
  assert.deepEqual(addPageCandidatesFor(items, 90), [12, 13, 14, 15, 16]);

  // 页码边界夹紧：第 1 页不产生 0，末页不越界
  assert.deepEqual(addPageCandidatesFor([{ pdf_page_number: 1 }], 90), [1, 2]);
  assert.deepEqual(addPageCandidatesFor([{ pdf_page_number: 90 }], 90), [89, 90]);

  // 本批无任何有效页码 → 空数组（调用方回退全量页码）
  assert.deepEqual(addPageCandidatesFor([], 90), []);
  assert.deepEqual(addPageCandidatesFor([{ pdf_page_number: 0 }], 90), []);

  // pageCount=0（未取到总页数）→ 只做下界夹紧
  assert.deepEqual(addPageCandidatesFor([{ pdf_page_number: 88 }], 0), [87, 88, 89]);
});
