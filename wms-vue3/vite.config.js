import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn';
    const aiProxyTarget = env.VITE_AI_PROXY_TARGET?.trim() || 'https://www.aster-mindlink.cn:7779';
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
                '/api/v1/asr': {
                    target: aiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
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
