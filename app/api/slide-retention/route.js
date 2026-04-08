import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";
import { requireAdmin } from "@/lib/auth";
import SlideRetention from "@/models/SlideRetention";

export const runtime = "nodejs";

const normalizeText = (value, maxLength = 180) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
};

const sanitizeDetails = (details) => {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  try {
    const serialized = JSON.stringify(details);
    if (!serialized || serialized.length > 12000) return null;
    return JSON.parse(serialized);
  } catch {
    return null;
  }
};

const sanitizeClientInfo = (...sources) => {
  const merged = {};

  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;

    const userAgent = normalizeText(source.userAgent, 600);
    const browser = normalizeText(source.browser, 120);
    const browserName = normalizeText(source.browserName, 120);
    const browserVersion = normalizeText(source.browserVersion, 120);
    const platform = normalizeText(source.platform, 120);
    const os = normalizeText(source.os, 120);
    const device = normalizeText(source.device, 120);

    if (userAgent) merged.userAgent = userAgent;
    if (browser) merged.browser = browser;
    if (browserName) merged.browserName = browserName;
    if (browserVersion) merged.browserVersion = browserVersion;
    if (platform) merged.platform = platform;
    if (os) merged.os = os;
    if (device) merged.device = device;
  }

  return merged;
};

const sanitizeEntry = (entry, requestClientInfo = null) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;

  const retentionId = normalizeText(entry.retentionId || entry.eventId, 120);
  const sessionId = normalizeText(entry.sessionId, 120) || null;
  const method = normalizeText(entry.method, 40).toLowerCase();
  const source = normalizeText(entry.source, 40).toLowerCase();
  const presentationId = normalizeText(entry.presentationId, 120);
  const caseId = normalizeText(entry.caseId, 120);
  const deckId = normalizeText(entry.deckId || caseId, 120) || caseId;
  const presentationTitle = normalizeText(entry.presentationTitle, 180) || null;
  const deckTitle = normalizeText(entry.deckTitle, 180) || null;
  const slideId = normalizeText(entry.slideId, 180) || null;
  const slideTitle = normalizeText(entry.slideTitle, 220) || null;
  const slideType = normalizeText(entry.slideType, 40) || null;
  const startedAt = new Date(entry.startedAt);
  const endedAt = new Date(entry.endedAt);
  const rawSlideIndex = Number(entry.slideIndex);
  const rawSlideNumber = Number(entry.slideNumber);
  const rawDurationMs = Number(entry.durationMs);
  const sanitizedDetails = sanitizeDetails(entry.details);
  const clientInfo = sanitizeClientInfo(requestClientInfo, sanitizedDetails, entry);
  const durationMs = Number.isFinite(rawDurationMs)
    ? Math.max(0, Math.round(rawDurationMs))
    : Math.max(0, endedAt.getTime() - startedAt.getTime());

  if (!retentionId || !presentationId || !caseId) return null;
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) return null;
  if (!Number.isFinite(rawSlideIndex) || rawSlideIndex < 0) return null;
  if (durationMs <= 0) return null;

  return {
    retentionId,
    sessionId,
    method: method === "keygen" ? "keygen" : method === "password" ? "password" : null,
    source: source === "offline" ? "offline" : source === "online" ? "online" : null,
    presentationId,
    caseId,
    deckId,
    presentationTitle,
    deckTitle,
    slideId,
    slideIndex: Math.round(rawSlideIndex),
    slideNumber: Number.isFinite(rawSlideNumber) && rawSlideNumber > 0 ? Math.round(rawSlideNumber) : Math.round(rawSlideIndex) + 1,
    slideTitle,
    slideType,
    startedAt,
    endedAt,
    durationMs,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    durationMinutes: Number((durationMs / 60000).toFixed(4)),
    details: sanitizedDetails,
    ...clientInfo,
  };
};

export async function POST(request) {
  try {
    const auth = await requireApiAuthIfEnabled(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const requestUserId = normalizeText(body?.userId, 80);
    const effectiveUserId = auth?.user?._id?.toString?.() || requestUserId;

    if (!effectiveUserId || !mongoose.Types.ObjectId.isValid(effectiveUserId)) {
      return NextResponse.json({ error: "A valid userId is required." }, { status: 400 });
    }

    const entries = Array.isArray(body?.entries) ? body.entries : [];
    const requestClientInfo = sanitizeClientInfo(body);
    const cleanedEntries = entries.map((entry) => sanitizeEntry(entry, requestClientInfo)).filter(Boolean);

    if (!cleanedEntries.length) {
      return NextResponse.json({ error: "No valid slide retention entries provided." }, { status: 400 });
    }

    await connectDB();

    const userId = new mongoose.Types.ObjectId(effectiveUserId);
    const operations = cleanedEntries.map((entry) => ({
      updateOne: {
        filter: {
          userId,
          retentionId: entry.retentionId,
        },
        update: {
          $setOnInsert: {
            userId,
            ...entry,
          },
        },
        upsert: true,
      },
    }));

    const result = await SlideRetention.bulkWrite(operations, { ordered: false });
    const inserted =
      Number(result?.upsertedCount || 0) +
      Number(result?.insertedCount || 0);

    return NextResponse.json({
      success: true,
      received: cleanedEntries.length,
      inserted,
    });
  } catch (error) {
    console.error("Slide retention sync error:", error);
    return NextResponse.json({ error: "Failed to sync slide retention." }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200;
    const userIdParam = normalizeText(searchParams.get("userId"), 80);
    const presentationId = normalizeText(searchParams.get("presentationId"), 120);
    const caseId = normalizeText(searchParams.get("caseId"), 120);

    await connectDB();

    const query = {};
    if (userIdParam && mongoose.Types.ObjectId.isValid(userIdParam)) {
      query.userId = new mongoose.Types.ObjectId(userIdParam);
    }
    if (presentationId) {
      query.presentationId = presentationId;
    }
    if (caseId) {
      query.caseId = caseId;
    }

    const rows = await SlideRetention.find(query)
      .sort({ endedAt: -1 })
      .limit(limit)
      .populate("userId", "name email username repId")
      .lean();

    return NextResponse.json({
      records: rows.map((row) => ({
        id: row._id,
        retentionId: row.retentionId,
        sessionId: row.sessionId || null,
        method: row.method || null,
        source: row.source || null,
        presentationId: row.presentationId,
        caseId: row.caseId,
        deckId: row.deckId || row.caseId,
        presentationTitle: row.presentationTitle || null,
        deckTitle: row.deckTitle || null,
        slideId: row.slideId || null,
        slideIndex: row.slideIndex,
        slideNumber: row.slideNumber,
        slideTitle: row.slideTitle || null,
        slideType: row.slideType || null,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        durationMs: row.durationMs,
        durationSeconds: row.durationSeconds,
        durationMinutes: row.durationMinutes,
        details: row.details || null,
        userAgent: row.userAgent || null,
        browser: row.browser || null,
        browserName: row.browserName || null,
        browserVersion: row.browserVersion || null,
        platform: row.platform || null,
        os: row.os || null,
        device: row.device || null,
        user: row.userId
          ? {
              id: row.userId._id,
              name: row.userId.name,
              email: row.userId.email,
              username: row.userId.username,
              repId: row.userId.repId,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Slide retention fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch slide retention." }, { status: 500 });
  }
}
