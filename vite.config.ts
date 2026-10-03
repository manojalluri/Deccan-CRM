import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { billingApiPlugin } from './src/server/billingApiPlugin.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    billingApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
})
