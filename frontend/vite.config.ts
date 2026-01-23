import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from parent directory (project root) where the main .env file is located
  const env = loadEnv(mode, path.resolve(process.cwd(), ".."), "");

  // Also check process.env (set by the Go build script) as fallback
  const basePath = env.PUBLIC_BASE_PATH || process.env.PUBLIC_BASE_PATH || "";
  const appName = env.APP_NAME || process.env.APP_NAME || "AI-BASE";

  // Normalize base path - ensure it starts with / and doesn't end with /
  const normalizedBasePath = basePath
    ? basePath.replace(/\/+$/, "").replace(/^([^/])/, "/$1")
    : "";

  // Use "/" as base when basePath is empty to ensure absolute paths for assets
  // This prevents asset loading issues when refreshing on deep routes like /projects/xxx/chat
  return {
    base: normalizedBasePath || "/",
    plugins: [
      react(),
      tailwindcss(),
      // Plugin to inject APP_NAME into index.html
      {
        name: "html-transform",
        transformIndexHtml(html) {
          return html.replace(
            /<title>(.*?)<\/title>/,
            `<title>${appName}</title>`
          );
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Inject environment variables for import.meta.env usage in source code
    define: {
      "import.meta.env.PUBLIC_BASE_PATH": JSON.stringify(normalizedBasePath),
      "import.meta.env.APP_NAME": JSON.stringify(appName),
    },
    server: {
      port: 5050,
      proxy: {
        [`${normalizedBasePath}/api`]: {
          target: "http://localhost:5040", // 3678
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => path.replace(normalizedBasePath, ""),
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes("node_modules")) {
              // 1. Core React & Router - Ensure these are together and matched specifically
              if (
                id.includes("node_modules/react/") ||
                id.includes("node_modules/react-dom/") ||
                id.includes("node_modules/scheduler/") ||
                id.includes("node_modules/react-router/") ||
                id.includes("node_modules/react-router-dom/")
              ) {
                return "react-vendor";
              }

              // 2. Large specialized vendors
              if (
                id.includes("node_modules/shiki/") ||
                id.includes("node_modules/@shikijs/") ||
                id.includes("node_modules/vscode-oniguruma/") ||
                id.includes("node_modules/vscode-textmate/")
              ) {
                return "shiki-vendor";
              }

              if (
                id.includes("node_modules/mermaid/") ||
                id.includes("node_modules/khroma/") ||
                id.includes("node_modules/stylis/") ||
                id.includes("node_modules/dagre-d3-es/") ||
                id.includes("node_modules/d3-")
              ) {
                return "mermaid-vendor";
              }

              if (
                id.includes("node_modules/@codemirror/") ||
                id.includes("node_modules/@uiw/") ||
                id.includes("node_modules/@lezer/") ||
                id.includes("node_modules/codemirror")
              ) {
                return "codemirror-vendor";
              }

              if (id.includes("node_modules/echarts/") || id.includes("node_modules/zrender/")) {
                return "charts-vendor";
              }

              if (id.includes("node_modules/framer-motion/")) {
                return "framer-motion-vendor";
              }

              // 3. UI and Icons
              if (id.includes("node_modules/@radix-ui/") || id.includes("node_modules/lucide-react/")) {
                return "ui-vendor";
              }

              // 4. Content Processing
              if (
                id.includes("node_modules/react-markdown/") ||
                id.includes("node_modules/remark-") ||
                id.includes("node_modules/micromark") ||
                id.includes("node_modules/mdast") ||
                id.includes("node_modules/unist") ||
                id.includes("node_modules/hast-") ||
                id.includes("node_modules/vfile")
              ) {
                return "markdown-vendor";
              }

              // 5. Misc Utils
              if (id.includes("node_modules/html2canvas/") || id.includes("node_modules/qrcode/")) {
                return "utils-vendor";
              }

              // Everything else goes to catch-all vendor chunk
              return "vendor";
            }
          },
        },
      },
    },
  };
});
