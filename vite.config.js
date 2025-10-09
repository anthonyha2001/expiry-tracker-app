import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Set the base path for deployment on GitHub Pages.
  // This is crucial for the live site to find its assets.
  base: '/expiry-tracker-app/',

  // Added server configuration for ngrok
  server: {
    // This allows any URL ending in .ngrok-free.app to connect,
    // which is useful for testing your site on other devices.
    allowedHosts: ['.ngrok-free.dev'],
  },
})