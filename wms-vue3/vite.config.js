import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn';
    return {
        base: '/wms/',
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
                '/api/v1/plugin/pdf': {
                    target: 'http://127.0.0.1:8001',
                    changeOrigin: true,
                    secure: false,
                },
                '/api/v1/coze': {
                    target: 'http://127.0.0.1:8001',
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
    };
});
