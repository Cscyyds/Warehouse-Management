<script setup>
import { computed } from 'vue';

const props = defineProps({
  jobs: { type: Array, default: () => [] },
  stages: { type: Array, default: () => [] },
  done: { type: Boolean, default: false },
  kbName: { type: String, default: '' },
  modelLabel: { type: String, default: '' },
});
const emit = defineEmits(['home', 'more']);

const totals = computed(() => ({
  chunks: props.jobs.reduce((n, j) => n + j.chunks, 0),
  tokens: props.jobs.reduce((n, j) => n + j.tokens, 0),
  finished: props.jobs.filter(j => j.status === 'done').length,
}));
const overall = computed(() => {
  if (!props.jobs.length) return 0;
  return Math.round(props.jobs.reduce((n, j) => n + j.progress, 0) / props.jobs.length);
});

function stageState(job, i) {
  if (job.status === 'done' || i < job.stage) return 'done';
  if (i === job.stage && job.status === 'running') return 'active';
  return '';
}
function statusText(job) {
  if (job.status === 'done') return '已入库';
  if (job.status === 'queued') return '排队中';
  return `${props.stages[job.stage] || ''}中`;
}
</script>

<template>
  <section class="panel proc fade-in">
    <div class="panel-header">
      <span class="panel-overline">DATA HUB / 03</span>
      <h1 class="panel-title">{{ props.done ? '处理完成' : '正在处理数据' }}</h1>
      <p class="panel-lead">
        <template v-if="props.done">
          {{ props.jobs.length }} 个数据源已写入「{{ props.kbName }}」，共 {{ totals.chunks }} 个分块，可在知识库中检索。
        </template>
        <template v-else>
          解析、切片后使用 {{ props.modelLabel }} 向量化并写入索引。离开本页不影响处理，进度可在知识库列表查看。
        </template>
      </p>
    </div>

    <div class="overall" :class="{ done: props.done }">
      <div class="overall-row">
        <span>{{ totals.finished }} / {{ props.jobs.length }} 已完成</span>
        <strong>{{ overall }}%</strong>
      </div>
      <div class="track" role="progressbar" :aria-valuenow="overall" aria-valuemin="0" aria-valuemax="100">
        <b :style="{ width: `${overall}%` }"></b>
      </div>
      <div class="overall-meta">{{ totals.chunks }} 个分块 · {{ totals.tokens.toLocaleString() }} tokens · 演示环境为模拟进度</div>
    </div>

    <ul class="jobs">
      <li v-for="j in props.jobs" :key="j.id" class="job" :data-status="j.status">
        <div class="job-head">
          <i class="ext-badge" :data-ext="j.ext">{{ j.ext === 'text' ? 'TXT' : j.ext }}</i>
          <div class="job-info">
            <strong :title="j.name">{{ j.name }}</strong>
            <span>{{ j.chunks }} 个分块 · {{ j.chars.toLocaleString() }} 字</span>
          </div>
          <span class="job-status">
            <i v-if="j.status === 'running'" class="spinner" aria-hidden="true"></i>
            <template v-else-if="j.status === 'done'">✓ </template>{{ statusText(j) }}
          </span>
        </div>
        <ol class="stages">
          <li v-for="(s, i) in props.stages" :key="s" :class="stageState(j, i)">
            <span class="stage-bar"><b :style="{ width: stageState(j, i) === 'done' ? '100%' : stageState(j, i) === 'active' ? `${j.stagePct}%` : '0%' }"></b></span>
            <span class="stage-name">{{ s }}</span>
          </li>
        </ol>
      </li>
    </ul>

    <div class="actions">
      <button class="btn btn-secondary" type="button" @click="emit('more')">继续导入</button>
      <button class="btn btn-primary" type="button" @click="emit('home')">{{ props.done ? '查看知识库' : '返回知识库（后台继续）' }}</button>
    </div>
  </section>
</template>

<style scoped>
.proc { max-width: 820px; margin: 0 auto; }
.overall { margin: var(--space-6) 0 var(--space-5); padding: var(--space-4) var(--space-5); border: 1px solid var(--border-default); border-left: 4px solid var(--info-600); border-radius: var(--radius-md); background: var(--bg-subtle); }
.overall.done { border-left-color: var(--success-600); }
.overall-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--text-secondary); }
.overall-row strong { color: var(--text-primary); font-size: 20px; font-variant-numeric: tabular-nums; }
.track { height: 6px; margin-top: 8px; border-radius: 3px; background: var(--bg-panel); overflow: hidden; }
.track b { display: block; height: 100%; border-radius: 3px; background: var(--info-600); transition: width 150ms linear; }
.overall.done .track b { background: var(--success-600); }
.overall-meta { margin-top: 8px; color: var(--text-secondary); font-size: 12px; }

.jobs { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.job { padding: 12px 14px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-panel); }
.job[data-status="running"] { border-color: var(--border-focus); }
.job-head { display: flex; align-items: center; gap: 12px; }
.job-head .ext-badge { width: 34px; height: 38px; font-size: 9px; font-style: normal; }
.job-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.job-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.job-info span { color: var(--text-secondary); font-size: 12px; }
.job-status { display: inline-flex; align-items: center; gap: 6px; flex: none; font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.job[data-status="running"] .job-status { color: var(--info-600); }
.job[data-status="done"] .job-status { color: var(--success-600); }
.spinner {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--info-600) 25%, transparent); border-top-color: var(--info-600);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.stages { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 12px 0 0; padding: 0; list-style: none; }
.stage-bar { display: block; height: 4px; border-radius: 2px; background: var(--bg-subtle); overflow: hidden; }
.stage-bar b { display: block; height: 100%; background: var(--info-600); transition: width 150ms linear; }
.stages li.done .stage-bar b { background: var(--success-600); }
.stage-name { display: block; margin-top: 4px; color: var(--text-tertiary); font-size: 11px; text-align: center; }
.stages li.active .stage-name { color: var(--info-600); font-weight: 600; }
.stages li.done .stage-name { color: var(--text-secondary); }

.actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-6); }
</style>
