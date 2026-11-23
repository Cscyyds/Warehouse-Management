// 二次图片识别合并纯逻辑单测。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/imageExtract.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEEP_PART_NAME, mergeInstallationText, renderInstallationForProduct } from './installationExtract.ts';
import { allocateTechRows, buildAllocatedTechPreview } from './techParamAllocation.ts';
import {
  appendValue,
  applyFeatureMerge,
  applyTechMerge,
  buildTechMergePreview,
  flattenSupplementModel,
  previewFeatureMerge,
} from './imageExtract.ts';

const installationItem = text => ({ text, source_ids: ['图1'] });

test('安装说明保留原文并按识别预览的标题分段写入', () => {
  const draft = {
    installation_notes: [installationItem('木板开槽宽 10 mm。')],
    steps: [installationItem('1. 将灯体推入槽内。')],
    alternatives: [installationItem('从侧板钻孔出线。')],
    warnings: [installationItem('固定件型号待确认。')],
  };

  assert.equal(mergeInstallationText('原安装说明', draft), [
    '原安装说明', '安装要点', '木板开槽宽 10 mm。', '安装步骤', '1. 将灯体推入槽内。',
    '可选安装方案', '从侧板钻孔出线。',
  ].join('\n'));
});

test('重新识别时补充到已有分段，保留步骤编号并跳过重复条目', () => {
  const existing = ['安装要点', '开槽宽 10 mm。', '', '安装步骤', '1. 开槽。', '',
    '可选安装方案', '从侧板钻孔出线。'].join('\r\n');
  const draft = {
    installation_notes: [installationItem('开槽宽10mm'), installationItem('开槽深 10 mm。')],
    steps: [installationItem('1. 开槽'), installationItem('2. 将灯体推入槽内。')],
    alternatives: [installationItem('从侧板钻孔出线。')],
  };
  const merged = mergeInstallationText(existing, draft);

  assert.equal(merged, ['安装要点', '开槽宽 10 mm。', '开槽深 10 mm。', '', '安装步骤',
    '1. 开槽。', '2. 将灯体推入槽内。', '', '可选安装方案', '从侧板钻孔出线。'].join('\r\n'));
  assert.equal(mergeInstallationText(merged, draft), merged);
  assert.equal(mergeInstallationText('', { installation_notes: [], steps: draft.steps, alternatives: [] }),
    '安装步骤\n1. 开槽\n2. 将灯体推入槽内。');
});

const partRow = (id, model, appliesTo = [], common = false) => ({
  id, name: '卡扣', marker: '②', model, applies_to: appliesTo, common, source_id: '图2',
});

function installationWithParts(parts, exact = parts.map(row => row.id)) {
  return {
    installation_notes: [], alternatives: [], parts,
    steps: [{ ...installationItem('将卡扣推入槽内。'), template: '将[[P1]]推入槽内。',
      part_refs: [{ slot: '[[P1]]', name: '卡扣', exact_row_ids: exact,
        candidate_row_ids: parts.map(row => row.id) }] }],
  };
}

test('共用安装步骤按目标产品型号分别填配件，写入文字只保留正文', () => {
  const result = installationWithParts([partRow('a', 'CK-01', ['A']), partRow('b', 'CK-02', ['B'])]);
  const a = renderInstallationForProduct(result, 'ａ');
  const b = renderInstallationForProduct(result, 'B');
  const c = renderInstallationForProduct(result, 'C');

  assert.equal(mergeInstallationText('', a), '安装步骤\n1. 将卡扣（CK-01）推入槽内。');
  assert.equal(mergeInstallationText('', b), '安装步骤\n1. 将卡扣（CK-02）推入槽内。');
  assert.deepEqual(a.steps[0].source_ids, ['图1', '图2']);
  assert.equal(c.steps[0].text, '将卡扣推入槽内。');
  assert.deepEqual(c.steps[0].partReviews[0].options, []);
  assert.equal(renderInstallationForProduct(result, '').steps[0].text, '将卡扣推入槽内。');
});

test('没有明确的唯一配件匹配时保持名称，手动选择只影响该产品的草稿', () => {
  const result = installationWithParts([partRow('no-scope', 'CK-03'), partRow('alt', 'CK-04', [], true)]);
  const [step] = renderInstallationForProduct(result, 'A').steps;
  const [{ key, options }] = step.partReviews;

  assert.deepEqual(options.map(row => row.model), ['CK-03', 'CK-04']);
  assert.equal(step.text, '将卡扣推入槽内。');
  assert.equal(renderInstallationForProduct(result, 'A', { [key]: 'no-scope' }).steps[0].text, '将卡扣（CK-03）推入槽内。');
  assert.equal(renderInstallationForProduct(result, 'A', { [key]: KEEP_PART_NAME }).steps[0].text, step.text);
  assert.equal(renderInstallationForProduct(result, 'B').steps[0].text, step.text);
  const visual = installationWithParts([partRow('alt', 'CK-04', [], true)], []);
  assert.equal(renderInstallationForProduct(visual, 'A').steps[0].text, step.text);
  const unscoped = installationWithParts([partRow('no-scope', 'CK-03')]);
  assert.equal(renderInstallationForProduct(unscoped, 'A').steps[0].text, step.text);
  const missing = installationWithParts([partRow('no-code', '', [], true)]);
  assert.equal(renderInstallationForProduct(missing, 'A').steps[0].text, step.text);
});

const allocationProduct = (id, model, itemNo = '', variants = []) => ({
  id, name: id, model, itemNo, tech: { params: [], variants },
});

test('补充说明的参数表按产品分配后，单型号参数直接进入普通参数', () => {
  const product = { ...allocationProduct('lamp', 'LA01'), supplement: true };
  const rows = allocateTechRows([{ 型号: 'la01', 功率: '8W' }], [product]);
  const { preview, ambiguous } = buildAllocatedTechPreview(product, rows, [{ name: '电压', value: '12V' }]);
  assert.equal(ambiguous, false);
  assert.deepEqual(applyTechMerge(product.tech, preview), {
    params: [{ name: '电压', value: '12V' }, { name: '功率', value: '8W' }], variants: [],
  });
  const mixed = { variants: [{ 型号: 'LA01', 功率: '8W' }, { 型号: 'LA02', 功率: '12W' }] };
  assert.equal(flattenSupplementModel(mixed, ['LA01']), mixed);
  const sameModel = allocateTechRows([{ 型号: 'LA01', 功率: '8W' }, { 型号: 'LA01', 长度: '500mm' }], [product]);
  const repeat = buildAllocatedTechPreview(product, sameModel, []);
  assert.equal(repeat.ambiguous, false);
  assert.deepEqual(repeat.preview.params.map(({ name }) => name), ['功率', '长度']);
  assert.deepEqual(repeat.preview.variants, []);
  assert.deepEqual(flattenSupplementModel({ variants: [{ 功率: '8W' }] }, ['LA01']), {
    params: [{ name: '功率', value: '8W' }], variants: [],
  });
});

test('参数表按独立型号或货号唯一匹配，歧义和未知型号留待确认', () => {
  const products = [
    allocationProduct('A', '001-A', 'SKU-A'),
    allocationProduct('B', '002-B', 'SKU-B', [[{ key: '型号', value: 'B-1' }]]),
    allocationProduct('C', '002-B', 'SKU-C'),
  ];
  const variants = [
    { 型号: ' 001-a ', 直径: '8 mm' },
    { 订货号: 'SKU-B', 直径: '10 mm' },
    { SKU: 'B-1', 直径: '11 mm' },
    { 型号: '002-B' },
    { 型号: '001-A', 货号: 'SKU-C' },
    { 型号: '1-A' },
    { 直径: '12 mm' },
  ];
  assert.deepEqual(allocateTechRows(variants, products).map(row => row.productId), ['A', 'B', 'B', '', '', '', '']);
});

test('按产品分别预览、合并型号别名，公共参数只进入勾选的产品', () => {
  const a = allocationProduct('A', '001-A', 'SKU-A', [[
    { key: '型号', value: '001-A' }, { key: '直径', value: '7 mm' },
  ]]);
  const b = allocationProduct('B', '002-B', 'SKU-B');
  const rows = allocateTechRows([
    { 产品型号: '001-a', 直径: '8 mm' }, { 订货号: 'SKU-B', 直径: '10 mm' }, { 型号: '003-C', 直径: '12 mm' },
  ], [a, b]);
  const aPreview = buildAllocatedTechPreview(a, rows.filter(row => row.productId === 'A'), []);
  assert.equal(aPreview.preview.variants[0].targetIndex, 0);
  assert.deepEqual(aPreview.preview.variants[0].fields.find(field => field.key === '直径'), {
    key: '直径', incoming: '8 mm', existing: '7 mm', kind: 'conflict',
  });
  assert.equal(applyTechMerge(a.tech, aPreview.preview, 'keep').variants[0][1].value, '7 mm');
  assert.equal(applyTechMerge(a.tech, aPreview.preview, 'overwrite').variants[0][1].value, '8 mm');
  const bPreview = buildAllocatedTechPreview(b, rows.filter(row => row.productId === 'B'), [{ name: '材质', value: '铝' }]);
  const bResult = applyTechMerge(b.tech, bPreview.preview, 'keep');
  assert.deepEqual(bResult.params, [{ name: '材质', value: '铝' }]);
  assert.deepEqual(Object.fromEntries(bResult.variants[0].map(({ key, value }) => [key, value])), {
    型号: 'SKU-B', 订货号: 'SKU-B', 直径: '10 mm',
  });
  assert.equal(rows[2].productId, '');
});

test('参数表完全重复的行去重，同一型号的冲突行标记歧义', () => {
  const product = allocationProduct('A', '001-A');
  const rows = allocateTechRows([
    { 型号: '001-A', 直径: '8 mm' }, { 直径: '8 mm', 型号: '001-A' }, { 型号: '001-A', 直径: '9 mm' },
  ], [product]);
  assert.equal(rows.length, 2);
  assert.equal(buildAllocatedTechPreview(product, rows, []).ambiguous, true);
});

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
