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
  matchCategoryOption,
  mergeDeletedProductCrops,
  mergeProductsPayload,
  normalizeNewManualCrops,
  stripProductPatches,
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

test('CATEGORY_OPTIONS：16 个类目名、无一级前缀、与系列无交集', () => {
  assert.equal(CATEGORY_OPTIONS.length, 16);
  assert.equal(new Set(CATEGORY_OPTIONS).size, 16, '清单不得重复');
  for (const c of CATEGORY_OPTIONS) {
    // 一级分组已取消：类目名里不得再出现 " - " 前缀，也不得带编号
    assert.ok(!c.includes(' - '), `不应带一级前缀：${c}`);
    assert.ok(!/^\d/.test(c), `不应带编号：${c}`);
  }
  // 合并后的类目存在、旧的两条已移除
  assert.ok(CATEGORY_OPTIONS.includes('柜内收纳机构与分隔件'));
  assert.ok(!CATEGORY_OPTIONS.some((c) => c.includes('柜内灵动机构')));
  // 品类与品牌系列互相独立：系列名不得出现在品类清单里
  assert.ok(!CATEGORY_OPTIONS.includes(INITIAL.series_name));
});

test('matchCategoryOption：历史写法折算到当前 16 类目，认不出返回空', () => {
  assert.equal(matchCategoryOption('衣柜收纳系统'), '衣柜收纳系统');
  // 旧「一级大类 - 二级类目」全串
  assert.equal(matchCategoryOption('全屋收纳与内分隔 - 衣柜收纳系统'), '衣柜收纳系统');
  // 旧两段式「类目 - 诺米一级」
  assert.equal(matchCategoryOption('衣柜收纳系统 - 衣柜收纳'), '衣柜收纳系统');
  // 已合并的旧类目名
  assert.equal(matchCategoryOption('柜内灵动机构（旋转/抽拉）'), '柜内收纳机构与分隔件');
  assert.equal(matchCategoryOption('柜内分隔与抽拉件'), '柜内收纳机构与分隔件');
  // 空 / 认不出 → 不杜撰
  assert.equal(matchCategoryOption(''), '');
  assert.equal(matchCategoryOption('瞎写的类目'), '');
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

test('mergeProductsPayload：删除产品覆盖自动通过与既有 approve，且保留已算出的 patch', () => {
  const snapshot = [
    { product_candidate_id: 'pc_1', review_action: null },       // 未审核 → 自动通过
    { product_candidate_id: 'pc_2', review_action: 'approve' },  // 上一批已通过
  ];
  const approvals = [{ product_candidate_id: 'pc_1', action: 'approve' }];
  assert.deepEqual(
    mergeProductsPayload(approvals, {}, snapshot, [{ product_candidate_id: 'pc_1' }]),
    [{ product_candidate_id: 'pc_1', action: 'reject' }]
  );
  assert.deepEqual(
    mergeProductsPayload([], {}, snapshot, [{ product_candidate_id: 'pc_2' }]),
    [{ product_candidate_id: 'pc_2', action: 'reject' }]
  );
  // 删除产品上残留的 patch 不丢（后端先合并 patch 再按 reject 过滤，行为无副作用）
  assert.deepEqual(
    mergeProductsPayload([], { pc_2: { product_basic: { product_name: 'X' } } }, snapshot,
      [{ product_candidate_id: 'pc_2' }]),
    [{ product_candidate_id: 'pc_2', action: 'reject', product_patch: { product_basic: { product_name: 'X' } } }]
  );
});

test('mergeDeletedProductCrops：删除产品的裁剪强制 reject，改绑其他产品的决策保留', () => {
  const bindings = [
    { source_crop_id: 'c1', product_candidate_id: 'p1' },
    { source_crop_id: 'c2', product_candidate_id: 'p1' },
    { source_crop_id: 'c3', product_candidate_id: 'p1' },
    { source_crop_id: 'c4', product_candidate_id: 'p2' },
  ];
  const decisions = [
    { source_crop_id: 'c1', action: 'approve' },
    { source_crop_id: 'c2', action: 'recrop' },
    { source_crop_id: 'c3', action: 'approve', product_candidate_id: 'p2' },  // 人工改绑到未删除产品
    { source_crop_id: 'c4', action: 'approve' },
  ];
  assert.deepEqual(mergeDeletedProductCrops(decisions, bindings, ['p1']), [
    { source_crop_id: 'c1', action: 'reject' },
    { source_crop_id: 'c2', action: 'reject' },
    { source_crop_id: 'c3', action: 'approve', product_candidate_id: 'p2' },
    { source_crop_id: 'c4', action: 'approve' },
  ]);
  // 无删除产品：原决策原样返回（去重保序）
  assert.deepEqual(
    mergeDeletedProductCrops([{ source_crop_id: 'c1', action: 'approve' }], bindings, []),
    [{ source_crop_id: 'c1', action: 'approve' }]
  );
  // 此前批次已通过、本批无决策的裁剪：按快照归属补 reject
  assert.deepEqual(
    mergeDeletedProductCrops([], [{ source_crop_id: 'c9', product_candidate_id: 'p1' }], ['p1']),
    [{ source_crop_id: 'c9', action: 'reject' }]
  );
});

test('normalizeNewManualCrops：补全人工卡片字段；非 approve/产品失效/字段不全则剔除', () => {
  const refs = [
    { source_crop_id: 'manual_a', product_candidate_id: 'p1', pdf_bbox: [0.1, 0.1, 0.5, 0.5], pdf_page_number: 2 },
    { source_crop_id: 'manual_b', product_candidate_id: 'p1', pdf_bbox: [0.1, 0.1, 0.5, 0.5], pdf_page_number: 2 },
    { source_crop_id: 'manual_c', product_candidate_id: 'p_deleted', pdf_bbox: [0.1, 0.1, 0.5, 0.5], pdf_page_number: 2 },
    { source_crop_id: 'manual_d', product_candidate_id: 'p_ghost', pdf_bbox: [0.1, 0.1, 0.5, 0.5], pdf_page_number: 2 },
  ];
  const decisions = [
    // 通用「通过」按钮覆盖后丢了 product/bbox/page → 用 item 权威字段补全
    { source_crop_id: 'manual_a', action: 'approve' },
    { source_crop_id: 'manual_b', action: 'reject' },
    { source_crop_id: 'manual_c', action: 'approve' },
    { source_crop_id: 'manual_d', action: 'approve' },
    { source_crop_id: 'manual_missing', action: 'approve' },
    // 已入库的 manual_ 裁剪不受影响（reject 合法）
    { source_crop_id: 'manual_persisted', action: 'reject', product_candidate_id: 'p1' },
    { source_crop_id: 'sc_1', action: 'approve' },
  ];
  const { decisions: out, dropped } = normalizeNewManualCrops(
    decisions, refs, ['manual_persisted'], ['p_deleted'], ['p1']
  );
  assert.deepEqual(out, [
    {
      source_crop_id: 'manual_a', action: 'approve', product_candidate_id: 'p1',
      pdf_bbox: [0.1, 0.1, 0.5, 0.5], pdf_page_number: 2,
    },
    { source_crop_id: 'manual_persisted', action: 'reject', product_candidate_id: 'p1' },
    { source_crop_id: 'sc_1', action: 'approve' },
  ]);
  assert.deepEqual(dropped, ['manual_b', 'manual_c', 'manual_d', 'manual_missing']);
});

test('countProductEdits：与初值不同才计数', () => {
  const initialByPcid = { pc_1: INITIAL, pc_2: INITIAL };
  assert.equal(countProductEdits({}, initialByPcid), 0);
  assert.equal(countProductEdits({ pc_1: { product_name: INITIAL.product_name } }, initialByPcid), 0);
  assert.equal(countProductEdits({ pc_1: { product_name: '改' }, pc_2: { installation: 'x' } }, initialByPcid), 2);
});

// ── 回归：预览回放不得污染 diff 基准（2026-11-03「改完提交，导出回原样」） ──
// 现象：用户在审核页改技术参数 → 切走再切回 Excel 预览（每次打开都刷新）→
// 提交当前批次 → 导出还是原值。根因是刷新预览时把「未提交的产品编辑」一起
// 回放了，接口返回的 fields 被当成初值基准 → buildProductPatch 判定没改。

test('回归：初值若被回灌成「改后的值」，技术参数补丁会被判成未修改而丢失', () => {
  const edit = { techParams: { params: [{ name: '承重', value: '20kg' }], variants: [] } };
  // 被污染的基准 = 预览已应用了这条未提交编辑
  const polluted = { tech_params_structured: { params: [{ name: '承重', value: '20kg' }], variants: [] } };
  assert.deepEqual(buildProductPatch(edit, polluted), {});
  // 干净基准（服务端已落库的原值）→ 补丁正常产出
  const clean = { tech_params_structured: { params: [], variants: [] } };
  assert.ok(Object.keys(buildProductPatch(edit, clean)).length > 0);
});

test('stripProductPatches：预览载荷保留审批动作、剥掉文字补丁，且不改原数组', () => {
  const products = [
    {
      product_candidate_id: 'pc_1',
      action: 'approve',
      product_patch: { product_specification: { technical_parameters: [{ parameter_name: '承重', parameter_value: '20kg' }] } },
    },
    { product_candidate_id: 'pc_2', action: 'reject', product_patch: {} },
    { product_candidate_id: 'pc_3', action: 'approve' },
  ];
  const out = stripProductPatches(products);
  assert.deepEqual(out, [
    { product_candidate_id: 'pc_1', action: 'approve' },
    { product_candidate_id: 'pc_2', action: 'reject' },
    { product_candidate_id: 'pc_3', action: 'approve' },
  ]);
  // 原载荷不被修改（提交出口还要用它）
  assert.ok('product_patch' in products[0]);
  assert.equal(out.length, products.length);
  assert.deepEqual(stripProductPatches(null), []);
});
