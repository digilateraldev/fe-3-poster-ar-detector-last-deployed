import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/eating-habit/", // Change this to your desired base path
  server: {
    host: true,
    port: 5173,
  },
});
