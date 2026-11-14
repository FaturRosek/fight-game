import { defineConfig } from "vite";

const backendTarget = process.env.VITE_BACKEND_PROXY || "http://localhost:3001";

export default defineConfig({
  base: "./",
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    open: true,
    proxy: {
      "/socket.io": {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
