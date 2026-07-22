import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-leaflet':  ['leaflet', 'react-leaflet', '@react-leaflet/core'],
          'vendor-cytoscape':['cytoscape', 'react-cytoscapejs'],
          'vendor-recharts': ['recharts'],
          'vendor-lucide':   ['lucide-react'],
        },
      },
    },
  },
})

