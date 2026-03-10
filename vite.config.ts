import "dotenv/config";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import type { Plugin } from "vite";

/**
 * Vite plugin to serve runtime-generated images from public/images/.
 * React Router's SSR handler catches all requests before Vite's
 * static file server can serve files created at runtime.
 */
function serveStoryImages(): Plugin {
  return {
    name: "serve-story-images",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/images/")) return next();

        const filePath = join(process.cwd(), "public", req.url);
        if (!existsSync(filePath)) return next();

        const ext = extname(filePath).toLowerCase();
        const contentType =
          ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "application/octet-stream";

        const file = readFileSync(filePath);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.end(file);
      });
    },
  };
}

export default defineConfig({
  server: { port: 5555 },
  plugins: [
    serveStoryImages(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
});
