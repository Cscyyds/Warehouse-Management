// Excel 文字预览与编辑纯逻辑单测（excelPreview.ts）——方案 §6 测试计划 6~8。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/excelPreview.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_OPTIONS,
  batchProductIds,
  buildProductPatch,
  countProductEdits,
  featuresToText,
  mergeProductsPayload,
  textToFeatures,
} from './excelPreview.ts';
import { techEditFromFields } from './techParams.ts';

// ── 6. 一行一条互转 ───────────────────────────────────

test('featuresToText / textToFeatures 往返：空行剔除、首尾空白去除', () => {
  assert.equal(featuresToText(['静音阻尼', '三节伸缩']), '静音阻尼\n三节伸缩');
  assert.equal(featuresToText(undefined), '');
  assert.equal(featuresToText([]), '');

  assert.deepEqual(textToFeatures('静音阻尼\n三节伸缩'), ['静音阻尼', '三节伸缩']);
  assert.deepEqual(textToFeatures('  a  \n\n b \n'), ['a', 'b']);   // trim + 空行过滤
  // Windows 粘贴（\r\n）与全空白行：trim 吸收 \r，不产生空条目
  assert.deepEqual(textToFeatures('甲\r\n\r\n  \r\n乙\r\n'), ['甲', '乙']);
  assert.deepEqual(textToFeatures('1.带编号也没关系\n2.第二行'), ['1.带编号也没关系', '2.第二行']);
  assert.deepEqual(textToFeatures(''), []);
  // 往返稳定
  assert.deepEqual(textToFeatures(featuresToText(['a', 'b'])), ['a', 'b']);
});

test('mergeProductsPayload：空 approvals + 空 patches 产生空载荷', () => {
  assert.deepEqual(mergeProductsPayload([], {}, []), []);
  assert.deepEqual(mergeProductsPayload([], { p1: {} }, []), []);   // 空 patch 不产生载荷
});

test('buildProductPatch：featuresText 全空白行 = 删除全部特点', () => {
  const patch = buildProductPatch({ featuresText: ' \n \n' }, { ...INITIAL });
  assert.deepEqual(patch, { product_description: { features: [] } });
});

test('buildProductPatch：技术参数编辑 → product_specification（整体替换+清空旧来源）', () => {
  const structured = {
    params: [{ name: '长度', value: '500mm' }],
    variants: [{ 型号: 'D123' }],
  };
  const initial = { ...INITIAL, tech_params_structured: structured };
  // 未触碰 / 初值等价 → 不发送
  assert.deepEqual(buildProductPatch({ techParams: techEditFromFields(structured) }, initial), {});
  // 编辑：加一个参数 + 一个变体
  const edit = techEditFromFields(structured);
  edit.params.push({ name: '承重', value: '35kg' });
  edit.variants.push([{ key: '型号', value: 'D456' }]);
  const patch = buildProductPatch({ techParams: edit }, initial);
  assert.deepEqual(patch, {
    product_specification: {
      technical_parameters: [
        { parameter_name: '长度', parameter_value: '500mm' },
        { parameter_name: '承重', parameter_value: '35kg' },
        { 型号: 'D123' },
        { 型号: 'D456' },
      ],
      other_parameters: { common_parameters: [], model_variants: [] },
    },
  });
});

test('batchProductIds：批次图片归属产品去重保序、剔除空值', () => {
  assert.deepEqual(
    batchProductIds([
      { product_candidate_id: 'pc_2' }, { product_candidate_id: 'pc_1' },
      { product_candidate_id: 'pc_2' }, { product_candidate_id: '' },
      { product_candidate_id: null }, {},
    ]),
    ['pc_2', 'pc_1']
  );
  assert.deepEqual(batchProductIds([]), []);
});

// ── 7. patch 构造：只发改过的字段 ─────────────────────

const INITIAL = {
  product_name: 'D215 三节轨',
  series_name: '子弹头系列',
  features: ['静音阻尼', '三节伸缩'],
  installation: '先固定轨道\n再装柜体',
  precautions: '注意孔距',
};

test('buildProductPatch：未触碰/改回原样不发送，改动才落对应键', () => {
  assert.deepEqual(buildProductPatch(undefined, INITIAL), {});
  assert.deepEqual(buildProductPatch({}, INITIAL), {});
  // 全部字段与初值相同 → 空 patch
  assert.deepEqual(buildProductPatch({
    product_name: INITIAL.product_name,
    series_name: INITIAL.series_name,
    featuresText: featuresToText(INITIAL.features),
    installation: INITIAL.installation,
    precautions: INITIAL.precautions,
  }, INITIAL), {});

  // 改名称 + 追加一条特点 + 清空注意事项
  const patch = buildProductPatch({
    product_name: 'D215 三节轨（改）',
    featuresText: '静音阻尼\n三节伸缩\n新增特点',
    precautions: '',
  }, INITIAL);
  assert.deepEqual(patch, {
    product_basic: { product_name: 'D215 三节轨（改）' },
    product_description: {
      features: ['静音阻尼', '三节伸缩', '新增特点'],
      precautions: '',
    },
  });
});

test('buildProductPatch：品类改选/清空落 product_basic.product_category，未改不发送', () => {
  const initial = { ...INITIAL, product_category: '' };
  // 初值未识别 → 下拉补选一条闭集值
  assert.deepEqual(
    buildProductPatch({ product_category: '基础结构与传动 - 抽屉与滑轨系统' }, initial),
    { product_basic: { product_category: '基础结构与传动 - 抽屉与滑轨系统' } }
  );
  // 未触碰 / 改回初值 → 不发送
  assert.deepEqual(buildProductPatch({ product_category: '' }, initial), {});
  const initialCat = { ...INITIAL, product_category: '基础结构与传动 - 抽屉与滑轨系统' };
  assert.deepEqual(
    buildProductPatch({ product_category: '基础结构与传动 - 抽屉与滑轨系统' }, initialCat), {}
  );
  // 有初值时选回「未识别」→ 提交空串（清空语义）
  assert.deepEqual(
    buildProductPatch({ product_category: '' }, initialCat),
    { product_basic: { product_category: '' } }
  );
});

test('CATEGORY_OPTIONS：17 条闭集、全串格式（一级 - 二级）、与系列无交集', () => {
  assert.equal(CATEGORY_OPTIONS.length, 17);
  assert.equal(new Set(CATEGORY_OPTIONS).size, 17, '清单不得重复');
  for (const c of CATEGORY_OPTIONS) {
    // 全串恰好一个 " - " 分隔符（二级类目「旋转/抽拉」不含该分隔符）
    assert.equal(c.split(' - ').length, 2, `格式异常：${c}`);
  }
  // 品类与品牌系列互相独立：系列名不得出现在品类清单里
  assert.ok(!CATEGORY_OPTIONS.includes(INITIAL.series_name));
});

// ── 8. 提交出口合并 ───────────────────────────────────

test('mergeProductsPayload：未审核自动 approve、已审核保留 action、空 patch 不产生载荷', () => {
  const snapshot = [
    { product_candidate_id: 'pc_1', review_action: 'reject' },   // 此前被拒绝
    { product_candidate_id: 'pc_2', review_action: 'approve' },  // 上一批已通过
    { product_candidate_id: 'pc_3', review_action: null },       // 未审核
  ];
  const approvals = [{ product_candidate_id: 'pc_3', action: 'approve' }];
  const patches = {
    pc_1: { product_description: { features: ['x'] } },  // 拒绝产品上的编辑：保留 reject
    pc_2: { product_basic: { product_name: '改名' } },    // 已通过产品：保留 approve + patch
    pc_4: {},                                             // 空 patch：不产生载荷
  };
  assert.deepEqual(mergeProductsPayload(approvals, patches, snapshot), [
    { product_candidate_id: 'pc_3', action: 'approve' },
    { product_candidate_id: 'pc_1', action: 'reject', product_patch: { product_description: { features: ['x'] } } },
    { product_candidate_id: 'pc_2', action: 'approve', product_patch: { product_basic: { product_name: '改名' } } },
  ]);
  // 快照里也不存在且不在 approvals 的（脏数据）→ 默认 approve 兜底
  assert.deepEqual(
    mergeProductsPayload([], { pc_9: { product_basic: { product_name: 'n' } } }, []),
    [{ product_candidate_id: 'pc_9', action: 'approve', product_patch: { product_basic: { product_name: 'n' } } }]
  );
});

test('countProductEdits：与初值不同才计数', () => {
  const initialByPcid = { pc_1: INITIAL, pc_2: INITIAL };
  assert.equal(countProductEdits({}, initialByPcid), 0);
  assert.equal(countProductEdits({ pc_1: { product_name: INITIAL.product_name } }, initialByPcid), 0);
  assert.equal(countProductEdits({ pc_1: { product_name: '改' }, pc_2: { installation: 'x' } }, initialByPcid), 2);
});
