import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
export default defineConfig({
  plugins:[vue()], resolve:{alias:{'@':path.resolve('src')}},
  define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/')},
  server:{host:'127.0.0.1',port:3087,strictPort:true,open:false},
})
