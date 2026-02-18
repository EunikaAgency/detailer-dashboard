import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import LoginEvent from "@/models/LoginEvent";

export const runtime = "nodejs";

const sanitizeEvent = (event) => {
  if (!event || typeof event !== "object") return null;
  const eventId = String(event.eventId || "").trim();
  const method = String(event.method || "").trim().toLowerCase();
  const source = String(event.source || "").trim().toLowerCase();
  const occurredAt = new Date(event.occurredAt);

  if (!eventId) return null;
  if (method !== "password" && method !== "keygen") return null;
  if (source !== "online" && source !== "offline") return null;
  if (Number.isNaN(occurredAt.getTime())) return null;

  return { eventId, method, source, occurredAt };
};

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body?.events) ? body.events : [];
    const cleaned = events.map(sanitizeEvent).filter(Boolean);

    if (!cleaned.length) {
      return NextResponse.json({ error: "No valid events provided." }, { status: 400 });
    }

    await connectDB();

    const bulkOps = cleaned.map((event) => ({
      updateOne: {
        filter: { eventId: event.eventId },
        update: {
          $setOnInsert: {
            ...event,
            userId: auth.user._id,
          },
        },
        upsert: true,
      },
    }));

    const result = await LoginEvent.bulkWrite(bulkOps, { ordered: false });

    return NextResponse.json({
      success: true,
      inserted: result?.upsertedCount || 0,
      received: cleaned.length,
    });
  } catch (error) {
    console.error("Login events sync error:", error);
    return NextResponse.json({ error: "Failed to sync login events." }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;

    await connectDB();
    const events = await LoginEvent.find()
      .sort({ occurredAt: -1 })
      .limit(limit)
      .populate("userId", "name email")
      .lean();

    return NextResponse.json({
      events: events.map((event) => ({
        id: event._id,
        eventId: event.eventId,
        method: event.method,
        source: event.source,
        occurredAt: event.occurredAt,
        user: event.userId
          ? {
              id: event.userId._id,
              name: event.userId.name,
              email: event.userId.email,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Login events fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch login events." }, { status: 500 });
  }
}
