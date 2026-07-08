import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_FRAPPE_BASE_URL || "https://btm.digihoopoe.com";
  const base = mode === "production" ? "/assets/cclms/xg-system/" : "/";

  return {
    base,
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 900,
    },
    server: {
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: "localhost",
        },
      },
    },
  };
});
