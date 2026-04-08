/**
 * Session tracking and event management for One Detailer
 */

import { apiClient, LoginEventsRequest } from './api';
import { getAccountProfile, refreshToken } from './auth';
import {
  deleteSyncQueueItems,
  getAppMeta,
  getSyncQueueItems,
  getSyncQueueSize,
  setAppMeta,
  type SyncQueueItem,
  upsertSyncQueueItem,
} from './indexed-db';

export interface Session {
  id: string;
  title: string;
  timeRange: string;
  moveCount: number;
  duration: string;
  status: 'synced' | 'pending';
  startTime: number;
  endTime: number;
  events: SessionEvent[];
  userAgent?: string;
  browser?: string;
  browserName?: string;
  browserVersion?: string;
  platform?: string;
  os?: string;
  device?: string;
  persistedTitle?: string; // Persisted deterministic title
}

export interface SessionEvent {
  id: string;
  eventType: 'auth' | 'activity';
  action: string;
  screen: string;
  method: string;
  source: 'online' | 'offline';
  timestamp: string;
  timestampMs: number;
  metadata?: Record<string, unknown>;
  sessionId?: string; // Track session ID for grouping
}

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const EVENTS_STORAGE_KEY = 'sessionEvents';
const SYNCED_EVENTS_KEY = 'syncedEventIds';
const SESSION_TITLES_KEY = 'sessionTitles'; // Persist titles
const CURRENT_SESSION_KEY = 'currentActivitySessionId';
const SESSION_STATE_EVENT = 'one-detailer:session-state-changed';
let syncInitialized = false;
const SESSION_SYNC_QUEUE_PREFIX = 'session-sync:';
const LAST_SYNC_META_KEY = 'sessionSync:lastResult';

// Explicit session-start events
const SESSION_START_EVENTS = new Set([
  'app_launch',
  'login_success',
  'offline_granted',
  'bypass_login'
]);

/**
 * Persisted session titles storage
 */
function getPersistedTitles(): Map<string, string> {
  const stored = localStorage.getItem(SESSION_TITLES_KEY);
  return new Map(stored ? JSON.parse(stored) : []);
}

function persistSessionTitle(sessionId: string, title: string) {
  const titles = getPersistedTitles();
  titles.set(sessionId, title);
  localStorage.setItem(SESSION_TITLES_KEY, JSON.stringify([...titles]));
}

/**
 * Time-of-day buckets (24 buckets covering 24 hours)
 */
const TIME_BUCKETS = [
  { hour: 0, label: 'Midnight' },
  { hour: 1, label: 'Deep Night' },
  { hour: 2, label: 'Deep Night' },
  { hour: 3, label: 'Pre Dawn' },
  { hour: 4, label: 'First Light' },
  { hour: 5, label: 'Dawn' },
  { hour: 6, label: 'Early Morning' },
  { hour: 7, label: 'Morning Rise' },
  { hour: 8, label: 'Morning' },
  { hour: 9, label: 'Late Morning' },
  { hour: 10, label: 'Late Morning' },
  { hour: 11, label: 'Noon' },
  { hour: 12, label: 'Noon' },
  { hour: 13, label: 'Early Afternoon' },
  { hour: 14, label: 'Afternoon' },
  { hour: 15, label: 'Afternoon' },
  { hour: 16, label: 'Late Afternoon' },
  { hour: 17, label: 'Dusk' },
  { hour: 18, label: 'Evening' },
  { hour: 19, label: 'Evening' },
  { hour: 20, label: 'Late Evening' },
  { hour: 21, label: 'Night' },
  { hour: 22, label: 'Night' },
  { hour: 23, label: 'Late Night' },
];

/**
 * Activity intensity descriptors by bucket
 */
const INTENSITY_DESCRIPTORS = {
  micro: [
    'Blink', 'Quick', 'Snap', 'Nudge', 'Tap', 'Flick',
    'Zip', 'Ping', 'Dash', 'Skim', 'Peek', 'Pulse'
  ],
  light: [
    'Drift', 'Glide', 'Stroll', 'Cruise', 'Wander', 'Browse',
    'Flow', 'Ease', 'Roam', 'Ripple', 'Meander', 'Loop'
  ],
  normal: [
    'Pulse', 'Loop', 'Drive', 'Trail', 'Rhythm', 'Stream',
    'Route', 'Track', 'Run', 'Cycle', 'Groove', 'Sprint'
  ],
  busy: [
    'Surge', 'Hustle', 'Rally', 'Charge', 'Rush', 'Boost',
    'Blaze', 'Momentum', 'Power Flow', 'Fast Loop', 'Stride', 'Rapid Run'
  ],
  heavy: [
    'Marathon', 'Deep Dive', 'Long Run', 'Full Sweep', 'Extended Flow', 'Big Push',
    'Power Session', 'Ultra', 'Grind', 'Heavy Loop', 'Endurance', 'Overdrive'
  ]
};

/**
 * Get intensity bucket from event count
 */
function getIntensityBucket(eventCount: number): keyof typeof INTENSITY_DESCRIPTORS {
  if (eventCount <= 5) return 'micro';
  if (eventCount <= 15) return 'light';
  if (eventCount <= 35) return 'normal';
  if (eventCount <= 70) return 'busy';
  return 'heavy';
}

/**
 * Get time-of-day label from hour
 */
function getTimeOfDayLabel(hour: number): string {
  const bucket = TIME_BUCKETS.find(b => b.hour === hour);
  return bucket?.label || 'Unknown';
}

/**
 * Deterministically select descriptor from pool
 * Uses hash of timestamp to ensure same inputs always give same output
 */
function selectDescriptor(descriptors: string[], timestamp: number, eventCount: number): string {
  // Create deterministic seed from timestamp and event count
  const seed = timestamp + eventCount;
  const index = Math.abs(seed) % descriptors.length;
  return descriptors[index];
}

/**
 * Get all tracked events from storage
 */
function getStoredEvents(): SessionEvent[] {
  const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Get synced event IDs
 */
function getSyncedEventIds(): Set<string> {
  const stored = localStorage.getItem(SYNCED_EVENTS_KEY);
  return new Set(stored ? JSON.parse(stored) : []);
}

/**
 * Store events
 */
function storeEvents(events: SessionEvent[]) {
  localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  notifySessionStateChanged();
}

function getCurrentSessionId() {
  return String(localStorage.getItem(CURRENT_SESSION_KEY) || '').trim();
}

export function getActiveSessionId() {
  if (typeof window === 'undefined') {
    return '';
  }

  return getCurrentSessionId();
}

function setCurrentSessionId(sessionId: string) {
  localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
}

function resolveSessionId(action: string, events: SessionEvent[], timestampMs: number) {
  const lastEvent = events[events.length - 1];
  const persistedSessionId = getCurrentSessionId();

  const shouldStartNewSession =
    !lastEvent ||
    SESSION_START_EVENTS.has(action) ||
    timestampMs - lastEvent.timestampMs > INACTIVITY_TIMEOUT;

  if (shouldStartNewSession) {
    const sessionId = `session-${timestampMs}`;
    setCurrentSessionId(sessionId);
    return sessionId;
  }

  const fallbackSessionId = lastEvent.sessionId || persistedSessionId || `session-${lastEvent.timestampMs}`;
  setCurrentSessionId(fallbackSessionId);
  return fallbackSessionId;
}

/**
 * Mark events as synced
 */
function markEventsSynced(eventIds: string[]) {
  const synced = getSyncedEventIds();
  eventIds.forEach(id => synced.add(id));
  localStorage.setItem(SYNCED_EVENTS_KEY, JSON.stringify([...synced]));
  notifySessionStateChanged();
}

function buildQueueId(eventId: string) {
  return `${SESSION_SYNC_QUEUE_PREFIX}${eventId}`;
}

function buildSyncQueueItem(event: SessionEvent): SyncQueueItem<SessionEvent> {
  return {
    id: buildQueueId(event.id),
    eventId: event.id,
    eventType: event.eventType,
    payload: event,
    createdAt: event.timestampMs,
    retryCount: 0,
    lastError: null,
    syncState: 'pending',
  };
}

async function enqueueEventForSync(event: SessionEvent) {
  try {
    await upsertSyncQueueItem(buildSyncQueueItem(event));
  } catch (error) {
    console.error('Failed to queue session event for sync:', error);
  }
}

async function ensureQueuedPendingEvents() {
  const events = getStoredEvents();
  const syncedIds = getSyncedEventIds();
  const pendingEvents = events.filter((event) => !syncedIds.has(event.id));

  await Promise.all(pendingEvents.map((event) => enqueueEventForSync(event)));
}

async function updateQueuedEvents(
  items: SyncQueueItem<SessionEvent>[],
  updates: Partial<Pick<SyncQueueItem<SessionEvent>, 'retryCount' | 'lastError' | 'syncState'>>
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

function notifySessionStateChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_STATE_EVENT));
}

function getRuntimeUserAgent() {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const userAgent = String(navigator.userAgent || "").trim();
  return userAgent || undefined;
}

function parseClientInfoFromUserAgent(userAgent: string) {
  const normalizedUserAgent = String(userAgent || '').trim();
  if (!normalizedUserAgent) {
    return {};
  }

  const browserMatchers = [
    { name: 'Edge', pattern: /(Edg|Edge)\/([\d.]+)/i },
    { name: 'Chrome', pattern: /(Chrome|CriOS)\/([\d.]+)/i },
    { name: 'Firefox', pattern: /(Firefox|FxiOS)\/([\d.]+)/i },
    { name: 'Safari', pattern: /Version\/([\d.]+).*Safari/i },
    { name: 'Samsung Internet', pattern: /SamsungBrowser\/([\d.]+)/i },
  ] as const;

  const browserMatch = browserMatchers
    .map((entry) => {
      const match = normalizedUserAgent.match(entry.pattern);
      if (!match) return null;
      const version = match[2] || match[1] || '';
      return {
        browserName: entry.name,
        browserVersion: version,
      };
    })
    .find(Boolean);

  let os = '';
  let platform = '';
  if (/Android/i.test(normalizedUserAgent)) {
    const versionMatch = normalizedUserAgent.match(/Android\s([\d.]+)/i);
    os = versionMatch ? `Android ${versionMatch[1]}` : 'Android';
    platform = 'Android';
  } else if (/iPhone OS\s([\d_]+)/i.test(normalizedUserAgent) || /iPad; CPU OS\s([\d_]+)/i.test(normalizedUserAgent)) {
    const versionMatch =
      normalizedUserAgent.match(/iPhone OS\s([\d_]+)/i) ||
      normalizedUserAgent.match(/iPad; CPU OS\s([\d_]+)/i);
    os = versionMatch ? `iOS ${versionMatch[1].replace(/_/g, '.')}` : 'iOS';
    platform = 'iOS';
  } else if (/Mac OS X\s([\d_]+)/i.test(normalizedUserAgent)) {
    const versionMatch = normalizedUserAgent.match(/Mac OS X\s([\d_]+)/i);
    os = versionMatch ? `macOS ${versionMatch[1].replace(/_/g, '.')}` : 'macOS';
    platform = 'macOS';
  } else if (/Windows NT\s([\d.]+)/i.test(normalizedUserAgent)) {
    const versionMatch = normalizedUserAgent.match(/Windows NT\s([\d.]+)/i);
    os = versionMatch ? `Windows ${versionMatch[1]}` : 'Windows';
    platform = 'Windows';
  } else if (/Linux/i.test(normalizedUserAgent)) {
    os = 'Linux';
    platform = 'Linux';
  }

  let device = '';
  const androidDeviceMatch = normalizedUserAgent.match(/Android[\d.\s;]+;\s?([^;)]+?)\sBuild\//i);
  if (androidDeviceMatch?.[1]) {
    device = androidDeviceMatch[1].trim();
  } else if (/iPhone/i.test(normalizedUserAgent)) {
    device = 'iPhone';
  } else if (/iPad/i.test(normalizedUserAgent)) {
    device = 'iPad';
  } else if (/Macintosh/i.test(normalizedUserAgent)) {
    device = 'Mac';
  } else if (/Windows/i.test(normalizedUserAgent)) {
    device = 'Windows PC';
  } else if (/Linux/i.test(normalizedUserAgent)) {
    device = 'Linux Device';
  }

  const browserName = browserMatch?.browserName || '';
  const browserVersion = browserMatch?.browserVersion || '';

  return {
    userAgent: normalizedUserAgent,
    browserName: browserName || undefined,
    browserVersion: browserVersion || undefined,
    browser: browserName ? `${browserName}${browserVersion ? ` ${browserVersion}` : ''}` : undefined,
    platform: platform || undefined,
    os: os || undefined,
    device: device || undefined,
  };
}

function getRuntimeClientInfo() {
  const userAgent = getRuntimeUserAgent();
  if (!userAgent) {
    return {};
  }

  return parseClientInfoFromUserAgent(userAgent);
}

const CLIENT_INFO_KEYS = [
  'userAgent',
  'browser',
  'browserName',
  'browserVersion',
  'platform',
  'os',
  'device',
] as const;

function extractClientInfo(...sources: Array<Record<string, unknown> | undefined>) {
  const clientInfo: Record<string, string> = {};

  for (const source of sources) {
    if (!source) continue;

    for (const key of CLIENT_INFO_KEYS) {
      const value = source[key];
      if (typeof value === 'string' && value.trim() && clientInfo[key] === undefined) {
        clientInfo[key] = value.trim();
      }
    }
  }

  return clientInfo;
}

export function subscribeSessionState(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => listener();

  window.addEventListener(SESSION_STATE_EVENT, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(SESSION_STATE_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

/**
 * Track a new event
 */
export function trackEvent(
  eventType: 'auth' | 'activity',
  action: string,
  screen: string,
  metadata?: Record<string, unknown>
) {
  const authMode = localStorage.getItem('authToken');
  const metadataSource = metadata?.source;
  const metadataMethod = metadata?.method;

  const source: 'online' | 'offline' =
    metadataSource === 'offline' || metadataSource === 'online'
      ? metadataSource
      : authMode === 'offline-granted'
      ? 'offline'
      : 'online';

  const method =
    metadataMethod === 'keygen' || metadataMethod === 'password'
      ? metadataMethod
      : 'password';

  const timestamp = new Date().toISOString();
  const events = getStoredEvents();
  const timestampMs = Date.now();
  const sessionId = resolveSessionId(action, events, timestampMs);
  const runtimeClientInfo = getRuntimeClientInfo();
  const enrichedMetadata = {
    ...runtimeClientInfo,
    ...(metadata || {}),
  };

  const event: SessionEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    action,
    screen,
    method,
    source,
    timestamp,
    timestampMs,
    metadata: Object.keys(enrichedMetadata).length > 0 ? enrichedMetadata : undefined,
    sessionId,
  };

  events.push(event);
  storeEvents(events);
  void enqueueEventForSync(event);

  return event;
}

/**
 * Group events into sessions based on inactivity timeout
 */
export function getSessionsFromEvents(): Session[] {
  const events = getStoredEvents();
  const syncedIds = getSyncedEventIds();
  
  if (events.length === 0) return [];

  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
  
  const sessions: Session[] = [];
  let currentSession: SessionEvent[] = [];
  let sessionStartTime = sortedEvents[0].timestampMs;
  let lastSessionId: string | undefined;

  sortedEvents.forEach((event, index) => {
    // Check if this should start a new session
    const shouldStartNewSession = 
      currentSession.length === 0 || // No current session
      SESSION_START_EVENTS.has(event.action) || // Explicit session-start event
      (event.sessionId && event.sessionId !== lastSessionId); // sessionId changed

    if (shouldStartNewSession && currentSession.length > 0) {
      // Save current session before starting new one
      sessions.push(createSession(currentSession, sessionStartTime, syncedIds));
      currentSession = [];
    }

    if (currentSession.length === 0) {
      // Starting new session
      currentSession.push(event);
      sessionStartTime = event.timestampMs;
      lastSessionId = event.sessionId;
    } else {
      // Check inactivity timeout
      const lastEvent = currentSession[currentSession.length - 1];
      const timeSinceLastEvent = event.timestampMs - lastEvent.timestampMs;

      if (timeSinceLastEvent > INACTIVITY_TIMEOUT) {
        // Inactivity timeout - create session from current batch
        sessions.push(createSession(currentSession, sessionStartTime, syncedIds));
        
        // Start new session
        currentSession = [event];
        sessionStartTime = event.timestampMs;
        lastSessionId = event.sessionId;
      } else {
        // Add to current session
        currentSession.push(event);
        if (event.sessionId) {
          lastSessionId = event.sessionId;
        }
      }
    }

    // Handle last event
    if (index === sortedEvents.length - 1 && currentSession.length > 0) {
      sessions.push(createSession(currentSession, sessionStartTime, syncedIds));
    }
  });

  return sessions.reverse(); // Most recent first
}

/**
 * Create a session object from events
 */
function createSession(
  events: SessionEvent[],
  startTime: number,
  syncedIds: Set<string>
): Session {
  const endTime = events[events.length - 1].timestampMs;
  const duration = endTime - startTime;
  const sessionId = `session-${startTime}`;
  
  // Check if all events in session are synced
  const allSynced = events.every(e => syncedIds.has(e.id));
  
  // Generate or retrieve persisted title
  const persistedTitles = getPersistedTitles();
  let title: string;
  
  if (persistedTitles.has(sessionId)) {
    // Use persisted title for stability
    title = persistedTitles.get(sessionId)!;
  } else {
    // Generate new deterministic title
    title = generateDeterministicSessionTitle(startTime, events.length);
    persistSessionTitle(sessionId, title);
  }

  const sessionClientInfo = extractClientInfo(...events.map((event) => event.metadata));

  return {
    id: sessionId,
    title,
    timeRange: formatTimeRange(startTime, endTime),
    moveCount: events.length, // Count all events, not just screen_view
    duration: formatDuration(duration),
    status: allSynced ? 'synced' : 'pending',
    startTime,
    endTime,
    events,
    userAgent: sessionClientInfo.userAgent,
    browser: sessionClientInfo.browser,
    browserName: sessionClientInfo.browserName,
    browserVersion: sessionClientInfo.browserVersion,
    platform: sessionClientInfo.platform,
    os: sessionClientInfo.os,
    device: sessionClientInfo.device,
  };
}

/**
 * Generate deterministic session title
 * Format: <Weekday> <Time Block> <Descriptor>
 * Example: "Tuesday Morning Rise Drift"
 */
function generateDeterministicSessionTitle(timestampMs: number, eventCount: number): string {
  const date = new Date(timestampMs);
  
  // Get weekday
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Get time-of-day label
  const hour = date.getHours();
  const timeOfDay = getTimeOfDayLabel(hour);
  
  // Get intensity bucket and descriptor
  const intensityBucket = getIntensityBucket(eventCount);
  const descriptors = INTENSITY_DESCRIPTORS[intensityBucket];
  const descriptor = selectDescriptor(descriptors, timestampMs, eventCount);
  
  return `${weekday} ${timeOfDay} ${descriptor}`;
}

/**
 * Generate session title from event
 * @deprecated - Use generateDeterministicSessionTitle instead
 */
function generateSessionTitle(event: SessionEvent): string {
  const date = new Date(event.timestampMs);
  const time = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  const screenMap: Record<string, string> = {
    'presentations': 'Presentation gallery',
    'viewer': 'Product presentation',
    'case-selection': 'Case selection',
    'sessions': 'Session review',
    'settings': 'Settings review',
    'account': 'Account review',
  };

  const screenName = screenMap[event.screen] || event.screen;
  return `${screenName} - ${time}`;
}

/**
 * Format time range
 */
function formatTimeRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  
  const dateStr = start.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  const startTime = start.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  const endTime = end.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return `${dateStr} • ${startTime} - ${endTime}`;
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return "<1s";
  }

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Get session by ID
 */
export function getSessionById(sessionId: string): Session | null {
  const sessions = getSessionsFromEvents();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Sync pending events to server
 */
export async function syncPendingEvents(): Promise<boolean> {
  const profile = getAccountProfile();
  if (!profile) return false;

  await ensureQueuedPendingEvents();

  const queuedItems = await getSyncQueueItems<SessionEvent>();
  const pendingItems = queuedItems.filter((item) => item.syncState !== 'syncing');
  const pendingEvents = pendingItems.map((item) => item.payload);
  if (pendingEvents.length === 0) {
    await setAppMeta(LAST_SYNC_META_KEY, {
      success: true,
      syncedAt: Date.now(),
      syncedCount: 0,
      error: null,
    });
    return true;
  }

  const buildSyncRequest = (): LoginEventsRequest => {
    const login = profile.issuedLoginUsername || profile.username;
    const username = profile.username || profile.issuedLoginUsername || login;
    const userId = profile.userId || profile.repId || login;
    const requestClientInfo = pendingEvents.reduce<Record<string, string>>(
      (acc, event) => ({ ...extractClientInfo(event.metadata, acc), ...acc }),
      {}
    );

    return {
      userId,
      login,
      username,
      issuedLoginUsername: profile.issuedLoginUsername || username,
      ...requestClientInfo,
      events: pendingEvents.map(e => ({
        ...extractClientInfo(e.metadata),
        eventId: e.id,
        eventType: e.eventType === 'activity' ? 'activity' : 'login',
        action: e.action,
        screen: e.screen,
        method: e.method,
        source: e.source,
        occurredAt: e.timestamp,
        timestampMs: e.timestampMs,
        sessionId: e.sessionId,
        details: e.metadata,
        deckTitle:
          typeof e.metadata?.deckTitle === 'string'
            ? e.metadata.deckTitle
            : typeof e.metadata?.presentationTitle === 'string'
            ? e.metadata.presentationTitle
            : undefined,
      })),
    };
  };

  const ensureSyncAuth = async () => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken || authToken === 'offline-granted' || authToken === 'session-cookie-only') {
      await refreshToken();
    }
  };

  try {
    await updateQueuedEvents(pendingItems, { syncState: 'syncing', lastError: null });
    await ensureSyncAuth();
    await apiClient.syncLoginEvents(buildSyncRequest());
    
    // Mark events as synced
    markEventsSynced(pendingEvents.map(e => e.id));
    await deleteSyncQueueItems(pendingItems.map((item) => item.id));
    await setAppMeta(LAST_SYNC_META_KEY, {
      success: true,
      syncedAt: Date.now(),
      syncedCount: pendingEvents.length,
      error: null,
    });
    
    return true;
  } catch (error) {
    try {
      await refreshToken();
      await apiClient.syncLoginEvents(buildSyncRequest());
      markEventsSynced(pendingEvents.map(e => e.id));
      await deleteSyncQueueItems(pendingItems.map((item) => item.id));
      await setAppMeta(LAST_SYNC_META_KEY, {
        success: true,
        syncedAt: Date.now(),
        syncedCount: pendingEvents.length,
        error: null,
      });
      return true;
    } catch (retryError) {
      await Promise.all(
        pendingItems.map((item) =>
          upsertSyncQueueItem({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: String((retryError as Error)?.message || (error as Error)?.message || 'Sync failed'),
            syncState: 'failed',
          })
        )
      );
      await setAppMeta(LAST_SYNC_META_KEY, {
        success: false,
        syncedAt: Date.now(),
        syncedCount: 0,
        error: String((retryError as Error)?.message || (error as Error)?.message || 'Sync failed'),
      });
      console.error('Failed to sync events:', retryError ?? error);
      return false;
    }
  }
}

/**
 * Initialize session tracking (track login event)
 */
export function initializeSession(method: string, source: 'online' | 'offline') {
  trackEvent('auth', 'login_success', 'login', { method, source });
  if (source === 'online') {
    void syncPendingEvents();
  }
}

/**
 * Track app launch event (explicit session-start event)
 */
export function trackAppLaunch() {
  trackEvent('activity', 'app_launch', 'boot', {});
}

/**
 * Track offline access granted (explicit session-start event)
 */
export function trackOfflineGranted() {
  trackEvent('auth', 'offline_granted', 'login', {});
}

export function initSessionSync() {
  if (syncInitialized || typeof window === 'undefined') {
    return;
  }

  syncInitialized = true;

  const triggerSync = () => {
    void syncPendingEvents();
  };

  window.addEventListener('online', triggerSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      triggerSync();
    }
  });

  if (navigator.onLine) {
    triggerSync();
  }
}

export async function getSessionSyncDiagnostics() {
  const [queueSize, lastSyncResult] = await Promise.all([
    getSyncQueueSize().catch(() => 0),
    getAppMeta<{
      success: boolean;
      syncedAt: number;
      syncedCount: number;
      error: string | null;
    }>(LAST_SYNC_META_KEY).catch(() => null),
  ]);

  return {
    queueSize,
    lastSyncResult: lastSyncResult?.value || null,
  };
}
