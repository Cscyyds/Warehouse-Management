/**
 * 单测：绑定塑料盒展示文本（src/utils/plasticBoxDisplay.ts）
 *
 * 背景：合包详情「当前位置-绑定塑料盒」原写法把编码与名称直接拼接，而现网塑料盒
 * 建档绝大多数「名称=编码」，于是渲染成 `SLH141754 SLH141754` 两段同样的值。
 * 产品口径改为只显示名称（`bound_plastic_box_name`），本测试锁住该语义，
 * 防止后续又改回编码+名称拼接。
 *
 * 运行：npm run test:plastic-box-name
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatPlasticBoxName } from './plasticBoxDisplay.ts'

test('名称与编码同名时只显示名称一份（截图场景 SLH141754）', () => {
  assert.equal(formatPlasticBoxName('SLH141754', 'SLH141754'), 'SLH141754')
})

test('名称与编码不同时只显示名称，不拼编码', () => {
  assert.equal(formatPlasticBoxName('PBOX001', '1号塑料盒'), '1号塑料盒')
})

test('名称缺失时回退编码，不出现空白单元格', () => {
  assert.equal(formatPlasticBoxName('PBOX001', ''), 'PBOX001')
  assert.equal(formatPlasticBoxName('PBOX001', null), 'PBOX001')
  assert.equal(formatPlasticBoxName('PBOX001', undefined), 'PBOX001')
})

test('编码与名称都缺失时返回空串', () => {
  assert.equal(formatPlasticBoxName(undefined, undefined), '')
  assert.equal(formatPlasticBoxName('', ''), '')
})

test('首尾空白不残留到展示文本', () => {
  assert.equal(formatPlasticBoxName(' SLH141754 ', ' SLH141754 '), 'SLH141754')
  assert.equal(formatPlasticBoxName('PBOX001', ' 1号塑料盒 '), '1号塑料盒')
})
