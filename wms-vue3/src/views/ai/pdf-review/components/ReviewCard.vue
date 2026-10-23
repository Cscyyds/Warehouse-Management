<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { IMAGE_TYPE_LABELS, typeLabel } from '../imageTypes';

// DESIGN_SPEC 6.9 审核卡片：顶部色条、4 决策按钮、键盘导航
const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, default: 0 },
  decision: { type: Object, default: null },
  // 已保存的人工修订（{ description?, image_type? }）：与决策分离——
  // 只改描述/类型不构成「已决策」（该项仍需通过/拒绝/跳过），提交出口统一合并
  edit: { type: Object, default: null }
});
const emit = defineEmits(['decide', 'save-edit', 'editing-change', 'remove', 'reedit']);

const root = ref(null);
const ACTIONS = [
  { key: 'approve', label: '通过', labelClass: 'approve' },
  { key: 'reject', label: '拒绝', labelClass: 'reject' },
  { key: 'skip', label: '跳过', labelClass: 'skip' },
  { key: 'recrop', label: '编辑', labelClass: 'recrop' }
];
// 「编辑」按钮实为重裁（改裁剪框），与描述修订区分：悬停提示写清各自改什么
const ACTION_TITLES = {
  approve: '保留此图片', reject: '丢弃此图片', skip: '暂不处理',
  recrop: '重新框选裁剪区域（改裁剪框，不改描述）'
};

// 人工新增卡片（manual_ 前缀，提交前只存在于前端）：未入后端快照，
// 通过/拒绝/跳过/重裁均无意义——只提供「移除」；描述/类型仍走既有修订入口
const isManual = computed(() => !!props.item.manual);

// 显示值：人工修订优先于 AI 原始值（description 修订可为空串 = 主动清空描述，
// 因此用 !== undefined 判断而非真值判断，避免清空后回退成原文）
const displayDesc = computed(() => {
  const e = props.edit;
  return (e && e.description !== undefined) ? e.description : (props.item.description || '');
});
const displayType = computed(() => {
  const e = props.edit;
  return (e && e.image_type !== undefined) ? e.image_type : (props.item.image_type || 'other');
});
const isEdited = computed(() => !!props.edit
  && (props.edit.description !== undefined || props.edit.image_type !== undefined));

// 编辑态：本地草稿；保存后由父组件落 edits 并按「是否与 AI 原始值相同」过滤
const editing = ref(false);
const descDraft = ref('');
const typeDraft = ref('other');
const customDraft = ref('');
const descBox = ref(null);
// 「其他」= 自定义类型入口：选中后展开输入框；留空提交时按「其他」处理（保持旧语义）
const isCustom = computed(() => typeDraft.value === 'other');
function startEdit() {
  descDraft.value = displayDesc.value;
  const t = displayType.value;
  // 值不在枚举内 = 自定义文本（历史或已保存）：回显「其他」并把原文本带进输入框
  if (t && !(t in IMAGE_TYPE_LABELS)) {
    typeDraft.value = 'other';
    customDraft.value = t;
  } else {
    typeDraft.value = t;
    customDraft.value = '';
  }
  editing.value = true;
  nextTick(() => descBox.value?.focus());
}
function commitEdit() {
  const finalType = isCustom.value ? (customDraft.value.trim() || 'other') : typeDraft.value;
  emit('save-edit', { description: descDraft.value, image_type: finalType });
  editing.value = false;
}
function cancelEdit() { editing.value = false; }

// 编辑态上报：父级汇总「哪些图正在编辑」，用户主动提交前拦截，防止未保存草稿被静默丢弃。
// 卸载兜底清账（批次切换/任务重载时卡片销毁，避免残留「正在编辑」标记）。
watch(editing, v => emit('editing-change', props.item.source_crop_id, v));
onBeforeUnmount(() => {
  if (editing.value) emit('editing-change', props.item.source_crop_id, false);
});

// 决策按钮点击：编辑态未保存的草稿先落库——「改完文本直接点通过/拒绝」是主流程，
// 不能让编辑框里的内容被静默丢弃（保存后编辑态收起，所见即所提交）
function onAction(key) {
  if (editing.value) commitEdit();
  emit('decide', key);
}

function isActive(action) {
  return props.decision?.action === action;
}

function buttons() {
  return root.value?.querySelectorAll?.('[data-card-action]') || [];
}

function onKeydown(e) {
  const btns = buttons();
  if (!btns.length) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const i = Array.from(btns).indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? btns[(i + 1) % btns.length] : btns[(i - 1 + btns.length) % btns.length];
    next.focus();
  }
}
</script>

<template>
  <article ref="root" class="review-card"
           :data-decision="decision?.action || ''"
           @keydown="onKeydown">
    <div class="card-preview">
      <img v-if="props.item.preview_url" :src="props.item.preview_url" alt="preview" loading="lazy">
      <div v-else class="card-preview empty">无预览</div>
      <span class="preview-label">图片 {{ props.index + 1 }}</span>
    </div>
    <div class="card-body">
      <div class="card-title">{{ props.item.product_name || '候选产品' }}</div>
      <div class="card-meta">
        <span>{{ typeLabel(displayType) }}</span>
        <!-- 人工新增卡片标记：与 AI 裁剪候选区分 -->
        <span v-if="isManual" class="manual-chip" title="人工新增，提交时随后端快照落库">人工新增</span>
        <!-- 修订标记：改过描述/类型后可见，避免「改没改过」无从判断。
             人工卡片无 AI 原始值可比，不显示此 chip -->
        <span v-if="isEdited && !isManual" class="edited-chip" title="描述或类型已人工修改，提交后生效">已修改</span>
        <span>第 {{ props.item.pdf_page_number ?? '-' }} 页</span>
      </div>

      <!-- 只读态：描述 + 修改入口（AI 描述不符时人工修订）。
           人工卡片走「重新编辑」（模态内含描述），不提供行内快改 -->
      <template v-if="!editing && !isManual">
        <p class="card-desc">{{ displayDesc || '无描述' }}</p>
        <button class="desc-edit" type="button"
                title="修改图片描述与类型（AI 识别不符时）" @click="startEdit">修改描述</button>
      </template>
      <p v-else-if="!editing" class="card-desc">{{ displayDesc || '无描述' }}</p>

      <!-- 编辑态：类型下拉 + 描述文本；同值字段由父组件保存时过滤；Esc 取消 -->
      <div v-else class="card-edit" @keydown.esc="cancelEdit">
        <select v-model="typeDraft" class="edit-field" aria-label="图片类型">
          <option v-for="(label, value) in IMAGE_TYPE_LABELS" :key="value" :value="value">{{ label }}</option>
        </select>
        <!-- 选择「其他」时展开自定义类型输入：选项都不匹配时自由填写；留空提交则按「其他」处理 -->
        <input v-if="isCustom" v-model="customDraft" class="edit-field" type="text"
               maxlength="20" placeholder="自定义图片类型（如：参数图、场景图；留空则为「其他」）"
               aria-label="自定义图片类型">
        <textarea ref="descBox" v-model="descDraft" class="edit-field edit-textarea" rows="3"
                  placeholder="请输入图片描述" aria-label="图片描述"></textarea>
        <div class="edit-actions">
          <button class="mini-btn" type="button" @click="cancelEdit">取消</button>
          <button class="mini-btn primary" type="button" @click="commitEdit">保存修改</button>
        </div>
      </div>

      <div class="card-actions" :class="{ manual: isManual }">
        <!-- 人工新增卡片：未入后端快照，决策动作无意义；提供重新编辑（框/页/产品/描述全能改）与移除 -->
        <template v-if="isManual">
          <button class="action manual-reedit" type="button"
                  title="重新编辑：改框选区域、页码、绑定产品、描述与类型"
                  @click="emit('reedit')">重新编辑</button>
          <button class="action manual-remove" type="button"
                  title="从本批移除该新增卡片（未提交，不影响后端）"
                  @click="emit('remove')">移除</button>
        </template>
        <template v-else>
          <button v-for="a in ACTIONS" :key="a.key"
                  :class="['action', { active: isActive(a.key), [a.labelClass]: isActive(a.key) }]"
                  data-card-action type="button"
                  :title="ACTION_TITLES[a.key]"
                  :aria-pressed="isActive(a.key)"
                  @click="onAction(a.key)">{{ a.label }}</button>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.review-card {
  position: relative;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: all var(--duration-fast) var(--ease-out);
}
.review-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
/* 顶部决策色条（DESIGN_SPEC 6.9） */
.review-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  width: 0;
  transition: width 150ms var(--ease-out);
  z-index: 2;
}
.review-card[data-decision="approve"]::before { width: 100%; background: var(--success-600, var(--accent-500)); }
.review-card[data-decision="reject"]::before { width: 100%; background: var(--danger-600); }
.review-card[data-decision="skip"]::before { width: 100%; background: var(--warn-600); }
.review-card[data-decision="recrop"]::before { width: 100%; background: var(--info-600); }

/*预览图用 contain 而非 cover：产品结构图/尺寸图最不能被裁边，
   裁掉四周就看不出是否完整产品，会直接影响审核判断。
   留白由 --bg-subtle 底色承担，视觉上仍是稳定的图片区。 */
.card-preview { position: relative; aspect-ratio: 16 / 10; background: var(--bg-subtle); overflow: hidden; }
.card-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
.preview-label {
  position: absolute;
  top: 10px; left: 10px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: rgba(17, 24, 39, 0.78);
  color: var(--text-inverse);
  font-size: 11px;
  font-weight: 600;
}
.card-body { padding: 12px; }
/* 标题降一档（14→13）：长产品名（如「魅力抽 H任意高度(方杆增高)」）少折一行 */
.card-title { font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1.4; }
/* meta 允许 wrap + 收紧间距：类型+人工新增+已修改+页码 4 件套不再挤成断行 */
.card-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 5px; color: var(--text-tertiary); font-size: 11px; }
.card-desc { margin: 8px 0 0; color: var(--text-secondary); font-size: 11px; line-height: 1.45; min-height: 32px; }
/* 修订标记 chip：与 recrop（人工修订族）同色，不抢决策色条的语义 */
.edited-chip {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--info-600);
  background: var(--info-50);
}
/* 人工新增标记 chip：与 recrop 同族色系但实心描边，强调「非 AI 产物」 */
.manual-chip {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--accent-600, var(--info-600));
  background: var(--accent-50, var(--info-50));
  border: 1px solid var(--accent-500, var(--info-600));
}
/* 描述修改入口：常驻但克制（存在感低于决策按钮），hover 才提亮 */
.desc-edit {
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
  padding: 2px 8px;
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--duration-fast);
}
.desc-edit:hover { border-color: var(--info-600); color: var(--info-600); background: var(--info-50); }
/* 编辑态：类型 + 描述 + 保存/取消。字段随卡片主题 token，深色模式自动适配 */
.card-edit { display: grid; gap: 6px; margin-top: 10px; }
.edit-field {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
}
.edit-field:focus { outline: none; border-color: var(--border-focus); }
.edit-field::placeholder { color: var(--text-tertiary); }
.edit-textarea { resize: vertical; min-height: 52px; }
.edit-actions { display: flex; justify-content: flex-end; gap: 6px; }
.mini-btn {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--duration-fast);
}
.mini-btn:hover { background: var(--bg-hover); }
.mini-btn.primary { border-color: var(--info-600); background: var(--info-50); color: var(--info-600); font-weight: 600; }

.card-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-top: 12px;
}
/* 人工新增卡片：重新编辑 + 移除两个动作，各占一半 */
.card-actions.manual { grid-template-columns: repeat(2, 1fr); }
.manual-reedit { border-style: dashed; }
.manual-reedit:hover { background: var(--bg-hover); color: var(--info-600); border-color: var(--info-600); }
.manual-remove { border-style: dashed; }
.manual-remove:hover { background: var(--bg-hover); color: var(--danger-600); border-color: var(--danger-600); }
.action {
  min-height: 32px;
  padding: 0 4px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  transition: all var(--duration-fast);
}
.action:hover:not(.active) { background: var(--bg-hover); }
.action:active { transform: scale(0.97); }
.action.active.approve { border-color: var(--success-600, var(--accent-500)); background: var(--success-50, var(--accent-50)); color: var(--success-600, var(--accent-900)); }
.action.active.reject { border-color: var(--danger-600); background: var(--danger-50); color: var(--danger-600); }
.action.active.skip { border-color: var(--warn-600); background: var(--warn-50); color: var(--warn-600); }
.action.active.recrop { border-color: var(--info-600); background: var(--info-50); color: var(--info-600); }
</style>
