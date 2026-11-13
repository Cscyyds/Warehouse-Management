# PageAgent × WMS 二次开发文档

| 项目 | 说明 |
| --- | --- |
| 上游源码 | `D:\WMS\page-agent-main\page-agent-main\`(GitHub zip 下载,alibaba/page-agent,**v1.12.2**) |
| 目标系统 | `D:\WMS\Warehouse-Management\wms-vue3\`(Vue 3.5 + Element Plus 2.8 + vue-router 4 + Pinia + Vite 5) |
| 上游协议 | **MIT**(允许自由二次开发、商用,保留版权声明即可) |
| 关联文档 | `Page_Agent_Search.md`(PageAgent 使用层 API 开发文档) |
| 文档更新日期 | 2026-07-31 |

---

## 1. 可行性结论

**结论:可行,且源码与线上依赖版本完全对齐(均为 1.12.2),fork 改动可做到对 wms-vue3 零感知替换。**

支撑理由:

1. **协议无障碍**:MIT License,唯一义务是在衍生作品中保留原版权声明(`LICENSE` 文件 + 各源文件头部 `Copyright (C) 2025 Alibaba Group Holding Limited` 注释不要删)。
2. **版本对齐**:wms-vue3 当前依赖 `page-agent@^1.12.2`,与拉取的源码版本一致,fork 构建产物可直接替换,无 API 迁移成本。
3. **架构可拆**:monorepo 按"决策(core)/操作(page-controller)/模型(llms)/界面(ui)"严格分层,WMS 定制(提示词、工具、面板、DOM 适配)各有明确的落点文件,改动互不污染。
4. **扩展点充足**:约 70% 的 WMS 定制(业务工具、页面指令、脱敏、黑名单、LLM 代理)通过配置层即可完成,**不需要改源码**;剩余 30%(内置工具集、系统提示词、面板形态、Element Plus 深度适配)才需要 fork。

### 1.1 两条技术路线

| | 路线 A:配置层定制(不改源码) | 路线 B:Fork 源码二开 |
| --- | --- | --- |
| 做法 | wms-vue3 中 `new PageAgent({...})` 时注入 `customTools / instructions / transformPageContent / interactiveBlacklist` | 修改 `page-agent-main` 源码,自行构建产物供 wms-vue3 消费 |
| 能覆盖 | 业务工具、页面说明书、脱敏、黑白名单、LLM 代理 | 在 A 之上 + 内置工具改造、系统提示词固化、面板 UI 品牌化、DOM 提取打补丁 |
| 升级成本 | 零,跟随 npm 升级 | 需维护 fork,定期 rebase 上游 |
| 适用阶段 | **试点期(建议先做)** | 规模化落地期 |
| 风险 | 无 | 构建链、版本漂移 |

> **建议路径**:先以路线 A 在 1~2 个页面(客户新增、订单查询)验证效果与模型成本,确认 ROI 后再进入路线 B。本文档以路线 B 为主线,同时标注哪些事项用路线 A 更划算(标 `[A即可]` 的不要改源码)。

---

## 2. 源码全景与定制点地图

### 2.1 仓库结构(v1.12.2,8 个包)

```text
page-agent-main/
├── package.json                 # npm workspaces 根,引擎要求 node ^22.22.1||>=24、npm ^11.6.3
├── scripts/                     # build.js(全量构建) / build-libs.js(仅库) / sync-version.js(版本同步)
├── docs/                        # developer-guide.md、CHANGELOG.md、README-zh.md 等
└── packages/
    ├── core/                    # @page-agent/core      —— Agent 主循环 + 工具集 + 系统提示词 ★二开主战场
    ├── page-controller/         # @page-agent/page-controller —— DOM 脱水/索引、事件模拟、遮罩 ★EP适配落点
    ├── llms/                    # @page-agent/llms      —— OpenAI 兼容客户端、重试、错误分类
    ├── ui/                      # @page-agent/ui        —— 悬浮面板 + i18n(原生 TS,非 Vue)★品牌化落点
    ├── page-agent/              # page-agent            —— 入口类 + ESM/IIFE 构建
    ├── extension/               # Chrome 扩展(WXT + React,跨标签页任务,暂不需要)
    ├── mcp/                     # MCP Server(Beta,外部 Agent 控制浏览器,暂不需要)
    └── website/                 # 文档站 + 开发调试 playground(React)
```

**关键事实(source-first monorepo)**:各库包 `package.json` 的 `exports` 在开发态指向 `src/*.ts`,只有发布时(`publishConfig`)才切换为 `dist/*`。这意味着:

- wms-vue3 可以通过 **Vite alias 直连 TS 源码**调试(见 §6.3),改源码即时热更新;
- `npm pack` 打 tarball 时 `publishConfig` 自动生效,得到的是指向 `dist` 的正常 npm 包。

### 2.2 定制点速查表

| 定制需求 | 落点文件 | 路线 |
| --- | --- | --- |
| 注入 WMS 业务规则/页面说明书 | 配置 `instructions.system` / `getPageInstructions(url)` | **[A即可]** |
| 新增 WMS 业务工具(路由直达、API 查询) | 配置 `customTools` | **[A即可]**,验证稳定后可固化进 `core/src/tools/index.ts` |
| 固化中文系统提示词 | `packages/core/src/prompts/system_prompt.md`(152 行,browser-use 派生,XML 标签结构) | B |
| 改造内置工具(如 wait 上限、click 前置校验) | `packages/core/src/tools/index.ts`(202 行,`tools: Map<string, PageAgentTool>`) | B |
| Element Plus 组件适配(el-select/el-dialog) | 优先 `customTools`(**[A即可]**);深度改造在 `packages/page-controller/src/actions.ts` 与 `dom/` | A 优先,B 兜底 |
| 面板品牌化(配色/Logo/位置/拖拽) | `packages/ui/src/panel/Panel.ts`(697 行)+ `Panel.module.css` | B |
| 中文文案增改 | `packages/ui/src/i18n/locales.ts` | B(少量可接受) |
| 数据脱敏(手机号/身份证/金额) | 配置 `transformPageContent` | **[A即可]** |
| 危险按钮屏蔽(删除/审核) | 配置 `interactiveBlacklist` | **[A即可]** |
| LLM 后端代理鉴权 | 配置 `customFetch` | **[A即可]** |
| 操作遮罩默认行为 | `packages/page-agent/src/PageAgent.ts` 中 `enableMask: config.enableMask ?? true` | B(改默认值) |

### 2.3 与原版文档的一处事实修正

> ⚠️ 早期资料称该 Agent 界面为"类似悬浮球、支持随意拖动"。**v1.12.2 源码实测:面板是 `position: fixed; bottom: 100px; left: 50%` 的底部居中悬浮条(Panel.module.css),全包无拖拽实现**。若 WMS 需要"可拖拽悬浮球"形态(不挡底部操作区),属于路线 B 的 UI 改造项,见 §5.4。

---

## 3. 环境准备

### 3.1 前置要求

| 项 | 要求 | 本机现状 |
| --- | --- | --- |
| Node | `^22.22.1 \|\| >=24` | ✅ 已有 22.22.2(managed)/ 24.14.0 |
| npm | `^11.6.3` | 需自查:`npm -v`,不足则 `npm i -g npm@latest` |
| Shell | 官方声明 macOS / Linux / **WSL**;Windows 原生 **必须全程用 Git Bash**(构建脚本含 `rm -rf`、`husky \|\| true` 等 POSIX 语法,cmd/PowerShell 会失败) | Git Bash 可用 |
| 磁盘 | 源码 + node_modules 约 1~2 GB | — |

### 3.2 初始化

```bash
cd /d/WMS/page-agent-main/page-agent-main
npm install        # 安装全 workspace 依赖(首次约 2~5 分钟)
```

> 源码为 GitHub zip 下载,无 `.git` 历史。**建议先 `git init` 并提交一次基线**,再开 `wms-custom` 分支做改动,否则后续无法 diff 上游、无法回滚:
>
> ```bash
> git init && git add -A && git commit -m "chore: upstream v1.12.2 baseline"
> git checkout -b wms-custom
> ```

### 3.3 冒烟验证

```bash
# 仓库根创建 .env(仅本地,勿提交)
cat > .env <<'EOF'
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=你的key
LLM_MODEL_NAME=deepseek-v4-flash
EOF

npm start          # 启动 website playground(Vite dev server)
```

浏览器打开 playground 页面,输入"点击 xxx"观察 Agent 跑通 ReAct 循环,即环境 OK。

---

## 4. 二开工作流(改动 → 验证 → 产物)

### 4.1 三种联调方式对比

| 方式 | 原理 | 适用 |
| --- | --- | --- |
| **① website playground** | `npm start` 跑官方演示站 | 改 core/llms 后的快速行为验证 |
| **② IIFE 书签注入(推荐联调 WMS)** | `npm run dev:demo` 在 `http://localhost:5174/page-agent.demo.js` 持续构建 IIFE;在**任意页面**(含本地 wms-vue3)用书签/控制台注入 | 不改动 wms-vue3 一行代码,即可在真实 WMS 页面上验证 Agent 行为 |
| **③ Vite alias 源码直连** | wms-vue3 的 vite alias 把 `page-agent` 指到源码 `src/*.ts` | 深度联调:改源码 → wms-vue3 热更新 |

### 4.2 方式②:IIFE 注入 WMS 页面(零侵入联调)

```bash
cd /d/WMS/page-agent-main/page-agent-main
npm run dev:demo   # 监听源码改动,持续输出 IIFE 到 :5174
```

在 wms-vue3 页面(`npm run dev` 起本地前端)的浏览器控制台执行:

```js
var s = document.createElement('script')
s.src = 'http://localhost:5174/page-agent.demo.js?lang=zh-CN&t=' + Math.random()
document.head.appendChild(s)
```

IIFE 入口 `packages/page-agent/src/demo.ts` 支持的 URL 参数:

| 参数 | 说明 |
| --- | --- |
| `autoInit=false` | 只挂 `window.PageAgent` 类,不自动实例化(之后手动 `new window.PageAgent({...})`) |
| `model` / `baseURL` / `apiKey` | 覆盖 LLM 配置(缺省走 `.env`,再缺省走官方免费测试代理) |
| `lang` | `zh-CN` / `en-US` |
| `showPanel=false` | 不自动展开面板 |

> ⚠️ **`.env` 中的 API Key 会被内联进 IIFE 产物**,该产物绝不外传、绝不部署到正式环境。
> 重复注入时 demo.ts 会自动 `dispose()` 旧实例,不会叠加。

### 4.3 方式③:wms-vue3 alias 直连源码(深度联调)

```ts
// wms-vue3/vite.config.ts 追加
import { resolve } from 'path'

const PA = resolve(__dirname, '../../page-agent-main/page-agent-main/packages')

export default defineConfig({
    // ...
    resolve: {
        alias: {
            'page-agent': resolve(PA, 'page-agent/src/PageAgent.ts'),
            '@page-agent/core': resolve(PA, 'core/src/PageAgentCore.ts'),
            '@page-agent/llms': resolve(PA, 'llms/src/index.ts'),
            '@page-agent/page-controller': resolve(PA, 'page-controller/src/PageController.ts'),
            '@page-agent/ui': resolve(PA, 'ui/src/index.ts'),
        },
    },
})
```

```bash
cd /d/WMS/Warehouse-Management/wms-vue3
npm i zod@^4 chalk     # alias 源码模式需在业务工程补齐这两个包
```

之后 `page-agent` 的引用全部指向本地源码,改 `page-agent-main` 任意文件,wms-vue3 dev server 热更新生效。**联调结束、出正式产物前,记得移除 alias 改回 §6 的正式接入方式。**

---

## 5. WMS 定制改造清单

### 5.1 [P0] 系统提示词中文化 + WMS 业务规则固化

**文件**:`packages/core/src/prompts/system_prompt.md`

现状:全英文、通用网页任务导向(browser-use 派生)。WMS 是中文后台,建议:

1. 保留 XML 标签骨架(`<browser_rules>` 等,主循环按这些标签组织),将说明性文字改为中文——**不要删标签,只改内容**;
2. 追加 WMS 业务段,示例:

```xml
<wms_domain_rules>
- 当前系统是 WMS 仓库管理系统,用户是仓库/销售/财务人员,全部使用中文回复。
- 金额字段:列表与表单中金额单位已是"元",不要自行换算。
- 状态枚举:客户状态 0=停用 1=正常;月结标识 0=现结 1=月结。
- 涉及"提交/删除/审核"类按钮前,必须先用 ask_user 向用户确认。
- 下拉框(el-select)不是原生 select:先点击输入框展开,再点击出现的选项。
</wms_domain_rules>
```

> 也可以在 `packages/core/src/PageAgentCore.ts` 的 `#getInstructions()`(约 490 行)里看到 `instructions.system` / `getPageInstructions(url)` 会被拼成 `<instructions><system_instructions>...<page_instructions>...` 注入——**页面级说明书用配置层 `[A即可]`,不要写死进源码**,源码里只放跨页面通用规则。

### 5.2 [P0] WMS 内置工具固化

**文件**:`packages/core/src/tools/index.ts`

工具是 `Map<string, PageAgentTool>` 结构,`tool()` 工厂 + zod v4 schema,`execute` 内 `this` 指向 `PageAgentCore` 实例。固化示例:

```ts
tools.set(
	'navigate_to',
	tool({
		description:
			'Navigate to a page inside the WMS SPA by vue-router path. Prefer this over clicking menus step by step.',
		inputSchema: z.object({
			path: z.string().describe('vue-router path, e.g. /customer/list'),
		}),
		execute: async function (this: PageAgentCore, input) {
			// SPA 内跳转:优先 history API,避免整页刷新丢掉 agent 上下文
			const url = new URL(input.path, location.origin)
			history.pushState({}, '', url)
			dispatchEvent(new PopStateEvent('popstate'))
			return `✅ Navigated to ${input.path}`
		},
	})
)
```

> ⚠️ 关键经验:**SPA 路由跳转不要用 `location.href = ...`**——整页刷新会销毁 PageAgent 实例,任务中断。用 `history.pushState` + `popstate` 事件(或注入 vue-router 实例)完成无刷新跳转。
>
> 建议固化工具清单:`navigate_to`(路由直达)、`select_ep_option`(el-select 专用,见 5.3)、`query_business_data`(直连后端 API 查数,减少 UI 步数)、`ask_confirm`(危险操作二次确认)。

### 5.3 [P0] Element Plus 适配

EP 组件与原生控件的差异是 WMS 场景成功率的最大变量,逐个处理:

| 组件 | 问题 | 方案 |
| --- | --- | --- |
| `el-select` | 非原生 `<select>`,内置 `select_dropdown_option` 工具不适用 | 方案一[A即可]:页面指令里写明"先点输入框展开再点选项";方案二(推荐):固化 `select_ep_option` 工具——点击触发器 → 等待 `.el-select-dropdown` 出现 → 按文本点击 `.el-select-dropdown__item` |
| `el-dialog` / `el-drawer` | 挂在 body 末尾,打开后 DOM 剧变,索引漂移 | 指令提示"弹窗打开后重新观察页面";必要时调大 `stepDelay` 至 0.6~0.8s |
| `el-cascader`(所在城市) | 多级联动 | 指令写明"先选省,等面板刷新后再选市" |
| `el-table` 行内按钮 | 同列按钮多,索引易混 | 任务描述带业务主键("对客户编号 C2026001 点编辑");或在 `packages/page-controller/src/dom/` 提取时把 `data-*` 主键属性加入 `includeAttributes` |
| `el-date-picker` | 输入+面板复合交互 | 优先直接 `input_text` 到输入框(EP 支持手输日期),避开面板点选 |

### 5.4 [P1] 面板品牌化 + 悬浮球形态改造

**文件**:`packages/ui/src/panel/Panel.ts` + `Panel.module.css`

- **现状**:底部居中固定条(`bottom:100px; left:50%`),无拖拽;文案走 `i18n/locales.ts`(已有 zh-CN)。
- **WMS 诉求**:不遮挡底部操作区、与系统主题(`--scanner-blue:#2f6fed`)一致、可拖拽收起为悬浮球。
- **改造点**:
  1. CSS 变量对齐 WMS 主题色(替换 Panel.module.css 中的主色);
  2. 增加拖拽:给 header 区加 `pointerdown/move/up` 监听,改 `wrapper.style.left/top`(源码当前无任何 drag 实现,需自研,约 50 行);
  3. 收起态:collapsed 时只渲染圆形 indicator(点击展开),DOM 结构与 `expand/collapse` 已有,改造成本低;
  4. z-index:EP 弹窗 z-index 2000+,面板需 > 3000 否则被 `el-dialog` 遮挡。
- **更激进的替代**:放弃内置 Panel,在 wms-vue3 中用 Vue 组件自绘 UI——`PageAgentCore` 是 `EventTarget`,订阅 `statuschange/historychange/activity` 三个事件 + 调用 `execute/stop` 即可完整复刻面板交互(`packages/ui` 就是纯消费这些接口写的,可照抄其逻辑换成 Vue 模板)。此方案 UI 自由度最大,推荐正式落地采用。

### 5.5 [P1] 安全护栏(配置层,[A即可],写在这里是为完整性)

```ts
new PageAgent({
    // 1) 手机号/身份证脱敏
    transformPageContent: async (c) =>
        c.replace(/1[3-9]\d{9}/g, '***********')
         .replace(/\b\d{17}[\dXx]\b/g, '******************'),
    // 2) 危险按钮感知层屏蔽(删除/批量操作区)
    interactiveBlacklist: [
        () => document.querySelector('.danger-zone'),
        () => document.querySelector('#btn-batch-delete'),
    ],
    // 3) LLM 走业务后端代理,Key 不下发
    baseURL: '/api/llm-proxy',
    customFetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
})
```

### 5.6 [P2] 默认配置微调(入口包)

**文件**:`packages/page-agent/src/PageAgent.ts`

- `enableMask: config.enableMask ?? true`:源码默认**开**遮罩(自动化期间锁页面)。WMS 人机协同场景建议默认关(`?? false`),让用户可随时接管。
- 可在此处固化 WMS 默认值:`language: 'zh-CN'`、`stepDelay: 0.6`。

---

## 6. 构建与接入 wms-vue3

### 6.1 构建产物

```bash
cd /d/WMS/page-agent-main/page-agent-main
npm run build:libs     # 仅构建 5 个库包(日常二开够用)
# npm run build        # 全量:库 + website + 扩展 zip(发版前完整验证用)
```

产物:各包 `dist/esm/*.js + .d.ts`(ESM,`external: chalk/zod/@page-agent/*`,不压缩,带 sourcemap);`packages/page-agent/dist/iife/page-agent.demo.js`(全量内联单文件)。

### 6.2 三种正式接入方式

| 方式 | 做法 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **① tarball(推荐起步)** | 各库包目录 `npm pack` → 得 `.tgz` → wms-vue3 `npm i ../path/xxx.tgz`(5 个包一起装) | 无基础设施;`publishConfig` 自动切 dist 导出 | 每次改动要重新 pack 安装 |
| **② 私有 registry** | 内网搭 Verdaccio,版本号改为 `1.12.2-wms.x` 后 `npm publish` | 最接近标准 npm 流程,CI 友好 | 要维护 registry |
| **③ git submodule + alias** | wms-vue3 仓库内嵌源码,Vite alias 直连(同 §4.3) | 改动即生效 | 构建链耦合,CI 需同步处理 |

**tarball 方式注意**:`page-agent` 的依赖是 `@page-agent/core: "1.12.2"` 等精确版本,若只装本地 tarball 的 `page-agent`,npm 会去公网 registry 拉**原版** core 而不是你的 fork。两个解法:

1. 5 个库包(`core/llms/page-controller/ui/page-agent`)**全部 pack 并在同一条 `npm i` 命令里安装**——npm 会以已安装的 file: 版本满足内部 semver;
2. 更稳妥:用 `node scripts/sync-version.js` 的思路把 5 个包版本统一改为 `1.12.2-wms.1`(内部依赖声明同步改),再 pack——彻底与公网包隔离,wms-vue3 锁版本也清晰。

```bash
# 示例:方式①
cd /d/WMS/page-agent-main/page-agent-main/packages/core && npm pack
cd ../llms && npm pack
cd ../page-controller && npm pack
cd ../ui && npm pack
cd ../page-agent && npm pack

cd /d/WMS/Warehouse-Management/wms-vue3
npm i zod@^4 \
  ../../page-agent-main/page-agent-main/packages/core/page-agent-core-1.12.2-wms.1.tgz \
  ../../page-agent-main/page-agent-main/packages/llms/page-agent-llms-1.12.2-wms.1.tgz \
  ../../page-agent-main/page-agent-main/packages/page-controller/page-agent-page-controller-1.12.2-wms.1.tgz \
  ../../page-agent-main/page-agent-main/packages/ui/page-agent-ui-1.12.2-wms.1.tgz \
  ../../page-agent-main/page-agent-main/packages/page-agent/page-agent-1.12.2-wms.1.tgz
```

### 6.3 wms-vue3 侧封装(与接入方式无关)

```ts
// src/utils/pageAgent.ts(单例 + 路由感知指令 + 业务工具)
import { PageAgent, tool } from 'page-agent'
import { z } from 'zod/v4'
import router from '@/router'

const PAGE_GUIDES: Record<string, string> = {
    '/customer/list': '客户列表页。状态枚举:0=停用 1=正常;月结标识:0=现结 1=月结。',
    '/customer/create': '新增客户页。必填:客户名称、联系人、电话;城市为省市级联,先省后市。',
}

let agent: PageAgent | null = null

export function getPageAgent(): PageAgent {
    if (!agent) {
        agent = new PageAgent({
            baseURL: '/api/llm-proxy',
            model: import.meta.env.VITE_PAGE_AGENT_MODEL || 'qwen3.5-plus',
            language: 'zh-CN',
            enableMask: false,
            customFetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
            instructions: {
                system: '你是 WMS 操作助手。只执行仓储业务操作;提交/删除前必须 ask_user 确认。',
                getPageInstructions: (url) => PAGE_GUIDES[new URL(url).pathname],
            },
            customTools: {
                navigate_to: tool({
                    description: '跳转到 WMS 系统内指定页面,优先于逐层点击菜单。',
                    inputSchema: z.object({ path: z.string() }),
                    execute: async (input) => {
                        await router.push(input.path)
                        return `✅ 已跳转到 ${input.path}`
                    },
                }),
            },
        })
        ;(window as any).pageAgent = agent
    }
    return agent
}
```

---

## 7. Fork 维护与上游同步策略

1. **分支模型**:`main` 只跟踪上游(纯镜像),`wms-custom` 承载全部二开改动;所有定制 commit 以 `feat(wms):` 前缀提交,便于 rebase 时识别。
2. **版本号规则**:产物版本 `上游版本-wms.N`(如 `1.12.2-wms.1`),CHANGELOG 中记录每个定制点对应的源码文件。
3. **升级流程**:上游发新版 → `main` 更新 → `git rebase main`(在 `wms-custom` 上)→ 重点回归 `core/src/tools`、`system_prompt.md`、`Panel.ts` 三个高频冲突区 → playground 冒烟 → 版本号 N+1 → 重新出产物。
4. **改动最小化纪律**:能用配置层(`customTools/instructions/transformPageContent`)实现的绝不改源码——每少一处源码改动,就少一处未来 rebase 冲突。
5. **上游 API 漂移预警**:`customTools`、生命周期钩子、`experimental*` 均标注 experimental,升级时先读上游 `docs/CHANGELOG.md`。

---

## 8. 验收清单(落地 DoD)

- [ ] `npm install` 成功,`npm start` playground 可用自有 LLM 跑通任务
- [ ] IIFE 注入 wms-vue3 客户列表页,完成"查询状态正常的客户"任务
- [ ] 新增客户页:Agent 完成名称/联系人/电话填写 + 城市级联选择 + ask_user 确认后提交
- [ ] el-select 场景成功率 ≥ 80%(连续 10 次)
- [ ] 手机号在 LLM 请求中已被脱敏(抓 `/api/llm-proxy` 请求体验证)
- [ ] 删除类按钮不出现在 DOM 脱水结果中(黑名单生效)
- [ ] 面板不被 el-dialog 遮挡,中文文案无缺失
- [ ] 构建产物 tarball 在 wms-vue3 干净安装、`npm run build` 通过、运行时无 chalk/zod 缺失报错
- [ ] fork 仓库基线 commit + `wms-custom` 分支建立,改动清单入 CHANGELOG

---

## 9. 风险与注意事项

| 风险 | 说明与对策 |
| --- | --- |
| IIFE Key 泄漏 | `.env` 的 Key 内联进 demo.js;该产物仅本机使用,不进 CI、不上服务器 |
| SPA 跳转丢上下文 | 内置工具若触发整页刷新会销毁 Agent;`navigate_to` 必须 pushState 无刷新跳转 |
| Token 成本 | 每步约 15k tokens,一个表单任务 5~15 步;必须后端代理做限流/审计,建议开 Prompt Caching |
| LLM 操作不可控 | `maxSteps`(默认 40)+ 黑名单 + ask_user 确认三重兜底;`experimentalScriptExecutionTool` 生产保持关闭 |
| Windows 构建 | 全程 Git Bash;`npm run cleanup` 等脚本在 cmd/PowerShell 下会失败 |
| zod peer | wms-vue3 未直接依赖 zod,自定义工具用 `zod/v4`,需显式 `npm i zod@^4` |
| 源码无拖拽 | "悬浮球拖动"需自研(§5.4),不要按旧文档假设它已存在 |

---

## 10. 参考

- 上游仓库:https://github.com/alibaba/page-agent · 文档站:https://alibaba.github.io/page-agent/
- 本仓库开发指南:`page-agent-main/docs/developer-guide.md`
- 使用层 API 文档(同目录):`Page_Agent_Search.md`
- 本地源码关键文件:
  - `packages/core/src/PageAgentCore.ts`(主循环,661 行)
  - `packages/core/src/tools/index.ts`(内置工具,202 行)
  - `packages/core/src/prompts/system_prompt.md`(系统提示词,152 行)
  - `packages/ui/src/panel/Panel.ts`(面板,697 行)
  - `packages/page-agent/src/demo.ts`(IIFE 入口/URL 参数)
