import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()], 
  base: "/eating-habit/", // Change this to your desired base path
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'books-receive-switching-ebook.trycloudflare.com', 
    ],
     mimeTypes: {
      '.wasm': 'application/wasm',
    },
  },
});
