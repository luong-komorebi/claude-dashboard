/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import { VitePWA } from 'vite-plugin-pwa'

// When deploying to GitHub Pages, VITE_BASE_PATH is set to "/<repo-name>/" by the CI workflow.
// For local dev it defaults to "/" so asset paths stay relative to the root.
const base = process.env.VITE_BASE_PATH ?? '/'

// Content Security Policy — production only.
// `connect-src 'self'` makes it physically impossible for this app to send
// data to any external server. Same-origin fetches (service worker, assets)
// still work. Blocked at the browser platform level, not by a JS check.
function cspPlugin(): PluginOption {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')

  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
      )
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    react(),
    wasm(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Claude Dashboard',
        short_name: 'Claude',
        description: 'Local dashboard for ~/.claude data — runs fully in the browser',
        theme_color: '#7c6af7',
        background_color: '#0d0d0d',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache the app shell (HTML, JS, CSS, WASM) with network-first for freshness
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/wasm-pkg/**'],
    },
  },
})
