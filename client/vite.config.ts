import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  return {
    envDir: "..",
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["zgo_logo.png", "igo_logo.png"],
        manifest: {
          name: "zGo - AI Go Friend",
          short_name: "zGo",
          description: "AI와 함께하는 바둑 친구",
          theme_color: "#f3f4f6",
          background_color: "#f3f4f6",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          icons: [
            {
              src: "/zgo_logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: [
            "**/*.{ico,png,svg,jpg,jpeg,webp,woff,woff2,ttf,mp3,m4a}",
          ],
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              },
            },
          ],
        },
      }),
    ],
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
