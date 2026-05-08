import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/wiki-editor-bundle.js"),
      name: "WestgateWikiEditor",
      formats: ["iife"],
      fileName: () => "wiki-tiptap.bundle.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: "wiki-tiptap[extname]"
      }
    },
    outDir: path.resolve(__dirname, "../public/vendor/tiptap"),
    emptyOutDir: true
  }
});
