// 二次图片识别合并纯逻辑单测。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/imageExtract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendValue,
  applyFeatureMerge,
  applyTechMerge,
  buildTechMergePreview,
  previewFeatureMerge,
} from './imageExtract.ts';

const CURRENT = {
  params: [
    { name: '长度', value: '500mm' },
    { name: '材质', value: '碳钢' },
  ],
  variants: [[
    { key: '型号', value: 'D123' },
    { key: '产品名称', value: '沙比利菜板' },
    { key: '颜色', value: '白色' },
  ]],
};

const EXTRACTED = {
  target: 'tech_params',
  params: [
    { name: '长度', value: '600mm' },
    { name: '宽度', value: '30mm' },
    { name: '材质', value: '碳钢' },
  ],
  variants: [
    { 型号: 'D123', 产品名称: '沙比利菜板', 颜色: '黑色', 承重: '35kg' },
    { 型号: 'D456', 产品名称: '沙比利菜板' },
  ],
};

test('buildTechMergePreview：新增 / 同值 / 冲突 + 按型号匹配变体', () => {
  const preview = buildTechMergePreview(CURRENT, EXTRACTED);
  assert.deepEqual(preview.params, [
    { name: '长度', incoming: '600mm', existing: '500mm', kind: 'conflict' },
    { name: '宽度', incoming: '30mm', existing: '', kind: 'add' },
    { name: '材质', incoming: '碳钢', existing: '碳钢', kind: 'same' },
  ]);
  assert.equal(preview.variants.length, 2);
  assert.equal(preview.variants[0].kind, 'merge');
  assert.equal(preview.variants[0].targetIndex, 0);
  assert.deepEqual(
    preview.variants[0].fields.map((f) => [f.key, f.kind]),
    [['型号', 'same'], ['产品名称', 'same'], ['颜色', 'conflict'], ['承重', 'add']]
  );
  assert.equal(preview.variants[1].kind, 'add');
  assert.equal(preview.variants[1].targetIndex, -1);
  // 不修改入参
  assert.equal(CURRENT.params[0].value, '500mm');
});

test('applyTechMerge：默认追加去重；新增项始终加入', () => {
  const preview = buildTechMergePreview(CURRENT, EXTRACTED);
  const next = applyTechMerge(CURRENT, preview, 'append');
  assert.deepEqual(next.params, [
    { name: '长度', value: '500mm；600mm' },
    { name: '材质', value: '碳钢' },
    { name: '宽度', value: '30mm' },
  ]);
  assert.deepEqual(next.variants[0], [
    { key: '型号', value: 'D123' },
    { key: '产品名称', value: '沙比利菜板' },
    { key: '颜色', value: '白色；黑色' },
    { key: '承重', value: '35kg' },
  ]);
  assert.deepEqual(next.variants[1], [
    { key: '型号', value: 'D456' },
    { key: '产品名称', value: '沙比利菜板' },
  ]);
  // 原对象不被修改
  assert.equal(CURRENT.variants[0][2].value, '白色');
});

test('applyTechMerge：保留现有 / 覆盖 / 跳过只影响冲突项', () => {
  const preview = buildTechMergePreview(CURRENT, EXTRACTED);
  const keep = applyTechMerge(CURRENT, preview, 'keep');
  assert.equal(keep.params[0].value, '500mm');
  assert.equal(keep.variants[0][2].value, '白色');
  assert.equal(keep.params.find((p) => p.name === '宽度').value, '30mm');
  assert.equal(keep.variants[0].find((e) => e.key === '承重').value, '35kg');
  assert.equal(keep.variants.length, 2);

  const overwrite = applyTechMerge(CURRENT, preview, 'overwrite');
  assert.equal(overwrite.params[0].value, '600mm');
  assert.equal(overwrite.variants[0][2].value, '黑色');

  const skip = applyTechMerge(CURRENT, preview, 'skip');
  assert.equal(skip.params[0].value, '500mm');
  assert.equal(skip.variants[0][2].value, '白色');
  assert.equal(skip.variants.length, 2);
});

test('appendValue：同值/已包含的值不重复拼接', () => {
  assert.equal(appendValue('500mm', '500mm'), '500mm');
  assert.equal(appendValue('500mm', '600mm'), '500mm；600mm');
  assert.equal(appendValue('500mm；600mm', '600mm'), '500mm；600mm');
  assert.equal(appendValue('', '600mm'), '600mm');
  assert.equal(appendValue('500mm', ''), '500mm');
});

test('buildTechMergePreview：无型号变体按新增处理，不误合并', () => {
  const preview = buildTechMergePreview(CURRENT, {
    variants: [{ 产品名称: '无型号菜板' }],
  });
  assert.equal(preview.variants.length, 1);
  assert.equal(preview.variants[0].modelKey, '');
  assert.equal(preview.variants[0].kind, 'add');
  const next = applyTechMerge(CURRENT, preview, 'append');
  assert.deepEqual(next.variants[1], [{ key: '产品名称', value: '无型号菜板' }]);
});

test('previewFeatureMerge / applyFeatureMerge：编号与空白归一后去重', () => {
  const preview = previewFeatureMerge(
    ['特点A', '2. 特点B'],
    ['特点A', '特点B', '特点C', '特点C']
  );
  assert.deepEqual(preview, [
    { text: '特点A', duplicate: true },
    { text: '特点B', duplicate: true },
    { text: '特点C', duplicate: false },
    { text: '特点C', duplicate: true },
  ]);
  assert.deepEqual(
    applyFeatureMerge(['特点A', '2. 特点B'], preview),
    ['特点A', '2. 特点B', '特点C']
  );
  // 用户只勾选部分条目：只追加选中的非重复项
  assert.deepEqual(
    applyFeatureMerge(['特点A'], [{ text: '特点C', duplicate: false }]),
    ['特点A', '特点C']
  );
  assert.deepEqual(applyFeatureMerge([], []), []);
});
