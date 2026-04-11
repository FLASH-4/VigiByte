/**
 * VITE CONFIGURATION (vite.config.js)
 * * VigiByte Build & Development Engine
 * * Purpose: This file configures the build pipeline, dev-server security, 
 * and integrates the latest Tailwind CSS (v4) and React plugins.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Plugin Integration: React for UI logic and Tailwind v4 for utility-first styling
  plugins: [
    react(), 
    tailwindcss()
  ],
  
  server: {
    port: 5173,
    // SECURITY HEADERS: Enforcing local security policies to protect the dashboard
    headers: {
      'X-Frame-Options': 'DENY', // Prevents UI Redressing (Clickjacking)
      'X-Content-Type-Options': 'nosniff', // Prevents the browser from interpreting files as different MIME types
      'X-XSS-Protection': '1; mode=block', // Legacy XSS filter for older browsers
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co http://127.0.0.1:8001 https://detect.roboflow.com;"
    }
  },

  build: {
    outDir: 'dist',
    // Performance: Disables source maps in production to keep the application logic obfuscated
    sourcemap: false,
    // Optimization: Adjusts the chunk size limit for complex AI libraries
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Manual Chunks: Separates heavy AI/DB libraries from the main application code
        manualChunks: {
          vendor: ['react', 'react-dom'],
          faceapi: ['@vladmandic/face-api'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
})