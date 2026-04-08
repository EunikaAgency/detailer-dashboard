import { apiClient, type SlideRetentionEntry, type SlideRetentionRequest } from "./api";
import { getAccountProfile, refreshToken } from "./auth";
import {
  deleteSyncQueueItems,
  getAppMeta,
  getSyncQueueItems,
  setAppMeta,
  upsertSyncQueueItem,
  type SyncQueueItem,
} from "./indexed-db";

interface SlideRetentionInput {
  sessionId?: string;
  presentationId: string;
  caseId: string;
  deckId?: string;
  presentationTitle?: string;
  deckTitle?: string;
  slideId?: string;
  slideIndex: number;
  slideNumber?: number;
  slideTitle?: string;
  slideType?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  details?: Record<string, unknown>;
}

const SLIDE_RETENTION_QUEUE_PREFIX = "slide-retention-sync:";
const LAST_SYNC_META_KEY = "slideRetentionSync:lastResult";
let slideRetentionSyncInitialized = false;

function getAuthSource(): "online" | "offline" {
  try {
    return localStorage.getItem("authToken") === "offline-granted" ? "offline" : "online";
  } catch {
    return "online";
  }
}

function getAuthMethod(): string {
  try {
    const offlineAuth = localStorage.getItem("offlineAuth");
    if (!offlineAuth) {
      return "password";
    }

    const parsed = JSON.parse(offlineAuth) as { method?: string };
    return parsed?.method === "keygen" ? "keygen" : "password";
  } catch {
    return "password";
  }
}

function getRuntimeClientInfo() {
  if (typeof navigator === "undefined") {
    return {};
  }

  const userAgent = String(navigator.userAgent || "").trim();
  const platform = String(navigator.platform || "").trim();

  return {
    userAgent: userAgent || undefined,
    platform: platform || undefined,
  };
}

function createRetentionId() {
  return `ret-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildQueueId(retentionId: string) {
  return `${SLIDE_RETENTION_QUEUE_PREFIX}${retentionId}`;
}

function buildQueueItem(entry: SlideRetentionEntry): SyncQueueItem<SlideRetentionEntry> {
  return {
    id: buildQueueId(entry.retentionId),
    eventId: entry.retentionId,
    eventType: "slide_retention",
    payload: entry,
    createdAt: new Date(entry.endedAt).getTime(),
    retryCount: 0,
    lastError: null,
    syncState: "pending",
  };
}

function getSlideRetentionQueueItems(items: SyncQueueItem<SlideRetentionEntry>[]) {
  return items.filter((item) => item.id.startsWith(SLIDE_RETENTION_QUEUE_PREFIX));
}

async function updateQueuedEntries(
  items: SyncQueueItem<SlideRetentionEntry>[],
  updates: Partial<Pick<SyncQueueItem<SlideRetentionEntry>, "retryCount" | "lastError" | "syncState">>
) {
  await Promise.all(
    items.map((item) =>
      upsertSyncQueueItem({
        ...item,
        ...updates,
      })
    )
  );
}

function buildEntry(input: SlideRetentionInput): SlideRetentionEntry | null {
  const presentationId = String(input.presentationId || "").trim();
  const caseId = String(input.caseId || "").trim();
  const slideIndex = Number.isFinite(input.slideIndex) ? Math.max(0, Math.round(input.slideIndex)) : -1;
  const startedAtMs = Number.isFinite(input.startedAt) ? Math.round(input.startedAt) : NaN;
  const endedAtMs = Number.isFinite(input.endedAt) ? Math.round(input.endedAt as number) : Date.now();
  const durationMs = Number.isFinite(input.durationMs)
    ? Math.max(0, Math.round(input.durationMs as number))
    : Math.max(0, endedAtMs - startedAtMs);

  if (!presentationId || !caseId || slideIndex < 0 || !Number.isFinite(startedAtMs) || durationMs <= 0) {
    return null;
  }

  return {
    retentionId: createRetentionId(),
    sessionId: input.sessionId,
    method: getAuthMethod(),
    source: getAuthSource(),
    presentationId,
    caseId,
    deckId: String(input.deckId || caseId).trim() || caseId,
    presentationTitle: String(input.presentationTitle || "").trim() || undefined,
    deckTitle: String(input.deckTitle || "").trim() || undefined,
    slideId: String(input.slideId || "").trim() || undefined,
    slideIndex,
    slideNumber: Number.isFinite(input.slideNumber) ? Math.max(1, Math.round(input.slideNumber as number)) : slideIndex + 1,
    slideTitle: String(input.slideTitle || "").trim() || undefined,
    slideType: String(input.slideType || "").trim() || undefined,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs,
    durationSeconds: Number((durationMs / 1000).toFixed(2)),
    durationMinutes: Number((durationMs / 60000).toFixed(4)),
    details: input.details,
    ...getRuntimeClientInfo(),
  };
}

async function ensureSyncAuth() {
  const authToken = localStorage.getItem("authToken");
  if (!authToken || authToken === "offline-granted" || authToken === "session-cookie-only") {
    await refreshToken();
  }
}

export async function recordSlideRetention(input: SlideRetentionInput) {
  const entry = buildEntry(input);
  if (!entry) {
    return null;
  }

  await upsertSyncQueueItem(buildQueueItem(entry));

  if (typeof navigator !== "undefined" && navigator.onLine) {
    void syncPendingSlideRetention();
  }

  return entry;
}

export async function syncPendingSlideRetention(): Promise<boolean> {
  const profile = getAccountProfile();
  if (!profile) {
    return false;
  }

  const queuedItems = getSlideRetentionQueueItems(await getSyncQueueItems<SlideRetentionEntry>());
  const pendingItems = queuedItems.filter((item) => item.syncState !== "syncing");
  const pendingEntries = pendingItems.map((item) => item.payload);

  if (pendingEntries.length === 0) {
    await setAppMeta(LAST_SYNC_META_KEY, {
      success: true,
      syncedAt: Date.now(),
      syncedCount: 0,
      error: null,
    });
    return true;
  }

  const buildRequest = (): SlideRetentionRequest => ({
    userId: profile.userId || profile.repId || profile.username,
    ...getRuntimeClientInfo(),
    entries: pendingEntries,
  });

  try {
    await updateQueuedEntries(pendingItems, { syncState: "syncing", lastError: null });
    await ensureSyncAuth();
    await apiClient.syncSlideRetention(buildRequest());
    await deleteSyncQueueItems(pendingItems.map((item) => item.id));
    await setAppMeta(LAST_SYNC_META_KEY, {
      success: true,
      syncedAt: Date.now(),
      syncedCount: pendingEntries.length,
      error: null,
    });
    return true;
  } catch (error) {
    try {
      await refreshToken();
      await apiClient.syncSlideRetention(buildRequest());
      await deleteSyncQueueItems(pendingItems.map((item) => item.id));
      await setAppMeta(LAST_SYNC_META_KEY, {
        success: true,
        syncedAt: Date.now(),
        syncedCount: pendingEntries.length,
        error: null,
      });
      return true;
    } catch (retryError) {
      await Promise.all(
        pendingItems.map((item) =>
          upsertSyncQueueItem({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: String((retryError as Error)?.message || (error as Error)?.message || "Sync failed"),
            syncState: "failed",
          })
        )
      );
      await setAppMeta(LAST_SYNC_META_KEY, {
        success: false,
        syncedAt: Date.now(),
        syncedCount: 0,
        error: String((retryError as Error)?.message || (error as Error)?.message || "Sync failed"),
      });
      console.error("Failed to sync slide retention:", retryError ?? error);
      return false;
    }
  }
}

export function initSlideRetentionSync() {
  if (slideRetentionSyncInitialized || typeof window === "undefined") {
    return;
  }

  slideRetentionSyncInitialized = true;

  const triggerSync = () => {
    void syncPendingSlideRetention();
  };

  window.addEventListener("online", triggerSync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      triggerSync();
    }
  });

  if (navigator.onLine) {
    triggerSync();
  }
}

export async function getSlideRetentionSyncDiagnostics() {
  const lastSyncResult = await getAppMeta<{
    success: boolean;
    syncedAt: number;
    syncedCount: number;
    error: string | null;
  }>(LAST_SYNC_META_KEY).catch(() => null);

  return {
    lastSyncResult: lastSyncResult?.value || null,
  };
}
