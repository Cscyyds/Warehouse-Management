import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import https from 'https';
const apiAgent = new https.Agent({ rejectUnauthorized: false });
function apiProxy(req, res, next) {
    if (!req.url?.startsWith('/api/')) {
        return next();
    }
    const targetUrl = new URL(req.url, 'https://www.aster-mindlink.cn:7777');
    const proxyReq = https.request(targetUrl, {
        method: req.method,
        headers: {
            ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'referer', 'origin'].includes(k.toLowerCase()))),
            host: targetUrl.host,
        },
        agent: apiAgent,
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
        console.error(`[API Proxy] ✗ Error for ${req.url}:`, err.message);
        if (!res.headersSent) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: `代理请求失败: ${err.message}` }));
        }
    });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.pipe(proxyReq);
    }
    else {
        proxyReq.end();
    }
}
export default defineConfig({
    base: '/wms/',
    plugins: [
        vue(),
        {
            name: 'api-proxy',
            configureServer(server) {
                server.middlewares.use(apiProxy);
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
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
            },
        },
    },
});
