import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The sync UI is embedded inside the admin app at `<admin-domain>/sync`, so
// asset URLs must be prefixed with `/sync/`. The parent admin's GitHub Actions
// workflow sets `VITE_APP_BASE=/sync` before building. Default to `/` so
// standalone `npm run dev` / `npm run build` still works.
const rawBase = process.env.VITE_APP_BASE ?? "/";
const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5173 },
});
