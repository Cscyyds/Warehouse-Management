import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'

const routerHistoryBase = import.meta.env.BASE_URL

const router = createRouter({
  history: createWebHistory(routerHistoryBase),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      children: [
        { path: '', redirect: '/platform/tenant-onboarding' },
        { path: 'platform/tenant-onboarding', name: 'tenant-onboarding', component: () => import('@/views/TenantOnboardingView.vue') },
        { path: 'platform/access-resources', name: 'access-resources', component: () => import('@/views/AccessResourcesView.vue') },
        { path: 'platform/tenant-resources', name: 'tenant-resources', component: () => import('@/views/TenantResourcesView.vue') },
        { path: 'platform/operation-logs', name: 'operation-logs', component: () => import('@/views/OperationLogsView.vue') },
        { path: 'platform/enum-mappings', name: 'enum-mappings', component: () => import('@/views/EnumMappingsView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore(pinia)
  if (to.meta.public) return auth.isSystemAdmin ? '/' : true
  if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (!auth.isSystemAdmin) {
    auth.logout()
    return { name: 'login', query: { reason: 'system-only' } }
  }
  return true
})

export default router
