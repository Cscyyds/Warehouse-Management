import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import https from 'https'

const apiAgent = new https.Agent({ rejectUnauthorized: false })

function apiProxy(req, res, next) {
  if (!req.url?.startsWith('/api/')) {
    return next()
  }

  const targetUrl = new URL(req.url, 'https://www.aster-mindlink.cn:7777')
  console.log(`[API Proxy] ${req.method} ${req.url} → ${targetUrl.href}`)

  const proxyReq = https.request(
    targetUrl,
    {
      method: req.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(req.headers).filter(([k]) => !['host', 'referer', 'origin'].includes(k.toLowerCase()))
        ),
        host: targetUrl.host,
      },
      agent: apiAgent,
    },
    (proxyRes) => {
      console.log(`[API Proxy] ← ${proxyRes.statusCode} ${req.url}`)
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', (err) => {
    console.error(`[API Proxy] ✗ Error for ${req.url}:`, err.message)
    if (!res.headersSent) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, message: `代理请求失败: ${err.message}` }))
    }
  })

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq)
  } else {
    proxyReq.end()
  }
}

export default defineConfig({
  base: '/wms/',
  plugins: [
    vue(),
    {
      name: 'api-proxy',
      configureServer(server) {
        server.middlewares.use(apiProxy)
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    // 普通 HTTP 仍由上面的自定义代理处理；该配置同时注册 WebSocket upgrade 代理。
    proxy: {
      '/api': {
        target: 'https://www.aster-mindlink.cn:7777',
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
})
