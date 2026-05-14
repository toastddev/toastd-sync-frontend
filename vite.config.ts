import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The sync UI is embedded inside the admin app at `<admin-domain>/sync`, so
// asset URLs must be prefixed with `/sync/`. Use `VITE_BASE` to override
// (e.g. `/` for standalone dev with `npm run dev`).
const base = process.env.VITE_BASE ?? "/sync/";

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5173 },
  build: {
    // When the deploy script invokes vite, this points to admin/public/sync.
    // Default value keeps `npm run build` standalone-friendly.
    outDir: process.env.VITE_OUT_DIR ?? "dist",
    emptyOutDir: true,
  },
});
