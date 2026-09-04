# PageAgent(AI 网页操作智能体)开发文档

| 项目 | 说明 |
| --- | --- |
| 适用项目 | wms-vue3(Warehouse-Management 前端,Vue 3.5 + Element Plus 2.8 + Vite 5) |
| 依赖版本 | `page-agent@1.12.2`(已安装,见 `wms-vue3/package.json`) |
| 上游项目 | [alibaba/page-agent](https://github.com/alibaba/page-agent)(MIT License) |
| 官方文档 | https://alibaba.github.io/page-agent/ |
| 文档更新日期 | 2026-07-31 |

---

## 1. 概述

### 1.1 什么是 PageAgent

PageAgent 是一个**纯 JavaScript 实现的页内 GUI 智能体(in-page GUI Agent)**:在页面中注入一个脚本,该网页就拥有了自己的 AI 操作员。最终用户用自然语言描述意图,PageAgent 即可理解当前页面结构并自动执行点击、输入、下拉选择、滚动等 GUI 操作。

关键特征:

- **零后端、零插件、零头less浏览器**:一切都在用户自己的页面内发生,不需要浏览器扩展、Python 环境或服务端自动化集群。
- **纯文本 DOM 操作**:不截图、不 OCR、不需要多模态大模型,普通支持 Tool Call 的文本模型即可驱动。
- **自带 LLM(BYOL)**:对接任何 OpenAI 兼容协议的模型服务,包括云端模型(通义/DeepSeek/GPT/Claude/Kimi 等)与本地部署模型(Ollama / LM Studio)。

### 1.2 定位与边界

> PageAgent 专为**客户端网页增强**设计,**不是**服务端自动化工具。其 DOM 处理组件与 Prompt 派生自 [browser-use](https://github.com/browser-use/browser-use)(MIT)。

| 维度 | PageAgent | browser-use / Playwright 等 |
| --- | --- | --- |
| 运行位置 | 用户浏览器页面内 | 服务端 / 无头浏览器 |
| 服务对象 | **最终用户**(自然语言交互) | 开发者(脚本/爬虫/测试) |
| 登录态 | 天然复用用户当前会话 | 需自行注入 Cookie/登录 |
| 部署成本 | 一个 script 标签或 npm 包 | 浏览器集群 + 运维 |
| 典型用途 | SaaS Copilot、智能表单、无障碍 | 爬虫、E2E 测试、RPA |

### 1.3 典型应用场景

- **SaaS AI Copilot** —— 几行代码为产品加上 AI 副驾驶,无需重写后端。
- **智能表单填写** —— 把"20 次点击"变成一句话,ERP / CRM / 管理后台(如 WMS)的最佳拍档。
- **无障碍增强** —— 视障用户、老年用户、新员工通过自然语言即可操作复杂系统。
- **跨页面 Agent** —— 通过可选 Chrome 扩展跨标签页工作;另有 MCP Server(Beta)可供外部 Agent 客户端控制浏览器。

---

## 2. 核心功能

### 2.1 智能 DOM 理解

能够深度分析网页的 DOM 结构,不需要通过视觉识别,纯文本就能实现精准操作(定位元素、操作元素、获取元素内容、模拟点击等)。

其原理是"**DOM 脱水(Dehydrated DOM)**":PageAgent 将完整 DOM 树裁剪、扁平化为 LLM 易读的纯文本——只保留可见元素、交互元素与关键文本,并为每个可交互元素打上**索引编号**。LLM 看到的是一个"脱水"后的页面大纲,回复索引号即可完成定位,Token 消耗远低于截图方案,且不受分辨率/缩放影响。

脱水后的页面文本形如:

```text
[0]<a aria-label=page-agent.js 首页 />
[1]<div >P />
[2]<div >page-agent.js
UI Agent in your webpage />
[3]<a >文档 />
[4]<a aria-label=查看源码(在新窗口打开)>源码 />
UI Agent in your webpage
用户输入需求,AI 理解页面并自动操作。
[5]<a role=button>快速开始 />
[6]<a role=button>查看文档 />
无需后端
```

> 可交互元素用 `[序号]` 标出,LLM 通过序号引用元素;缩进代表父子关系;普通文本直接列出。

### 2.2 自然语言 → DOM 操作指令

可以将自然语言转换为对应的 DOM 操作指令,实现对网页的智能操作。例如:

- 用户输入「**点击登录按钮**」,PageAgent 就能将这个指令转换为对应的 DOM 操作指令,实现对登录按钮的点击;
- 用户输入「**帮我去新增一个正式客户**」,PageAgent 就能将这个指令转换为对应的 DOM 操作指令,先跳转到新增客户页面;如果用户还输入了新增客户的相关参数(如客户名称、联系电话、所在城市),还能实现对新增客户表单的**逐项填写和提交**操作。

整个过程是**多步推理-执行循环**(见 §3.3),而非单次指令翻译:Agent 每一步都会重新观察页面、评估上一步结果、规划下一步动作,直到任务完成或达到步数上限。

### 2.3 人机协同(Human-in-the-loop)

- **ask_user 工具**:执行中信息不足时,Agent 会主动在面板中向用户提问并等待回答(例如"请提供客户联系电话")。
- **人工接管**:用户随时可以手动操作页面,Agent 会记录 `user_takeover` 事件并将人工操作结果纳入后续推理。
- **随时终止**:面板提供「终止」按钮,也可调用 `agent.stop()` 编程式停止。
- **操作遮罩(可选)**:开启 `enableMask` 后,自动化期间页面覆盖半透明遮罩,防止用户误操作干扰。

### 2.4 可扩展工具系统

所有页面操作都封装为"工具(Tool)",LLM 以 Tool Call 方式调用。开发者可以:

- **新增业务工具**(如"查询库存""跳转指定路由");
- **覆盖同名内置工具**改变默认行为;
- **将内置工具置为 `null` 直接移除**(如禁用 `ask_user`)。

详见 §8。

### 2.5 安全可控

- 支持交互元素**黑白名单**(屏蔽危险按钮、只开放指定区域);
- 支持页面内容发送给 LLM 前的**数据脱敏**(手机号、金额等);
- 支持注入**自定义指令/知识库**(系统级 + 页面级),约束 AI 按企业规则工作;
- LLM 请求可经**后端代理**转发,API Key 永不落地前端。

详见 §10。

---

## 3. 技术架构

### 3.1 Monorepo 包结构(v1.12.2)

PageAgent 采用简化 monorepo 架构。早期版本为"三包"结构(page-agent / page-controller / website),**v1.12.2 已拆分为以下更细的包**,各部分职责清晰:

```text
packages/
├── page-agent/          # 入口包(npm: page-agent)
│   └── PageAgent        # 入口类:继承 PageAgentCore,挂载 Panel 面板,打包 IIFE/ESM 产物
├── core/                # AI 核心(npm: @page-agent/core)
│   ├── PageAgentCore    # 代理主循环(ReAct Loop),协调工具与 LLM
│   └── tools/           # 内置工具集:click / input / select / scroll / wait / ask_user / done
├── llms/                # LLM 集成层(npm: @page-agent/llms)
│   └── LLM              # OpenAI 兼容客户端:Tool Call 调用、重试、错误分类
├── page-controller/     # DOM 操作层(npm: @page-agent/page-controller)
│   ├── DOM 脱水与索引化 # 扁平化 DOM 树 → 带序号的可交互元素 Map
│   ├── 事件模拟         # W3C Pointer Events 规范的点击/输入/滚动
│   └── Visual Mask      # 自动化期间的页面遮罩
├── ui/                  # 面板 UI(npm: @page-agent/ui)
│   ├── Panel            # 可拖拽悬浮面板(任务输入 + 步骤历史)
│   └── i18n             # 中英文案(en-US / zh-CN)
├── extension/           # Chrome 扩展(跨页面任务,可选)
└── website/             # 文档与演示站点
```

依赖关系(单向,无循环):

```text
page-agent ──► core ──► llms
    │           │
    │           └──────► page-controller
    └────► ui(Panel 仅依赖 PanelAgentAdapter 接口,不反向依赖 core)
```

> 设计要点:**AI 决策(core)与页面操作(page-controller)分离**,DOM 操作层可单独复用;**一切操作皆工具**,LLM 像调函数一样使用,扩展性极强;**UI 通过最小接口适配器解耦**,任何实现该接口的 Agent 都能复用面板。

### 3.2 前端呈现形式

Alibaba PageAgent 自带一个用于快速体验的悬浮面板 `Panel`,展开后可输入任务并查看实时步骤历史。官方 Panel 与执行内核通过 `PanelAgentAdapter` 解耦,不是 Agent 运行的必要条件。

面板行为可通过 `agent.panel` 编程控制:`show() / hide() / expand() / collapse() / reset() / dispose()`。

**WMS 最终呈现方式已确定为自建 Vue3 悬浮窗**,不使用官方 Panel 作为业务 UI。Alibaba PageAgent 只负责模型调用、任务循环、DOM Controller、自定义 Tool 与中断控制;悬浮入口、任务面板、执行时间线、状态动效和业务确认全部由 `wms-vue3` 自己实现,详见 §11.6。

### 3.3 运行时:ReAct 代理主循环

`PageAgentCore` 内部是一个 **ReAct(Reason + Act)循环**,每步三段式:

```text
┌────────────────────────────────────────────────────┐
│ step n                                             │
│  1. observe  观察:PageController.updateTree()      │
│              重新脱水当前 DOM → BrowserState       │
│  2. think    思考:调用 LLM(Tool Call 强制输出)   │
│              reflection 反思:评估上一步、更新记忆、 │
│                           给出下一步目标            │
│              action     动作:选择一个工具并给出参数 │
│  3. act      执行:运行工具 → 结果写入 history      │
└────────────────────────────────────────────────────┘
        │  未 done 且 step < maxSteps(默认 40)
        └──────────────► 进入 step n+1
```

- **Reflection-before-action**:LLM 每次调用必须先在 `action` 前输出 `evaluation_previous_goal / memory / next_goal` 三段反思(MacroTool 抽象),显著降低幻觉操作。
- **终止条件**:LLM 调用 `done` 工具、达到 `maxSteps`、用户 `stop()` 或发生不可恢复错误。
- **步间延迟**:`stepDelay` 默认 0.4 秒,给页面渲染留出时间。

### 3.4 底层交互:W3C 事件模拟

PageController 的点击不是简单的 `element.click()`,而是按 **W3C Pointer Events + UI Events 规范顺序**派发完整事件序列:

```text
pointerover/enter → mouseover/enter → pointerdown → mousedown
→ [focus] → pointerup → mouseup → click
```

因此 Vue / Element Plus 等依赖标准事件链的组件库能被正确触发(等同真人操作),这也是它能在 wms-vue3 中直接驱动 `el-button`、表单校验的原因。

### 3.5 事件与信息流系统

PageAgent 是 `EventTarget`,运行时有两条信息流:

| 信息流 | 事件/属性 | 特点 |
| --- | --- | --- |
| **历史事件**(持久) | `history` 数组 + `historychange` 事件 | 构成 Agent 记忆,随上下文喂给 LLM;类型:`step / observation / user_takeover / retry / error` |
| **实时活动**(瞬态) | `activity` 事件 | 仅供 UI 展示"正在做什么";类型:`thinking / executing / executed / retrying / error`,不进 LLM 上下文 |

状态机:`idle → running → completed | error | stopped`,通过 `statuschange` 事件广播。

---

## 4. 快速开始

### 4.1 CDN 一行接入(快速体验)

```html
<script
    src="https://registry.npmmirror.com/page-agent/1.12.2/files/dist/iife/page-agent.demo.js"
    crossorigin="anonymous"
></script>
```

> ⚠️ Demo 脚本使用官方免费测试 LLM,**仅限技术评估**,有限速与额度限制,禁止输入任何隐私/敏感数据。
>
> 在 URL 后加 `?autoInit=false` 可只加载脚本不自动初始化,之后用 `new window.PageAgent({...})` 手动创建并接入自己的 LLM。

### 4.2 NPM 集成(生产方式,wms-vue3 已装依赖)

```bash
npm install page-agent   # wms-vue3 中已是 ^1.12.2,无需重复安装
```

```ts
import { PageAgent } from 'page-agent'

const agent = new PageAgent({
    model: 'qwen3.5-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'YOUR_API_KEY',        // ⚠️ 生产环境禁止硬编码,见 §10.1
    language: 'zh-CN',
})

const result = await agent.execute('点击登录按钮')
console.log(result.success, result.data)
```

### 4.3 在 wms-vue3 中初始化(推荐模式)

当前项目已经在 `src/plugins/pageAgent.ts` 中封装开发环境单例,并由 `src/main.ts` 在 Vue 应用挂载后初始化。开发调试配置保存在被 Git 忽略的 `.env.local`,实例挂到 `window.pageAgent` 便于调试。现有代码仍会显示官方 Panel 并使用默认遮罩;接入 WMS 自定义悬浮窗时应改为以下目标配置:

```ts
// src/main.ts
app.mount('#app')
void initializePageAgent()

// src/plugins/pageAgent.ts(MVP 目标摘要)
const isEnabled = () =>
    import.meta.env.DEV && import.meta.env.VITE_PAGE_AGENT_ENABLED === 'true'

export async function initializePageAgent() {
    if (!isEnabled()) return

    const { PageAgent } = await import('page-agent')
    const agent = new PageAgent({
        model: import.meta.env.VITE_PAGE_AGENT_MODEL || 'qwen3.5-plus',
        baseURL:
            import.meta.env.VITE_PAGE_AGENT_BASE_URL ||
            'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: import.meta.env.VITE_PAGE_AGENT_API_KEY,
        language: 'zh-CN',
        // WMS 自建悬浮窗和人工确认流程,禁用全屏操作遮罩
        enableMask: false,
        customTools: {
            ask_user: null, // WMS 提问 UI 未接管前禁用,避免等待已销毁的官方 Panel
            execute_wms_action: dispatcherTool,
        },
        instructions: { getPageInstructions },
    })

    // 官方 Panel 会在 status=running 时自动 show,仅不调用 show() 不足以禁用
    agent.panel.dispose()
    agent.onAskUser = undefined

    // 由 WmsAgentPanel 驱动 execute()/stop()
    window.pageAgent = agent
}
```

MVP 只在本地开发环境直连 DashScope。生产启用时必须改为 `nuomi_wms` 提供的 LLM Proxy,前端不再接收模型 API Key,见 §9.3 与 §11.5.13。

MVP 仍可实例化完整的 `PageAgent`,但创建后立即调用 `agent.panel.dispose()` 移除官方 Panel DOM、定时器和事件监听。后续若希望连官方 Panel 的短暂构造过程也完全取消,再迁移为 `PageAgentCore + PageController` 无头模式;两阶段共用同一套 Registry、Dispatcher 和 WMS UI Bridge。

> 注意 `page-agent` 为纯 ESM 包(`"type": "module"`),Vite 5 开箱即用;peer 依赖 `zod@^3.25 || ^4.0.0`,自定义工具时需要。

---

## 5. 配置参考(PageAgentConfig)

`PageAgentConfig = AgentConfig & PageControllerConfig & Omit<PanelConfig, 'language'>`,以下按来源分组(★ = 必填)。

### 5.1 LLM 配置(来自 @page-agent/llms)

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| ★ `baseURL` | `string` | — | OpenAI 兼容服务地址,如 `https://api.deepseek.com` 或后端代理路径 |
| ★ `model` | `string` | — | 模型名,如 `qwen3.5-plus` / `deepseek-chat` |
| `apiKey` | `string` | — | 云端模型必填;本地模型/代理可省略 |
| `maxRetries` | `number` | — | LLM 调用失败最大重试次数 |
| `customFetch` | `typeof fetch` | — | 自定义请求函数(加 Header、携带 Cookie、走代理),见 §9.3 |
| `transformRequestBody` | `(body) => body \| void` | — | 发出前改写请求体(如注入缓存提示),见 §9.5 |
| `disableNamedToolChoice` | `boolean` | `false` | 移除 `tool_choice` 字段,修复部分模型(如 LM Studio)报错 |
| ~~`temperature`~~ | `number` | — | **已废弃**,多数模型直接拒绝;确需设置请用 `transformRequestBody` |

### 5.2 Agent 行为配置(来自 @page-agent/core)

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `language` | `'en-US' \| 'zh-CN'` | `'en-US'` | 面板与提示语言 |
| `maxSteps` | `number` | `40` | 单任务最大步数,防止死循环烧钱 |
| `stepDelay` | `number`(秒) | `0.4` | 步间延迟,等待页面渲染 |
| `customTools` | `Record<string, PageAgentTool \| null>` | — | 自定义工具;同名覆盖内置,置 `null` 移除,见 §8 |
| `instructions.system` | `string` | — | 全局系统级指令,对所有任务生效 |
| `instructions.getPageInstructions` | `(url) => string \| undefined \| null` | — | **页面级指令回调**,每步前按当前 URL 取指令,见 §11.3 |
| `transformPageContent` | `(content) => string \| Promise<string>` | — | 页面文本发给 LLM 前的变换钩子,用于脱敏,见 §10.2 |
| `customSystemPrompt` | `string` | — | **完全覆盖**默认系统提示词,⚠️ 实验性,极易破坏行为 |
| `onAskUser` | `(question, {signal}) => Promise<string>` | — | Agent 提问时的应答实现;不设置则 `ask_user` 工具禁用 |

### 5.3 生命周期钩子(实验性)

| 钩子 | 签名 | 时机 |
| --- | --- | --- |
| `onBeforeTask` | `(agent) => void` | 任务开始前 |
| `onAfterTask` | `(agent, result) => void` | 任务结束后(成功或失败) |
| `onBeforeStep` | `(agent, stepCount) => void` | 每步执行前 |
| `onAfterStep` | `(agent, history) => void` | 每步执行后 |
| `onDispose` | `(agent, reason?) => void` | 实例销毁时(可异步阻塞销毁流程) |

> ⚠️ 永远不要在生命周期钩子里 `await agent.stop()`,会死锁。

### 5.4 DOM 提取配置(来自 @page-agent/page-controller)

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enableMask` | `boolean` | `false` | 自动化期间显示页面遮罩,防用户误触,见 §10.4 |
| `viewportExpansion` | `number` | — | 视口外扩展像素,控制"看"多远 |
| `interactiveBlacklist` | `(Element \| () => Element)[]` | — | 交互黑名单:元素从脱水结果剔除,Agent 看不到也就点不到 |
| `interactiveWhitelist` | `(Element \| () => Element)[]` | — | 交互白名单:只开放指定元素 |
| `includeAttributes` | `string[]` | — | 脱水时额外保留的 HTML 属性 |
| `highlightOpacity` / `highlightLabelOpacity` | `number` | — | 元素高亮/序号标签透明度 |
| `keepSemanticTags` | `boolean` | `false` | 保留语义化 landmark 标签(⚠️ 可能干扰滚动推理,慎用) |

### 5.5 面板配置(来自 @page-agent/ui)

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `promptForNextTask` | `boolean` | `true` | 任务完成后是否提示输入下一个任务 |

> 该配置只作用于 Alibaba 官方 Panel。WMS 自建悬浮窗不依赖此配置,自身状态和交互协议见 §11.6。

### 5.6 实验性开关

| 参数 | 默认 | 风险说明 |
| --- | --- | --- |
| `experimentalScriptExecutionTool` | `false` | 开放 `execute_javascript` 工具,允许 LLM 在页面执行任意 JS。**可能绕过脱敏与安全护栏,生产慎开**,见 §10.5 |
| `experimentalLlmsTxt` | `false` | 每任务每源拉取一次 `/llms.txt` 作为上下文 |

---

## 6. API 参考

### 6.1 PageAgent 类

```ts
class PageAgent extends PageAgentCore {
    panel: Panel                        // 悬浮面板实例
    constructor(config: PageAgentConfig)
}
```

继承自 `PageAgentCore`(本身是一个 `EventTarget`):

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `execute(task)` | `(task: string) => Promise<ExecutionResult>` | **核心方法**:下发自然语言任务,等待整个 ReAct 循环跑完 |
| `stop()` | `() => Promise<void>` | 停止当前任务并等待完全收尾(含钩子),实例可复用 |
| `dispose()` | `() => void` | 销毁实例(终态,不可复用) |
| `status` | `'idle' \| 'running' \| 'completed' \| 'error' \| 'stopped'` | 当前状态(getter) |
| `lastResult` | `ExecutionResult \| null` | 最近一次执行结果 |
| `history` | `HistoricalEvent[]` | 历史事件流(Agent 记忆) |
| `task` / `taskId` / `id` | `string` | 当前任务描述 / 任务 ID / 实例 ID |
| `pageController` | `PageController` | 底层 DOM 操作器,见 §6.4 |
| `tools` | `Map<string, PageAgentTool>` | 当前生效的工具表(含自定义) |
| `config` | `PageAgentCoreConfig & { maxSteps: number }` | 只读生效配置 |
| `onAskUser` | `(question, {signal}) => Promise<string>` | 运行期可赋值的提问回调 |

`ExecutionResult`:

```ts
interface ExecutionResult {
    success: boolean          // 任务是否成功完成
    data: string              // LLM 通过 done 工具给出的最终答复文本
    history: HistoricalEvent[]// 完整执行轨迹(仅用于调试或派生白名单审计事件,禁止原样持久化)
}
```

### 6.2 事件订阅

```ts
agent.addEventListener('statuschange', () => console.log(agent.status))
agent.addEventListener('historychange', () => renderSteps(agent.history))
agent.addEventListener('activity', (e) => showActivity((e as CustomEvent).detail))
agent.addEventListener('dispose', () => cleanup())
```

`activity` 事件 `detail` 形如 `{ type: 'executing', tool: 'click_element_by_index', input: {...} }`,适合做"正在点击元素 [12]..."这类实时反馈;`step` 历史事件还带 `usage`(promptTokens / completionTokens / cachedTokens 等)与 `rawRequest / rawResponse` 调试字段。

> `history`、`rawRequest` 和 `rawResponse` 可能包含用户任务、页面文本、Action 参数或模型回复,只允许在受控开发环境临时调试。生产审计必须从执行事件中提取白名单字段并脱敏,不得直接保存完整 History 或原始收发内容。

### 6.3 Panel 面板

```ts
agent.panel.show()      // 显示
agent.panel.hide()      // 隐藏
agent.panel.expand()    // 展开历史
agent.panel.collapse()  // 收起
agent.panel.reset()     // 重置
agent.panel.wrapper     // 根 HTMLElement,可自定义挂载/样式
```

以上 API 仅用于官方面板调试。官方 Panel 会监听 `statuschange`,并在 Agent 进入 `running` 时自行调用 `show()`,所以 WMS 运行时必须在创建 PageAgent 后立即调用一次 `agent.panel.dispose()`,不能只省略 `agent.panel.show()`。自建悬浮窗直接订阅 `PageAgentCore` 事件并调用执行 API,见 §11.6。

### 6.4 PageController(底层 DOM 操作,可独立使用)

| 方法 | 说明 |
| --- | --- |
| `getBrowserState()` | 获取结构化页面状态 `{ url, title, header, content, footer }`(自动刷新 DOM 树) |
| `updateTree()` | 重新脱水 DOM,返回给 LLM 的简化文本 |
| `clickElement(index)` | 按索引点击(W3C 完整事件序列) |
| `inputText(index, text)` | 按索引输入文本 |
| `selectOption(index, optionText)` | 按索引选择原生 `<select>` 选项 |
| `scroll({ down, numPages, pixels?, index? })` | 垂直滚动(可指定元素内滚动) |
| `scrollHorizontally({ right, pixels, index? })` | 水平滚动 |
| `executeJavascript(script, signal?)` | 在页面执行任意 JS(配合实验开关) |
| `showMask() / hideMask()` | 显示/隐藏操作遮罩 |
| `cleanUpHighlights()` | 清除元素高亮 |

> 事件:`beforeUpdate` / `afterUpdate`(DOM 树刷新前后)。

---

## 7. 内置工具清单

LLM 每一步只能从下表选一个工具调用(MacroTool 单动作约束):

| 工具名 | 参数 | 说明 |
| --- | --- | --- |
| `click_element_by_index` | `index: number` | 点击指定索引的交互元素 |
| `input_text` | `index, text` | 向 input/textarea 输入文本 |
| `select_dropdown_option` | `index, optionText` | 选择原生 `<select>` 的选项 |
| `scroll` | 方向 + 幅度 | 页面/元素垂直滚动 |
| `scroll_horizontally` | 方向 + 像素 | 水平滚动 |
| `wait` | `seconds` | 等待(应对加载/动画) |
| `ask_user` | `question` | 向用户提问并等待回答(HITL) |
| `done` | 结果文本 | 声明任务完成并给出最终答复 |
| `execute_javascript` | `script` | ⚠️ 实验性,需 `experimentalScriptExecutionTool: true` |

---

## 8. 自定义工具开发

### 8.1 用 `tool()` 定义业务工具

```ts
import { PageAgent, tool } from 'page-agent'
import { z } from 'zod/v4'

const agent = new PageAgent({
    // ...LLM 配置
    customTools: {
        // 示例:WMS 路由跳转工具(比"找菜单再点击"更快更稳)
        navigate_to: tool({
            description: '跳转到 WMS 系统内的指定页面。优先使用本工具而非逐层点击菜单。',
            inputSchema: z.object({
                path: z.string().describe('vue-router 路径,如 /customer/list'),
            }),
            execute: async function (input) {
                await router.push(input.path)   // this 指向 PageAgent 实例
                return `✅ 已跳转到 ${input.path}`
            },
        }),
    },
})
```

要点:

- `inputSchema` 用 **zod v4** 定义,`description` 写清楚,LLM 选工具主要靠它;
- `execute` 内 `this` 为 PageAgent 实例,可通过 `this.pageController` 做 DOM 操作;
- 返回字符串即工具结果,会写入 history 并反馈给 LLM;
- 入参 `ctx.signal`(`AbortSignal`)必须响应,保证 `stop()` 能及时中断。

### 8.2 覆盖 / 移除内置工具

```ts
customTools: {
    ask_user: null,                 // 移除:禁止 Agent 向用户提问
    wait: tool({ ... }),            // 覆盖:自定义等待逻辑
}
```

### 8.3 WMS 业务工具建议清单

| 工具 | 价值 |
| --- | --- |
| `navigate_to` | 路由直达,省去菜单点击,降低步数与失败率 |
| `open_create_dialog(module)` | 直达"新增客户/新增订单"弹窗,配合表单填写 |
| `query_business_data(type, keyword)` | 直接调后端 API 查数(库存/订单),不走 UI,又快又准 |
| `get_current_user()` | 告知 Agent 当前登录人与权限,避免越权操作 |

> 原则:**能用 API/路由解决的,不让 Agent 慢慢点**;DOM 操作留给真正的表单填写与界面探索。

---

## 9. LLM 接入指南

### 9.1 模型要求

- 必须符合 **OpenAI API 协议**且**支持 Tool Call(function calling)**;
- 上下文建议 ≥ 32k——典型页面脱水后约 **15k tokens**,8k 是最低门槛;
- Tool Call 能力弱的模型会返回错误格式(常见错误一般可自动恢复);过小或无法处理复杂工具定义的模型表现通常不佳。

官方已测模型(节选,⭐ 为推荐:快、轻量、ToolCall 强):

| 厂商 | 模型 |
| --- | --- |
| 通义 Qwen | qwen3.7-max / qwen3.6-plus / **qwen3.5-plus⭐** / **qwen3.5-flash⭐** / qwen3-max |
| DeepSeek | deepseek-v4-pro / **deepseek-v4-flash⭐** / deepseek-3.2 |
| OpenAI | gpt-5.6 系列 / gpt-5.5 / **gpt-5.4-mini⭐** / **gpt-5.4-nano⭐** / gpt-4.1 |
| Google | **gemini-3.5-flash⭐** / gemini-3.1-pro / gemini-2.5-pro |
| Anthropic | claude-sonnet-5 / claude-opus-4.8 / **claude-haiku-4.5⭐** |
| MoonshotAI | **kimi-k3** / kimi-k2.7-code / kimi-k2.6 |
| 其他 | MiniMax-M2.7、xAI grok-4.5、腾讯 hy3、Z.AI glm-5.2 |

> WMS 场景推荐 **qwen3.5-plus / deepseek-v4-flash / kimi-k3**:中文界面理解好、Tool Call 稳、国内访问顺畅。

### 9.2 云端模型配置示例

```ts
// 阿里云百炼(OpenAI 兼容模式)
const agent = new PageAgent({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: 'your-api-key',
    model: 'qwen3.5-plus',
})
```

### 9.3 生产环境:后端代理 + customFetch(必须)

> ⚠️ **永远不要把真实 LLM API Key 提交到前端代码。** 集成进 WMS 这类面向员工的产品时,应由后端做 LLM 代理,前端用 `customFetch` 携带业务登录态:

```ts
const agent = new PageAgent({
    baseURL: '/api/llm-proxy',           // 自研后端代理,鉴权+转发+限流+审计
    model: 'qwen3.5-plus',
    customFetch: (url, init) =>
        fetch(url, { ...init, credentials: 'include' }),  // 带 Cookie 会话
})
```

后端代理收益:Key 不下发、按租户/员工限流、调用审计、模型可随时切换。

### 9.4 本地/内网模型(Ollama / LM Studio)

离线或内网部署时可用本地 OpenAI 兼容运行时:

```ts
// Ollama(无需 apiKey)
const agent = new PageAgent({ baseURL: 'http://localhost:11434/v1', model: 'qwen3:14b' })

// LM Studio(必须关命名 tool_choice)
const agent = new PageAgent({
    baseURL: 'http://127.0.0.1:1234/v1',
    model: 'qwen/qwen3.5-27b',
    disableNamedToolChoice: true,
})
```

部署要求:

- **开启 CORS**,否则浏览器无法直连(Ollama:`OLLAMA_ORIGINS="*"`);
- **上下文 ≥ 8000,建议 64000**(默认 4k 必然截断):`OLLAMA_CONTEXT_LENGTH=64000`;
- 模型须支持 tool_call,**参数量 < 10B 通常不够用**(实测 Ollama 0.15 + qwen3:14b @ RTX3090 可用)。

### 9.5 Prompt Caching(降本提速)

部分厂商支持提示词缓存,但各家实现不同,用 `transformRequestBody` 注入缓存提示:

```ts
// Claude(兼容代理):顶层加 cache_control
transformRequestBody: (body) => ({ ...body, cache_control: { type: 'ephemeral' } })

// 百炼 Qwen:把 system 消息改为带 cache_control 的分段格式
transformRequestBody: (body) => {
    const [sys, ...rest] = body.messages
    if (sys.role !== 'system' || typeof sys.content !== 'string') return body
    return {
        ...body,
        messages: [
            { ...sys, content: [{ type: 'text', text: sys.content, cache_control: { type: 'ephemeral' } }] },
            ...rest,
        ],
    }
}
```

---

## 10. 安全与合规

### 10.1 API Key 保护

- 禁止硬编码 Key 进前端 bundle;统一走 §9.3 的后端代理;
- 官方免费测试 API 仅限评估:**数据经中国大陆服务器处理,禁止输入任何 PII/敏感业务数据**。

### 10.2 数据脱敏(transformPageContent)

页面文本发给 LLM 前的最后关卡,典型用法——手机号脱敏:

```ts
const agent = new PageAgent({
    // ...
    transformPageContent: async (content) =>
        content.replace(/1[3-9]\d{9}/g, '***********'),
})
```

WMS 建议追加:身份证号、银行卡号、客户具体成交金额(按分存储的字段先转元再决定脱敏粒度)等正则规则。

`transformPageContent` 只处理 DOM 脱水文本,不能覆盖用户任务、`getContext()`、Action 参数与结果、接口错误、History 和模型原始收发。完整安全模型必须分别在任务入口、Context Builder、Dispatcher 结果摘要和审计写入层执行字段白名单与脱敏;MVP 至少禁止把完整业务对象放入 `getContext()` 或 Action 返回字符串。

### 10.3 交互元素黑白名单

```ts
const agent = new PageAgent({
    // 黑名单:Agent 永远"看不见"删除/审核类危险按钮
    interactiveBlacklist: [
        () => document.querySelector('.danger-zone'),
        () => document.querySelector('#btn-delete-all'),
    ],
    // 或白名单:只允许操作查询区
    // interactiveWhitelist: [() => document.querySelector('.filter-deck')],
})
```

> 黑名单是**感知层拦截**(元素不进脱水结果,LLM 根本不知道它存在),比事后拦截更可靠。

### 10.4 操作遮罩与人工接管

- `enableMask: true`:自动化期间全页半透明遮罩,防用户误点;DOM 提取会自动绕过遮罩;
- 用户手动操作会记录 `user_takeover` 事件,Agent 把人工结果纳入推理,实现"人机接力";
- 任何时刻可 `await agent.stop()` 优雅停止。

WMS MVP 固定使用 `enableMask: false`。原因是销售订单审核需要在 Agent Tool 执行期间等待用户操作 `AuditPreviewDialog`,而官方遮罩层的层级高于普通 Element Plus 弹窗并会拦截鼠标、键盘和滚轮事件。执行状态与防重复操作改由 WMS 悬浮窗、确认弹窗和页面局部 loading 控制。若后续重新启用遮罩,必须先实现“确认弹窗透传或确认期间临时隐藏遮罩”的完整交互协议并进行回归测试。

### 10.5 危险开关警示

| 开关 | 风险 |
| --- | --- |
| `experimentalScriptExecutionTool` | LLM 可执行任意 JS,**可能绕过脱敏与黑白名单**,生产默认关闭 |
| `customSystemPrompt` | 完全覆盖官方提示词,反射格式/工具约束可能被破坏,仅深度定制时使用 |

---

## 11. WMS 集成落地方案

### 11.1 现状

- `wms-vue3/package.json` 已引入 `page-agent@^1.12.2`;
- 已通过 `src/plugins/pageAgent.ts` 封装开发环境单例,并在 `src/main.ts` 挂载 Vue 应用后初始化;本地模型配置保存在被 Git 忽略的 `.env.local`;
- 技术栈 Vue 3.5 + Element Plus 2.8 + vue-router 4 + Pinia,与 PageAgent 完全兼容(纯页内 JS,W3C 事件模拟可触发 el 组件)。

### 11.2 目标场景(按优先级)

| 优先级 | 场景 | 示例指令 | 落地要点 |
| --- | --- | --- | --- |
| P0 | 智能表单填写 | "帮我新增一个正式客户:XX贸易,电话138...,月结" | `navigate_to` 直达新增页 + DOM 填写 + 提交前 `ask_user` 确认 |
| P0 | 列表搜索/筛选 | "查一下上个月所有待审核的销售订单" | 填写筛选区 + 点击查询;复杂查询建议 `query_business_data` 走 API |
| P1 | 页面导航 | "打开月结收款单列表" | 纯 `navigate_to` 自定义工具,一步直达 |
| P1 | 操作引导(新手) | "怎么给客户开通月结?" | instructions 注入操作手册,Agent 边讲边演示 |
| P2 | 批量操作 | "把这几个停用的客户都删掉" | ⚠️ 高危,必须黑名单/确认双重护栏 |

### 11.3 路由感知指令(getPageInstructions)

WMS 页面多、结构差异大,按页面注入说明书可以显著减少 Agent 猜测和无效步骤。对于当前可修改源码的 WMS 项目,推荐以 §11.4 的**页面主动注册**作为主定位方式,Vue Router 与 URL 仅作为导航和降级定位依据。

只依赖 URL 存在两个问题:

1. Vite 部署基础路径 `import.meta.env.BASE_URL` 为 `/wms/`,所有业务页面相同,只能识别当前应用,不能识别具体业务页面;
2. `/common/add` 被客户、销售、采购、仓库、财务等大量新增/编辑场景复用,必须结合 `route.query.type / mode / id / readonly` 才能确定真实页面身份。

如果页面尚未接入主动注册,可临时按标准化后的路由路径和查询参数注入页面说明:

```ts
const PAGE_GUIDES: Record<string, string> = {
    '/customer/info': '本页是正式客户列表。查询区在顶部,状态枚举:0=停用 1=正常;月结标识 is_monthly_settlement:0=现结 1=月结。',
    '/sales/order': '本页是销售订单。金额单位:分(展示已转元);warehouse_status≠3 表示需跟进。',
}

new PageAgent({
    // ...
    instructions: {
        system: '你是 WMS 操作助手。只执行仓储业务操作;涉及提交/删除前必须用 ask_user 向用户确认。',
        getPageInstructions: () => {
            const route = router.currentRoute.value

            if (route.name === 'AddTemplate') {
                const type = String(route.query.type || 'unknown')
                const mode = route.query.readonly === '1'
                    ? 'readonly'
                    : route.query.mode === 'edit'
                        ? 'edit'
                        : 'create'

                return `当前是通用业务表单。表单类型:${type};操作模式:${mode}。`
            }

            return PAGE_GUIDES[route.path]
        },
    },
})
```

### 11.4 页面主动注册与轻量页面定位

#### 11.4.1 设计决策

WMS Agent 不应长期依赖 URL 或 DOM 文本猜测当前页面。推荐由页面组件在挂载时主动向 Agent Runtime 注册自己的身份、能力和风险等级,卸载或失活时注销。定位优先级固定为:

```text
1. 当前活动 Surface(弹窗/抽屉/Popover)
2. 页面运行时主动注册信息
3. Vue Router meta / route.name
4. 标准化后的 route.path + params + 关键 query
5. DOM 标识校验与降级推断
```

主动注册解决“当前是什么业务页面”,`data-agent-*` 稳定属性解决“当前应该操作哪个元素”;Router 和 URL 保留用于页面导航、未接入页面的兼容以及故障降级。

#### 11.4.2 页面身份协议

页面注册信息只保存轻量元数据与惰性上下文读取函数,不保存完整表格、表单或 Vue 组件实例:

```ts
export interface WmsAgentPageDefinition {
    id: string
    module: string
    title: string
    mode: 'list' | 'create' | 'edit' | 'detail' | 'readonly'
    capabilities: string[]
    riskLevel: 'read' | 'draft' | 'write' | 'dangerous'
    instructions?: string | (() => string)
    getContext?: () => Record<string, unknown>
    isReady?: () => boolean
}
```

正式客户列表可注册为:

```ts
useAgentPage({
    id: 'customer.info.list',
    module: 'customer',
    title: '正式客户信息',
    mode: 'list',
    capabilities: [
        'customer.search',
        'customer.view',
        'customer.prepare-create',
    ],
    riskLevel: 'read',
    instructions: '本页用于查询正式客户。查询区位于顶部;Agent 可以查询和查看,不能直接执行删除。',
    getContext: () => ({
        selectedCustomerId: selectedRow.value?.customer_id,
        currentStatus: searchForm.status,
        totalRows: pagination.total,
    }),
})
```

`getContext()` 只在 Agent 每一步真正需要页面上下文时执行,并且只返回当前任务需要的少量字段。禁止把完整表格数据、完整 Pinia Store 或整个响应式表单对象注册到 Runtime。

#### 11.4.3 通用表单场景

`/common/add` 无法仅凭 URL 区分真实业务场景。应结合现有 `formConfigs.ts` 中的 `type` 配置生成页面身份:

```ts
const type = computed(() => String(route.query.type || 'unknown'))
const isEdit = computed(() => route.query.mode === 'edit')
const isReadonly = computed(() => route.query.readonly === '1')

useAgentPage(() => ({
    id: `${type.value}.form`,
    module: resolveModuleByFormType(type.value),
    title: formConfig.value?.title || '业务表单',
    mode: isReadonly.value
        ? 'readonly'
        : isEdit.value
            ? 'edit'
            : 'create',
    capabilities: formConfig.value?.agent?.capabilities || [],
    riskLevel: isReadonly.value ? 'read' : 'draft',
    getContext: () => ({
        formType: type.value,
        entityId: route.query.id,
    }),
}))
```

后续可直接在表单配置中声明 Agent 元数据,使字段规则与 Agent 规则共用同一事实来源:

```ts
const formConfigs = {
    customerInfo: {
        // 原有表单配置
        agent: {
            pageId: 'customer.info.form',
            module: 'customer',
            capabilities: [
                'customer.prepare-create',
                'customer.prepare-edit',
            ],
            riskLevel: 'draft',
            instructions: '客户名称、联系人、联系电话为必填项。Agent 可以填写表单,但不能自动提交。',
        },
    },
}
```

#### 11.4.4 轻量注册中心

注册中心使用 `shallowRef + markRaw` 保存当前页面引用,避免 Vue 对页面定义进行深度代理。注册、读取和注销均为 O(1):

```ts
import { markRaw, shallowRef } from 'vue'

const currentPage = shallowRef<WmsAgentPageDefinition>()

export function registerAgentPage(page: WmsAgentPageDefinition) {
    if (currentPage.value?.id === page.id) return
    currentPage.value = markRaw(page)
}

export function unregisterAgentPage(pageId: string) {
    if (currentPage.value?.id === pageId) {
        currentPage.value = undefined
    }
}

export function getCurrentAgentPage() {
    return currentPage.value
}
```

Composable 在页面挂载/激活时注册,卸载/失活时注销。WMS 多标签或 `KeepAlive` 页面必须同时处理 `onActivated / onDeactivated`,并保证重复注册幂等:

```ts
export function useAgentPage(
    source: WmsAgentPageDefinition | (() => WmsAgentPageDefinition),
) {
    const resolve = () => typeof source === 'function' ? source() : source
    const register = () => registerAgentPage(resolve())
    const unregister = () => unregisterAgentPage(resolve().id)

    onMounted(register)
    onActivated(register)
    onDeactivated(unregister)
    onUnmounted(unregister)
}
```

禁止使用 `watch(form, ..., { deep: true })` 在每个输入变化时重新注册页面;动态业务状态统一通过惰性的 `getContext()` 获取。

#### 11.4.5 活动 Surface

Element Plus 弹窗通常挂载到 `body`。弹窗打开后,Agent 的实际操作目标已从背景页面切换到 Dialog/Drawer/Popover,因此需要独立的 Surface 注册栈:

```ts
export interface WmsAgentSurfaceDefinition {
    id: string
    type: 'page' | 'dialog' | 'drawer' | 'popover'
    priority: number
    capabilities: string[]
    instructions?: string
    rootElement?: () => Element | null
}
```

Surface 打开时注册、关闭时注销。Runtime 总是选择优先级最高的活动 Surface,避免 Agent 在弹窗存在时误点背景页面。正常情况下同时活动的 Surface 数量很少,使用小数组或栈即可,不需要持续扫描整个 DOM。

#### 11.4.6 稳定元素标识

关键输入、查询、提交和危险按钮应增加稳定属性:

```vue
<el-input
    v-model="form.customerName"
    data-agent-id="customer.name"
/>

<el-button
    data-agent-id="customer.save"
    data-agent-risk="write"
>
    保存
</el-button>
```

并让 PageAgent 在脱水结果中保留这些属性:

```ts
new PageAgent({
    // ...
    includeAttributes: [
        'data-agent-id',
        'data-agent-risk',
        'data-agent-field',
    ],
})
```

`data-agent-id` 不能代替服务端权限校验,但能减少对中文文本和易漂移元素索引的依赖,提高元素定位稳定性。

#### 11.4.7 与 PageAgent 指令系统连接

`getPageInstructions` 优先读取当前主动注册页面和 Surface;只有未注册时才退回 Router/URL 解析:

```ts
new PageAgent({
    // ...
    instructions: {
        system: WMS_AGENT_SYSTEM_INSTRUCTIONS,
        getPageInstructions: () => {
            const surface = getActiveAgentSurface()
            if (surface?.instructions) return surface.instructions

            const page = getCurrentAgentPage()
            if (page) {
                const instructions = typeof page.instructions === 'function'
                    ? page.instructions()
                    : page.instructions
                const context = page.getContext?.()

                return buildPageInstructions(page, instructions, context)
            }

            return resolveInstructionsFromRouter(router.currentRoute.value)
        },
    },
})
```

#### 11.4.8 性能原则与预算

页面主动注册本身不是主要性能瓶颈。合理实现时,它只在组件生命周期边界写入或删除一个轻量引用;相比 LLM 网络调用、DOM 脱水、长 Prompt 和多余 Agent 步骤,其成本可以忽略。主动注册还能减少“观察 → 猜测页面 → 误操作 → 再观察”的无效循环,通常会降低总体延迟和 Token 消耗。

性能实现原则:

- 注册中心只保存当前页面/Surface 的轻量定义,不深度响应式完整业务数据;
- 页面元数据使用 `markRaw`,当前引用使用 `shallowRef`;
- `getContext()` 按 Agent 步骤惰性执行,只返回白名单字段;
- 页面输入变化不触发重新注册;
- 不使用全局 `MutationObserver` 持续扫描整个 DOM 来识别页面;
- 页面说明与静态能力列表可以按 `pageId` 缓存;
- 页面适配器可随业务路由懒加载,避免全部进入首屏;
- 注册、注销和 Surface 操作必须幂等,避免 HMR/KeepAlive 重复记录与内存泄漏。

建议将下表作为待实测的框架性能目标:

| 环节 | 目标 |
| --- | ---: |
| 页面注册/注销 | `< 1ms` |
| 当前页面或 Surface 解析 | `< 1ms` |
| WMS Context 生成 | `< 5ms` |
| 页面指令组装 | `< 5ms` |
| DOM 脱水 | 按页面规模控制在 `< 50ms` |

这些数值是工程预算而非既成结论,应通过 `performance.mark / performance.measure` 在真实客户列表、销售订单、库存表和通用表单上采样验证。框架性能优化的优先级应为:**减少 Agent 步数 > 缩短 Prompt/DOM > 降低 LLM 延迟 > 优化注册中心**。

### 11.5 页面业务 Action 注册需求

#### 11.5.1 背景与目标

仅依靠 PageAgent 操作 DOM 完成查询、录入和提交时,一次任务通常需要多轮“观察页面 → 定位元素 → 点击/输入 → 等待 → 再观察”。对于 WMS 中结构明确、已有后端接口的业务操作,可由主动注册页面同时声明受控的业务 Action,让 Agent 在满足权限、校验和确认条件后直接复用现有前端 API Service。

该能力的目标是:

- 减少查询、填表、提交等任务的 Agent 步数、DOM 脱水次数、Token 消耗和总体延迟;
- 使用稳定的业务动作名替代易变化的 DOM 结构、按钮文案和原始接口地址;
- 继续复用项目现有请求封装、登录会话、错误处理和字段转换;
- 对写入、状态流转和危险操作提供统一的校验、确认、幂等、权限及审计机制;
- Action 执行后同步 Pinia、表格、表单等页面状态,保证用户看到的界面与后端结果一致;
- 当 Action 未接入或发生可恢复的技术故障时,可在确认原页面操作已获授权后退回 PageAgent 的页面操作能力;权限不足时必须拒绝,禁止通过 DOM 回退绕过权限。

本需求不允许把任意 URL、HTTP Method 或未经约束的请求体直接交给模型调用。Router 只负责识别当前业务上下文,不能作为权限边界;后端仍然是权限和业务规则的最终裁决者。

#### 11.5.2 核心设计决策

页面注册的是语义化业务 Action,而不是后端接口地址。例如销售订单相关页面使用 `sales-order.search`、`sales-order.create` 和 `sales-order.audit-approve` 等稳定动作。Action 执行器内部复用 `searchSalesOrdersV2()`、`createSalesOrderV2()`、`getSalesAuditPreview()` 和 `auditSalesOrderV2()` 等现有前端 API Service,原始路径、鉴权头和底层请求细节默认不进入 Prompt。

MVP 的 PageAgent 桥接方式确定为:**单一静态 Dispatcher Tool**。PageAgent 初始化时只注册一个稳定的 `execute_wms_action` 自定义工具,页面切换时不重建 PageAgent,也不直接动态修改 `agent.tools`。当前 Page/Surface 通过 Action Registry 动态提供允许执行的 Action;`getPageInstructions` 每步只向模型说明当前页面的 Action ID、用途和参数提示;Dispatcher 在本地再次检查 Action 是否属于当前上下文并执行 Zod 校验。

选择该方案的原因:

- 只依赖 PageAgent 正式提供的 `customTools` 与 `getPageInstructions`,不依赖内部工具 Map 的动态修改行为;
- PageAgent 单例和 Tool Schema 保持稳定,页面切换不需要销毁或重建实例;
- 模型只看到一个通用执行入口,当前可用业务动作由页面指令按需注入,避免把所有 WMS Action 长期放入 Prompt;
- Action Registry 是最终白名单,即使模型生成未列出的 Action ID,Dispatcher 也会在发送后端请求前拒绝;
- 后续若 PageAgent 提供正式的动态 Tool Provider,可以只替换桥接适配器,不改变页面 Action 协议。

能力解析优先级为:

```text
1. 当前活动 Surface 注册的 Action
2. 当前页面主动注册的 Action
3. 全局且当前用户有权使用的通用 Action
4. 无合适 Action 且原页面操作已获授权时,才允许退回 PageAgent 页面操作
```

对于多个页面复用的 Action,Action 定义应集中注册,页面只引用 Action ID;禁止在每个页面重复拼接接口地址和请求参数。

#### 11.5.3 Action 定义协议

```ts
import type { ZodType } from 'zod/v4'

export type AgentActionRisk =
    | 'read'
    | 'write'
    | 'state-change'
    | 'destructive'

export interface WmsAgentConfirmation {
    title: string
    summary: string
    details?: Array<{ label: string; value: string }>
    /** 只在浏览器内传给确认组件,禁止写入 Prompt/普通日志 */
    uiPayload?: unknown
}

export interface WmsAgentActionDefinition<TInput = unknown, TResult = unknown> {
    id: string
    title: string
    description: string
    inputSchema: ZodType<TInput>
    inputGuide: string
    risk: AgentActionRisk
    requiredPermissions?: string[]
    confirmation: 'none' | 'preview' | 'explicit'
    idempotency?: 'none' | 'recommended' | 'required'
    timeoutMs?: number
    prepareConfirmation?: (
        input: TInput,
        context: WmsAgentExecutionContext,
    ) => Promise<WmsAgentConfirmation> | WmsAgentConfirmation
    requestConfirmation?: (
        confirmation: WmsAgentConfirmation,
        context: WmsAgentExecutionContext,
    ) => Promise<boolean>
    execute: (
        input: TInput,
        context: WmsAgentExecutionContext,
    ) => Promise<TResult>
    summarizeResult?: (result: TResult) => string
    onSuccess?: (result: TResult) => void | Promise<void>
}

export interface WmsAgentExecutionContext {
    signal: AbortSignal
    pageId: string
    surfaceId?: string
    taskId?: string
    userId?: string
    permissions?: ReadonlySet<string>
    idempotencyKey?: string
    traceId?: string
}
```

MVP 中页面定义的 `capabilities` 全部使用 Action ID,不再混用无法执行的宽泛能力名:

```ts
useAgentPage({
    id: 'sales.order.list',
    module: 'sales',
    title: '销售订单',
    mode: 'list',
    capabilities: [
        'sales-order.search',
        'sales-order.audit-approve',
    ],
    riskLevel: 'dangerous',
})
```

页面风险取当前页面所有 Action 的最高风险,映射固定为:`read → read`、`write → write`、`state-change/destructive → dangerous`;`draft` 仅用于尚未提交的表单编辑能力。

文档中的“提交销售订单”统一解释为“创建销售订单”,对应现有 `createSalesOrderV2()`;不再使用不存在的 `salesOrderApi.submit()`。创建 Action 的正式定义示意如下,但它不属于首期 MVP:

```ts
registerAgentAction({
    id: 'sales-order.create',
    title: '创建销售订单',
    description: '根据已校验的销售订单主单和明细创建一张新销售订单',
    inputSchema: salesOrderCreateSchema,
    inputGuide: 'args 为销售订单创建参数,字段规则与 SalesOrderCreatePayload 一致',
    risk: 'write',
    requiredPermissions: ['api_sales_create_order'],
    confirmation: 'explicit',
    idempotency: 'required',
    prepareConfirmation: (input) => ({
        title: '创建销售订单',
        summary: `将为客户 ${input.customer_id} 创建一张销售订单`,
    }),
    execute: (input) => createSalesOrderV2(input),
    onSuccess: () => reloadOrderList(),
})
```

#### 11.5.4 Dispatcher 桥接协议

Dispatcher 是 PageAgent 与 WMS Action Runtime 之间唯一的 MVP 工具入口:

```ts
import { tool } from 'page-agent'
import { z } from 'zod/v4'

export const executeWmsActionTool = tool({
    description: '执行当前 WMS 页面允许的业务动作。只能使用当前页面说明中列出的 actionId。',
    inputSchema: z.object({
        actionId: z.string(),
        args: z.record(z.string(), z.unknown()).default({}),
    }),
    execute: async function ({ actionId, args }, { signal }) {
        return executeCurrentPageAction(actionId, args, {
            signal,
            taskId: this.taskId,
        })
    },
})
```

`executeCurrentPageAction()` 必须按以下顺序执行:

1. 解析当前活动 Page/Surface;
2. 确认 `actionId` 在当前上下文的 `capabilities` 白名单中;
3. 从 Action Registry 获取定义,找不到立即拒绝;
4. 使用该 Action 自己的 `inputSchema.safeParse(args)` 再次校验;
5. 执行权限与风险策略;
6. 当 `confirmation !== 'none'` 时,先调用 `prepareConfirmation`,再调用 `requestConfirmation` 或 Runtime 默认确认服务并等待结果;
7. 预检失败或用户取消时立即结束,不得调用 `execute`;
8. 只有确认成功后才调用 Action 的 `execute` 闭包,并把 `AbortSignal` 传入执行上下文;
9. 调用 `summarizeResult` 将结果转换为简短字符串返回 PageAgent;
10. 执行 `onSuccess` 同步当前页面状态。

`getPageInstructions` 每一步只注入当前页面 Action 目录:

```ts
getPageInstructions: () => {
    const page = getCurrentAgentPage()
    if (!page) return resolveInstructionsFromRouter(router.currentRoute.value)

    return buildCurrentPageInstructions({
        page,
        actions: getAvailableActions(page.capabilities),
    })
}
```

禁止让 Dispatcher 接收 URL、HTTP Method、任意 Header 或原始鉴权信息。Dispatcher 参数中的 `actionId` 只是候选值,Action Registry 的当前上下文校验才是可执行性的事实来源。

确认职责固定为:

- `prepareConfirmation`:属于 Action,可执行只读业务预检并生成业务化确认数据,不得产生写入副作用;
- `requestConfirmation`:属于页面适配器或统一确认服务,负责展示确认 UI 并返回 `true/false`;必须响应 `context.signal`;
- `execute`:只负责最终业务调用,Dispatcher 确认成功前绝不调用;
- `onSuccess`:只在 `execute` 成功后运行,负责页面状态同步。

`confirmation: 'preview'` 必须同时提供 `prepareConfirmation`。需要专用弹窗的 Action 还必须提供 `requestConfirmation`;普通 `explicit` Action 可以使用 Runtime 默认确认服务。缺少必需确认钩子的 Action 在注册阶段即视为配置错误,不得暴露给 Agent。

#### 11.5.5 完整目标功能需求

本节描述生产完整目标。MVP 明确延后的条目以 §11.5.13 为准,不应误判为首期阻塞项。

| 编号 | 需求 |
| --- | --- |
| `PA-ACT-001` | 页面和活动 Surface 必须能够声明当前可用的 Action ID。 |
| `PA-ACT-002` | Runtime 必须只把当前上下文可用且当前用户有权使用的 Action 暴露给 Agent。 |
| `PA-ACT-003` | Agent 必须通过稳定的 Action ID 发起操作,不得构造或调用未注册的 URL、Method 和请求体。 |
| `PA-ACT-004` | 每个 Action 必须提供用途说明、输入 Schema、风险级别、确认策略和执行函数。 |
| `PA-ACT-005` | Action 输入必须在执行前完成 Schema 校验;校验失败时不得发送后端请求。 |
| `PA-ACT-006` | Action 必须复用当前项目的 API Service/请求封装,继承当前登录会话和统一错误处理。 |
| `PA-ACT-007` | Runtime 必须在执行前检查前端可见权限;后端接口必须再次进行权限与业务规则校验。 |
| `PA-ACT-008` | `read` Action 可直接执行;`write` 至少显示参数预览;`state-change` 和 `destructive` 必须显式确认。 |
| `PA-ACT-009` | 创建、提交、库存变更等不可安全重复的操作必须携带幂等键,防止模型重试导致重复写入。 |
| `PA-ACT-010` | Action 成功后必须执行定义的页面同步策略,例如刷新列表、更新 Pinia 或重新获取详情。 |
| `PA-ACT-011` | Action 失败时必须返回结构化错误,区分参数错误、权限不足、业务冲突、网络失败和系统异常。 |
| `PA-ACT-012` | Action 不存在、未就绪或发生可恢复的技术故障时,Runtime 可在确认原页面操作已获授权后改用页面操作;权限不足必须直接拒绝,禁止 DOM 回退。 |
| `PA-ACT-013` | Runtime 必须记录 Action ID、页面 ID、操作者、确认结果、执行时间、耗时、结果状态和追踪 ID。 |
| `PA-ACT-014` | 敏感字段不得写入 Prompt、控制台和普通审计日志;日志应支持字段白名单和脱敏。 |
| `PA-ACT-015` | Action 必须支持超时和取消;同一任务不得无控制地并发执行多个写入 Action。 |

#### 11.5.6 风险与确认策略

| 风险级别 | 典型场景 | 默认执行策略 |
| --- | --- | --- |
| `read` | 查询列表、读取详情、加载下拉选项 | 参数校验后可直接执行 |
| `write` | 创建草稿、修改未提交单据 | 展示变更摘要,用户确认后执行 |
| `state-change` | 提交审核、审核通过、出入库确认 | 显示业务对象、当前状态与目标状态,必须显式确认 |
| `destructive` | 删除、作废、库存调整、不可逆操作 | 强制二次确认;首期默认禁用或仅开放白名单 |

确认界面必须展示业务语义,不能只显示原始 JSON。例如应显示“将销售订单 `SO2026001` 从未审核变更为审核通过”,而不是仅显示 `{ id: 123, status: 1 }`。`preview` 和 `explicit` 均为阻塞式确认;区别是 `preview` 需要先调用业务预检接口并展示预检结果。

#### 11.5.7 完整目标标准执行链路

以下为生产完整链路;MVP 暂不实现的幂等、专用审计和前端权限预筛选见 §11.5.13。

```text
解析当前 Page/Surface
  → 筛选当前可用 Action
  → Agent 选择 Action 并生成参数
  → Schema 校验
  → 权限、风险和业务前置条件检查
  → 必要时生成变更预览并请求用户确认
  → 生成幂等键并调用现有 API Service
  → 执行页面状态同步
  → 向 Agent 和用户返回结构化结果
  → 写入脱敏审计记录
```

模型只负责意图理解、Action 选择和候选参数生成;是否允许执行由确定性的校验器、权限策略和确认状态决定。

#### 11.5.8 页面状态一致性

直接调用接口绕过了原有按钮事件,因此每个写入 Action 必须声明成功后的同步方式。可选策略包括:

- 重新请求当前列表或详情;
- 精确更新 Pinia 中对应实体;
- 刷新通用表单的初始值和版本号;
- 关闭已完成的 Dialog/Drawer 并恢复页面焦点;
- 后端返回异步任务时进入轮询或事件订阅状态,不能提前宣称任务成功。

如果同步失败但后端操作已经成功,Runtime 必须明确提示“后端已成功、页面刷新失败”,并提供重新加载入口,不得自动重复发送写入请求。

#### 11.5.9 性能与可观测性要求

Action Registry 与页面注册采用相同的轻量原则,静态定义使用 `markRaw`,按 ID 使用 `Map` 查找,不深度响应式业务数据。以下指标均不包含 LLM 和后端网络耗时:

| 指标 | 目标 |
| --- | ---: |
| 当前上下文 Action 筛选 | `< 2ms` |
| Schema 与本地策略校验 | `< 5ms` |
| 确认摘要组装 | `< 5ms` |
| Action 注册/注销 | `< 1ms` |

每次执行应使用 `performance.mark / performance.measure` 或统一埋点拆分记录 `agent_decision`、`local_validation`、`user_confirmation`、`api_request`、`state_sync` 五段耗时。试点流程相较纯 DOM 操作应至少减少 50% 的 Agent 操作步数;该比例为验收目标,需以相同任务和测试数据实测。

#### 11.5.10 MVP 首期范围

首期固定为两个页面、三个 Action,不再使用“任选代表性模块”的开放描述:

| 页面 ID | 路由 | Action ID | 风险 | 实际行为 |
| --- | --- | --- | --- | --- |
| `customer.info.list` | `/customer/info` | `customer.search` | `read` | 按客户名称、客户类型、状态查询正式客户并更新当前表格 |
| `sales.order.list` | `/sales/order` | `sales-order.search` | `read` | 按订单号、客户、结算方式、审核状态、创建日期查询销售订单并更新当前表格 |
| `sales.order.list` | `/sales/order` | `sales-order.audit-approve` | `state-change` | 只允许把未审核订单变更为审核通过(`audit_status=1`),必须先预检并等待用户明确确认 |

MVP 不开放销售订单反审核、重置待审核、审核失败、删除、作废、库存调整和批量跨模块流程。`sales-order.create` 已完成语义与真实 API 对齐,但不纳入首期实现。

三个 MVP Action 的输入契约固定为:

| Action ID | `args` 字段 | 约束 |
| --- | --- | --- |
| `customer.search` | `customerName?`、`customerTypeName?`、`status?: 0 \| 1`、`page?` | 全部为空时等同加载客户列表;状态在页面适配器中转换为现有筛选表单需要的字符串值 |
| `sales-order.search` | `salesOrderNo?`、`customerName?`、`settlementMethod?`、`auditStatus?: 0 \| 1 \| 2 \| 3`、`createdStart?`、`createdEnd?`、`page?` | 日期使用 `YYYY-MM-DD`;全部为空时等同加载销售订单列表 |
| `sales-order.audit-approve` | `salesOrderId`、`salesOrderNo` | 两者必填且必须匹配当前页面上下文中的同一张订单;订单当前状态必须为未审核;目标状态不作为模型参数,由执行器固定为 `1` |

`sales.order.list` 的 `getContext()` 只需向 Agent 提供当前可见订单的 `{ salesOrderId, salesOrderNo, auditStatus }` 轻量映射,不得暴露完整订单、金额明细或客户敏感数据。审核执行器必须使用 ID 与订单号双重校验,避免模型根据相似编号选错目标。

页面 Action 以闭包形式注册,允许直接复用页面已有的 `searchForm`、`tableData`、`pagination`、`loadData()` 和审核弹窗状态。Action 成功后必须更新当前页面,不能只把接口结果返回给模型。

销售订单审核流程固定为:

```text
定位一张当前页面中的未审核订单
  → GET 审核预检
  → 展示订单编号、客户、当前状态、目标状态和资金预检摘要
  → 用户明确确认
  → POST 审核通过(audit_status=1)
  → 刷新销售订单列表
```

`sales-order.audit-approve` 的职责分配固定如下:

```ts
{
    id: 'sales-order.audit-approve',
    confirmation: 'preview',
    prepareConfirmation: async ({ salesOrderId, salesOrderNo }, context) => {
        // 只读调用 getSalesAuditPreview([salesOrderId])
        // 校验 ID、订单号、当前 audit_status=0,并生成审核资金预检数据
        return buildSalesAuditConfirmation(salesOrderId, salesOrderNo, context.signal)
    },
    requestConfirmation: async (confirmation, context) => {
        // 委托唯一 UI Bridge 打开 AuditPreviewDialog 并等待 confirm/cancel;
        // context.signal 中止时 Bridge 关闭弹窗并返回 false
        return agentUiBridge.requestConfirmation(
            toUiConfirmationRequest(confirmation, context),
            context.signal,
        )
    },
    execute: ({ salesOrderId }, context) =>
        auditSalesOrderV2(salesOrderId, 1, { signal: context.signal }),
    onSuccess: () => loadData(),
}
```

现有 `AuditPreviewDialog` 需要通过 §11.6.4 的 UI Bridge 增加 Promise 适配层:Bridge 打开弹窗时保存本次请求的 resolve/reject;确认事件 resolve(`true`),取消、关闭或 `AbortSignal` 中止时 resolve(`false`),结束后清理引用。不得在 Dialog 的确认按钮事件中绕过 Dispatcher 再执行一次审核,避免重复写入;最终 `auditSalesOrderV2()` 只能由 Action 的 `execute` 调用。

#### 11.5.11 nuomi_wms 后端与真实接口矩阵

业务后端项目确定为 `D:\WMS\nuomi_wms`。MVP 不新增业务接口,统一复用以下现有契约:

| Action | wms-vue3 Service | nuomi_wms 接口 | 服务端权限路径 |
| --- | --- | --- | --- |
| `customer.search` | `getCustomerList()` / `searchCustomers()` | `GET /api/v1/tenant-customers/query`、`GET /api/v1/tenant-customers/search` | 请求路径对应权限,由 `require_tenant_employee_access(is_query=True)` 校验 |
| `sales-order.search` | `getSalesOrderListV2()` / `searchSalesOrdersV2()` | `GET /api/v1/tenant-sales-orders/list`、`GET /api/v1/tenant-sales-orders/search` | `/tenant-sales-orders/list`、`/tenant-sales-orders/search` |
| `sales-order.audit-approve` 预检 | `getSalesAuditPreview()` | `GET /api/v1/tenant-sales-orders/audit/preview` | `/tenant-sales-orders/audit/preview` |
| `sales-order.audit-approve` 执行 | `auditSalesOrderV2(salesOrderId, 1)` | `POST /api/v1/tenant-sales-orders/audit` | `/tenant-sales-orders/audit` |
| 后续 `sales-order.create` | `createSalesOrderV2()` | `POST /api/v1/tenant-sales-orders/create` | `/tenant-sales-orders/create` |

后端已经通过 Bearer Token 解析当前租客员工并执行接口级权限与业务规则校验。还存在 `GET /api/v1/tenant-employees/visible-permissions` 可作为后续前端权限预筛选的数据源。

MVP 阶段的权限策略:

- 前端权限集合缓存暂缓,由 `nuomi_wms` 的接口级鉴权作为最终边界;
- Dispatcher 仍必须执行当前 Page/Action 白名单检查;
- 后端返回 `401/403` 时任务立即失败,禁止转为 DOM 操作继续尝试;
- 本地开发继续使用当前 DashScope 配置;生产 LLM Proxy、Agent 专用审计与业务幂等协议保留为后续阶段,不得因此把开发 Key 发布到生产前端。

#### 11.5.12 MVP 文件边界与实施顺序

建议新增或修改的文件边界如下,具体命名可在实现时小幅调整,但职责不能混合:

```text
wms-vue3/src/
├── agent/
│   ├── types.ts                    # Page、Surface、Action、ExecutionContext 类型
│   ├── pageRegistry.ts             # 当前 Page/Surface 注册与解析
│   ├── actionRegistry.ts           # Action Map、当前上下文白名单、Zod 校验
│   ├── dispatcherTool.ts           # execute_wms_action PageAgent Tool
│   ├── instructions.ts             # 当前页面及 Action 目录的 Prompt 组装
│   ├── runtime/
│   │   ├── agentRuntime.ts         # PageAgent 单例、execute/stop/dispose
│   │   └── agentUiBridge.ts        # Agent 事件转为 WMS UI 事件
│   ├── stores/
│   │   └── agentUiStore.ts         # 悬浮窗状态、活动、历史和确认状态
│   └── ui/
│       ├── WmsAgentLauncher.vue    # 悬浮入口
│       ├── WmsAgentPanel.vue       # 面板容器
│       ├── WmsAgentHeader.vue      # 状态和停止/关闭控制
│       ├── WmsAgentTimeline.vue    # 白名单化执行时间线
│       ├── WmsAgentComposer.vue    # 任务输入
│       ├── WmsAgentActionCard.vue  # 业务 Action 状态卡片
│       └── WmsAgentThinking.vue    # 思考/执行动效
├── composables/
│   └── useAgentPage.ts             # Vue/KeepAlive 生命周期适配
├── plugins/
│   └── pageAgent.ts                # 兼容现有 main.ts 的薄启动入口,不持有第二份单例
├── views/
    ├── customer/CustomerInfo.vue   # 注册 customer.search
    └── sales/SalesOrder.vue        # 注册 search、audit-approve
├── App.vue                         # 全局挂载唯一 WmsAgentLauncher,跨路由不卸载
└── main.ts                         # Vue mount 后调用薄启动入口
```

实施顺序:

1. 显式安装并锁定 `zod` 直接依赖;
2. 实现类型、Page Registry 和 Action Registry;
3. 实现静态 Dispatcher Tool 与动态页面指令;
4. 实现 Agent Runtime、UI Bridge、Pinia UI Store 和最小可用 WMS 悬浮窗;
5. 接入 `src/plugins/pageAgent.ts`,dispose 官方 Panel、禁用操作遮罩并处理 `ask_user`;
6. 接入 `CustomerInfo.vue` 的只读查询;
7. 接入 `SalesOrder.vue` 的查询;
8. 将现有审核预检弹窗改造成可由 Action 等待的确认流程,接入审核通过;
9. 完善执行时间线、错误反馈和状态动效;
10. 执行构建、人工联调和固定任务验收;
11. 将实测结果和已知限制回填本文档。

#### 11.5.13 MVP 延后项

以下完整安全需求继续保留,但不阻塞本地 MVP 验证:

- `nuomi_wms` LLM Proxy 与模型 Key 服务端托管;
- 前端加载 `visible-permissions` 并按权限码预筛选 Action;
- Agent 专用白名单审计事件、Trace ID 和日志脱敏;
- 写入 Action 的端到端幂等键、TTL 与重放响应协议;
- 确认凭证绑定 `taskId + actionId + payloadHash + userId + pageId`;
- 自动化测试框架、P50/P95 性能基线和多次成功率统计;
- 动态 Surface Action、跨页面工作流和后端 Agent Gateway。

即使属于延后项,以下底线在 MVP 中也必须执行:**参数 Schema 校验、当前页面 Action 白名单、审核人工确认、服务端鉴权、401/403 禁止 DOM 回退、模型 Key 仅限本地开发环境**。

#### 11.5.14 MVP 验收标准

- 进入 `/customer/info` 后只注册 `customer.search`,可按名称、客户类型、状态查询并同步更新当前表格;
- 进入 `/sales/order` 后只注册 `sales-order.search` 与 `sales-order.audit-approve`;
- 销售订单查询支持订单号、客户、结算方式、审核状态和日期范围,查询结果同步当前表格;
- 审核 Action 只接受一张未审核订单并固定执行 `audit_status=1`;
- 审核必须先成功调用预检接口;预检失败时不得调用审核接口;
- 用户确认前不得发送审核写请求;用户取消后返回“已取消”且页面状态不变;
- 审核成功后刷新列表,目标订单显示为审核通过;
- 当前页面未声明的 Action、不存在的 Action ID 和 Schema 非法参数均在业务接口调用前被拒绝;
- 页面切换后不能继续调用上一个页面的 Action;
- 后端返回 `401/403` 时直接终止,不得通过 DOM 操作尝试绕过;
- Action 接口失败时保留可恢复的页面状态并向 Agent 返回明确错误;
- `AbortSignal` 被触发后,尚未开始或支持取消的 Action 应终止;
- 每个查询任务原则上通过一次 Action 调用完成,相较纯 DOM 操作明显减少 Agent 步数;
- Action 注册、当前上下文查找与本地 Schema 校验合计目标 `< 10ms`;
- WMS 悬浮入口和面板可独立打开、收起和关闭;任务进入 `running` 后 Alibaba 官方 Panel 也不会重新出现;
- 悬浮窗可正确展示 `idle`、`thinking`、`executing`、`awaiting-confirmation`、`success`、`error`、`stopped` 状态;
- 点击停止后调用 `agent.stop()`,界面最终进入 `stopped` 且不遗留未决确认 Promise;
- 审核等待确认期间用户可正常点击 Element Plus 弹窗,不存在全屏遮罩拦截;
- 页面卸载或 Agent 销毁后移除事件监听器和未完成的 UI 状态,不得重复订阅;
- `npm run build` 通过,并使用固定任务分别完成客户查询、销售订单查询、审核确认、审核取消和权限拒绝联调。

### 11.6 WMS 自定义悬浮窗与动效

#### 11.6.1 架构决策

WMS 选择**完全重做悬浮窗 UI 与动效**,不修改 Alibaba PageAgent 的 `packages/ui` 源码,也不直接修改 `node_modules/page-agent`。PageAgent 作为执行内核,WMS Vue 组件作为唯一业务交互界面:

```text
WmsAgentLauncher / WmsAgentPanel
            │ execute / stop / confirm
            ▼
       Agent UI Bridge
            │ statuschange / historychange / activity / WMS runtime events
            ▼
       PageAgent Runtime
            │
            ├── PageAgentCore 任务循环与 LLM
            ├── PageController DOM 操作
            └── execute_wms_action Dispatcher
```

选择该方案的原因:

- WMS 可以统一使用 Vue3、Pinia 和 Element Plus,不受官方 Panel DOM 结构和 CSS Module 类名约束;
- 悬浮窗可以展示 WMS 专属的 Action、订单审核预览、权限错误和业务状态;
- PageAgent 升级时只需验证内核事件和工具协议,无需长期维护 UI fork;
- UI 动效不会侵入 Agent 推理、Action 安全校验和后端调用链路;
- 官方 `PanelConfig` 目前只提供语言和 `promptForNextTask`,不足以支撑结构、主题、插槽和业务确认的完整定制。

#### 11.6.2 两阶段运行模式

**阶段 A(MVP):完整 PageAgent + 立即销毁官方 Panel。**继续使用当前 `page-agent@1.12.2`;实例创建后立即调用 `agent.panel.dispose()`,移除官方 Panel 的 DOM、定时器和事件监听。仅省略 `agent.panel.show()` 不成立,因为官方 Panel 会在 `statuschange: running` 时自动显示。WMS UI 随后直接调用 `agent.execute()`、`agent.stop()` 并监听事件。

官方 Panel 构造时还会把 `agent.onAskUser` 指向自己的输入 UI。MVP 在构造配置中使用 `customTools: { ask_user: null, execute_wms_action: dispatcherTool }`,dispose Panel 后再把 `agent.onAskUser` 清为 `undefined`,避免保留指向已销毁 Panel 的回调。未来实现 WMS 提问组件时,可重新提供支持 `AbortSignal` 的 `onAskUser`,并显式恢复 `ask_user` 工具;审核确认仍不得复用通用提问工具。

**阶段 B(后续优化):无头模式。**当 MVP 稳定且确有必要连官方 Panel 的短暂构造过程也取消时,改为直接组合 `PageAgentCore + PageController`,并把 `@page-agent/core`、`@page-agent/page-controller` 声明为直接依赖。该迁移不得改变 Page/Action Registry、Dispatcher、UI Store 和 UI Bridge 的对外接口。

MVP 禁止为取消官方 Panel 的短暂构造过程而提前 fork PageAgent。只有需要原生动态 Tool 注册、结构化 Tool Result、遮罩弹窗透传或准备向上游贡献通用 UI API 时,才单独评估修改源码。

#### 11.6.3 UI 组件职责

| 组件 | 职责 |
| --- | --- |
| `WmsAgentLauncher.vue` | 页面固定悬浮入口、未读/等待确认提示、打开面板 |
| `WmsAgentPanel.vue` | 面板布局、展开/收起、任务区与历史区组合 |
| `WmsAgentHeader.vue` | 当前状态、页面身份、停止和关闭控制 |
| `WmsAgentTimeline.vue` | 展示脱敏后的步骤、Action 名称、耗时与结果摘要 |
| `WmsAgentComposer.vue` | 输入自然语言任务、提交、防重复提交和快捷任务入口 |
| `WmsAgentActionCard.vue` | 查询、审核等业务 Action 的准备中/执行中/成功/失败状态 |
| `WmsAgentThinking.vue` | 思考、重试和执行中的视觉动效,不得承载业务状态判断 |

`WmsAgentPanel` 不直接访问具体页面组件或后端 API。业务调用仍必须经过 Dispatcher;UI 只提交任务、展示状态、发出停止或确认意图。

悬浮窗的全局挂载点固定为 `src/App.vue`:在 `<el-config-provider>` 内将 `<WmsAgentLauncher />` 作为 `<router-view />` 的同级组件。不得把 Launcher 放进客户页、销售订单页或会随业务路由卸载的局部组件;这样才能保证 Agent 与 UI 在两个 MVP 路由之间保持单例。`WmsAgentLauncher` 内部负责按需展示 `WmsAgentPanel`,不再额外创建第二个 Agent 实例。

Runtime 所有权固定如下:

- `src/agent/runtime/agentRuntime.ts` 是 PageAgent 实例、初始化 Promise 和异步关闭流程的**唯一所有者**;
- `src/plugins/pageAgent.ts` 只保留为兼容现有 `main.ts` 的薄入口,内部调用 `initializeAgentRuntime()`,不得再声明自己的 `pageAgent` 或 `initializationPromise`;
- `src/main.ts` 在 `app.mount('#app')` 后调用薄入口;UI 通过 Runtime API 获取状态和提交任务,不得读取 `window.pageAgent` 作为业务依赖;
- `window.pageAgent` 只在本地开发环境由 Runtime 暴露用于 DevTools 调试,生产不挂载;
- `App.vue` 只挂载 UI,不负责初始化或销毁内核,避免 Vue 组件重挂载时重复创建 Agent。

#### 11.6.4 状态模型与事件映射

WMS UI 使用比 PageAgent 核心更细的展示状态:

```ts
type WmsAgentUiStatus =
    | 'idle'
    | 'thinking'
    | 'executing'
    | 'awaiting-confirmation'
    | 'success'
    | 'error'
    | 'stopped'
```

| 来源 | 输入事件/状态 | WMS UI 状态或行为 |
| --- | --- | --- |
| PageAgent | `statuschange: running` | 保持当前细分状态;尚无活动时进入 `thinking` |
| PageAgent | `activity: thinking` | `thinking` |
| PageAgent | `activity: executing` | `executing`,创建或更新 Action 卡片 |
| PageAgent | `activity: retrying` | 保持运行态并展示重试次数 |
| PageAgent | `activity: error` | `error`,展示可操作错误摘要 |
| PageAgent | `statuschange: completed` | 按 `lastResult.success` 进入 `success` 或 `error` |
| PageAgent | `statuschange: stopped` | `stopped` |
| Dispatcher | `confirmation-requested` | `awaiting-confirmation`,高亮悬浮入口并展示业务确认 |
| Dispatcher | `confirmation-resolved` | 确认后回到 `executing`;取消则展示已取消结果 |
| PageAgent | `historychange` | 重新派生脱敏时间线,不得原样持久化完整 History |

`awaiting-confirmation` 是 WMS Runtime 状态,不是 PageAgent 原生 `AgentStatus`。UI Bridge 必须合并两类事件,避免仅凭 `agent.status === 'running'` 把等待用户确认错误显示为“正在执行接口”。

UI Bridge 必须提供单一的确认服务,不得让 Dispatcher 直接操作 Pinia Store 或 Vue 组件:

```ts
interface WmsAgentConfirmationRequest {
    confirmationId: string
    taskId: string
    actionId: string
    pageId: string
    title: string
    summary: Record<string, string | number | boolean | null>
    risk: 'write' | 'state-change' | 'destructive'
}

interface WmsAgentUiBridge {
    requestConfirmation(
        request: WmsAgentConfirmationRequest,
        signal: AbortSignal,
    ): Promise<boolean>
    resolveConfirmation(confirmationId: string, accepted: boolean): void
    cancelPendingConfirmation(reason: 'stop' | 'dispose' | 'route-change'): void
    dispose(): void
}
```

`requestConfirmation()` 写入 Store 并产生 `confirmation-requested`;确认、取消或中止后产生 `confirmation-resolved` 并清理 resolver。任一时刻最多存在一个未决确认;`confirmationId` 不匹配、任务已变化或页面已切换时必须拒绝处理。事件 detail 只包含上述白名单字段,不得携带 API 响应完整对象或鉴权信息。

状态更新必须经过单一 reducer 串行处理,优先级固定为:终态 `error/stopped/success` > `awaiting-confirmation` > `executing` > `thinking` > `idle`。等待确认期间收到普通 `activity: thinking/executing` 不得覆盖确认状态;确认结束后再依据最新核心状态恢复。只有 `activity.tool === 'execute_wms_action'` 才生成 WMS 业务 Action 卡片,点击、输入、滚动等 PageAgent 内置 DOM Tool 只生成通用步骤,不得误标为后端 Action。

#### 11.6.5 交互与生命周期要求

- 提交任务时若 Agent 已运行,输入区必须禁用或明确提示先停止当前任务,不得并发调用 `execute()`;
- 停止按钮必须 `await agent.stop()`,并通过同一 `AbortSignal` 结束接口、延时和确认等待;
- 关闭面板只隐藏 UI,不等同于停止任务;运行中关闭时悬浮入口仍显示执行或待确认状态;
- Runtime 的关闭入口必须是异步 `shutdownAgentRuntime()`:先触发/等待 `agent.stop()`,使当前 Tool 的 `AbortSignal` 中止并释放确认 Promise;再调用 `uiBridge.dispose()` 和解除全部监听;最后调用同步的 `agent.dispose()` 并清空单例。禁止运行中直接只调用 `agent.dispose()` 后丢弃未决状态;
- 应用卸载或 HMR 时调用统一 `shutdownAgentRuntime()`;若宿主钩子不能等待 Promise,也必须先同步触发 abort/取消确认,再执行剩余清理;
- `onAskUser` 若由 WMS UI 接管,必须支持 `AbortSignal`,任务停止时清理 resolver;MVP 未实现该组件前固定以 `customTools.ask_user = null` 禁用工具,并清除官方 Panel 写入的回调;
- Timeline 只展示 Action ID、白名单参数摘要、结果摘要、耗时和错误码,禁止展示 API Key、Authorization、完整订单/客户对象、`rawRequest` 或 `rawResponse`;
- 审核确认仍以 §11.5.3/§11.5.10 的 `AuditPreviewDialog` Promise 适配协议为准,不得由通用聊天输入框代替明确确认按钮。
- 用户取消审核确认时,本次 `requestConfirmation()` 返回 `false`,Dispatcher 返回明确的“用户已取消,未发送写请求”结果。Agent 可再进行一次总结步骤,但 Dispatcher 必须按 `taskId + actionId + payload` 记住本次拒绝,同一任务不得对完全相同的审核再次弹窗或发送写请求;
- PageAgent 自定义 Tool 的正式签名是 `execute(this: PageAgentCore, args, { signal })`;内核调用时会绑定 Agent 实例,因此 Dispatcher 可以从 `this.taskId`、`this.task` 构造执行上下文。业务 Action 闭包不得自行读取全局 `window.pageAgent`。

当前 `src/utils/request.ts` 的 `get/post/put/del` 已接受 Axios `RequestConfig`,可通过 `{ signal }` 使用原生 `AbortSignal`;但现有 `getCustomerList()`、`searchCustomers()`、`getSalesOrderListV2()`、`searchSalesOrdersV2()`、`getSalesAuditPreview()` 和 `auditSalesOrderV2()` 尚未暴露 config/signal 参数。MVP 接入 Action 时必须给这些 Service 增加可选 `config?: RequestConfig` 或 `signal?: AbortSignal`,并向底层请求传递,不能只在 Dispatcher 声明支持取消却丢失 signal。

取消 HTTP 客户端等待不等于撤销服务端已经接收的写操作。审核 POST 发出前必须完成确认;POST 发出后若用户停止,前端可以停止等待和后续 Agent 步骤,但必须把结果标记为“状态待刷新确认”,下次进入页面或手动刷新时重新查询。服务端幂等与最终状态查询仍按 §11.5.13 作为生产增强项。

#### 11.6.6 动效范围与性能约束

MVP 动效包括:

- 悬浮入口空闲态轻量呼吸效果;
- 面板展开、收起和位置变化的短过渡;
- `thinking` 状态渐变流光或点状加载;
- `executing` 状态 Action 时间线和局部进度反馈;
- `awaiting-confirmation` 状态高亮提醒;
- `success` 状态完成反馈;
- `error` 状态清晰但不过度的失败反馈。

动效必须遵循以下约束:

- 优先使用 `transform` 与 `opacity`,避免持续触发布局计算;
- 支持 `prefers-reduced-motion: reduce`,关闭非必要循环动效;
- 无限循环动效只在 `thinking/executing/awaiting-confirmation` 等活动状态运行,面板关闭或任务结束后停止;
- 动效不得延迟 Dispatcher、确认 Promise 或 `agent.stop()` 的真实状态更新;
- 悬浮窗不得遮挡 Element Plus 业务弹窗,审核确认层级必须高于普通 Agent 面板内容;
- 不复用 PageAgent `SimulatorMask` 充当悬浮窗动效;MVP 保持 `enableMask: false`。

#### 11.6.7 UI 验收标准

- 官方 PageAgent Panel 在初始化后立即 dispose,Agent 进入 `running` 时也不会重新出现;WMS 悬浮窗是唯一任务入口;
- 悬浮窗在客户与销售订单路由间切换时保持单例,当前页面身份和 Action 目录及时更新;
- 连续任务不会重复注册事件或重复追加相同历史卡片;
- 执行、重试、成功、失败、停止和等待确认都有可区分的视觉反馈;
- 面板关闭后任务可继续执行,悬浮入口仍可反映当前状态并重新打开;
- 审核等待确认期间可正常操作 `AuditPreviewDialog`,取消或停止均不发送审核写请求;审核 POST 已发出后的停止按“状态待刷新确认”处理,不宣称能够撤销服务端写入;
- 键盘操作可聚焦任务输入、提交、停止和确认控件,关键状态不只依赖颜色表达;
- 桌面端主流分辨率下不遮挡 WMS 主要操作区,窄屏时面板宽度自适应;
- 开启浏览器 `prefers-reduced-motion` 后无非必要循环动画;
- 组件卸载、HMR 和 Agent dispose 后无悬挂 Promise、定时器或事件监听器。

### 11.7 Element Plus 适配注意事项

1. **`el-select` 不是原生 `<select>`**:`select_dropdown_option` 工具不适用,Agent 会退化为"点击展开 → 点击选项"两次 click——可用但慢;对高频下拉(如所在城市)建议在页面指令中写明操作路径,或封装自定义工具直接赋值。
2. **弹窗(el-dialog)挂载在 body 末尾**:脱水树能覆盖到,但注意弹窗打开后页面状态变化大,`stepDelay` 可适当调大(0.6~0.8s)等动画结束。
3. **表格行内操作按钮多**:索引容易漂移,任务描述里带上业务主键(如"对客户编号 C2026001 点编辑")成功率显著更高。
4. **权限**:Agent 复用当前用户会话和 Bearer Token,但菜单/按钮是否可见不能代替权限判断。业务 Action 以 `nuomi_wms` 服务端鉴权为最终边界;返回 `401/403` 时禁止 DOM 回退。危险 DOM 元素仍使用黑名单兜底。

---

## 12. 限制与注意事项

1. **单页面边界**:基础版只在当前标签页工作;跨页面/跨标签任务需官方 Chrome 扩展。
2. **复杂 canvas / 游戏化界面不适用**:脱水依赖语义化 DOM,纯 canvas 渲染的页面(如大屏可视化)无法有效理解。
3. **成功率非 100%**:DOM 结构剧变、极长页面、Tool Call 弱的模型都会降低成功率;务必用 `maxSteps` + 黑名单 + 确认机制兜底。
4. **成本与延迟**:每步一次 LLM 调用、典型页面约 15k tokens/步,一个"新增客户"任务可能 5~15 步;生产环境务必走代理做限流与审计,并考虑 Prompt Caching。
5. **实验性 API 可能变更**:`customTools`、生命周期钩子、`experimental*` 开关在小版本间可能调整,升级前看 CHANGELOG。
6. **i18n 仅中英文**:`language` 只支持 `en-US / zh-CN`。
7. **纯 ESM 包**:老 webpack4 / require 环境需额外构建配置(Vite 5 无此问题)。

---

## 13. 故障排查 FAQ

| 现象 | 排查方向 |
| --- | --- |
| 初始化后无悬浮面板 | WMS 模式会主动 `agent.panel.dispose()`,应检查 `WmsAgentLauncher` 是否挂载、UI Store 是否初始化以及 Runtime 单例是否就绪。仅在独立调试官方 Panel 且尚未 dispose 时才能调用 `agent.panel.show()` |
| LLM 报 `Invalid tool_choice type: 'object'` | 该模型不支持命名 tool_choice,设置 `disableNamedToolChoice: true`(LM Studio 必设) |
| 本地 Ollama 请求失败 | 检查 CORS:`OLLAMA_ORIGINS="*"`;检查上下文:`OLLAMA_CONTEXT_LENGTH=64000` |
| 模型答非所问/格式错误 | 换 Tool Call 更强的模型(⭐推荐列表);常见格式错误框架会自动重试,持续失败看 `history` 中 `retry/error` 事件 |
| 点了没反应(Vue 组件) | 确认元素在视口内且未被黑名单过滤;PageAgent 派发的是完整 W3C 事件链,若组件只监听 `mousedown` 之类非标准组合需自定义工具兜底 |
| 元素索引对不上 | 页面在步与步之间发生了变化(懒加载/轮播),增大 `stepDelay`;或在指令中提示"先 wait 再操作" |
| Token 消耗异常高 | 页面过大,用 `interactiveBlacklist` 剔除无关区域;开启 Prompt Caching;检查是否死循环(看 `maxSteps` 与 history) |
| 想禁用向用户提问 | `customTools: { ask_user: null }` |
| 调试 LLM 原始收发 | 读 `history` 里 step 事件的 `rawRequest / rawResponse` 字段 |

---

## 14. 参考资料

- GitHub 仓库:https://github.com/alibaba/page-agent
- 官方文档站:https://alibaba.github.io/page-agent/
- 支持模型列表:https://alibaba.github.io/page-agent/docs/features/models
- 中文 README:https://github.com/alibaba/page-agent/blob/main/docs/README-zh.md
- 上游致谢:[browser-use](https://github.com/browser-use/browser-use)(MIT,DOM 处理组件与 Prompt 来源)
- 本地类型源码(最准确的 API 事实来源):
  - `wms-vue3/node_modules/page-agent/dist/esm/PageAgent.d.ts`
  - `wms-vue3/node_modules/@page-agent/core/dist/esm/PageAgentCore.d.ts`
  - `wms-vue3/node_modules/@page-agent/llms/dist/`、`@page-agent/page-controller/dist/`、`@page-agent/ui/dist/`
