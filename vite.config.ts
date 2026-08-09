import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    rollupOptions: {
      input: {
        homepage: fileURLToPath(new URL("./index.html", import.meta.url)),
        kleinBottle: fileURLToPath(
          new URL("./play/klein-bottle/index.html", import.meta.url),
        ),
      },
    },
  },
});
