/**
 * PWA Installation Utilities
 */

import { registerSW } from "virtual:pwa-register";

export interface InstallState {
  canPrompt: boolean;
  standalone: boolean;
  ios: boolean;
  safari: boolean;
  showAction: boolean;
}

let deferredPrompt: any = null;
const subscribers = new Set<(state: InstallState) => void>();
let pendingReload = false;
let initialized = false;

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
  const standalone = isStandalone();
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

const isSecureOrigin =
  typeof window !== "undefined" &&
  (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");

if (typeof window !== "undefined" && import.meta.env.PROD && isSecureOrigin && "serviceWorker" in navigator) {
  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (pendingReload) return;
      pendingReload = true;
      navigator.serviceWorker?.addEventListener?.(
        "controllerchange",
        () => {
          window.location.reload();
        },
        { once: true }
      );
      void updateServiceWorker(true);
    },
    onRegisterError(error) {
      console.error("[PWA] service worker registration failed", error);
    },
  });
}
