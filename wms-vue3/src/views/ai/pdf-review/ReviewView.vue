<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ReviewCard from './components/ReviewCard.vue';
import ExcelPreviewPanel from './components/ExcelPreviewPanel.vue';
import SupplementBindPanel from './components/SupplementBindPanel.vue';
import { IMAGE_TYPE_LABELS, typeLabel } from './imageTypes';
import { filterOptionValues, matchReviewItems } from './batchFilter';
import { batchProductIds } from './excelPreview';

// DESIGN_SPEC 5.4 审核页三栏布局
const props = defineProps({
  batches: { type: Array, default: () => [] },
  batchIndex: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
  decisions: { type: Object, default: () => ({}) },
  // 已保存的人工修订（{ [source_crop_id]: { description?, image_type? } }）：独立于决策计数
  edits: { type: Object, default: () => ({}) },
  activity: { type: Array, default: () => [] },
  canAbandon: { type: Boolean, default: false },
  // 审核超时倒计时（秒）：>0 时展示；归零前未提交则未决项自动通过并提交。
  // （2026-10-27 起自动审核入口已下线，本倒计时仅剩 Coze 回滚链路的等待窗口兜底，
  //  agent 引擎 eventId 为空不会起算，正常流程不展示）
  autoCountdown: { type: Number, default: 0 },
  // 是否开放「人工新增卡片」：仅走插件 REST 直提通道时可用
  // （pdf_agent 引擎 / 恢复会话）。Coze 直播 SSE 通道的 resume 载荷不含
  // pdf_page_number，人工卡片会被网关/工作流剥离，故隐藏入口。
  canAddCard: { type: Boolean, default: false },
  // Excel 文字预览：未提交的产品文字编辑数（徽标 + 统计面板）
  productEditCount: { type: Number, default: 0 },
  // 产品级文字编辑态（{ [pcid]: ProductEditState }）：Excel 文字预览面板回显用
  productEdits: { type: Object, default: () => ({}) },
  // Excel 文字预览数据（index.vue 拉取）：{ headers, rows, products } 与加载态
  xlsxPreview: { type: Object, default: null },
  xlsxLoading: { type: Boolean, default: false },
  xlsxError: { type: String, default: '' },
  // 导出前置校验 { issues, stats }
  xlsxValidation: { type: Object, default: null },
  // 绑定裁剪图：未发布图回落的审核预览图基址（转发给预览面板）
  cropAssetBase: { type: String, default: '' },
  // 嵌入模式（WMS 主布局内）：面板放大遮罩降级为 absolute
  embedded: { type: Boolean, default: false },
  // 疑似截断风险 { [source_crop_id]: {side: ratio} | null }（后端对预渲染
  // 预览图的四边贴边检测；null=预览缺失不展示）
  truncationRisks: { type: Object, default: () => ({}) },
  // 流式审核状态条（方案 B）：{ streaming, w1Done, w1Total, arrived, ready, pipelineDone, error }
  // arrived=审核单已到货张数（单调，用作增量到货水位）；ready=剩余待审张数（提交后变小）
  // streaming/error 任一为真时展示；error 时提供「重新识别 / 强制收尾」双入口
  pipelineStatus: { type: Object, default: null },
  // 调试入口：识别进行中可中断解析（仅 pdf_agent 引擎；Coze 直播链路没有停止接口）
  canInterrupt: { type: Boolean, default: false },
  // 中断请求在途：按钮转「中断中…」并禁用
  interrupting: { type: Boolean, default: false },
  // ── 补充说明任务（task_type=supplement，仅 agent 引擎）──
  // 绑定面板开关 + 审核快照产品列表 + 匹配候选与加载态（数据在 index.vue）
  supplementEnabled: { type: Boolean, default: false },
  supplementProducts: { type: Array, default: () => [] },
  supplementMatches: { type: Array, default: () => [] },
  supplementLoading: { type: Boolean, default: false },
  supplementHint: { type: String, default: '' },
  supplementSaved: { type: Boolean, default: false },
  // 上传的 PDF 文件名（审核页标题下展示；空则不显示该行）
  pdfName: { type: String, default: '' }
});
const emit = defineEmits(['select-batch', 'decide', 'decide-many', 'approve-all', 'submit', 'abandon', 'save-edit', 'editing-change', 'add-card', 'remove-card', 'reedit-card', 'open-xlsx-preview', 'product-edit', 'product-edit-reset', 'force-finalize', 'restart-recognition', 'interrupt-recognition', 'supplement-refresh', 'supplement-search', 'supplement-save']);

const all = computed(() => props.batches.flatMap(b => b.items));
const decidedCount = computed(() => all.value.filter(x => props.decisions[x.source_crop_id]).length);
const progress = computed(() => all.value.length ? Math.round(decidedCount.value / all.value.length * 100) : 0);

const currentDecided = computed(() => props.items.filter(x => props.decisions[x.source_crop_id]).length);
const recropCount = computed(() => currentDecided.value
  ? props.items.filter(x => props.decisions[x.source_crop_id]?.action === 'recrop').length : 0);
// 本批已修订描述/类型的图片数：与「已做决定」分开计数——修订不构成决策（仍需通过/拒绝/跳过）
const editCount = computed(() => props.items.filter(x => props.edits[x.source_crop_id]).length);
const remaining = computed(() => Math.max(0, props.items.length - currentDecided.value));
const ready = computed(() => props.items.length > 0 && currentDecided.value === props.items.length);
// 未决项数：驱动「全部通过（N）」的计数与禁用态，避免一键覆盖已有决策后用户毫不知情
const unddecidedCount = computed(() => props.items.filter(x => !props.decisions[x.source_crop_id]).length);
// 各决策动作的分布，用于在统计面板明示「已有决策」构成（approve-all 只补未决）
const actionBreakdown = computed(() => {
  const count = { approve: 0, reject: 0, skip: 0, recrop: 0 };
  for (const x of props.items) {
    const a = props.decisions[x.source_crop_id]?.action;
    if (a && a in count) count[a] += 1;
  }
  return count;
});

function decide(item, action) { emit('decide', item, action); }
function saveEdit(item, patch) { emit('save-edit', item, patch); }
// 编辑态变化向上透传（(cropId, editing)）：父级汇总用于「提交前拦截未保存草稿」
function onEditingChange(cropId, editing) { emit('editing-change', cropId, editing); }
function removeCard(item) { emit('remove-card', item); }
function reeditCard(item) { emit('reedit-card', item); }

// ── 中栏视图切换：图片审核 ⇄ Excel 文字预览（2026-10-27 起去弹窗，
//    点击「Excel 文字预览」整个中栏主操作区切换为文字预览编辑面板）──
const excelOpen = ref(false);
// 左侧批次列表滚动容器：切批次时把当前项滚进视野（批次多时不丢位置）
const batchListEl = ref(null);
// 「本批次产品」范围（面板批次口径）：与 index.vue 的 xlsxPreviewBatchIds 同源
const excelBatchIds = computed(() => batchProductIds(props.items));
function toggleExcelView() {
  excelOpen.value = !excelOpen.value;
  if (excelOpen.value) {
    filterOpen.value = false;   // 视图互斥：切换时收起筛选面板
    moreOpen.value = false;
    emit('open-xlsx-preview');  // 父组件拉取/刷新预览数据
  }
}

// ── 右侧统计栏可折叠（2026-10-27）：Excel 文字预览视图自动收起给预览让宽，
//    两个视图下都可手动展开/收起（收起后留一个窄条按钮）──
const inspectorOpen = ref(true);
watch(excelOpen, (open) => { if (open) inspectorOpen.value = false; });
watch(() => props.batchIndex, () => {
  batchListEl.value?.querySelector('.batch.active')
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// ── 危险操作收纳（P0-02）：「放弃此任务」收进「更多」下拉，
//    与常规操作拉开距离 + 两步触达，避免审核高强度操作下误点 ──
const moreOpen = ref(false);
function onDocClick() { moreOpen.value = false; }
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

// ── 条件批量决策（当前批：类型/产品/关键词筛选，只补未决） ──────
const filterOpen = ref(false);
const batchFilter = ref({ image_type: '', product_name: '', keyword: '' });
const filterOptions = computed(() => filterOptionValues(props.items, props.edits));
const filterMatches = computed(() =>
  matchReviewItems(props.items, batchFilter.value, props.decisions, props.edits));
function applyFilter(action) {
  if (!filterMatches.value.length) return;
  emit('decide-many', filterMatches.value, action);
}
const truncationCount = computed(() =>
  props.items.filter((x) => props.truncationRisks[x.source_crop_id]
    && Object.keys(props.truncationRisks[x.source_crop_id]).length).length);
</script>

<template>
  <section class="review-layout fade-in" :class="{ 'no-inspector': !inspectorOpen }">
    <!-- 左侧：批次列表 + 进度 -->
    <aside class="side-panel">
      <h2>审核进度</h2>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div :id="'progressText'" class="progress-text">{{ decidedCount }} / {{ all.length }}</div>
      <div ref="batchListEl" class="batch-list">
        <button v-for="(b, i) in props.batches" :key="i" type="button"
                class="batch" :class="{ active: i === props.batchIndex }"
                @click="emit('select-batch', i)">
          <strong>批次 {{ i + 1 }}</strong>
          <span>{{ b.items.length }} 张图片</span>
        </button>
      </div>
    </aside>

    <!-- 中间：审核网格 -->
    <section class="main-column">
      <!-- 补充说明任务（task_type=supplement）：目标产品行绑定面板（识别产品 ↔
           知识库已有行）。绑定保存后，发布完成即可在结果页一键合并回写。 -->
      <SupplementBindPanel v-if="props.supplementEnabled"
        :products="props.supplementProducts" :matches="props.supplementMatches"
        :loading="props.supplementLoading" :hint="props.supplementHint"
        :saved="props.supplementSaved"
        @refresh="emit('supplement-refresh')" @search="emit('supplement-search', $event)"
        @save="emit('supplement-save', $event)" />

      <!-- 流式审核状态条（方案 B）：识别进行中/中断的常驻提示与双入口 -->
      <div v-if="props.pipelineStatus && (props.pipelineStatus.streaming || props.pipelineStatus.error)"
           class="pipeline-bar" :class="{ error: !!props.pipelineStatus.error }">
        <template v-if="props.pipelineStatus.error">
          <span class="pipeline-text">识别中断：{{ props.pipelineStatus.error }}</span>
          <span class="pipeline-actions">
            <button class="btn btn-secondary" type="button"
                    title="从识别中断处继续重跑（已完成页/批次与已审内容保留）"
                    @click="emit('restart-recognition')">重新识别</button>
            <button class="btn btn-danger" type="button"
                    title="未决项自动通过并进入发布；之后到达的识别结果不会并入本任务"
                    @click="emit('force-finalize')">按已就绪内容强制收尾</button>
          </span>
        </template>
        <template v-else>
          <span class="pipeline-text">
            识别进行中 {{ props.pipelineStatus.w1Done }}/{{ props.pipelineStatus.w1Total }} 页
            · 已到货 {{ props.pipelineStatus.arrived }} 张 · 待审 {{ props.pipelineStatus.ready }} 张
            —— 可先审核已到货批次，剩余批次到达后自动加入
          </span>
          <span v-if="props.canInterrupt" class="pipeline-actions">
            <button class="btn btn-danger" type="button"
                    :disabled="props.interrupting"
                    title="协作式中断：在飞的模型调用收尾后停止，已完成页面/批次与已审内容保留，可再「重新识别」续跑"
                    @click="emit('interrupt-recognition')">
              {{ props.interrupting ? '中断中…' : '中断解析' }}
            </button>
          </span>
        </template>
      </div>

      <div class="review-head">
        <div>
          <h1>{{ excelOpen ? 'Excel 文字预览' : '候选图片审核' }}</h1>
          <!-- 上传的 PDF 文件名（标题下方）：长名省略号截断，悬停看全名 -->
          <p v-if="props.pdfName" class="review-doc-name" :title="props.pdfName">
            <i class="doc-badge" aria-hidden="true">PDF</i><span class="doc-name-text">{{ props.pdfName }}</span>
          </p>
          <p v-if="!excelOpen">批次 {{ props.batchIndex + 1 }} · {{ props.items.length }} 张图片</p>
          <p v-else>行文本与导出同源（所见即所写），可直接编辑；修改随本批提交生效<template v-if="props.productEditCount">，当前 {{ props.productEditCount }} 处未提交</template></p>
        </div>
        <!-- Excel 文字预览视图：仅保留返回入口 + 修改计数，图片审核操作全部退场 -->
        <div v-if="excelOpen" class="head-actions">
          <span v-if="props.productEditCount" class="edit-count-chip"
                title="有未提交的产品文字修改，返回图片审核提交本批后生效">
            {{ props.productEditCount }} 处修改未提交
          </span>
          <button class="btn btn-secondary" type="button" @click="toggleExcelView">← 返回图片审核</button>
        </div>
        <!-- 图片审核视图：工具组 | 主操作 | 危险收纳（P0-02 分组） -->
        <div v-else class="head-actions">
          <!-- 工具组：视图切换与批量辅助（次级样式） -->
          <button class="btn btn-secondary btn-tool" type="button"
                  title="切换到 Excel 文字预览：预览本批产品将写入 Excel 的文字，可直接编辑名称/系列/特点/安装说明/注意事项；编辑随本批提交"
                  @click="toggleExcelView">
            Excel 文字预览<template v-if="props.productEditCount">（{{ props.productEditCount }}）</template>
          </button>
          <button class="btn btn-secondary btn-tool" type="button" :class="{ active: filterOpen }"
                  title="按图片类型 / 所属产品 / 描述关键词筛选本批未决图片，一键批量通过或拒绝"
                  @click="filterOpen = !filterOpen">筛选批量</button>
          <button v-if="props.canAddCard" class="btn btn-secondary btn-tool" type="button"
                  title="人工新增一张审核卡片：选择页码后在原图上框选区域，自写图片描述并绑定产品"
                  @click="emit('add-card')">+ 新增卡片</button>
          <span class="action-divider" aria-hidden="true"></span>
          <!-- 审核超时倒计时：仅 Coze 回滚链路会起算（agent 引擎不展示），
               归零即未决项自动通过并提交 -->
          <span v-if="props.autoCountdown > 0" class="countdown-chip"
                :class="{ urgent: props.autoCountdown <= 10 }"
                :title="`工作流等待人工审核有时限，${props.autoCountdown} 秒后仍未提交将自动通过并提交本批`">
            {{ props.autoCountdown }}s 后自动审核
          </span>
          <!-- 主操作：只补未决项，已有决策保留。无未决项时禁用并说明原因 -->
          <button class="btn btn-secondary btn-main" type="button" :disabled="!unddecidedCount"
                  :title="unddecidedCount
                    ? `将 ${unddecidedCount} 张未决图片标记为通过，已做的通过/拒绝/编辑决策保持不变`
                    : '本批图片均已完成决策'"
                  @click="emit('approve-all')">
            {{ unddecidedCount ? `全部通过（${unddecidedCount}）` : '已全部决策' }}
          </button>
          <!-- 危险收纳：「放弃此任务」两步触达（展开 + 确认弹窗），不再与常规操作同排 -->
          <div v-if="props.canAbandon" class="more-menu">
            <button class="btn btn-ghost more-toggle" type="button" title="更多操作"
                    aria-haspopup="menu" :aria-expanded="moreOpen"
                    @click.stop="moreOpen = !moreOpen">⋯</button>
            <div v-if="moreOpen" class="more-pop" role="menu" @click.stop>
              <button class="more-item danger" type="button" role="menuitem"
                      title="删除后端任务快照，任务内已审内容将不可恢复"
                      @click="moreOpen = false; emit('abandon')">放弃此任务…</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Excel 文字预览视图：中栏整块切换（去弹窗），侧栏进度与统计保留 -->
      <section v-if="excelOpen" class="excel-panel fade-in">
        <ExcelPreviewPanel
          mode="review"
          :loading="props.xlsxLoading" :error="props.xlsxError"
          :preview="props.xlsxPreview" :validation="props.xlsxValidation"
          :batch-ids="excelBatchIds" :product-edits="props.productEdits"
          :asset-base="props.cropAssetBase" :embedded="props.embedded"
          @refresh="emit('open-xlsx-preview')"
          @edit="(pcid, field, value) => emit('product-edit', pcid, field, value)"
          @reset-edit="(pcid) => emit('product-edit-reset', pcid)" />
      </section>

      <template v-else>

      <!-- 筛选批量面板：类型/产品/关键词 → 命中未决项 → 批量通过/拒绝 -->
      <div v-if="filterOpen" class="filter-panel">
        <select v-model="batchFilter.image_type" class="filter-field" aria-label="图片类型">
          <option value="">全部类型</option>
          <option v-for="t in filterOptions.imageTypes" :key="t" :value="t">{{ typeLabel(t) }}</option>
        </select>
        <select v-model="batchFilter.product_name" class="filter-field" aria-label="所属产品">
          <option value="">全部产品</option>
          <option v-for="n in filterOptions.productNames" :key="n" :value="n">{{ n }}</option>
        </select>
        <input v-model="batchFilter.keyword" class="filter-field filter-keyword" type="text"
               maxlength="40" placeholder="描述/产品名关键词" aria-label="关键词">
        <span class="filter-count">命中 {{ filterMatches.length }} 张未决</span>
        <button class="btn btn-secondary" type="button" :disabled="!filterMatches.length"
                title="将命中的未决图片全部标记为通过（已有决策不受影响）"
                @click="applyFilter('approve')">通过（{{ filterMatches.length }}）</button>
        <button class="btn btn-danger" type="button" :disabled="!filterMatches.length"
                title="将命中的未决图片全部标记为拒绝（已有决策不受影响）"
                @click="applyFilter('reject')">拒绝（{{ filterMatches.length }}）</button>
      </div>

      <div v-if="!props.items.length" class="empty-state">暂无待审图片</div>
      <div v-else class="review-grid">
        <ReviewCard v-for="(item, i) in props.items" :key="item.source_crop_id"
                    :item="item" :index="i"
                    :decision="props.decisions[item.source_crop_id] || null"
                    :edit="props.edits[item.source_crop_id] || null"
                    :truncation-risk="props.truncationRisks[item.source_crop_id] ?? null"
                    @decide="decide(item, $event)"
                    @save-edit="saveEdit(item, $event)"
                    @remove="removeCard(item)"
                    @reedit="reeditCard(item)"
                    @editing-change="onEditingChange" />
      </div>

      <div class="review-footer">
        <button class="btn btn-primary" type="button" :disabled="!ready"
                @click="emit('submit')">提交当前批次</button>
      </div>
      </template>
    </section>

    <!-- 右侧：统计面板 + 操作记录（可折叠：Excel 文字预览视图自动收起给预览让宽） -->
    <aside class="side-panel inspector" :class="{ collapsed: !inspectorOpen }">
      <button class="inspector-toggle" type="button"
              :title="inspectorOpen ? '收起统计面板' : '展开统计面板'"
              :aria-expanded="inspectorOpen"
              @click="inspectorOpen = !inspectorOpen">{{ inspectorOpen ? '»' : '«' }}</button>
      <template v-if="inspectorOpen">
      <section>
        <h2>当前批次</h2>
        <div class="metric"><span>图片数量</span><strong>{{ props.items.length }}</strong></div>
        <div class="metric"><span>已做决定</span><strong>{{ currentDecided }}</strong></div>
        <div class="metric"><span>重新裁剪</span><strong>{{ recropCount }}</strong></div>
        <!-- 修订只改描述/类型、不计入「已做决定」：单独一行避免与决策计数混淆 -->
        <div v-if="editCount" class="metric"><span>描述修订</span><strong>{{ editCount }}</strong></div>
        <!-- 疑似截断（四边贴边检测）：提示本批需要重裁的卡片数 -->
        <div v-if="truncationCount" class="metric"><span>疑似截断</span><strong>{{ truncationCount }}</strong></div>
        <!-- Excel 文字编辑（产品级，独立于图片决策计数） -->
        <div v-if="props.productEditCount" class="metric"><span>Excel 文字编辑</span><strong>{{ props.productEditCount }}</strong></div>
        <div class="metric"><span>剩余待审</span><strong>{{ remaining }}</strong></div>
        <!-- 决策构成：让「已做决策」可见，配合「全部通过只补未决」的语义 -->
        <div v-if="currentDecided" class="decision-breakdown">
          <span class="bd-item bd-approve">通过 {{ actionBreakdown.approve }}</span>
          <span class="bd-item bd-reject">拒绝 {{ actionBreakdown.reject }}</span>
          <span class="bd-item bd-skip">跳过 {{ actionBreakdown.skip }}</span>
          <span class="bd-item bd-recrop">编辑 {{ actionBreakdown.recrop }}</span>
        </div>
      </section>
      <section>
        <h2 class="activity-title">操作记录</h2>
        <div class="activity">
          <div v-for="(a, i) in props.activity" :key="i" class="activity-item">
            <b>{{ a.title }}</b>
            <span v-if="a.detail">{{ a.detail }}</span>
          </div>
          <p v-if="!props.activity.length" class="activity-empty">暂无记录</p>
        </div>
      </section>
      </template>
    </aside>
  </section>
</template>

<style scoped>
.review-layout {
  display: grid;
  /* 侧栏不再写死 240/280px：嵌在 WMS 内还要再减侧边栏与 padding，
     固定值在 1280 屏会把中列压到 ~460px。用 clamp 随容器比例伸缩。 */
  grid-template-columns: clamp(180px, 17%, 240px) minmax(0, 1fr) clamp(200px, 19%, 280px);
  gap: var(--space-4);
  align-items: start;
}
.side-panel {
  /* 跟随滚动窗口（2026-10-27）：页面上下滚动时侧栏吸附在视口内始终可见。
     偏移量由 index.vue 的 --review-sticky-top 提供（全屏避开吸顶 Topbar，嵌入贴顶） */
  position: sticky;
  top: var(--review-sticky-top, 80px);
  padding: var(--space-5);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
}
/* 右侧统计栏可折叠：展开时切换按钮停在右上角；收起后整栏缩为窄条 */
.inspector { position: relative; }
.inspector-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}
.inspector-toggle:hover { color: var(--accent-600); border-color: var(--border-focus); }
/* 收起态：第三列缩为窄条，仅留展开按钮（透明容器，不占视觉重量） */
.review-layout.no-inspector { grid-template-columns: clamp(180px, 17%, 240px) minmax(0, 1fr) 26px; }
.review-layout.no-inspector .inspector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 2px;
  border: none;
  background: transparent;
  box-shadow: none;
}
.review-layout.no-inspector .inspector .inspector-toggle { position: static; }
.side-panel h2 { margin: 0 0 var(--space-4); font-size: 14px; font-weight: 600; color: var(--text-primary); }
.progress-track { height: 6px; border-radius: 3px; background: var(--bg-subtle); overflow: hidden; }
.progress-fill {
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, var(--accent-600), var(--accent-500));
  border-radius: 3px;
  transition: width var(--duration-normal) var(--ease-out);
}
.progress-text { margin-top: 8px; color: var(--text-tertiary); font-size: 12px; font-weight: 500; }
.batch-list {
  display: grid;
  gap: 6px;
  margin-top: var(--space-4);
  /* 上下滑动窗口（2026-10-27）：批次多时列表内部滚动，侧栏高度封顶不再撑长整页。
     上限跟随视口（顶栏+步骤条+进度头约 430px），最少 200px、最多 560px */
  max-height: clamp(200px, calc(100vh - 430px), 560px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  padding-right: 4px;
}
.batch {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
  transition: all var(--duration-fast);
}
.batch:hover { background: var(--bg-hover); }
.batch.active { border-color: var(--border-focus); background: var(--accent-50); }
.batch strong { display: block; font-size: 13px; color: var(--text-primary); }
.batch span { display: block; margin-top: 2px; font-size: 12px; color: var(--text-tertiary); }

.main-column { min-width: 0; }
.review-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.review-head h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
.review-head p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 13px; }
/* 上传的 PDF 文件名（标题下）：PDF 徽标 + 名称，长名单行省略 */
.review-doc-name {
  display: flex; align-items: center; gap: 6px;
  margin: 6px 0 0 !important; min-width: 0; max-width: 560px;
  color: var(--text-secondary) !important; font-size: 13px; font-weight: 500;
}
.review-doc-name .doc-name-text {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.review-doc-name .doc-badge {
  flex: none; font-style: normal; font-size: 10px; font-weight: 700; line-height: 1;
  padding: 3px 6px; border-radius: 4px;
  color: var(--text-inverse); background: var(--accent-600);
}
.head-actions { display: flex; align-items: center; gap: var(--space-3); }
/* 工具组按钮弱化一档（去边框），与主操作（全部通过）拉开层级 */
.head-actions .btn-tool {
  border-color: transparent;
  color: var(--text-secondary);
}
.head-actions .btn-tool:hover:not(:disabled) {
  border-color: var(--border-default);
  color: var(--accent-600);
}
.head-actions .btn-tool.active {
  border-color: var(--border-focus);
  background: var(--accent-50, var(--bg-subtle));
  color: var(--accent-600);
}
/* 主操作按钮：实底浅红，视觉强于工具组但弱于底部提交（一屏一红原则） */
.head-actions .btn-main {
  background: var(--bg-active, var(--bg-subtle));
  border-color: var(--accent-600);
  color: var(--accent-600);
  font-weight: 600;
}
.head-actions .btn-main:hover:not(:disabled) {
  background: var(--accent-50, var(--bg-subtle));
}
/* 分组分隔线：工具组 | 主操作/危险 */
.action-divider {
  width: 1px;
  height: 20px;
  background: var(--border-default);
  flex: none;
}
/* 危险收纳（更多菜单）：轻量自绘下拉，点击外部收起 */
.more-menu { position: relative; flex: none; }
.more-toggle { width: 32px; padding: 0; font-size: 16px; line-height: 1; }
.more-pop {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-elevated, var(--bg-panel));
  box-shadow: var(--shadow-lg);
}
.more-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  text-align: left;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.more-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.more-item.danger { color: var(--danger-600); }
.more-item.danger:hover { background: var(--danger-50, var(--bg-subtle)); color: var(--danger-600); }
/* Excel 预览视图：中栏整块切换的承载容器（与侧栏卡片同风格） */
.excel-panel {
  padding: var(--space-5);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
  animation: fadeIn 250ms var(--ease-out);
}
/* Excel 视图头部的未提交计数徽标 */
.edit-count-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--warn-600);
  background: var(--warn-50);
  white-space: nowrap;
}
.countdown-chip {
  padding: 4px 10px;
  border-radius: var(--radius-full, 999px);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
  white-space: nowrap;
}
/* 倒计时告急：走主题语义色，不再写死浅粉底 + 深红字（深色主题下会变成刺眼亮块） */
.countdown-chip.urgent {
  color: var(--danger-600);
  background: var(--danger-50);
}
/* 卡片网格按可用宽度自动降列，而不是固定 3 列 + 视口断点：
   中列被压窄时先降列，卡片尺寸保持可读，不会把 4 个决策按钮挤到换行。 */
.review-grid {
  display: grid;
  /* 卡片放大（2026-10-27）：最小列 220→300px，卡片与内部字号等比放大更易读 */
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-3);
}
.empty-state {
  grid-column: 1 / -1;
  padding: 48px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  text-align: center;
  color: var(--text-tertiary);
  background: var(--bg-subtle);
}
.review-footer { display: flex; justify-content: flex-end; margin-top: var(--space-6); }

/* 流式审核状态条（方案 B）：识别进行中常驻提示 / 中断时的双入口 */
.pipeline-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding: 10px 14px;
  border: 1px solid var(--info-600, var(--accent-600));
  border-radius: var(--radius-md);
  background: var(--info-50, var(--accent-50));
}
.pipeline-bar.error {
  border-color: var(--danger-600);
  background: var(--danger-50);
}
.pipeline-text { font-size: 13px; color: var(--text-secondary); }
.pipeline-bar.error .pipeline-text { color: var(--danger-600); font-weight: 600; }
.pipeline-actions { display: flex; gap: var(--space-3); }

/* 筛选批量面板：批头下方一行内联筛选器 + 批量动作按钮 */
.filter-panel {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding: 10px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
}
.filter-field {
  padding: 5px 8px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 12px;
  max-width: 200px;
}
.filter-keyword { min-width: 160px; }
.filter-count { font-size: 12px; color: var(--text-tertiary); white-space: nowrap; }

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--divider);
  font-size: 13px;
}
.metric:last-child { border-bottom: none; }
.metric span { color: var(--text-tertiary); }
.metric strong { color: var(--text-primary); font-size: 17px; font-weight: 700; }
/* 决策构成标签：与卡片色条、动作按钮同一套语义色 */
.decision-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px dashed var(--divider);
}
.bd-item {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.bd-approve { color: var(--success-600); background: var(--success-50); }
.bd-reject  { color: var(--danger-600);  background: var(--danger-50); }
.bd-skip    { color: var(--warn-600);    background: var(--warn-50); }
.bd-recrop  { color: var(--info-600);    background: var(--info-50); }
.activity-title { margin-top: var(--space-6) !important; }
.activity { max-height: 220px; overflow: auto; margin-top: var(--space-3); }
.activity-item { padding: 8px 0; border-bottom: 1px solid var(--divider); font-size: 12px; color: var(--text-tertiary); }
.activity-item:last-child { border-bottom: none; }
.activity-item b { display: block; color: var(--text-primary); font-weight: 600; }
.activity-empty { margin: 8px 0 0; color: var(--text-tertiary); font-size: 12px; }

@media (max-width: 1080px) {
  /* 断点阈值按「视口 - WMS 侧栏(~220px) - padding」重估：
     原 1080px 判的是视口，1280 屏不降级导致中列被压。 */
  .review-layout { grid-template-columns: clamp(160px, 22%, 200px) minmax(0, 1fr); }
  .inspector { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  /* 收起态在窄断点下不再占第三列：保持两列网格，收起后缩为一条横条 */
  .review-layout.no-inspector { grid-template-columns: clamp(160px, 22%, 200px) minmax(0, 1fr); }
  .review-layout.no-inspector .inspector { display: flex; flex-direction: row; justify-content: flex-start; padding: 6px 10px; }
  .review-layout.no-inspector .inspector .inspector-toggle { position: static; }
}
@media (max-width: 680px) {
  .review-layout { display: block; }
  .side-panel { margin-bottom: var(--space-4); }
  .batch-list { display: flex; overflow-x: auto; gap: 8px; }
  .batch { min-width: 120px; }
  .review-head { flex-direction: column; align-items: flex-start; }
  .inspector { display: block; }
}
</style>
