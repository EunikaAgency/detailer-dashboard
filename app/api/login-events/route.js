import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { requireApiAuthIfEnabled } from "@/lib/apiAccess";
import { requireAdmin } from "@/lib/auth";
import ActivityLog from "@/models/ActivityLog";
import LoginEvent from "@/models/LoginEvent";

export const runtime = "nodejs";

const normalizeText = (value, maxLength = 160) => {
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

const sanitizeEvent = (event) => {
  if (!event || typeof event !== "object") return null;
  const eventId = normalizeText(event.eventId, 120);
  const method = String(event.method || "").trim().toLowerCase();
  const source = String(event.source || "").trim().toLowerCase();
  const occurredAt = new Date(event.occurredAt);
  const eventType = String(event.eventType || "").trim().toLowerCase() === "activity" ? "activity" : "login";
  const action = normalizeText(event.action, 120) || "login_success";
  const screen = normalizeText(event.screen, 80) || null;
  const sessionId = normalizeText(event.sessionId, 120) || null;
  const details = sanitizeDetails(event.details);
  const deckTitle = normalizeText(
    event.deckTitle || details?.deckTitle || details?.presentationTitle || "",
    180
  ) || null;
  const rawTimestampMs = Number(event.timestampMs);
  const timestampMs = Number.isFinite(rawTimestampMs) ? Math.round(rawTimestampMs) : occurredAt.getTime();

  if (!eventId) return null;
  if (method !== "password" && method !== "keygen") return null;
  if (source !== "online" && source !== "offline") return null;
  if (Number.isNaN(occurredAt.getTime())) return null;

  return {
    eventId,
    eventType,
    method,
    source,
    action,
    deckTitle,
    screen,
    sessionId,
    timestampMs,
    details,
    occurredAt,
  };
};

const toStoredEvent = (event) => ({
  eventId: event.eventId,
  eventType: event.eventType,
  action: event.action,
  deckTitle: event.deckTitle,
  screen: event.screen,
  timestampMs: event.timestampMs,
  details: event.details,
  occurredAt: event.occurredAt,
});

const buildSessionKey = (event) => event.sessionId || `event-${event.eventId}`;

const groupBySession = (events) => {
  const grouped = new Map();
  for (const event of events) {
    const sessionKey = buildSessionKey(event);
    const group = grouped.get(sessionKey) || {
      sessionId: sessionKey,
      method: event.method,
      source: event.source,
      events: [],
    };
    group.events.push(event);
    grouped.set(sessionKey, group);
  }
  for (const group of grouped.values()) {
    group.events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  }
  return Array.from(grouped.values());
};

const mapLegacyEventsToLogs = (events) => {
  const grouped = new Map();
  for (const event of events) {
    const sessionId = normalizeText(event?.sessionId, 120) || `event-${event?.eventId || event?._id}`;
    const current = grouped.get(sessionId) || {
      id: `${event?.userId?._id || "user"}-${sessionId}`,
      sessionId,
      method: event?.method || "password",
      source: event?.source || "online",
      startedAt: event?.occurredAt,
      endedAt: event?.occurredAt,
      lastOccurredAt: event?.occurredAt,
      eventCount: 0,
      user: event?.userId
        ? {
            id: event.userId._id,
            name: event.userId.name,
            email: event.userId.email,
            username: event.userId.username,
            repId: event.userId.repId,
          }
        : null,
      events: [],
    };

    current.events.push({
      eventId: event?.eventId || String(event?._id || ""),
      eventType: event?.eventType || "activity",
      action: event?.action || "unknown_action",
      deckTitle: normalizeText(event?.deckTitle || event?.details?.deckTitle || "", 180) || null,
      screen: event?.screen || null,
      timestampMs: event?.timestampMs || null,
      details: event?.details || null,
      occurredAt: event?.occurredAt || null,
    });

    current.eventCount = current.events.length;
    if (!current.startedAt || new Date(event?.occurredAt || 0).getTime() < new Date(current.startedAt || 0).getTime()) {
      current.startedAt = event?.occurredAt || current.startedAt;
    }
    if (!current.endedAt || new Date(event?.occurredAt || 0).getTime() > new Date(current.endedAt || 0).getTime()) {
      current.endedAt = event?.occurredAt || current.endedAt;
      current.lastOccurredAt = current.endedAt;
    }
    grouped.set(sessionId, current);
  }

  return Array.from(grouped.values())
    .map((log) => {
      const sortedEvents = log.events.sort(
        (left, right) => new Date(left?.occurredAt || 0).getTime() - new Date(right?.occurredAt || 0).getTime()
      );
      return {
        ...log,
        events: sortedEvents,
        payload: {
          sessionId: log.sessionId,
          method: log.method,
          source: log.source,
          startedAt: log.startedAt,
          endedAt: log.endedAt,
          eventCount: sortedEvents.length,
          events: sortedEvents,
        },
      };
    })
    .sort((left, right) => new Date(right?.lastOccurredAt || 0).getTime() - new Date(left?.lastOccurredAt || 0).getTime());
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
      return NextResponse.json(
        { error: "A valid userId is required when login is not provided." },
        { status: 400 }
      );
    }
    const resolvedUserId = new mongoose.Types.ObjectId(effectiveUserId);

    const events = Array.isArray(body?.events) ? body.events : [];
    const cleaned = events.map(sanitizeEvent).filter(Boolean);

    if (!cleaned.length) {
      return NextResponse.json({ error: "No valid events provided." }, { status: 400 });
    }

    await connectDB();

    const sessionGroups = groupBySession(cleaned);
    let inserted = 0;
    let updatedLogs = 0;

    for (const group of sessionGroups) {
      const existing = await ActivityLog.findOne({
        userId: resolvedUserId,
        sessionId: group.sessionId,
      });

      if (!existing) {
        const initialEvents = group.events.map(toStoredEvent);
        if (!initialEvents.length) continue;
        const startedAt = initialEvents[0].occurredAt;
        const endedAt = initialEvents[initialEvents.length - 1].occurredAt;
        await ActivityLog.create({
          userId: resolvedUserId,
          sessionId: group.sessionId,
          method: group.method,
          source: group.source,
          startedAt,
          endedAt,
          lastOccurredAt: endedAt,
          eventCount: initialEvents.length,
          events: initialEvents,
        });
        inserted += initialEvents.length;
        updatedLogs += 1;
        continue;
      }

      const existingIds = new Set(existing.events.map((item) => item.eventId));
      const uniqueIncoming = group.events
        .filter((item) => !existingIds.has(item.eventId))
        .map(toStoredEvent);

      if (!uniqueIncoming.length) continue;

      existing.events.push(...uniqueIncoming);
      existing.events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
      existing.eventCount = existing.events.length;
      existing.startedAt = existing.events[0].occurredAt;
      existing.endedAt = existing.events[existing.events.length - 1].occurredAt;
      existing.lastOccurredAt = existing.endedAt;
      if (!existing.method) existing.method = group.method;
      if (!existing.source) existing.source = group.source;
      await existing.save();

      inserted += uniqueIncoming.length;
      updatedLogs += 1;
    }

    return NextResponse.json({
      success: true,
      received: cleaned.length,
      inserted,
      sessions: sessionGroups.length,
      updatedLogs,
    });
  } catch (error) {
    console.error("Login events sync error:", error);
    return NextResponse.json({ error: "Failed to sync login events." }, { status: 500 });
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

    await connectDB();
    const logs = await ActivityLog.find()
      .sort({ lastOccurredAt: -1 })
      .limit(limit)
      .populate("userId", "name email username repId")
      .lean();

    const mappedLogs = logs.map((log) => {
      const mappedUser = log.userId
        ? {
            id: log.userId._id,
            name: log.userId.name,
            email: log.userId.email,
            username: log.userId.username,
            repId: log.userId.repId,
          }
        : null;

      const mappedEvents = Array.isArray(log.events)
        ? log.events.map((event) => ({
            eventId: event.eventId,
            eventType: event.eventType || "activity",
            action: event.action || "unknown_action",
            deckTitle: event.deckTitle || normalizeText(event?.details?.deckTitle || "", 180) || null,
            screen: event.screen || null,
            timestampMs: event.timestampMs || null,
            details: event.details || null,
            occurredAt: event.occurredAt,
          }))
        : [];

      return {
        id: log._id,
        sessionId: log.sessionId,
        method: log.method,
        source: log.source,
        startedAt: log.startedAt,
        endedAt: log.endedAt,
        lastOccurredAt: log.lastOccurredAt,
        eventCount: log.eventCount || mappedEvents.length,
        user: mappedUser,
        events: mappedEvents,
        payload: {
          sessionId: log.sessionId,
          method: log.method,
          source: log.source,
          startedAt: log.startedAt,
          endedAt: log.endedAt,
          eventCount: log.eventCount || mappedEvents.length,
          events: mappedEvents,
        },
      };
    });

    let effectiveLogs = mappedLogs;
    if (!effectiveLogs.length) {
      const legacyEvents = await LoginEvent.find()
        .sort({ occurredAt: -1 })
        .limit(limit)
        .populate("userId", "name email username repId")
        .lean();
      effectiveLogs = mapLegacyEventsToLogs(legacyEvents);
    }

    const flatEvents = effectiveLogs.flatMap((log) =>
      log.events.map((event) => ({
        id: `${log.id}-${event.eventId}`,
        eventId: event.eventId,
        eventType: event.eventType,
        method: log.method,
        source: log.source,
        action: event.action,
        deckTitle: event.deckTitle || null,
        screen: event.screen,
        sessionId: log.sessionId,
        timestampMs: event.timestampMs,
        details: event.details,
        occurredAt: event.occurredAt,
        user: log.user,
      }))
    );

    return NextResponse.json({
      logs: effectiveLogs,
      events: flatEvents,
    });
  } catch (error) {
    console.error("Login events fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch login events." }, { status: 500 });
  }
}
