<script setup>
import { computed } from 'vue';
import ReviewCard from './components/ReviewCard.vue';

// DESIGN_SPEC 5.4 审核页三栏布局
const props = defineProps({
  batches: { type: Array, default: () => [] },
  batchIndex: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
  decisions: { type: Object, default: () => ({}) },
  activity: { type: Array, default: () => [] },
  canAbandon: { type: Boolean, default: false }
});
const emit = defineEmits(['select-batch', 'decide', 'approve-all', 'submit', 'abandon']);

const all = computed(() => props.batches.flatMap(b => b.items));
const decidedCount = computed(() => all.value.filter(x => props.decisions[x.source_crop_id]).length);
const progress = computed(() => all.value.length ? Math.round(decidedCount.value / all.value.length * 100) : 0);

const currentDecided = computed(() => props.items.filter(x => props.decisions[x.source_crop_id]).length);
const recropCount = computed(() => currentDecided.value
  ? props.items.filter(x => props.decisions[x.source_crop_id]?.action === 'recrop').length : 0);
const remaining = computed(() => Math.max(0, props.items.length - currentDecided.value));
const ready = computed(() => props.items.length > 0 && currentDecided.value === props.items.length);

function decide(item, action) { emit('decide', item, action); }
</script>

<template>
  <section class="review-layout fade-in">
    <!-- 左侧：批次列表 + 进度 -->
    <aside class="side-panel">
      <h2>审核进度</h2>
      <div class="progress-track">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div :id="'progressText'" class="progress-text">{{ decidedCount }} / {{ all.length }}</div>
      <div class="batch-list">
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
      <div class="review-head">
        <div>
          <h1>候选图片审核</h1>
          <p>批次 {{ props.batchIndex + 1 }} · {{ props.items.length }} 张图片</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-secondary" type="button" @click="emit('approve-all')">全部通过</button>
          <!-- 放弃：删除后端任务快照（仅审核阶段的任务允许删除） -->
          <button v-if="props.canAbandon" class="btn btn-danger" type="button"
                  @click="emit('abandon')">放弃此任务</button>
        </div>
      </div>

      <div v-if="!props.items.length" class="empty-state">暂无待审图片</div>
      <div v-else class="review-grid">
        <ReviewCard v-for="(item, i) in props.items" :key="item.source_crop_id"
                    :item="item" :index="i"
                    :decision="props.decisions[item.source_crop_id] || null"
                    @decide="decide(item, $event)" />
      </div>

      <div class="review-footer">
        <button class="btn btn-primary" type="button" :disabled="!ready"
                @click="emit('submit')">提交当前批次</button>
      </div>
    </section>

    <!-- 右侧：统计面板 + 操作记录 -->
    <aside class="side-panel inspector">
      <section>
        <h2>当前批次</h2>
        <div class="metric"><span>图片数量</span><strong>{{ props.items.length }}</strong></div>
        <div class="metric"><span>已做决定</span><strong>{{ currentDecided }}</strong></div>
        <div class="metric"><span>重新裁剪</span><strong>{{ recropCount }}</strong></div>
        <div class="metric"><span>剩余待审</span><strong>{{ remaining }}</strong></div>
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
    </aside>
  </section>
</template>

<style scoped>
.review-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
  gap: var(--space-5);
  align-items: start;
}
.side-panel {
  padding: var(--space-5);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-sm);
}
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
.batch-list { display: grid; gap: 6px; margin-top: var(--space-4); }
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
.head-actions { display: flex; align-items: center; gap: var(--space-3); }
.review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
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
.activity-title { margin-top: var(--space-6) !important; }
.activity { max-height: 220px; overflow: auto; margin-top: var(--space-3); }
.activity-item { padding: 8px 0; border-bottom: 1px solid var(--divider); font-size: 12px; color: var(--text-tertiary); }
.activity-item:last-child { border-bottom: none; }
.activity-item b { display: block; color: var(--text-primary); font-weight: 600; }
.activity-empty { margin: 8px 0 0; color: var(--text-tertiary); font-size: 12px; }

@media (max-width: 1080px) {
  .review-layout { grid-template-columns: 200px minmax(0, 1fr); }
  .review-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .inspector { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
}
@media (max-width: 680px) {
  .review-layout { display: block; }
  .side-panel { margin-bottom: var(--space-4); }
  .batch-list { display: flex; overflow-x: auto; gap: 8px; }
  .batch { min-width: 120px; }
  .review-head { flex-direction: column; align-items: flex-start; }
  .review-grid { grid-template-columns: 1fr; }
  .inspector { display: block; }
}
</style>
