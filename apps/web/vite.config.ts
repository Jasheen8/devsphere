import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@memora/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@memora/template-engine": path.resolve(
        __dirname,
        "../../packages/template-engine/src",
      ),
    },
  },
  server: { port: 5173 },
  build: { target: "es2022" },
});
