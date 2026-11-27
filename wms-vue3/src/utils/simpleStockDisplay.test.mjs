import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatStockDecimal, inventoryDisplayMode, simplePlaceLabel, simplePlaceDisplay, simpleStockPositionRows, sumSimpleStock } from './simpleStockDisplay.ts'

test('无条码数量和毫米长度保留精度，大数不经过 Number', () => {
  assert.equal(formatStockDecimal('9007199254740993.123456'), '9,007,199,254,740,993.123456')
  assert.equal(formatStockDecimal('0.0001'), '0.0001')
  assert.equal(formatStockDecimal('1200.500000'), '1,200.5')
  assert.equal(formatStockDecimal('0.0000'), '0')
  for (const value of [null, undefined, '', '***', 'NaN']) assert.equal(formatStockDecimal(value), '-')
})

test('只合计无条码余额一次，四位小数相加不丢精度', () => {
  assert.equal(sumSimpleStock([{ stock_qty: '0.1001' }, { stock_qty: '0.2002' }]), '0.3003')
  assert.equal(sumSimpleStock([{ stock_qty: '99999999999999.9999' }, { stock_qty: '0.0001' }]), '100,000,000,000,000')
  assert.equal(sumSimpleStock([]), '0')
})

test('缺失、隐藏或非法数量不补零，合计不可反推', () => {
  for (const row of [{}, {stock_qty:null}, {stock_qty:''}, {stock_qty:'***'}]) {
    assert.equal(sumSimpleStock([{stock_qty:'2'},row]), '-')
  }
})

test('模式优先采用实时状态；状态不可用时空数组保持未知', () => {
  assert.equal(inventoryDisplayMode([], false, true), 'simple')
  assert.equal(inventoryDisplayMode([], false, false), 'barcode')
  assert.equal(inventoryDisplayMode([], false), 'empty')
  assert.equal(inventoryDisplayMode(undefined, false), 'empty')
  assert.equal(inventoryDisplayMode([{}], false, false), 'barcode')
  assert.equal(inventoryDisplayMode([], true, true), 'simple')
  assert.equal(inventoryDisplayMode([{}], false), 'simple')
  assert.equal(inventoryDisplayMode([], true), 'barcode')
  assert.equal(simplePlaceLabel('POSITION'), '位置')
  assert.equal(simplePlaceLabel('PLASTIC_BOX'), '塑料盒')
  assert.equal(simplePlaceLabel('DISTRIBUTION_SPOT'), '集散位')
  assert.equal(simplePlaceLabel('NEW_TYPE'), '其他存放对象')
})

test('存放对象展示中文名称和编号，不把内部ID或上级位置冒充盒编号', () => {
  assert.deepEqual(simplePlaceDisplay({ place_type: 'PLASTIC_BOX', place_id: 'pbox_internal', box_name: '测试塑料盒', box_code: 'BOX001' }), { name: '测试塑料盒', code: 'BOX001' })
  assert.deepEqual(simplePlaceDisplay({ place_type: 'DISTRIBUTION_SPOT', spot_name: '待发区', spot_no: 'SPOT001' }), { name: '待发区', code: 'SPOT001' })
  assert.deepEqual(simplePlaceDisplay({ place_type: 'POSITION', location_name: '一号货架', floor_no: 1, position_no: 2, position_code: 'POS001' }), { name: '一号货架 · 1层 · 2号位', code: 'POS001' })
  assert.deepEqual(simplePlaceDisplay({ place_type: 'PLASTIC_BOX', place_id: 'pbox_internal', position_code: 'PARENT_POS' }), { name: '', code: '' })
  assert.deepEqual(simplePlaceDisplay({ place_type: 'POSITION', place_id: 'pos_internal' }), { name: '', code: '' })
})

test('同位置不同长度保留余额行，合计只使用原始余额一次', () => {
  const rows=[{balance_id:'a',place_type:'POSITION',length_mm:'1000',stock_qty:'1.1250',positions:[{position_code:'POS001',warehouse_name:'主仓',stock_qty:'1.1250'}]},
    {balance_id:'b',place_type:'PLASTIC_BOX',box_code:'BOX001',length_mm:'2000',stock_qty:'2.3750',positions:[{position_code:'POS001',warehouse_name:'主仓',stock_qty:'2.3750'}]}]
  const displayed=simpleStockPositionRows(rows)
  assert.equal(displayed.length,2)
  assert.notEqual(displayed[0].displayKey,displayed[1].displayKey)
  assert.equal(displayed[0].position.warehouse_name,'主仓')
  assert.equal(displayed[1].box_code,'BOX001')
  assert.equal(sumSimpleStock(rows),'3.5')
})

test('嵌套位置不用于反推被隐藏的余额数量，空资料和旧响应也保留行', () => {
  const hidden=[{balance_id:'h',place_type:'POSITION',positions:[{stock_qty:'99',position_id:null}]}]
  assert.equal(simpleStockPositionRows(hidden).length,1)
  assert.equal(formatStockDecimal(simpleStockPositionRows(hidden)[0].stock_qty),'-')
  assert.equal(sumSimpleStock(hidden),'-')
  const legacy=simpleStockPositionRows([{balance_id:'l',place_type:'POSITION',position_code:'OLD',stock_qty:'0.0001'}])
  assert.equal(legacy[0].position.position_code,'OLD')
  assert.equal(legacy[0].stock_qty,'0.0001')
})
