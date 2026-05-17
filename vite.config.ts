import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
      // `CompanionAvatar` loads pixel poses from `Avatars and Scenes/Poses/` (outside `client/` root).
      allow: [path.resolve(import.meta.dirname)],
    },
    // Used when merging into middleware-mode server (`server/vite.ts`). Helps file watcher ignore noisy dirs.
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**"],
    },
  },
});
