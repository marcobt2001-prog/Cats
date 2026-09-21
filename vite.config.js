import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import catsLean from './server/lean/vite-plugin.js'

export default defineConfig({
  // catsLean only applies while serving, so a build (and the deployed site)
  // has no Lean endpoint at all.
  plugins: [react(), catsLean()],
})
