import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/wiki-editor-bundle.js"),
      name: "WikiEditorBundle",
      formats: ["iife"],
      fileName: () => "wiki-ckeditor.bundle.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: "wiki-ckeditor[extname]"
      }
    },
    outDir: path.resolve(__dirname, "../public/vendor/ckeditor5"),
    emptyOutDir: true
  }
});
