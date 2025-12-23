import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from parent directory (project root) where the main .env file is located
  const env = loadEnv(mode, path.resolve(process.cwd(), '..'), '');

  // Also check process.env (set by the Go build script) as fallback
  const basePath = env.PUBLIC_BASE_PATH || process.env.PUBLIC_BASE_PATH || "";

  // Normalize base path - ensure it starts with / and doesn't end with /
  const normalizedBasePath = basePath
    ? basePath.replace(/\/+$/, '').replace(/^([^/])/, '/$1')
    : "";

  return {
    base: normalizedBasePath,
    plugins: [react(), tailwindcss({ optimize: true })],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Inject PUBLIC_BASE_PATH for import.meta.env usage in source code
    define: {
      'import.meta.env.PUBLIC_BASE_PATH': JSON.stringify(normalizedBasePath),
    },
    server: {
      port: 5050,
      proxy: {
        [`${normalizedBasePath}/api`]: {
          target: "http://localhost:5040",
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(normalizedBasePath, ''),
        },
      },
    },
  };
});
