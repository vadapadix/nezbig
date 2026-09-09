import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//]
      },
      manifest: {
        name: "Незбіг — перевірка тексту на плагіат",
        short_name: "Незбіг",
        description: "Безкоштовна перевірка тексту на плагіат, AI-сліди та відкриті вебджерела.",
        theme_color: "#2ec4b6",
        background_color: "#fbf7ed",
        display: "standalone",
        icons: [
          { src: "/logo.jpg", sizes: "192x192", type: "image/jpeg" },
          { src: "/logo.jpg", sizes: "512x512", type: "image/jpeg" }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  },
  preview: {
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/client/testSetup.ts"],
    exclude: ["node_modules", "tests/**"]
  }
});
