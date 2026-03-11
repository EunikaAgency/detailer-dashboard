import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const appRoot = path.resolve(process.cwd(), "app-capacitor", "dist");

const MIME_BY_EXT = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".otf", "font/otf"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webm", "video/webm"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

const getContentType = (filePath) =>
  MIME_BY_EXT.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";

const sanitizeSegments = async (paramsPromise) => {
  const params = await paramsPromise;
  const rawSegments = Array.isArray(params?.segments) ? params.segments : [];

  return rawSegments
    .map((segment) => {
      try {
        return decodeURIComponent(String(segment || ""));
      } catch {
        return "";
      }
    })
    .filter(Boolean);
};

const resolveFilePath = (segments) => {
  if (segments.some((segment) => segment.startsWith("."))) return null;
  const requestedPath = segments.length ? segments : ["index.html"];
  const absolutePath = path.resolve(appRoot, ...requestedPath);
  const rootWithSep = `${appRoot}${path.sep}`;

  if (absolutePath !== appRoot && !absolutePath.startsWith(rootWithSep)) return null;
  return absolutePath;
};

const parseRange = (rangeHeader, fileSize) => {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const range = rangeHeader.replace("bytes=", "").trim();
  const [startText, endText] = range.split("-", 2);
  if (!startText && !endText) return null;

  let start = Number.parseInt(startText, 10);
  let end = Number.parseInt(endText, 10);

  if (Number.isNaN(start)) {
    const suffixLength = Number.parseInt(endText, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else if (Number.isNaN(end)) {
    end = fileSize - 1;
  }

  if (start < 0 || end < 0 || start > end || start >= fileSize) return null;
  end = Math.min(end, fileSize - 1);
  return { start, end };
};

const buildHeaders = (filePath, stat, cacheControl) => {
  const headers = new Headers();
  headers.set("Content-Type", getContentType(filePath));
  headers.set("Cache-Control", cacheControl);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(stat.size));
  return headers;
};

const getCacheControl = (filePath) => {
  const normalized = filePath.replaceAll("\\", "/");
  const ext = path.extname(filePath).toLowerCase();

  if (normalized.endsWith("/service-worker.js")) {
    return "public, max-age=0, must-revalidate";
  }

  if (normalized.endsWith("/manifest.webmanifest")) {
    return "public, max-age=0, must-revalidate";
  }

  if (ext === ".html") {
    return "no-store";
  }

  return "public, max-age=31536000, immutable";
};

const serveFile = async (request, paramsPromise, method = "GET") => {
  const segments = await sanitizeSegments(paramsPromise);
  const filePath = resolveFilePath(segments);
  if (!filePath) {
    return new Response("Not Found", { status: 404 });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    const looksLikeAssetRequest = segments.some((segment) => segment.includes("."));
    if (looksLikeAssetRequest) {
      return new Response("Not Found", { status: 404 });
    }

    const indexPath = path.join(appRoot, "index.html");
    try {
      stat = await fs.stat(indexPath);
      const headers = buildHeaders(indexPath, stat, "no-store");
      if (method === "HEAD") {
        return new Response(null, { status: 200, headers });
      }
      const stream = createReadStream(indexPath);
      return new Response(Readable.toWeb(stream), { status: 200, headers });
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }

  if (!stat.isFile()) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = buildHeaders(filePath, stat, getCacheControl(filePath));
  const rangeHeader = request.headers.get("range");
  const parsedRange = parseRange(rangeHeader, stat.size);

  if (rangeHeader && !parsedRange) {
    headers.set("Content-Range", `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (parsedRange) {
    const { start, end } = parsedRange;
    const chunkSize = end - start + 1;
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    headers.set("Content-Length", String(chunkSize));
    if (method === "HEAD") {
      return new Response(null, { status: 206, headers });
    }
    const stream = createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream), { status: 206, headers });
  }

  if (method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream), { status: 200, headers });
};

export async function GET(request, context) {
  return serveFile(request, context?.params, "GET");
}

export async function HEAD(request, context) {
  return serveFile(request, context?.params, "HEAD");
}
