import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn'
  // AI 会话、文件和豆包 ASR 与小程序一致，部署在独立的 7779 服务。
  // 更具体的前缀必须放在通用 /api 代理之前。
  const aiProxyTarget = env.VITE_AI_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn:7779'
  // PDF 审核 / 知识库导入（Coze_Connect 网关）：默认走本地 8001（调试推荐）；
  // 需连云端 7779 时在 .env.* 里覆盖 VITE_PDF_PROXY_TARGET。
  const pdfProxyTarget = env.VITE_PDF_PROXY_TARGET?.trim() || 'http://127.0.0.1:8001'

  return {
    base: '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        // PDF 审核（Coze_Connect 网关）——前缀更具体，必须排在 '/api/v1/file' 之前，
        // 否则 '/api/v1/files/upload/pdf' 会被 '/api/v1/file' 前缀截胡。
        // 目标由 VITE_PDF_PROXY_TARGET 决定（当前环境见 .env.development）
        '/api/v1/files/upload/pdf': {
          target: pdfProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/v1/pdf-workflow': {
          target: pdfProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        // PDF 流实例（排队机制方案 D）：GET /{id}/events 轮询、DELETE 取消、/mode 探测。
        // 必须排在兜底 '/api' 之前，否则会被劫到主后端（无此路由 → 404）。
        '/api/v1/pdf-stream': {
          target: pdfProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/v1/plugin/pdf': {
          target: pdfProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        // 官方产品知识库（同 Coze_Connect 网关）：PDF 结果页「导入知识库」
        // 走 /api/v1/knowledge/admin/imports/*，须排在兜底 '/api' 之前，
        // 否则会被劫到主后端（无此路由 → 404）。目标随 PDF 三条同进退。
        '/api/v1/knowledge': {
          target: pdfProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/v1/coze': {
          target: aiProxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/api/v1/file': {
          target: aiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        // 豆包流式语音识别 WebSocket
        '/api/v1/asr': {
          target: aiProxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        // 条码打印走扫码枪后端（独立 axios 实例 + VITE_SCANNER_API_BASE_URL 绝对地址），
        // 不经此处代理：/api/v1/tenant-wms 前缀主后端也在用（如 association/query），不能整段劫持
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  }
})
