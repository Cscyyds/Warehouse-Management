<script setup>
import StatusBadge from './StatusBadge.vue';
import { ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';
import { useThemeStore } from '@/stores/theme';
const props = defineProps({
  status: { type: String, default: 'waiting' },
  statusText: { type: String, default: '等待上传' },
  title: { type: String, default: 'PDF 图片解析工作台' },
  sub: { type: String, default: '识图拆图 · 产品整理 · 人工审核' }
});
// 主题切换：走 WMS 全局主题（html.dark），工作台颜色全部随 token 自动翻转；
// 偏好写入 localStorage，与主站一致（嵌入 WMS 时本组件隐藏，由主布局管理）
const theme = useThemeStore();

// 退出登录：pdf_agent 是独立应用，退出后回它自己的登录页；
// /ai/pdf_review 属于 WMS 链路，退出后回 WMS 登录页。
const route = useRoute();
function logoutTarget() {
  return route.path.startsWith('/ai/pdf_agent') ? '/ai/pdf_agent/login' : '/login';
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('退出后需重新登录，进行中的任务会保留在服务器。', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning'
    });
  } catch {
    return;   // 取消
  }
  // 只清会话标记，不清任务历史（最近任务存在 localStorage，换账号后自行隔离）；
  // wms_session 是切独立会话时暂存的 WMS 会话，退出登录要一并清掉
  ['token', 'auth_kind', 'operator_id', 'operator_name', 'operator_type', 'company_id', 'login_name', 'wms_session']
    .forEach((k) => localStorage.removeItem(k));
  // 整页跳转：顺带清掉轮询与 pinia 内存态
  window.location.href = logoutTarget();
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">PDF</div>
      <div>
        <div class="brand-title">{{ props.title }}</div>
        <div class="brand-sub">{{ props.sub }}</div>
      </div>
    </div>
    <div class="topbar-right">
      <StatusBadge :status="props.status" :text="props.statusText" />
      <button class="theme-toggle" type="button"
              :title="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
              :aria-label="theme.isDark ? '切换到浅色模式' : '切换到深色模式'"
              @click="theme.toggleTheme()">
        <!-- 浅色态显示月亮（点击进深色）；深色态显示太阳（点击回浅色） -->
        <svg v-if="!theme.isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
        </svg>
      </button>
      <button class="logout-btn" type="button" @click="handleLogout">退出登录</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 28px;
  /* 半透面板色 + 模糊，浅色/深色主题均自适应 */
  background: color-mix(in srgb, var(--bg-panel) 95%, transparent);
  border-bottom: 1px solid var(--border-default);
  backdrop-filter: blur(10px);
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  /* 品牌红块，白字（--text-inverse 在深色下不可用，固定白字） */
  background: var(--accent-600);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  flex: none;
}
.brand-title { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
.brand-sub { margin-top: 1px; color: var(--text-tertiary); font-size: 12px; white-space: nowrap; }
.topbar-right { display: flex; align-items: center; gap: 12px; flex: none; }
.theme-toggle {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast), background var(--duration-fast);
}
.theme-toggle:hover { color: var(--accent-600); border-color: var(--border-focus); background: var(--bg-hover); }
.theme-toggle svg { width: 16px; height: 16px; }
.logout-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-panel);
  color: var(--text-tertiary);
  font-size: 13px;
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast), background var(--duration-fast);
  white-space: nowrap;
}
.logout-btn:hover { color: var(--accent-600); border-color: var(--border-focus); background: var(--bg-hover); }
@media (max-width: 680px) {
  .topbar { padding: 0 16px; }
  .brand-sub { display: none; }
}
</style>
