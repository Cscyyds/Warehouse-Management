<script setup>
// DESIGN_SPEC 处理面板：W1/W2/W3 工作流步骤 + 日志
const props = defineProps({
  message: { type: String, default: '正在准备进入工作流…' },
  fileName: { type: String, default: 'PDF document' },
  fileUrl: { type: String, default: '等待 BOS 上传' },
  steps: { type: Array, default: () => [
    { key: 'w1', label: 'W1 · 页面识别与候选裁图', state: 'active' },
    { key: 'w2', label: 'W2 · 产品合并与预览生成', state: '' },
    { key: 'w3', label: 'W3 · 人工审核与结果发布', state: '' }
  ] },
  retry: { type: Object, default: () => ({ active: false, current: 0, max: 3 }) }
});
</script>

<template>
  <section class="panel process-panel fade-in">
    <div class="panel-header">
      <span class="panel-overline">PDF PIPELINE / 02</span>
      <h1 class="panel-title">正在解析 PDF</h1>
      <p class="panel-lead" id="processMessage">{{ props.message }}</p>

      <div v-if="props.retry.active" class="retry-line" role="status" aria-live="polite">
        <span class="retry-spinner" aria-hidden="true"></span>
        <strong>重试中（{{ props.retry.current }} / {{ props.retry.max }}）</strong>
        <span class="retry-hint">已完成的进度会保留，请勿关闭页面</span>
        <span class="retry-dots" aria-hidden="true">
          <i v-for="n in props.retry.max" :key="n"
             :class="{ used: n <= props.retry.current }"></i>
        </span>
      </div>
    </div>

    <div class="process-file">
      <div class="file-badge">PDF</div>
      <div>
        <strong>{{ props.fileName }}</strong>
        <span>{{ props.fileUrl }}</span>
      </div>
    </div>

    <div class="workflow-steps">
      <div v-for="s in props.steps" :key="s.key" class="wstep"
           :class="s.state">
        <i class="wstep-dot"></i>
        <span>{{ s.label }}</span>
      </div>
    </div>

    <div class="process-log" id="processLog">{{ props.message }}</div>
  </section>
</template>

<style scoped>
.process-panel { max-width: 720px; margin: 0 auto; }

/* 重试进度：面板头部内联一行 */
.retry-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: var(--space-3);
  font-size: 13px;
}
.retry-spinner {
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(13, 138, 109, 0.22);
  border-top-color: var(--accent-600);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.retry-line strong {
  font-weight: 600;
  color: var(--accent-600);
}
.retry-hint {
  color: var(--text-tertiary);
  font-size: 12px;
}
.retry-dots { display: inline-flex; gap: 5px; flex: none; margin-left: auto; }
.retry-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(13, 138, 109, 0.2);
  transition: background var(--duration-fast);
}
.retry-dots i.used { background: var(--accent-600); }
@keyframes spin { to { transform: rotate(360deg); } }

.process-file {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  margin: var(--space-6) 0;
}
.file-badge {
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  font-size: 11px;
  font-weight: 800;
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}
.process-file strong { display: block; font-size: 14px; color: var(--text-primary); }
.process-file span { display: block; font-size: 12px; color: var(--text-tertiary); margin-top: 2px; word-break: break-all; }
.workflow-steps { display: grid; gap: 10px; }
.wstep {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  background: var(--bg-panel);
  transition: all var(--duration-fast);
}
.wstep-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-strong); transition: background var(--duration-fast); }
.wstep.active {
  border-color: var(--border-focus);
  color: var(--accent-600);
  background: var(--accent-50);
}
.wstep.active .wstep-dot { background: var(--accent-600); animation: pulse 1.6s infinite; }
.wstep.done { color: var(--text-primary); }
.wstep.done .wstep-dot { background: var(--accent-600); }
.process-log {
  margin-top: var(--space-5);
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 13px;
  min-height: 44px;
}
</style>
