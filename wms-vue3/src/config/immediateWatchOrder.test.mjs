/**
 * 守卫：`watch(..., { immediate: true })` 会**立即执行**回调，
 * 若回调里用到声明在它后面的 `const`/`let`（尤其 `let xxx = null` 这类），
 * 运行时就会抛 "Cannot access 'xxx' before initialization"（TDZ），
 * 而 `vue-tsc` 完全查不出这类错误 —— 只能靠这里静态拦。
 *
 * 本次真实事故：PdfExportDialog.vue 把 watch 写在 `let previewController` 之前，
 * 导致整个采购订单页面加载失败（生产可见）。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (name.endsWith('.vue') || name.endsWith('.ts')) acc.push(full)
  }
  return acc
}

/** 找出 `<script setup>` 内的代码（.ts 直接用全文），并返回脚本内容与实际文件行号的偏移 */
function scriptOf(file, text) {
  if (!file.endsWith('.vue')) return { code: text, offsetLine: 0 }
  const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(text)
  if (!m) return { code: '', offsetLine: 0 }
  // m[1] 前有多少个换行，脚本内行号 i(0基) 对应的文件行号 = offsetLine + i + 1
  const scriptStart = m.index + m[0].indexOf('>') + 1
  const offsetLine = text.slice(0, scriptStart).split('\n').length - 1
  return { code: m[1], offsetLine }
}

/** 收集顶层声明（粗略但足够：行首的 const/let/function） */
function topLevelDeclarations(code) {
  const decls = new Map()
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /^(?:export\s+)?(const|let|var|function)\s+([A-Za-z_$][\w$]*)/.exec(line)
    if (m) decls.set(m[2], i)
  }
  return decls
}

/** 找出所有 watch(...) 调用及其是否 immediate */
function findImmediateWatches(code) {
  const out = []
  const re = /(?:^|\n)\s*watch\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    // 从 watch( 起做括号配平，取出整段调用
    let depth = 0
    let i = m.index + m[0].indexOf('watch(') + 'watch'.length
    const start = i
    for (; i < code.length; i++) {
      const ch = code[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) { i++; break }
      }
    }
    const call = code.slice(start, i)
    if (!/immediate\s*:\s*true/.test(call)) continue
    const line = code.slice(0, m.index + m[0].indexOf('watch(')).split('\n').length - 1
    out.push({ call, line })
  }
  return out
}

test('immediate watch 不得引用声明在它之后的顶层变量（防 TDZ）', () => {
  const files = walk(SRC)
  const problems = []

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('immediate: true')) continue
    const { code, offsetLine } = scriptOf(file, text)
    if (!code) continue

    const decls = topLevelDeclarations(code)
    const watches = findImmediateWatches(code)

    for (const w of watches) {
      for (const [name, declLine] of decls) {
        if (declLine <= w.line) continue          // 声明在前，安全
        // 回调里出现该标识符（排除属性访问 a.name 与对象键 name:）
        const re = new RegExp(`(^|[^.\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`)
        if (re.test(w.call)) {
          problems.push(
            `${relative(SRC, file)}: immediate watch 在第 ${offsetLine + w.line + 1} 行，` +
            `但使用了第 ${offsetLine + declLine + 1} 行才声明的 "${name}"（会抛 TDZ）`,
          )
        }
      }
    }
  }

  assert.deepEqual(problems, [], `发现会触发 TDZ 的 immediate watch：\n${problems.join('\n')}`)
})
