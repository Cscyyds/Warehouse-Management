// 仅供本地浏览器回归使用，不注册到产品路由。
import { createApp } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import Detail from '../src/views/warehouse/WarehouseStockDetail.vue'
import { saveSession } from '../src/utils/session'

export async function mountInventoryFixture(mode?: boolean) {
  saveSession('wms', { token: 'inventory-ui-fixture', company_id: 'fixture', simple_mode_enabled: mode })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/detail', component: Detail }] })
  await router.push('/detail?productId=fixture-product')
  await router.isReady()
  const host = document.createElement('div')
  host.id = 'inventory-test-host'
  document.body.replaceChildren(host)
  const app = createApp(Detail)
  app.use(router).use(ElementPlus)
  app.mount(host)
}
