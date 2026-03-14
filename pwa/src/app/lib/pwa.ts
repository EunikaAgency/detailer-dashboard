/**
 * PWA Installation Utilities
 */

import { registerSW } from "virtual:pwa-register";

export interface InstallState {
  canPrompt: boolean;
  standalone: boolean;
  displayMode: "browser" | "standalone" | "fullscreen" | "minimal-ui" | "window-controls-overlay";
  ios: boolean;
  safari: boolean;
  showAction: boolean;
}

export interface AppUpdateState {
  updateAvailable: boolean;
  refreshing: boolean;
  readyOffline: boolean;
}

const shouldDebugPwa =
  typeof window !== "undefined" &&
  (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    new URLSearchParams(window.location.search).has("pwaDebug")
  );

let deferredPrompt: any = null;
const subscribers = new Set<(state: InstallState) => void>();
const updateSubscribers = new Set<(state: AppUpdateState) => void>();
let initialized = false;
let serviceWorkerUpdater: ((reloadPage?: boolean) => Promise<void>) | null = null;
let appUpdateState: AppUpdateState = {
  updateAvailable: false,
  refreshing: false,
  readyOffline: false,
};

function publishInstallState() {
  const snapshot = getInstallState();
  subscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore subscriber errors.
    }
  });
}

function publishAppUpdateState() {
  const snapshot = { ...appUpdateState };
  updateSubscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore subscriber errors.
    }
  });
}

function logPwaDebug(event: string, details?: Record<string, unknown>) {
  if (!shouldDebugPwa) {
    return;
  }

  console.info(`[PWA] ${event}`, details || {});
}

export function getDisplayMode(): InstallState["displayMode"] {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "browser";
  }

  if (window.matchMedia("(display-mode: window-controls-overlay)").matches) {
    return "window-controls-overlay";
  }
  if (window.matchMedia("(display-mode: fullscreen)").matches) {
    return "fullscreen";
  }
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return "standalone";
  }
  if (window.matchMedia("(display-mode: minimal-ui)").matches) {
    return "minimal-ui";
  }

  return "browser";
}

/**
 * Listen for beforeinstallprompt event
 */
export function initPWAInstall() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    publishInstallState();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    publishInstallState();
  });

  window.matchMedia?.('(display-mode: standalone)')?.addEventListener?.('change', publishInstallState);
}

/**
 * Check if app is running in standalone mode
 */
export function isStandalone(): boolean {
  // Check if running as PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // Check iOS standalone
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  
  return false;
}

/**
 * Detect iOS
 */
export function isIOS(): boolean {
  const userAgent = navigator.userAgent || "";
  const isClassicIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isIPadOSDesktopMode =
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;

  return isClassicIOS || isIPadOSDesktopMode;
}

/**
 * Detect Safari
 */
export function isSafari(): boolean {
  const userAgent = navigator.userAgent || "";
  return /safari/i.test(userAgent) && !/chrome|chromium|android|crios|fxios|edgios/i.test(userAgent);
}

/**
 * Get install state
 */
export function getInstallState(): InstallState {
  const displayMode = getDisplayMode();
  const standalone = displayMode !== "browser" || isStandalone();
  const ios = isIOS();
  const safari = isSafari();
  const canPrompt = !!deferredPrompt && !standalone;
  
  // Show install action whenever the app is not already installed.
  // Browsers that support beforeinstallprompt can use the native prompt;
  // all others should fall back to manual instructions.
  const showAction = !standalone;
  
  return {
    canPrompt,
    standalone,
    displayMode,
    ios,
    safari,
    showAction,
  };
}

/**
 * Show install prompt
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  
  // Clear the deferred prompt
  deferredPrompt = null;
  publishInstallState();
  
  return outcome === 'accepted';
}

/**
 * Get install button label
 */
export function getInstallButtonLabel(): string {
  const state = getInstallState();
  
  if (state.canPrompt) {
    return 'Install App';
  }
  
  return 'How To Install';
}

/**
 * Handle install action
 */
export async function handleInstallAction(): Promise<'prompt' | 'instructions' | null> {
  const state = getInstallState();
  
  if (state.canPrompt) {
    await showInstallPrompt();
    return 'prompt';
  }

  return state.showAction ? 'instructions' : null;
}

export function subscribeInstallState(listener: (state: InstallState) => void) {
  subscribers.add(listener);
  listener(getInstallState());
  return () => subscribers.delete(listener);
}

export function getAppUpdateState() {
  return { ...appUpdateState };
}

export function subscribeAppUpdateState(listener: (state: AppUpdateState) => void) {
  updateSubscribers.add(listener);
  listener(getAppUpdateState());
  return () => updateSubscribers.delete(listener);
}

export async function refreshAppNow() {
  if (!serviceWorkerUpdater) {
    return false;
  }

  appUpdateState = {
    ...appUpdateState,
    refreshing: true,
  };
  publishAppUpdateState();

  await serviceWorkerUpdater(true);
  return true;
}

export function dismissAppUpdate() {
  appUpdateState = {
    ...appUpdateState,
    updateAvailable: false,
  };
  publishAppUpdateState();
}

const isSecureOrigin =
  typeof window !== "undefined" &&
  (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");

if (typeof window !== "undefined" && import.meta.env.PROD && isSecureOrigin && "serviceWorker" in navigator) {
  serviceWorkerUpdater = registerSW({
    immediate: true,
    onRegisteredSW(swScriptUrl, registration) {
      logPwaDebug("service worker registered", {
        swScriptUrl,
        scope: registration?.scope || "",
        controller: navigator.serviceWorker.controller?.scriptURL || "",
      });

      void navigator.serviceWorker.ready.then((readyRegistration) => {
        logPwaDebug("service worker ready", {
          scope: readyRegistration.scope,
          activeState: readyRegistration.active?.state || "",
          controller: navigator.serviceWorker.controller?.scriptURL || "",
        });
      });
    },
    onNeedRefresh() {
      appUpdateState = {
        ...appUpdateState,
        updateAvailable: true,
        refreshing: false,
      };
      publishAppUpdateState();
    },
    onOfflineReady() {
      logPwaDebug("offline shell ready");
      appUpdateState = {
        ...appUpdateState,
        readyOffline: true,
      };
      publishAppUpdateState();
    },
    onRegisterError(error) {
      console.error("[PWA] service worker registration failed", error);
    },
  });

  navigator.serviceWorker?.addEventListener?.("message", (event) => {
    const data = event.data;
    if (data?.type === "ONE_DETAILER_SW_DEBUG") {
      logPwaDebug(`sw:${String(data.event || "message")}`, data.details || {});
    }
  });

  navigator.serviceWorker?.addEventListener?.(
    "controllerchange",
    () => {
      logPwaDebug("service worker controller changed", {
        controller: navigator.serviceWorker.controller?.scriptURL || "",
      });
      window.location.reload();
    },
    { once: false }
  );
}
