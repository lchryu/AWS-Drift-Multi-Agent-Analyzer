import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig(({ command }) => {
  // which view is being built?
  const view = process.env.VIEW;

  if (!view) throw new Error("Please set VIEW=treeView or VIEW=editorView");

  return {
    plugins: [react(), svgr()],
    base: "./",
    build: {
      outDir: resolve(__dirname, `../out/${view}`),
      emptyOutDir: true,
      rollupOptions: {
        input: resolve(__dirname, `${view}/index.html`),
      },
    },
  };
});
