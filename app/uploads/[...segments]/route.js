import { createReadStream } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");

const MIME_BY_EXT = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".bmp", "image/bmp"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".avi", "video/x-msvideo"],
  [".pdf", "application/pdf"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".html", "text/html; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
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
  const absolutePath = path.resolve(uploadsRoot, ...segments);
  const rootWithSep = `${uploadsRoot}${path.sep}`;
  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(rootWithSep)) return null;
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

const serveFile = async (request, paramsPromise, method = "GET") => {
  const segments = await sanitizeSegments(paramsPromise);
  if (!segments.length) {
    return new Response("Not Found", { status: 404 });
  }

  const filePath = resolveFilePath(segments);
  if (!filePath) {
    return new Response("Not Found", { status: 404 });
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  if (!stat.isFile()) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", getContentType(filePath));
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(stat.size));

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
