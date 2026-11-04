const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { extname, resolve, sep } = require("node:path");

const root = resolve(__dirname);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};
const port = Number(process.env.PORT || 5500);

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const publicPath = (requestedPath === "/manifest.json" || requestedPath === "/manifest.webmanifest")
    ? "/public/manifest.json"
    : requestedPath.startsWith("/icons/") ? `/public${requestedPath}` : requestedPath;
  const filePath = resolve(root, `.${publicPath}`);

  if (!filePath.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404).end("Not found");
      return;
    }
    console.error("Static file read failed.", error);
    response.writeHead(500).end("Unable to read requested file");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Study Zone is available at http://127.0.0.1:${port}`);
});
