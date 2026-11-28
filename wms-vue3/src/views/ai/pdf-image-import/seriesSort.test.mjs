// 图片源导入「按系列聚集」纯逻辑单测（seriesSort.ts）。
// 运行：node --experimental-strip-types --test src/views/ai/pdf-image-import/seriesSort.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasOpenBracket, pidValue, seriesKey, seriesSummary, sortBySeries } from './seriesSort.ts';

// ── 1. 系列名提取：真实目录的三种命名 ───────────────────

test('显式「系列」：取到系列二字结尾，括号限定词不进系列名', () => {
  assert.equal(seriesKey('拉斐系列-阻尼衣物皮革篮'), '拉斐系列');
  assert.equal(seriesKey('小犀牛系列(C款)-四段力阻尼铰链'), '小犀牛系列');
  assert.equal(seriesKey('灵犀系列（N款）-三维调节零角度快装三段力'), '灵犀系列');
  assert.equal(seriesKey('紫珑Pro系列-阻尼衣物绒布篮'), '紫珑Pro系列');
  assert.equal(seriesKey('子弹头系列-厚薄门三股力滑入式一字底座铝框'), '子弹头系列');
});

test('破折号/下划线分类：取首个分隔符前的主体', () => {
  assert.equal(seriesKey('玻璃柜—玻璃中岛柜'), '玻璃柜');
  assert.equal(seriesKey('铝材开架—电视柜开架'), '铝材开架');
  assert.equal(seriesKey('3C适配器电源_24V'), '3C适配器电源');
  assert.equal(seriesKey('水槽配件-盆中盆100201044'), '水槽配件');
  assert.equal(seriesKey('木板护墙板型材系统-型材1顶线'), '木板护墙板型材系统');
  assert.equal(seriesKey('护墙板收口型材--5腰线'), '护墙板收口型材');
});

test('无分隔符的独立产品：整名自成一组', () => {
  assert.equal(seriesKey('AI鞋柜净魔方'), 'AI鞋柜净魔方');
  assert.equal(seriesKey('垃圾箱'), '垃圾箱');
  assert.equal(seriesKey('  '), '');
});

test('脏名字护栏：纯数字前缀不当系列名，括号内不切分', () => {
  // 10020120 是商品编码，不是系列
  assert.equal(seriesKey('10020120-立式置物菜板架'), '10020120-立式置物菜板架');
  assert.equal(seriesKey('10020119-解冻板'), '10020119-解冻板');
  // 下划线落在未闭合括号里，切开会得到半截「…开关Ⅱ（2」
  assert.equal(seriesKey('双门控感应功率开关Ⅱ（2_拼线）'), '双门控感应功率开关Ⅱ（2_拼线）');
  assert.equal(hasOpenBracket('双门控感应功率开关Ⅱ（2'), true);
  assert.equal(hasOpenBracket('拉斐系列-阻尼衣物皮革篮'), false);
  assert.equal(hasOpenBracket('门控_amp;手扫感应信号开关Ⅱ'), false);
});

// ── 2. 排序：同系列必须连续 ─────────────────────────────

const RAW = [
  // 后端字典序：449_ < 44_（'9' < '_'），同系列被打散
  { folder: '449_拉斐系列-阻尼高端饰物架', pid: '449', product_name: '拉斐系列-阻尼高端饰物架', image_count: 11 },
  { folder: '44_魅影系列-窄边篮', pid: '44', product_name: '魅影系列-窄边篮', image_count: 5 },
  { folder: '450_拉斐系列-电动升降挂衣架', pid: '450', product_name: '拉斐系列-电动升降挂衣架', image_count: 8 },
  { folder: '45_魅影系列-地柜联动拉篮', pid: '45', product_name: '魅影系列-地柜联动拉篮', image_count: 5 },
  { folder: '463_子弹头系列-厚薄门三股力滑入式一字底座铝框', pid: '463', product_name: '子弹头系列-厚薄门三股力滑入式一字底座铝框', image_count: 3 },
  { folder: '469_灵犀系列（N款）-三维调节零角度快装', pid: '469', product_name: '灵犀系列（N款）-三维调节零角度快装', image_count: 9 },
  { folder: '46_魅影系列-柜门联动拉篮', pid: '46', product_name: '魅影系列-柜门联动拉篮', image_count: 3 },
  { folder: '478_特殊系列-二维快装165°阻尼铰链', pid: '478', product_name: '特殊系列-二维快装165°阻尼铰链', image_count: 7 },
  { folder: '479_特殊系列-45°_90°_135°阻尼铰链', pid: '479', product_name: '特殊系列-45°_90°_135°阻尼铰链', image_count: 7 },
  { folder: '47_魅影系列-双层空降机', pid: '47', product_name: '魅影系列-双层空降机', image_count: 9 },
  { folder: '480_美式系列-美式铰链', pid: '480', product_name: '美式系列-美式铰链', image_count: 9 }
];

test('排序后同一系列严格连续，不被打断', () => {
  const sorted = sortBySeries(RAW);
  const lastIndex = new Map();
  for (let i = 0; i < sorted.length; i += 1) {
    const key = sorted[i].series;
    if (lastIndex.has(key)) {
      assert.equal(lastIndex.get(key), i - 1, `系列「${key}」在位置 ${i} 被打断`);
    }
    lastIndex.set(key, i);
  }
});

test('组间按系列最小 pid 升序，组内按 pid 升序', () => {
  const sorted = sortBySeries(RAW);
  assert.deepEqual(sorted.map((row) => row.series), [
    '魅影系列', '魅影系列', '魅影系列', '魅影系列',
    '拉斐系列', '拉斐系列',
    '子弹头系列',
    '灵犀系列',
    '特殊系列', '特殊系列',
    '美式系列'
  ]);
  assert.deepEqual(sorted.map((row) => row.pid), ['44', '45', '46', '47', '449', '450', '463', '469', '478', '479', '480']);
});

test('组内无图产品沉到本系列末尾，不影响其它系列的连续段', () => {
  const rows = [
    { folder: '10_甲系列-a', pid: '10', product_name: '甲系列-a', image_count: 0 },
    { folder: '11_甲系列-b', pid: '11', product_name: '甲系列-b', image_count: 6 },
    { folder: '12_乙系列-a', pid: '12', product_name: '乙系列-a', image_count: 3 }
  ];
  const sorted = sortBySeries(rows);
  assert.deepEqual(sorted.map((row) => row.folder), ['11_甲系列-b', '10_甲系列-a', '12_乙系列-a']);
  assert.deepEqual(sorted.map((row) => row.series), ['甲系列', '甲系列', '乙系列']);
});

test('pid 缺失的排在最后，空输入不抛错', () => {
  const rows = [
    { folder: '没有pid_独立产品', pid: '', product_name: '独立产品', image_count: 2 },
    { folder: '5_某系列-a', pid: '5', product_name: '某系列-a', image_count: 2 }
  ];
  assert.deepEqual(sortBySeries(rows).map((row) => row.folder), ['5_某系列-a', '没有pid_独立产品']);
  assert.equal(pidValue({ folder: 'x', pid: '' }), Number.MAX_SAFE_INTEGER);
  assert.deepEqual(sortBySeries([]), []);
  assert.deepEqual(sortBySeries(null), []);
});

test('排序不丢字段、不改原数组', () => {
  const snapshot = JSON.parse(JSON.stringify(RAW));
  const sorted = sortBySeries(RAW);
  assert.deepEqual(RAW, snapshot);
  assert.equal(sorted.length, RAW.length);
  const row = sorted.find((item) => item.folder === '449_拉斐系列-阻尼高端饰物架');
  assert.equal(row.image_count, 11);
  assert.equal(row.series, '拉斐系列');
});

// ── 3. 勾选摘要 ────────────────────────────────────────

test('seriesSummary：按数量降序，超过 3 个折成「等 N 个系列」', () => {
  const rows = [
    ...Array.from({ length: 23 }, () => ({ series: '魅影系列' })),
    ...Array.from({ length: 9 }, () => ({ series: '紫水晶系列' })),
    ...Array.from({ length: 10 }, () => ({ series: '曜影系列' })),
    ...Array.from({ length: 7 }, () => ({ series: '特拉斯系列' })),
    { series: '香槟玫瑰系列' }
  ];
  assert.equal(seriesSummary(rows), '魅影系列 ×23、曜影系列 ×10、紫水晶系列 ×9 等 5 个系列');
  assert.equal(seriesSummary([{ series: '甲系列' }, { series: '' }]), '甲系列 ×1、未分组 ×1');
  assert.equal(seriesSummary([]), '');
  assert.equal(seriesSummary(null), '');
});
