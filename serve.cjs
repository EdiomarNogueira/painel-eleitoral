const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "dist");
const sharedRoot = new URL(
  "https://ediomarnogueira.github.io/painel-eleitoral/",
);

function contentType(filename) {
  if (filename.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filename.endsWith(".css")) return "text/css; charset=utf-8";
  if (filename.endsWith(".json")) return "application/json; charset=utf-8";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
    return "image/jpeg";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".svg")) return "image/svg+xml";
  return "text/html; charset=utf-8";
}

function localFile(pathname, res) {
  const filename = path.resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!filename.startsWith(root + path.sep)) {
    res.writeHead(403, { "Cache-Control": "no-store" });
    res.end();
    return;
  }
  fs.readFile(filename, (error, data) => {
    if (error) {
      res.writeHead(404, {
        "Cache-Control": "no-store",
        "X-Painel-Snapshot-Source": "local",
      });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType(filename),
      "Cache-Control": "no-store",
      "X-Painel-Snapshot-Source": "local",
    });
    res.end(data);
  });
}

http
  .createServer(async (req, res) => {
    let requestUrl;
    let pathname;
    try {
      requestUrl = new URL(req.url, "http://localhost");
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      res.writeHead(400, { "Cache-Control": "no-store" });
      res.end();
      return;
    }

    if (pathname.startsWith("/data/tse/")) {
      const segments = pathname.split("/").filter(Boolean);
      if (
        segments.some(
          (part) => part === "." || part === ".." || /[\\/]/.test(part),
        )
      ) {
        res.writeHead(403, { "Cache-Control": "no-store" });
        res.end();
        return;
      }
      // A coleta local corrigida tem prioridade. Use PAINEL_REMOTE=1 para inspecionar a publicação.
      const snapshotPath = path.resolve(root, "." + pathname);
      if (
        process.env.PAINEL_REMOTE !== "1" &&
        snapshotPath.startsWith(root + path.sep) &&
        fs.existsSync(snapshotPath)
      ) {
        localFile(pathname, res);
        return;
      }
      const upstream = new URL(segments.join("/"), sharedRoot);
      upstream.search = requestUrl.search;
      try {
        const response = await fetch(upstream, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const data = Buffer.from(await response.arrayBuffer());
          res.writeHead(response.status, {
            "Content-Type":
              response.headers.get("content-type") || contentType(pathname),
            "Cache-Control": "no-store",
            "X-Painel-Snapshot-Source": "github-pages",
          });
          res.end(data);
          return;
        }
        console.warn(
          `Snapshot compartilhado respondeu HTTP ${response.status} (${pathname}); usando cópia local.`,
        );
      } catch (error) {
        console.warn(
          `Snapshot compartilhado indisponível (${error.message}); usando cópia local.`,
        );
      }
    }

    localFile(pathname, res);
  })
  .listen(4173, "127.0.0.1", () =>
    console.log("Painel Eleitoral 2026: http://127.0.0.1:4173/"),
  );
