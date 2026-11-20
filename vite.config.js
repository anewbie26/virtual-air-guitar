import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true lets a phone on the same LAN open the dev server for camera testing.
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    passWithNoTests: true,
  },
})
