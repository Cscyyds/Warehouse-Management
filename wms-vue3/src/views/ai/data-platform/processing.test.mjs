import test from 'node:test'
import assert from 'node:assert/strict'
import { createChunks, defaultConfig, configError, cleanText } from './processing.ts'
const doc = text => ({ id: 'test', name: '指南.md', kind: 'MD', size: text.length, text })
test('length chunks preserve every character and overlap without splitting Unicode', () => {
  const text = '产品😀安装说明'.repeat(90)
  const config = { ...defaultConfig, strategy: 'length', size: 50, overlap: 12 }
  const chunks = createChunks(doc(text), config)
  assert.ok(chunks.length > 1)
  let restored = chunks[0].text
  for (let i = 1; i < chunks.length; i++) {
    assert.equal(chunks[i].start, chunks[i - 1].end - 12)
    restored += Array.from(chunks[i].text).slice(12).join('')
  }
  assert.equal(restored, text)
  assert.ok(chunks.every(chunk => Array.from(chunk.text).length <= 50))
})
test('paragraph and literal delimiter strategies retain source characters', () => {
  for (const strategy of ['paragraph', 'delimiter']) {
    const text = ('一'.repeat(40) + '\n\n' + '二'.repeat(65) + '###').repeat(4).trim()
    const chunks = createChunks(doc(text), { ...defaultConfig, strategy, size: 80, overlap: 0, delimiter: '###' })
    assert.equal(chunks.map(chunk => chunk.text).join(''), text)
    assert.ok(chunks.every(chunk => Array.from(chunk.text).length <= 80))
  }
})
test('threshold equality and whole storage preserve a single document', () => {
  const document = doc('甲'.repeat(150))
  assert.equal(createChunks(document, { ...defaultConfig, condition: 'threshold', threshold: 150, size: 50, overlap: 0 }).length, 1)
  assert.equal(createChunks(document, { ...defaultConfig, condition: 'threshold', threshold: 149, size: 50, overlap: 0 }).length, 3)
  assert.equal(createChunks(document, { ...defaultConfig, storage: 'whole', size: 50 }).length, 1)
})
test('invalid parameters cannot create infinite or misleading chunks', () => {
  for (const patch of [{ size: 0 }, { size: 50, overlap: 50 }, { size: 50.5 }, { overlap: -1 }, { indexSize: NaN }, { strategy: 'delimiter', delimiter: '' }, { depth: 7 }]) {
    assert.ok(configError({ ...defaultConfig, ...patch }))
    assert.equal(createChunks(doc('测试内容'), { ...defaultConfig, ...patch }).length, 0)
  }
})
test('title indexing, cleanup and index size affect actual output', () => {
  const config = { ...defaultConfig, indexSize: 16, removeBlank: true }
  assert.equal(cleanText('  安装\t \t说明\r\n\r\n\r\n正文  ', config), '安装 说明\n\n正文')
  const chunk = createChunks(doc('产品知识'.repeat(20)), config)[0]
  assert.ok(chunk.index.startsWith('指南 · '))
  assert.equal(Array.from(chunk.index).length, 16)
  assert.ok(!createChunks(doc('产品知识'), { ...config, titleIndex: false })[0].index.includes('指南'))
})
test('heading depth changes paragraph boundaries', () => {
  const source = doc('甲'.repeat(35) + '\n### 小标题\n' + '乙'.repeat(70))
  const shallow = createChunks(source, { ...defaultConfig, size: 70, overlap: 0, depth: 2 })
  const deep = createChunks(source, { ...defaultConfig, size: 70, overlap: 0, depth: 3 })
  assert.notEqual(shallow[0].end, deep[0].end)
  assert.equal(deep.map(chunk => chunk.text).join(''), source.text)
})
