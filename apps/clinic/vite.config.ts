import { defineConfig } from "vite";

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3004";

export default defineConfig({
  root: "apps/clinic",
  base: "./",
  envPrefix: "VITE_",
  build: {
    outDir: "../../dist/clinic",
    emptyOutDir: true
  },
  server: {
    port: 3002,
    host: "0.0.0.0",
    // 内网穿透（clinic.wyhxx.top）需要放行公网 Host；Vite 默认只允许 localhost
    allowedHosts: ["clinic.wyhxx.top", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
        secure: false
      }
    }
  },
  preview: {
    port: 3002,
    host: "0.0.0.0",
    allowedHosts: ["clinic.wyhxx.top", "localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: false,
        secure: false
      }
    }
  }
});
