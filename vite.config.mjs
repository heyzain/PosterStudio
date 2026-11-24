import { defineConfig } from 'vite';
import tailwind from '@tailwindcss/postcss';

export default defineConfig({
  publicDir: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  oxc: { jsx: { runtime: 'automatic' } },
  css: { postcss: { plugins: [tailwind()] } },
  build: {
    outDir: 'app/renderer-build',
    lib: {
      entry: 'app/renderer/main.jsx',
      name: 'PosterStudio',
      formats: ['iife'],
      fileName: () => 'workspace.js',
      cssFileName: 'workspace',
    },
  },
});
