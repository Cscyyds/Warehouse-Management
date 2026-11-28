// 技术参数结构化编辑纯逻辑单测（techParams.ts，方案 A）。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/techParams.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicateParamNames,
  inheritParamKeys,
  inheritVariantKeys,
  isVariantIdentityKey,
  sharedVariantValues,
  techEditFromFields,
  techEquals,
  techPatch,
} from './techParams.ts';

const FIELDS = {
  params: [{ name: '长度', value: '500mm' }, { name: '宽度', value: '30mm' }],
  variants: [{ 型号: 'D123', 标称长度: '500mm' }],
};

test('techEditFromFields：初值 → 编辑态（变体 dict → 键值对数组保持插入序）', () => {
  const state = techEditFromFields(FIELDS);
  assert.deepEqual(state.params, [
    { name: '长度', value: '500mm' }, { name: '宽度', value: '30mm' },
  ]);
  assert.deepEqual(state.variants, [[
    { key: '型号', value: 'D123' }, { key: '标称长度', value: '500mm' },
  ]]);
  assert.deepEqual(techEditFromFields(undefined), { params: [], variants: [] });
});

test('techPatch：组装 product_specification（参数 parameter_name/value + 变体原样行 + 清空旧来源）', () => {
  const state = techEditFromFields(FIELDS);
  state.params.push({ name: '承重', value: '35kg' });
  state.variants.push([{ key: '型号', value: 'D456' }]);
  assert.deepEqual(techPatch(state), {
    product_specification: {
      technical_parameters: [
        { parameter_name: '长度', parameter_value: '500mm' },
        { parameter_name: '宽度', parameter_value: '30mm' },
        { parameter_name: '承重', parameter_value: '35kg' },
        { 型号: 'D123', 标称长度: '500mm' },
        { 型号: 'D456' },
      ],
      other_parameters: { common_parameters: [], model_variants: [] },
    },
  });
});

test('techPatch：空行过滤（无名/无值参数、无键属性、空变体行丢弃）', () => {
  const state = {
    params: [{ name: '  ', value: 'x' }, { name: '长度', value: ' ' }, { name: '宽度', value: '30mm' }],
    variants: [[{ key: '', value: 'x' }], [{ key: '型号', value: '' }]],
  };
  assert.deepEqual(techPatch(state), {
    product_specification: {
      technical_parameters: [
        { parameter_name: '宽度', parameter_value: '30mm' },
        { 型号: '' },          // 键有效值空：保留（用户可能正在编辑）
      ],
      other_parameters: { common_parameters: [], model_variants: [] },
    },
  });
  // 全清空 = 删除全部参数
  assert.deepEqual(techPatch({ params: [], variants: [] }), {
    product_specification: { technical_parameters: [], other_parameters: { common_parameters: [], model_variants: [] } },
  });
});

test('techEquals：改回原样=等价不发送；任何改动=不等价', () => {
  const same = techEditFromFields(FIELDS);
  assert.equal(techEquals(same, FIELDS), true);
  assert.equal(techEquals(undefined, FIELDS), true);
  const changed = techEditFromFields(FIELDS);
  changed.params[0].value = '600mm';
  assert.equal(techEquals(changed, FIELDS), false);
  // 仅空行差异（归一化后相同）= 等价
  const padded = techEditFromFields(FIELDS);
  padded.params.push({ name: ' ', value: ' ' });
  assert.equal(techEquals(padded, FIELDS), true);
});

test('inheritParamKeys：只补上一产品缺失的参数名，值留空，已有同名值不动', () => {
  const current = {
    params: [{ name: '长度', value: '600mm' }, { name: '承重', value: '35kg' }],
    variants: [[{ key: '型号', value: 'D456' }]],
  };
  const previous = {
    params: [
      { name: '长度', value: '500mm' },
      { name: '宽度', value: '30mm' },
      { name: ' 宽度 ', value: '30mm' },   // 重复键去重
      { name: ' ', value: 'x' },           // 空键忽略
      { name: '材质', value: '' },          // 键有效即继承（值不继承）
    ],
    variants: [[{ key: '型号', value: 'D123' }]],
  };
  const next = inheritParamKeys(current, previous);
  assert.deepEqual(next.params, [
    { name: '长度', value: '600mm' },   // 已有同名：保留当前值
    { name: '承重', value: '35kg' },
    { name: '宽度', value: '' },
    { name: '材质', value: '' },
  ]);
  assert.deepEqual(next.variants, [[{ key: '型号', value: 'D456' }]], '变体不动');
  // 不修改入参
  assert.deepEqual(current.params[0], { name: '长度', value: '600mm' });
});

test('inheritParamKeys：无可继承返回 null（无上一产品 / 键已齐 / 上一产品无键）', () => {
  assert.equal(inheritParamKeys({ params: [], variants: [] }, undefined), null);
  assert.equal(inheritParamKeys(
    { params: [{ name: '长度', value: '' }], variants: [] },
    { params: [{ name: '长度', value: '500mm' }], variants: [] }
  ), null);
  assert.equal(inheritParamKeys(undefined, { params: [], variants: [] }), null);
  // 当前为空：仅继承键、全部空值
  assert.deepEqual(
    inheritParamKeys(undefined, { params: [{ name: '长度', value: '500mm' }], variants: [] }),
    { params: [{ name: '长度', value: '' }], variants: [] }
  );
});

test('sharedVariantValues：仅返回每个变体都有且值一致的键', () => {
  const shared = sharedVariantValues([
    [{ key: '型号', value: 'D123' }, { key: '产品名称', value: '沙比利菜板' }, { key: '颜色', value: '白色' }],
    [{ key: '型号', value: 'D456' }, { key: '产品名称', value: '沙比利菜板' }],
    [{ key: '型号', value: 'D789' }, { key: '产品名称', value: '沙比利菜板' }, { key: '备注', value: '' }],
  ]);
  // 型号值各不相同、颜色/备注不是每个变体都有、备注值为空 → 都不算共享
  assert.deepEqual(shared, { 产品名称: '沙比利菜板' });
  assert.deepEqual(sharedVariantValues([]), {});
  assert.deepEqual(sharedVariantValues(undefined), {});
});

test('sharedVariantValues：型号/货号身份键永不共享（单变体也不复制型号）', () => {
  assert.deepEqual(
    sharedVariantValues([[{ key: '型号', value: 'D123' }, { key: '产品名称', value: '沙比利菜板' }]]),
    { 产品名称: '沙比利菜板' }
  );
  assert.equal(isVariantIdentityKey(' 型号 '), true);
  assert.equal(isVariantIdentityKey('货号'), true);
  assert.equal(isVariantIdentityKey('产品名称'), false);
});

test('inheritVariantKeys：共享值自动带出，差异键留空', () => {
  const previous = [
    { key: '型号', value: 'D456' },
    { key: '产品名称', value: '沙比利菜板' },
  ];
  assert.deepEqual(
    inheritVariantKeys(previous, { 产品名称: '沙比利菜板' }),
    [
      { key: '型号', value: '' },
      { key: '产品名称', value: '沙比利菜板' },
    ]
  );
});

test('inheritVariantKeys：新变体沿用上一变体的键，值留空、保序去重', () => {
  const previous = [
    { key: '型号', value: 'D123' },
    { key: '标称长度', value: '500mm' },
    { key: ' 型号 ', value: 'D999' },   // 重复键去重（保留首次出现）
    { key: ' ', value: 'x' },           // 空键忽略
    { key: '颜色', value: '' },          // 键有效即继承（值不继承）
  ];
  assert.deepEqual(inheritVariantKeys(previous), [
    { key: '型号', value: '' },
    { key: '标称长度', value: '' },
    { key: '颜色', value: '' },
  ]);
  // 不修改入参（组件里传入的是深拷贝，仍守住纯函数约束）
  assert.deepEqual(previous[0], { key: '型号', value: 'D123' });
});

test('inheritVariantKeys：无上一变体或上一变体无有效键时回落到「型号」', () => {
  assert.deepEqual(inheritVariantKeys(undefined), [{ key: '型号', value: '' }]);
  assert.deepEqual(inheritVariantKeys([]), [{ key: '型号', value: '' }]);
  assert.deepEqual(
    inheritVariantKeys([{ key: ' ', value: 'x' }, { key: '', value: '' }]),
    [{ key: '型号', value: '' }]
  );
});

test('duplicateParamNames：同名软提醒', () => {
  assert.deepEqual(
    duplicateParamNames([{ name: '长度', value: '1' }, { name: '长度', value: '2' }, { name: '宽度', value: '3' }]),
    ['长度']
  );
  assert.deepEqual(duplicateParamNames([{ name: '长度', value: '1' }]), []);
});
