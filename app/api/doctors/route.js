import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Doctor from "@/models/Doctor";
import { requireAuth } from "@/lib/auth";

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await connectDB();
    const doctors = await Doctor.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json(doctors);
  } catch (error) {
    console.error("Fetch doctors error:", error);
    return NextResponse.json({ error: "Failed to fetch doctors." }, { status: 500 });
  }
}
