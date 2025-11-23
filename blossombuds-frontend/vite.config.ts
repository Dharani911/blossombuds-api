// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import os from "os";

// optional: get local IP for dev HMR
function getLANHost() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return "localhost";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const server: any = {
    host: true,
    port: 5173,
    strictPort: true,
    cors: false,
    hmr: {
      host: getLANHost(),
      protocol: "ws",
      port: 5173,
    },
  };

  if (mode === "development") {
    server.proxy = {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 120000,
        proxyTimeout: 120000,
      },
    };
  }

  return {
    plugins: [react()],
    define: { "process.env": {} },
    server,
    preview: { host: true, port: 4173 },
    build: { outDir: "dist" },
  };
});

