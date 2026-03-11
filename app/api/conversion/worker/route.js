import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { processOne } from "@/lib/conversionWorker";
import connectDB from "@/lib/db";
import Product from "@/models/Product";

export const runtime = "nodejs";

export async function POST(request) {
  const cronSecret = process.env.CONVERSION_CRON_SECRET || "";
  const providedSecret = request.headers.get("x-cron-secret") || "";
  if (!cronSecret || cronSecret !== providedSecret) {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }
  try {
    await connectDB();
    const pendingCount = await Product.countDocuments({ "media.status": "pending" });
    const result = await processOne();
    return NextResponse.json({ ok: true, pendingCount, result });
  } catch (error) {
    console.error("Conversion worker endpoint error:", error);
    return NextResponse.json({ error: "Failed to process queue." }, { status: 500 });
  }
}
