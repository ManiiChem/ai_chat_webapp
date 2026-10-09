import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const FLASK_URL = "http://127.0.0.1:5000"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    // while developing, api calls get passed on to flask so the browser sees one site and the login cookie just works
    proxy: {
      "/auth": FLASK_URL,
      "/ai": FLASK_URL,
    },
  },
})
