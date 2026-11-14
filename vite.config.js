import { defineConfig } from "vite";

const backendUrl = process.env.VITE_BACKEND_URL || "http://localhost:3001";

export default defineConfig({
  base: "./",
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    open: true,
    proxy: {
      "/socket.io": {
        target: backendUrl,
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
