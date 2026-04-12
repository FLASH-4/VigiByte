/**
 * VITE PRODUCTION CONFIGURATION (vite.config.js)
 * * VigiByte Build & Security Engine
 * * Purpose: Configures the latest Tailwind v4 pipeline, enforces strict 
 * security headers, and optimizes the build for large AI libraries.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // PLUGIN ORCHESTRATION: Seamless integration of React and Tailwind v4
  plugins: [
    react(), 
    tailwindcss()
  ],
  
  server: {
    port: 5173,
    /**
     * SECURITY HEADERS (Dev & Production Preview)
     * These headers protect the Intelligence Dashboard from common web exploits.
     */
    headers: {
      'X-Frame-Options': 'DENY', // Prevents clickjacking by disabling iframe embedding
      'X-Content-Type-Options': 'nosniff', // Disables MIME-type sniffing for security
      'X-XSS-Protection': '1; mode=block', // Activates browser XSS filters
      // CSP: Whitelisting trusted sources for Supabase, Render Backend, and Roboflow AI
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://flash-04-vigibyte-api.hf.space https://detect.roboflow.com;"
    }
  },

  build: {
    outDir: 'dist',
    // OBSFUCATION: Disables sourcemaps to prevent raw code exposure in production
    sourcemap: false, 
    // AI ASSET MANAGEMENT: High limit for chunky face-recognition libraries
    chunkSizeWarningLimit: 2000,
    
    rollupOptions: {
      output: {
        /**
         * DYNAMIC CODE SPLITTING (manualChunks)
         * Purpose: Separates heavy dependencies into independent bundles.
         * Benefits: Faster initial load times and better browser caching.
         */
        manualChunks: (id) => {
          // Bundle core React library separately
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
          // Bundle the heavy Face-API weights and logic into its own chunk
          if (id.includes('@vladmandic/face-api')) {
            return 'faceapi'
          }
          // Bundle Database connectivity logic separately
          if (id.includes('@supabase')) {
            return 'supabase'
          }
        }
      }
    }
  }
})