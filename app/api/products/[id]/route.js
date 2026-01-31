import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/auth";
import path from "path";
import { promises as fs } from "fs";

const getIdFromRequest = (request, params) => {
  if (params?.id) return params.id;
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    const payload = await request.json();
    await connectDB();
    const existing = await Product.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const nextMedia = Array.isArray(payload.media) ? payload.media : existing.media;
    const existingUrls = new Set((existing.media || []).map((item) => item.url));
    const nextUrls = new Set((nextMedia || []).map((item) => item.url));
    const removedUrls = Array.from(existingUrls).filter((url) => !nextUrls.has(url));

    for (const url of removedUrls) {
      if (typeof url !== "string") continue;
      if (!url.startsWith("/uploads/")) continue;
      const filePath = path.join(process.cwd(), "public", url);
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore missing files
      }
    }

    const updated = await Product.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Failed to update product." }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const id = getIdFromRequest(request, params);
    if (!id) {
      return NextResponse.json({ error: "Product id is required." }, { status: 400 });
    }

    await connectDB();
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Failed to delete product." }, { status: 500 });
  }
}
