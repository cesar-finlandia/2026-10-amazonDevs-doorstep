// Requirement IDs: HEE-KIT-01
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: "index.html",
        lab: "src/demo/lab.html",
        vanilla: "src/demo/vanilla.html",
      },
    },
  },
  server: {
    port: 5173,
  },
});
