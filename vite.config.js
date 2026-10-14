import {defineConfig} from 'vite';
export default defineConfig({
  base: './',
  server: {host:'127.0.0.1',port:4331,strictPort:true},
  preview: {host:'127.0.0.1',port:4331,strictPort:true},
  build: {outDir:'build-output',chunkSizeWarningLimit:1800,rollupOptions:{input:'appearance.html'}},
});
