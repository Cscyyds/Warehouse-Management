<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCreationContextStore } from '@/stores/creationContext'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const context = useCreationContextStore()
const mobileOpen = ref(false)

const navigation = [
  { path: '/platform/tenants', label: '租客全景', code: 'PANORAMA', glyph: '览' },
  { path: '/platform/tenant-onboarding', label: '租客开通', code: 'TENANT', glyph: '开' },
  { path: '/platform/access-resources', label: '权限资源', code: 'ACCESS', glyph: '权' },
  { path: '/platform/tenant-resources', label: '租客基础资料', code: 'RESOURCE', glyph: '资' },
  { path: '/platform/printer-models', label: '打印机配置', code: 'PRINTER', glyph: '印' },
  { path: '/platform/operation-logs', label: '操作日志', code: 'LOG', glyph: '志' },
  { path: '/platform/enum-mappings', label: '枚举映射', code: 'MAPPING', glyph: '映' },
]

const initials = computed(() => auth.session?.operatorName?.slice(-2) || '系统')

function logout() {
  context.reset()
  auth.logout()
  router.replace('/login')
}

function navigate(path: string) {
  mobileOpen.value = false
  router.push(path)
}
</script>

<template>
  <div class="admin-shell">
    <div v-if="mobileOpen" class="shell-backdrop" @click="mobileOpen = false" />
    <aside class="shell-sidebar" :class="{ 'is-open': mobileOpen }">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div>
          <strong>智星 WMS</strong>
          <span>平台操作控制台</span>
        </div>
      </div>

      <div class="sidebar-section-label mono-label">CONTROL LANES</div>
      <nav class="shell-nav" aria-label="系统管理员功能">
        <button
          v-for="item in navigation"
          :key="item.path"
          type="button"
          :class="{ 'is-active': route.path === item.path }"
          @click="navigate(item.path)"
        >
          <span class="nav-glyph">{{ item.glyph }}</span>
          <span class="nav-copy"><strong>{{ item.label }}</strong><small>{{ item.code }}</small></span>
          <span class="nav-arrow">→</span>
        </button>
      </nav>

      <div class="session-crate">
        <span class="mono-label">SESSION LOAD</span>
        <strong>{{ context.createdCount }}</strong>
        <small>项资源已在本次会话中接力</small>
      </div>
    </aside>

    <div class="shell-main">
      <header class="shell-topbar">
        <button class="mobile-menu" type="button" aria-label="打开菜单" @click="mobileOpen = true">☰</button>
        <div class="system-state"><span /> 后端通道 <strong>API V1</strong></div>
        <div class="admin-identity">
          <div class="admin-avatar">{{ initials }}</div>
          <div><strong>{{ auth.session?.operatorName }}</strong><span>{{ auth.session?.loginName }} · SYSTEM</span></div>
          <button type="button" @click="logout">退出</button>
        </div>
      </header>
      <main class="shell-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
