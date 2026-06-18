import { defineConfig } from "vite";

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3004";

export default defineConfig({
  root: "apps/admin",
  base: "./",
  envPrefix: "VITE_",
  cacheDir: "../../node_modules/.vite-admin",
  build: {
    outDir: "../../dist/admin",
    emptyOutDir: true
  },
  server: {
    port: 3003,
    host: "0.0.0.0",
    // 内网穿透（admin.wyhxx.top）需要放行公网 Host；Vite 默认只允许 localhost
    allowedHosts: ["admin.wyhxx.top", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
        secure: false
      }
    }
  },
  preview: {
    port: 3003,
    host: "0.0.0.0",
    allowedHosts: ["admin.wyhxx.top", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
        secure: false
      }
    }
  }
});
