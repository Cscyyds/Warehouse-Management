// 本地回归入口，不注册产品路由；测试的API均由隔离浏览器拦截。
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import MergePage from '../src/views/warehouse/WarehouseMergePackage.vue'
import { saveSession } from '../src/utils/session'

export async function mountMergePackageFixture() {
  saveSession('wms', { token: 'merge-ui-fixture', company_id: 'fixture', operator_type: 'USER' })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/warehouse/merge-package', component: MergePage }] })
  await router.push('/warehouse/merge-package')
  await router.isReady()
  const host = document.createElement('div')
  document.body.replaceChildren(host)
  createApp(MergePage).use(createPinia()).use(router).use(ElementPlus).directive('perm', () => {}).mount(host)
}
