/**
 * Settings Management
 * Local persisted preferences (not server-driven)
 */

import { useSyncExternalStore } from "react";
import { getOfflinePresentationSummary } from "./media-cache";

export type GalleryColumns = 1 | 2 | 3 | 4;
export type UiScale = "compact" | "standard" | "comfortable";
export type ActionLabels = "icons" | "labels";
export type OfflineAccessMode = "automatic" | "manual";
export const SESSIONS_VISIBILITY_DURATION_MS = 24 * 60 * 60 * 1000;

export interface AppSettings {
  // Main Settings
  showGalleryLabels: boolean;
  actionLabels: ActionLabels;
  galleryColumns: GalleryColumns;
  uiScale: UiScale;
  dynamicSlideBackdrop: boolean;
  offlineAccessMode: OfflineAccessMode;

  // Advanced Settings
  showSessions: boolean;
  sessionsVisibilityExpiresAt: number | null;
  showHotspotAreas: boolean;
  debugMode: boolean;
}

const SETTINGS_KEY = "appSettings";
const SETTINGS_EVENT = "app-settings-change";

const DEFAULT_SETTINGS_BASE: Omit<AppSettings, "actionLabels"> = {
  showGalleryLabels: true,
  galleryColumns: 3,
  uiScale: "comfortable",
  dynamicSlideBackdrop: true,
  offlineAccessMode: "automatic",
  showSessions: false,
  sessionsVisibilityExpiresAt: null,
  showHotspotAreas: false,
  debugMode: false,
};

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getDefaultActionLabels(): ActionLabels {
  if (!isBrowser()) {
    return "labels";
  }

  return window.innerWidth < 768 ? "icons" : "labels";
}

function getDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS_BASE,
    actionLabels: getDefaultActionLabels(),
  };
}

let cachedSettings = getDefaultSettings();
let hasLoadedStoredSettings = false;

function normalizeSettings(value: unknown): AppSettings {
  const defaultSettings = getDefaultSettings();
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const merged = { ...defaultSettings, ...raw };

  const galleryColumns = Number(merged.galleryColumns);
  const sessionsVisibilityExpiresAt =
    typeof merged.sessionsVisibilityExpiresAt === "number" &&
    Number.isFinite(merged.sessionsVisibilityExpiresAt)
      ? merged.sessionsVisibilityExpiresAt
      : null;
  const sessionsVisibilityActive =
    merged.showSessions === true &&
    sessionsVisibilityExpiresAt !== null &&
    sessionsVisibilityExpiresAt > Date.now();

  return {
    showGalleryLabels:
      typeof merged.showGalleryLabels === "boolean"
        ? merged.showGalleryLabels
        : defaultSettings.showGalleryLabels,
    actionLabels:
      merged.actionLabels === "icons" || merged.actionLabels === "labels"
        ? merged.actionLabels
        : defaultSettings.actionLabels,
    galleryColumns:
      galleryColumns === 1 || galleryColumns === 2 || galleryColumns === 3 || galleryColumns === 4
        ? (galleryColumns as GalleryColumns)
        : defaultSettings.galleryColumns,
    uiScale:
      merged.uiScale === "compact" || merged.uiScale === "standard" || merged.uiScale === "comfortable"
        ? merged.uiScale
        : defaultSettings.uiScale,
    dynamicSlideBackdrop:
      typeof merged.dynamicSlideBackdrop === "boolean"
        ? merged.dynamicSlideBackdrop
        : defaultSettings.dynamicSlideBackdrop,
    offlineAccessMode:
      merged.offlineAccessMode === "manual" || merged.offlineAccessMode === "automatic"
        ? merged.offlineAccessMode
        : defaultSettings.offlineAccessMode,
    showSessions: sessionsVisibilityActive,
    sessionsVisibilityExpiresAt: sessionsVisibilityActive ? sessionsVisibilityExpiresAt : null,
    showHotspotAreas:
      typeof merged.showHotspotAreas === "boolean"
        ? merged.showHotspotAreas
        : defaultSettings.showHotspotAreas,
    debugMode:
      typeof merged.debugMode === "boolean"
        ? merged.debugMode
        : defaultSettings.debugMode,
  };
}

function readStoredSettings(): AppSettings {
  if (!isBrowser()) {
    return getDefaultSettings();
  }

  const stored = localStorage.getItem(SETTINGS_KEY);

  if (!stored) {
    return getDefaultSettings();
  }

  try {
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return getDefaultSettings();
  }
}

function refreshCachedSettings() {
  cachedSettings = readStoredSettings();
  hasLoadedStoredSettings = true;
  return cachedSettings;
}

function persistSettings(settings: AppSettings) {
  if (!isBrowser()) {
    cachedSettings = settings;
    return settings;
  }

  cachedSettings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent<AppSettings>(SETTINGS_EVENT, { detail: settings }));
  return settings;
}

/**
 * Get all settings
 */
export function getSettings(): AppSettings {
  if (!isBrowser()) {
    return cachedSettings;
  }

  if (localStorage.getItem(SETTINGS_KEY) === null) {
    if (!hasLoadedStoredSettings) {
      cachedSettings = getDefaultSettings();
      hasLoadedStoredSettings = true;
    }
    return cachedSettings;
  }

  if (!hasLoadedStoredSettings) {
    return refreshCachedSettings();
  }

  return cachedSettings;
}

/**
 * Subscribe to settings changes across the app.
 */
export function subscribeSettings(listener: () => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleSettingsChange = () => {
    refreshCachedSettings();
    listener();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_KEY) {
      refreshCachedSettings();
      listener();
    }
  };

  window.addEventListener(SETTINGS_EVENT, handleSettingsChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(SETTINGS_EVENT, handleSettingsChange);
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Hook for reactive settings reads.
 */
export function useAppSettings() {
  return useSyncExternalStore(subscribeSettings, getSettings, getDefaultSettings);
}

/**
 * Update settings
 */
export function updateSettings(updates: Partial<AppSettings>) {
  const current = getSettings();
  const updated = normalizeSettings({ ...current, ...updates });
  return persistSettings(updated);
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
  return persistSettings(getDefaultSettings());
}

/**
 * Get specific setting
 */
export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const settings = getSettings();
  return settings[key];
}

/**
 * Set specific setting
 */
export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const updated = updateSettings({ [key]: value } as Partial<AppSettings>);
  return updated[key];
}

export function setSessionsVisibility(enabled: boolean) {
  return updateSettings({
    showSessions: enabled,
    sessionsVisibilityExpiresAt: enabled ? Date.now() + SESSIONS_VISIBILITY_DURATION_MS : null,
  });
}

/**
 * Export diagnostics data
 */
export function exportDiagnostics(): string {
  const authToken = localStorage.getItem('authToken');
  const accountProfile = localStorage.getItem('accountProfile');
  const productsConfig = localStorage.getItem('productsConfig');
  const sessionEvents = localStorage.getItem('sessionEvents');
  const settings = getSettings();
  const offlineSummary = getOfflinePresentationSummary();
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    appVersion: '1.0.0',
    authenticated: !!authToken,
    authMode: authToken === 'offline-granted' ? 'offline' : authToken === 'session-cookie-only' ? 'cookie' : 'bearer',
    accountProfile: accountProfile ? JSON.parse(accountProfile) : null,
    productsLoaded: !!productsConfig,
    productsCount: productsConfig ? JSON.parse(productsConfig).products?.length : 0,
    eventsCount: sessionEvents ? JSON.parse(sessionEvents).length : 0,
    offlinePresentations: offlineSummary.downloadedProducts,
    offlineDecks: offlineSummary.downloadedDecks,
    offlineCachedAssets: offlineSummary.cachedAssets,
    settings,
    localStorage: {
      keys: Object.keys(localStorage),
      size: JSON.stringify(localStorage).length,
    },
  };
  
  return JSON.stringify(diagnostics, null, 2);
}

/**
 * Download diagnostics as file
 */
export function downloadDiagnostics() {
  const data = exportDiagnostics();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `one-detailer-diagnostics-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
