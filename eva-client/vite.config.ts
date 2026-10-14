import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5173,
    headers: {
      "Cache-Control": "no-store",
    },
    proxy: {
      "/health": "http://localhost:2567",
      "/auth": "http://localhost:2567",
    },
  },
});
