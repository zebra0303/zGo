import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  return {
    envDir: "..",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: parseInt(env.VITE_PORT || "5173", 10),
    },
    build: {
      rollupOptions: {
        output: {
          // perf: split vendor chunks for better cache efficiency
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-state": ["zustand", "immer", "@tanstack/react-query"],
            "vendor-i18n": ["i18next", "react-i18next"],
            "vendor-icons": ["lucide-react"],
          },
        },
      },
    },
  };
});
