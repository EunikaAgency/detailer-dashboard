import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ActivityLog from "@/models/ActivityLog";
import LoginEvent from "@/models/LoginEvent";
import User from "@/models/User";

export const runtime = "nodejs";

const normalizeText = (value, maxLength = 160) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, maxLength);
};

const extractClientInfo = (...sources) => {
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

  return {
    userAgent: merged.userAgent || null,
    browser: merged.browser || null,
    browserName: merged.browserName || null,
    browserVersion: merged.browserVersion || null,
    platform: merged.platform || null,
    os: merged.os || null,
    device: merged.device || null,
  };
};

const parsePositiveInt = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return Math.min(Math.max(rounded, min), max);
};

const mapUser = (user) => ({
  id: user?._id?.toString?.() || "",
  name: user?.name || "",
  email: user?.email || "",
  username: user?.username || "",
  repId: user?.repId || "",
});

const mapEvent = (event) => {
  const clientInfo = extractClientInfo(event, event?.details);

  return {
    eventId: event?.eventId || "",
    eventType: event?.eventType || "activity",
    action: event?.action || "unknown_action",
    deckTitle:
      event?.deckTitle || normalizeText(event?.details?.deckTitle || event?.details?.presentationTitle || "", 180) || null,
    screen: event?.screen || null,
    ...clientInfo,
    timestampMs: event?.timestampMs || null,
    details: event?.details || null,
    occurredAt: event?.occurredAt || null,
  };
};

const mapActivityLog = (log, user) => {
  const events = Array.isArray(log?.events) ? log.events.map(mapEvent) : [];
  const clientInfo = extractClientInfo(log, ...events, ...(Array.isArray(log?.events) ? log.events : []));

  return {
    id: log?._id,
    sessionId: log?.sessionId,
    method: log?.method,
    source: log?.source,
    ...clientInfo,
    startedAt: log?.startedAt,
    endedAt: log?.endedAt,
    lastOccurredAt: log?.lastOccurredAt,
    eventCount: log?.eventCount || events.length,
    user,
    events,
    payload: {
      sessionId: log?.sessionId,
      method: log?.method,
      source: log?.source,
      ...clientInfo,
      startedAt: log?.startedAt,
      endedAt: log?.endedAt,
      eventCount: log?.eventCount || events.length,
      events,
    },
  };
};

const filterLogByEventType = (log, eventTypeFilter) => {
  if (!eventTypeFilter) return log;

  const filteredEvents = Array.isArray(log?.events)
    ? log.events.filter((event) => event?.eventType === eventTypeFilter)
    : [];

  return {
    ...log,
    eventCount: filteredEvents.length,
    events: filteredEvents,
    payload: {
      ...log.payload,
      eventCount: filteredEvents.length,
      events: filteredEvents,
    },
  };
};

const mapLegacyEventsToLogs = (events, mappedUser) => {
  const grouped = new Map();

  for (const event of events) {
    const sessionId = normalizeText(event?.sessionId, 120) || `event-${event?.eventId || event?._id}`;
    const current = grouped.get(sessionId) || {
      id: `${mappedUser?.id || "user"}-${sessionId}`,
      sessionId,
      method: event?.method || "password",
      source: event?.source || "online",
      ...extractClientInfo(event, event?.details),
      startedAt: event?.occurredAt,
      endedAt: event?.occurredAt,
      lastOccurredAt: event?.occurredAt,
      eventCount: 0,
      user: mappedUser,
      events: [],
    };

    const eventClientInfo = extractClientInfo(event, event?.details);

    current.events.push({
      eventId: event?.eventId || String(event?._id || ""),
      eventType: event?.eventType || "activity",
      action: event?.action || "unknown_action",
      deckTitle: normalizeText(event?.details?.deckTitle || event?.details?.presentationTitle || "", 180) || null,
      screen: event?.screen || null,
      ...eventClientInfo,
      timestampMs: event?.timestampMs || null,
      details: event?.details || null,
      occurredAt: event?.occurredAt || null,
    });

    if (!current.userAgent && eventClientInfo.userAgent) current.userAgent = eventClientInfo.userAgent;
    if (!current.browser && eventClientInfo.browser) current.browser = eventClientInfo.browser;
    if (!current.browserName && eventClientInfo.browserName) current.browserName = eventClientInfo.browserName;
    if (!current.browserVersion && eventClientInfo.browserVersion) current.browserVersion = eventClientInfo.browserVersion;
    if (!current.platform && eventClientInfo.platform) current.platform = eventClientInfo.platform;
    if (!current.os && eventClientInfo.os) current.os = eventClientInfo.os;
    if (!current.device && eventClientInfo.device) current.device = eventClientInfo.device;

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
        eventCount: sortedEvents.length,
        events: sortedEvents,
        payload: {
          sessionId: log.sessionId,
          method: log.method,
          source: log.source,
          userAgent: log.userAgent || null,
          browser: log.browser || null,
          browserName: log.browserName || null,
          browserVersion: log.browserVersion || null,
          platform: log.platform || null,
          os: log.os || null,
          device: log.device || null,
          startedAt: log.startedAt,
          endedAt: log.endedAt,
          eventCount: sortedEvents.length,
          events: sortedEvents,
        },
      };
    })
    .sort((left, right) => new Date(right?.lastOccurredAt || 0).getTime() - new Date(left?.lastOccurredAt || 0).getTime());
};

export async function GET(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const resolvedParams = await params;
    const userId = String(resolvedParams?.id || "").trim();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parsePositiveInt(searchParams.get("limit"), 50, 1, 500);
    const page = parsePositiveInt(searchParams.get("page"), 1, 1, 100000);
    const eventTypeRaw = normalizeText(searchParams.get("eventType")).toLowerCase();

    if (eventTypeRaw && eventTypeRaw !== "activity" && eventTypeRaw !== "login") {
      return NextResponse.json({ error: "eventType must be either 'activity' or 'login'." }, { status: 400 });
    }

    await connectDB();

    const resolvedUserId = new mongoose.Types.ObjectId(userId);
    const logQuery = { userId: resolvedUserId };
    if (eventTypeRaw) {
      logQuery["events.eventType"] = eventTypeRaw;
    }

    const [user, totalLogs] = await Promise.all([
      User.findById(userId).select("name email username repId").lean(),
      ActivityLog.countDocuments(logQuery),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const skip = (page - 1) * limit;
    const logs = await ActivityLog.find(logQuery)
      .sort({ lastOccurredAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const mappedUser = mapUser(user);

    let mappedLogs = logs.map((log) => mapActivityLog(log, mappedUser));
    if (!mappedLogs.length) {
      const legacyQuery = { userId: resolvedUserId };
      if (eventTypeRaw) {
        legacyQuery.eventType = eventTypeRaw;
      }

      const legacyEvents = await LoginEvent.find(legacyQuery)
        .sort({ occurredAt: -1 })
        .limit(limit)
        .lean();
      mappedLogs = mapLegacyEventsToLogs(legacyEvents, mappedUser);
    }

    const filteredLogs = eventTypeRaw
      ? mappedLogs.map((log) => filterLogByEventType(log, eventTypeRaw)).filter((log) => log.eventCount > 0)
      : mappedLogs;

    const events = filteredLogs.flatMap((log) =>
      (log.events || []).map((event) => ({
        id: `${log.id}-${event.eventId}`,
        eventId: event.eventId,
        eventType: event.eventType,
        method: log.method,
        source: log.source,
        action: event.action,
        deckTitle: event.deckTitle || null,
        screen: event.screen,
        userAgent: event.userAgent || null,
        browser: event.browser || null,
        browserName: event.browserName || null,
        browserVersion: event.browserVersion || null,
        platform: event.platform || null,
        os: event.os || null,
        device: event.device || null,
        sessionId: log.sessionId,
        timestampMs: event.timestampMs,
        details: event.details,
        occurredAt: event.occurredAt,
        user: log.user,
      }))
    );

    const totalPages = Math.max(1, Math.ceil(totalLogs / limit));

    return NextResponse.json({
      user: mappedUser,
      filters: {
        userId,
        eventType: eventTypeRaw || null,
      },
      pagination: {
        page,
        limit,
        total: totalLogs,
        totalPages,
        hasNextPage: page < totalPages,
      },
      logs: filteredLogs,
      events,
    });
  } catch (error) {
    console.error("User activity logs fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch user activity logs." }, { status: 500 });
  }
}
