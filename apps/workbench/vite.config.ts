import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// .evolution/ lives at the workspace root (two levels up from apps/workbench/)
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const EVOLUTION_DIR = path.join(WORKSPACE_ROOT, ".evolution");
const DEMOS_DIR = path.join(EVOLUTION_DIR, "demos");

/**
 * Vite plugin that provides a local REST API for .evolution/ folder management.
 *
 * Routes (all under /api/demos):
 *   GET    /api/demos      — list all demonstrations (sorted by timestamp)
 *   POST   /api/demos      — save a demonstration to .evolution/demos/{id}.json
 *   DELETE /api/demos/:id  — remove .evolution/demos/{id}.json
 *
 * Only active during `vite dev`. Not included in production builds.
 */
function evolutionPlugin(): Plugin {
  return {
    name: "evolution-store",
    configureServer(server) {
      fs.mkdirSync(DEMOS_DIR, { recursive: true });

      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/api/demos")) return next();

        const suffix = req.url.slice("/api/demos".length); // "" | "/" | "/{id}"
        const id = suffix.replace(/^\//, "");              // "" or "{id}"

        res.setHeader("Content-Type", "application/json");

        // GET /api/demos — list all demos sorted by timestamp
        if (req.method === "GET" && !id) {
          const files = fs.readdirSync(DEMOS_DIR).filter((f) => f.endsWith(".json"));
          const demos = files
            .map((f) => {
              try {
                return JSON.parse(fs.readFileSync(path.join(DEMOS_DIR, f), "utf-8"));
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
          res.end(JSON.stringify(demos));
          return;
        }

        // POST /api/demos — write {id}.json
        if (req.method === "POST" && !id) {
          let body = "";
          req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
          req.on("end", () => {
            try {
              const demo = JSON.parse(body);
              if (!demo.id) throw new Error("Demo must have an id");
              fs.writeFileSync(
                path.join(DEMOS_DIR, `${demo.id}.json`),
                JSON.stringify(demo, null, 2),
              );
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: String(e) }));
            }
          });
          return;
        }

        // DELETE /api/demos/:id — remove {id}.json
        if (req.method === "DELETE" && id) {
          const file = path.join(DEMOS_DIR, `${id}.json`);
          if (fs.existsSync(file)) fs.unlinkSync(file);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), evolutionPlugin()],
  server: {
    port: 5173,
  },
});
