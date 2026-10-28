<template>
  <section v-for="group in groups" :key="group.owner" class="impact-group">
    <h4>{{ group.owner_name }}</h4>
    <p v-if="!group.permissions.length" class="empty-impact">{{ group.owner === 'WMS_SCANNER' ? '当前未纳入扫码枪接口' : '当前没有登记的使用位置' }}</p>
    <div v-for="item in group.permissions" :key="`${group.owner}:${item.perm_code}:${item.interface_path}:${item.param_name}`" class="impact-item">
      <el-tag v-if="item.unbound" type="info" size="small">未绑定权限</el-tag>
      <strong>{{ item.perm_name || item.interface_name || item.api_name || '未命名使用位置' }}</strong>
      <details><summary>查看涉及字段</summary><p>{{ item.param_name }}</p><p class="advanced">接口说明：{{ item.interface_name || item.api_name || '—' }} · {{ item.interface_path }}</p></details>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { SensitiveImpactGroup } from '@/api/modules/sensitiveField'
const props = defineProps<{ value: SensitiveImpactGroup[] }>()
const groups = computed(() => [
  ...[{ owner: 'WMS_PLATFORM', owner_name: 'WMS页面' }, { owner: 'WMS_SCANNER', owner_name: '扫码枪' }].map(group => ({ ...group, permissions: props.value.find(item => item.owner === group.owner)?.permissions ?? [] })),
  ...props.value.filter(group => !['WMS_PLATFORM', 'WMS_SCANNER'].includes(group.owner)),
])
</script>
<style scoped>
.impact-group { margin: 16px 0; } h4 { margin: 0 0 10px; } .impact-item { padding: 10px 0; border-bottom: 1px solid var(--border-color); }
.impact-item strong { font-size: 13px; margin-left: 6px; } details { margin-top: 6px; overflow-wrap: anywhere; font-size: 12px; } summary { cursor: pointer; color: var(--el-color-primary); }
.empty-impact, .advanced { color: var(--text-secondary); font-size: 12px; } p { margin: 6px 0; }
</style>
