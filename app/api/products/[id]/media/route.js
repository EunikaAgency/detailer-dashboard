import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

const uploadsDir = path.join(process.cwd(), "public", "uploads");

const getMediaType = (value) => {
  const lower = value.toLowerCase();
  if (lower.includes("video") || lower.match(/\.(mp4|mov|webm|avi)$/)) return "video";
  if (lower.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) return "image";
  return "image";
};

const cleanFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

const getIdFromRequest = (request, params) => {
  if (params?.id) return params.id;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 2] || "";
};

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    const formData = await request.formData();
    const mediaFiles = formData.getAll("mediaFile");
    if (!mediaFiles.length) {
      return NextResponse.json({ error: "No media files provided." }, { status: 400 });
    }

    const additions = [];
    for (const mediaFile of mediaFiles) {
      if (mediaFile && typeof mediaFile === "object" && mediaFile.arrayBuffer) {
        await fs.mkdir(uploadsDir, { recursive: true });
        const buffer = Buffer.from(await mediaFile.arrayBuffer());
        const ext = path.extname(mediaFile.name || "") || ".bin";
        const safeName = cleanFilename(path.basename(mediaFile.name || "upload", ext));
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        await fs.writeFile(filePath, buffer);
        const publicUrl = `/uploads/${filename}`;
        additions.push({ type: getMediaType(mediaFile.type || filename), url: publicUrl });
      }
    }

    await connectDB();
    const product = await Product.findByIdAndUpdate(
      id,
      { $push: { media: { $each: additions } } },
      { new: true }
    );

    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Update product media error:", error);
    return NextResponse.json({ error: "Failed to update product media." }, { status: 500 });
  }
}
