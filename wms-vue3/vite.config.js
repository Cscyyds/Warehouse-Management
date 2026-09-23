import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn';
    // AI 会话、文件和豆包 ASR 与小程序一致，部署在独立的 7779 服务。
    // 更具体的前缀必须放在通用 /api 代理之前。
    const aiProxyTarget = env.VITE_AI_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn:7779';
    // 扫码枪后端（nuomi_wms_barcode_scanner）线上只对外开 7780（nginx 7780 → 服务器本机 8010），
    // 本机开发通常不起这个服务，故 dev 代理转发到线上。
    const scannerProxyTarget = env.VITE_SCANNER_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn:7780';
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
                // 当前指向本地 127.0.0.1:8001 调试（切回云端改 https://www.aster-mindlink.cn:7779）
                '/api/v1/files/upload/pdf': {
                    target: 'http://127.0.0.1:8001',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/v1/pdf-workflow': {
                    target: 'http://127.0.0.1:8001',
                    changeOrigin: true,
                    secure: false,
                },
                // 方案 D 流实例：前端 2s 轮询 /api/v1/pdf-stream/{id}/events?since=N 取进度。
                // 同样必须排在兜底 '/api' 之前，否则被劫到主后端（无此路由 → 404 Not Found，
                // 前端连续 3 次轮询失败即合成 error → 自动重试 start，
                // 表现为 start / events?since=0 死循环，且每轮都真实发起一次 Coze 工作流）
                '/api/v1/pdf-stream': {
                    target: 'http://127.0.0.1:8001',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/v1/plugin/pdf': {
                    target: 'http://127.0.0.1:8001',
                    changeOrigin: true,
                    secure: false,
                },
                // 官方产品知识库（同 Coze_Connect 网关）：PDF 结果页「导入知识库」
                // 走 /api/v1/knowledge/admin/imports/*，须排在兜底 '/api' 之前，
                // 否则会被劫到主后端（无此路由 → 404）。目标随 PDF 三条同进退。
                '/api/v1/knowledge': {
                    target: 'http://127.0.0.1:8001',
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
                // 条码打印 / 打印任务走扫码枪后端（独立 axios 实例 + VITE_SCANNER_API_BASE_URL）：
                // 前端 baseURL 配相对路径 /scanner-api → 此处剥掉前缀，后端收到的仍是
                // /api/v1/tenant-wms/*。走同源代理可绕开线上 CORS 白名单（线上只放了
                // http://localhost:3000，换 127.0.0.1 访问就会被预检拦掉）。
                // 不能改用 /api/v1/tenant-wms 前缀劫持——该前缀主后端也在用（如 association/query）。
                '/scanner-api': {
                    target: scannerProxyTarget,
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/scanner-api/, ''),
                },
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
    };
});
