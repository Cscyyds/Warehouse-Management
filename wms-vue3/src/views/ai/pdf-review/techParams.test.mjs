// 技术参数结构化编辑纯逻辑单测（techParams.ts，方案 A）。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-review/techParams.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicateParamNames,
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

test('duplicateParamNames：同名软提醒', () => {
  assert.deepEqual(
    duplicateParamNames([{ name: '长度', value: '1' }, { name: '长度', value: '2' }, { name: '宽度', value: '3' }]),
    ['长度']
  );
  assert.deepEqual(duplicateParamNames([{ name: '长度', value: '1' }]), []);
});
