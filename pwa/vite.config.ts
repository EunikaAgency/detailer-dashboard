import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: "/pwa/",
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['manifest.json'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
      },
      manifest: {
        name: 'One Detailer',
        short_name: 'One Detailer',
        id: '/pwa/',
        description: 'Medical presentation viewer with offline support',
        start_url: '/pwa/',
        scope: '/pwa/',
        display_override: ['standalone', 'minimal-ui'],
        display: 'standalone',
        launch_handler: {
          client_mode: ['focus-existing', 'auto'],
        },
        background_color: '#f8fafc',
        theme_color: '#3b82f6',
        orientation: 'any',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "../public/pwa",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
