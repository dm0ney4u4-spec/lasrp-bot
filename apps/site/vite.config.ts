import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const proxy={'/api':{target:'http://127.0.0.1:3000',changeOrigin:false},'/auth':{target:'http://127.0.0.1:3000',changeOrigin:false}};
export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true,proxy }, preview: { port: 4173, strictPort: true,proxy } });
