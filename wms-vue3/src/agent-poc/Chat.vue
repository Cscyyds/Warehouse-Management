<template>
  <div class="poc-shell">
    <header class="poc-header">
      <div>
        <h1>WMS Agent POC</h1>
        <span class="sub">自主规划链路手测：自然语言 → 语义分析 → 依赖图规划 → 真实后端 → 回复生成</span>
      </div>
      <div class="hdr-actions">
        <span class="conn" :class="health === null ? 'off' : 'on'">
          {{ health === null ? '服务未连接' : health }}
        </span>
        <button class="btn ghost" @click="newSession">新会话</button>
      </div>
    </header>

    <main class="poc-chat" ref="listEl">
      <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
        <div class="bubble">
          <div class="md" v-html="render(m.text)"></div>
          <div v-if="m.options && m.options.length" class="options">
            <button v-for="opt in m.options" :key="opt" class="opt" @click="send(opt)">{{ opt }}</button>
          </div>
          <div v-if="showDebug && m.debug && Object.keys(m.debug).length" class="debug">
            <template v-for="(v, k) in m.debug" :key="k"><b>{{ k }}</b>: {{ v }}&nbsp;&nbsp;</template>
          </div>
        </div>
      </div>
      <div v-if="loading" class="row bot">
        <div class="bubble typing">思考中<span class="dots">…</span></div>
      </div>
    </main>

    <footer class="poc-input">
      <label class="dbg-toggle"><input type="checkbox" v-model="showDebug" /> 显示调试信息</label>
      <div class="input-row">
        <input
          v-model="draft"
          placeholder="试试：查一下广东诺米的资料 / SO202608140004 什么情况 / 汇总一下广东诺米的订单"
          :disabled="loading"
          @keydown.enter.prevent="send(draft)"
        />
        <button class="btn primary" :disabled="loading || !draft.trim()" @click="send(draft)">发送</button>
      </div>
      <div class="tips">
        快捷：<a @click="send('查一下广东诺米的资料')">客户资料</a>
        <a @click="send('汇总一下广东诺米的订单')">订单汇总</a>
        <a @click="send('查一下销售订单SO202608140004')">单号直查</a>
        <a @click="send('查一下广东诺米的拜访记录')">拜访记录</a>
        <a @click="send('查一下王总的手机号')">人物歧义</a>
        <a @click="send('今天天气怎么样')">越界</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import MarkdownIt from 'markdown-it'

const API = (import.meta.env.VITE_AGENT_POC_API || 'http://127.0.0.1:8012') as string
const md = new MarkdownIt({ breaks: true, linkify: false })

type Msg = { role: 'user' | 'bot'; text: string; options?: string[]; debug?: Record<string, unknown> }

const messages = ref<Msg[]>([{
  role: 'bot',
  text: '你好，我是 WMS 智能助手（POC）。可以查 **员工 / 客户 / 销售订单 / 拜访单**。\n\n'
    + '提示：本页是 Agent 自主规划链路的手测入口——回复由 LLM 生成，数据来自本地真实后端（127.0.0.1:8000）。',
}])
const draft = ref('')
const loading = ref(false)
const showDebug = ref(false)
const health = ref<string | null>(null)
const listEl = ref<HTMLElement | null>(null)

let sid = localStorage.getItem('agent_poc_sid') || ('s_' + Math.random().toString(36).slice(2, 10))
localStorage.setItem('agent_poc_sid', sid)

function render(text: string): string {
  return md.render(text || '')
}

async function scrollBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function checkHealth() {
  try {
    const r = await fetch(`${API}/api/health`)
    const d = await r.json()
    const llm = d.llm === 'ok' ? 'LLM 正常' : `LLM 异常：${d.llm}`
    health.value = `${llm} · 后端：${d.backend}`
  } catch {
    health.value = null
  }
}

async function send(text?: string) {
  const content = (text ?? draft.value).trim()
  if (!content || loading.value) return
  draft.value = ''
  messages.value.push({ role: 'user', text: content })
  loading.value = true
  scrollBottom()
  try {
    const r = await fetch(`${API}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, message: content }),
    })
    const d = await r.json()
    messages.value.push({ role: 'bot', text: d.reply || '（空回复）', options: d.options || [], debug: d.debug || {} })
  } catch (e) {
    messages.value.push({
      role: 'bot',
      text: `⚠️ 请求失败：${e}\n\n请确认 POC 服务已启动：\n\`\`\`\ncd D:/WMS/Coze_Connect\npython -m agent_poc.server\n\`\`\``,
    })
  } finally {
    loading.value = false
    scrollBottom()
  }
}

async function newSession() {
  await fetch(`${API}/api/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sid, message: '' }),
  }).catch(() => {})
  sid = 's_' + Math.random().toString(36).slice(2, 10)
  localStorage.setItem('agent_poc_sid', sid)
  messages.value = [{ role: 'bot', text: '已开启新会话。' }]
}

onMounted(checkHealth)
</script>

<style scoped>
.poc-shell { display: flex; flex-direction: column; height: 100vh; background: #f4f6fa; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif; }
.poc-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; background: #1f2d3d; color: #fff; }
.poc-header h1 { margin: 0; font-size: 18px; }
.poc-header .sub { font-size: 12px; opacity: .65; margin-left: 10px; }
.hdr-actions { display: flex; align-items: center; gap: 12px; }
.conn { font-size: 12px; padding: 3px 10px; border-radius: 10px; background: #2e3f52; }
.conn.on { color: #7dea9b; }
.conn.off { color: #ff9f9f; }
.btn { border: none; border-radius: 6px; padding: 7px 16px; cursor: pointer; font-size: 13px; }
.btn.ghost { background: rgba(255,255,255,.12); color: #fff; }
.btn.primary { background: #3b82f6; color: #fff; }
.btn.primary:disabled { opacity: .5; cursor: default; }
.poc-chat { flex: 1; overflow-y: auto; padding: 20px 18px; }
.row { display: flex; margin: 10px 0; }
.row.user { justify-content: flex-end; }
.bubble { max-width: 78%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.65; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.row.bot .bubble { background: #fff; border-top-left-radius: 3px; }
.row.user .bubble { background: #3b82f6; color: #fff; border-top-right-radius: 3px; white-space: pre-wrap; }
.typing { color: #888; }
.dots::after { content: ''; animation: dots 1.2s steps(4) infinite; }
@keyframes dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
.md :deep(table) { border-collapse: collapse; margin: 8px 0; font-size: 13px; }
.md :deep(th), .md :deep(td) { border: 1px solid #e3e7ee; padding: 5px 10px; }
.md :deep(th) { background: #f0f3f8; }
.md :deep(code) { background: #eef1f6; padding: 1px 5px; border-radius: 4px; font-size: 12.5px; }
.md :deep(pre) { background: #20232a; color: #d6e2f0; padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
.md :deep(pre code) { background: none; color: inherit; }
.options { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
.opt { border: 1px solid #c6d4ee; background: #f4f8ff; color: #2b5cad; border-radius: 16px; padding: 5px 14px; font-size: 13px; cursor: pointer; }
.opt:hover { background: #e3edff; }
.debug { margin-top: 8px; padding-top: 6px; border-top: 1px dashed #dfe4ec; font-size: 11.5px; color: #8a94a6; word-break: break-all; }
.poc-input { padding: 10px 18px 14px; background: #fff; border-top: 1px solid #e6eaf1; }
.dbg-toggle { font-size: 12px; color: #6b7288; display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.input-row { display: flex; gap: 10px; }
.input-row input { flex: 1; border: 1px solid #d4dae5; border-radius: 8px; padding: 10px 14px; font-size: 14px; outline: none; }
.input-row input:focus { border-color: #3b82f6; }
.tips { margin-top: 8px; font-size: 12px; color: #98a2b3; }
.tips a { color: #3b82f6; cursor: pointer; margin-right: 12px; }
.tips a:hover { text-decoration: underline; }
</style>
