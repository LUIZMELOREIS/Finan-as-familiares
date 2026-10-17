import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base: "/" na Vercel; "/<nome-do-repositorio>/" no GitHub Pages (definido em VITE_BASE).
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brasao.svg', 'icones/*.png'],
      manifest: {
        name: 'Finanças da Família',
        short_name: 'Finanças',
        description: 'O app de finanças da nossa casa: lance gastos por foto, voz ou digitação, acompanhe as contas e os sonhos da família.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0D0E23',
        theme_color: '#0D0E23',
        categories: ['finance', 'lifestyle'],
        icons: [
          { src: 'icones/icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icones/icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icones/icone-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Lançar gasto', short_name: 'Lançar', url: './#/lancar', icons: [{ src: 'icones/icone-192.png', sizes: '192x192' }] },
          { name: 'Caixa de Entrada', short_name: 'Caixa', url: './#/caixa', icons: [{ src: 'icones/icone-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: mode === 'production' ? 'index.html' : undefined,
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'google-fonts-css' } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts-arquivos', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
          { urlPattern: /^https:\/\/(drive|lh3)\.google(usercontent)?\.com\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'imagens-drive', expiration: { maxEntries: 60 } } },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor')) return 'graficos'
          if (id.includes('node_modules/react')) return 'react'
          return undefined
        },
      },
    },
  },
}))
