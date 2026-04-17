import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API = env.VITE_API_URL || 'http://localhost:8000';

  return {
    server: {
      port: 5173,
      proxy: {
        '/devices': { target: API, changeOrigin: true },
        '/ws':      { target: API.replace(/^http/, 'ws'), ws: true, changeOrigin: true },
      },
    },
  };
});
