import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true // อนุญาตให้ Cloudflare (หรือโดเมนอื่น) เข้าถึงได้
  }
})