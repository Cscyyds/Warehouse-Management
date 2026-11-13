import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: '/admin-wms/',
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: 3030,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://www.aster-mindlink.cn',
          changeOrigin: true,
        },
        // PDF 解析后台：Coze_Connect pdf_agent 子应用（本地默认 8001）
        '/pdf-agent': {
          target: env.VITE_PDF_AGENT_PROXY_TARGET || 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
      },
    },
  }
})
