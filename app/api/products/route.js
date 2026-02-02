import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/auth";
import { isPdf, isPpt } from "@/lib/fileConverter";
import "@/lib/conversionWorker";

export const runtime = "nodejs";

const uploadsDir = path.join(process.cwd(), "public", "uploads");
const queueDir = path.join(uploadsDir, "queue");

const getMediaType = (value) => {
  const lower = value.toLowerCase();
  if (lower.includes("video") || lower.match(/\.(mp4|mov|webm|avi)$/)) return "video";
  if (lower.includes("pdf") || lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(png|jpg|jpeg|gif|webp)$/)) return "image";
  return "image";
};

const cleanFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    await connectDB();
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(products);
  } catch (error) {
    console.error("Fetch products error:", error);
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const formData = await request.formData();
    const name = String(formData.get("name") || "").trim();
    const brandName = String(formData.get("brandName") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim();
    const mediaUrls = String(formData.get("mediaUrls") || "").trim();

    if (!name || !category || !description) {
      return NextResponse.json(
        { error: "Name, category, and description are required." },
        { status: 400 }
      );
    }

    const media = [];

    if (mediaUrls) {
      mediaUrls
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
        .forEach((url) => {
          media.push({ type: getMediaType(url), url });
        });
    }

    const mediaFiles = formData.getAll("mediaFile");
    for (const mediaFile of mediaFiles) {
      if (mediaFile && typeof mediaFile === "object" && mediaFile.arrayBuffer) {
        const buffer = Buffer.from(await mediaFile.arrayBuffer());
        const filename = mediaFile.name || "upload";
        const mimeType = mediaFile.type || "";

        // Check if file is PDF or PPT/PPTX
        if (isPdf(filename, mimeType) || isPpt(filename, mimeType)) {
          await fs.mkdir(queueDir, { recursive: true });
          const ext = path.extname(filename) || ".bin";
          const safeName = cleanFilename(path.basename(filename, ext));
          const groupId = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
          const queuedFilename = `${groupId}${ext}`;
          const filePath = path.join(queueDir, queuedFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/queue/${queuedFilename}`;
          media.push({
            type: "pdf",
            url: publicUrl,
            status: "pending",
            groupId,
            sourceName: filename,
          });
        } else {
          // Regular file upload (images, videos, etc.)
          await fs.mkdir(uploadsDir, { recursive: true });
          const ext = path.extname(filename) || ".bin";
          const safeName = cleanFilename(path.basename(filename, ext));
          const newFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${ext}`;
          const filePath = path.join(uploadsDir, newFilename);
          await fs.writeFile(filePath, buffer);
          const publicUrl = `/uploads/${newFilename}`;
          media.push({ type: getMediaType(mimeType || filename), url: publicUrl });
        }
      }
    }

    await connectDB();
    const product = await Product.create({
      name,
      brandName,
      category,
      description,
      thumbnailUrl,
      media,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ 
      error: "Failed to create product.", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
