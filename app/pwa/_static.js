import { readFile } from "node:fs/promises";
import path from "node:path";

const PWA_ROOT = path.join(process.cwd(), "public", "pwa");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function getCacheControl(filePath) {
  const filename = path.basename(filePath);

  if (filename === "sw.js" || filename.startsWith("workbox-")) {
    return "no-cache, no-store, must-revalidate";
  }
  if (filename === "manifest.webmanifest" || filename === "manifest.json") {
    return "no-cache";
  }
  if (filePath.endsWith(".html")) {
    return "no-cache";
  }
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600";
}

function resolveTargetPath(slug = []) {
  const requestedPath = path.join(PWA_ROOT, ...slug);
  const normalizedPath = path.normalize(requestedPath);

  if (!normalizedPath.startsWith(PWA_ROOT)) {
    return null;
  }

  return normalizedPath;
}

async function readResponseFile(filePath) {
  const body = await readFile(filePath);
  const headers = {
    "Cache-Control": getCacheControl(filePath),
    "Content-Type": getContentType(filePath),
  };

  if (path.basename(filePath) === "sw.js") {
    headers["Service-Worker-Allowed"] = "/pwa/";
  }

  return new Response(body, {
    headers,
  });
}

export async function servePwaAsset(params = {}) {
  const slug = Array.isArray(params.slug) ? params.slug : [];
  const targetPath = resolveTargetPath(slug);

  if (!targetPath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    return await readResponseFile(targetPath);
  } catch {
    const requestedLeaf = slug.at(-1) || "";
    const isAssetRequest = requestedLeaf.includes(".");

    if (isAssetRequest) {
      return new Response("Not found", { status: 404 });
    }

    return readResponseFile(path.join(PWA_ROOT, "index.html"));
  }
}

export async function servePwaShell() {
  return readResponseFile(path.join(PWA_ROOT, "index.html"));
}
