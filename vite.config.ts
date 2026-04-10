import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const BACKEND = env.VITE_FRAPPE_BASE_URL || "https://crm.galaxylabs.online";

  return {
    base: "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: BACKEND,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: "localhost",
        },
      },
    },
  };
});
