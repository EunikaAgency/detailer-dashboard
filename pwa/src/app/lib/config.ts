/**
 * Mobile UI Config Management
 * Handles fetching and caching UI text labels from /api/mobile-config
 */

import { apiClient } from './api';

export interface MobileConfig {
  account: string;
  config: {
    text: Record<string, string>;
  };
  fetchedAt?: number;
}

const CONFIG_CACHE_KEY = 'mobileUiConfig';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_ACCOUNT =
  import.meta.env.VITE_POST_LOGIN_MOBILE_CONFIG_ACCOUNT ||
  import.meta.env.VITE_MOBILE_CONFIG_ACCOUNT ||
  "otsuka-detailer";

/**
 * Default UI text labels
 */
const DEFAULT_TEXT: Record<string, string> = {
  brandTitle: 'One Detailer',
  loginTitle: 'One Detailer',
  loginSubtitle: 'Sign in to continue',
  loginButton: 'Sign in',
  rememberCredentials: 'Remember credentials',
  productsTitle: 'Presentations',
  searchPlaceholder: 'Search presentations',
  menuTitle: 'Menu',
  settingsTitle: 'Settings',
  advancedSettingsTitle: 'Advanced',
  myAccountTitle: 'My Account',
  sessionsTitle: 'Sessions',
  selectCaseLabel: 'Select Case',
  slideLabel: 'Slide',
  ofLabel: 'of',
  fullscreenButton: 'Fullscreen',
  installAppButton: 'Install App',
  howToInstallButton: 'How To Install',
  syncButton: 'Sync',
  logoutButton: 'Logout',
  backButton: 'Back',
};

/**
 * Get cached config
 */
function getCachedConfig(): MobileConfig | null {
  const cached = localStorage.getItem(CONFIG_CACHE_KEY);
  if (!cached) return null;

  try {
    const config: MobileConfig = JSON.parse(cached);
    
    // Check if cache is still valid
    if (config.fetchedAt && Date.now() - config.fetchedAt < CACHE_DURATION) {
      return config;
    }
    
    // Cache expired but return it anyway as fallback
    return config;
  } catch {
    return null;
  }
}

/**
 * Store config in cache
 */
function cacheConfig(config: MobileConfig) {
  const configWithTimestamp: MobileConfig = {
    ...config,
    fetchedAt: Date.now(),
  };
  localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(configWithTimestamp));
}

/**
 * Fetch mobile config from API
 */
export async function fetchMobileConfig(account: string = DEFAULT_ACCOUNT): Promise<MobileConfig> {
  try {
    const response = await apiClient.getMobileConfig(account);
    cacheConfig(response);
    return response;
  } catch (error) {
    console.error('Failed to fetch mobile config:', error);
    
    // Try to return cached config
    const cached = getCachedConfig();
    if (cached) {
      return cached;
    }
    
    // Return default config
    return {
      account,
      config: {
        text: DEFAULT_TEXT,
      },
    };
  }
}

/**
 * Get UI text label
 */
export function getUIText(key: string): string {
  const cached = getCachedConfig();
  
  if (cached?.config?.text?.[key]) {
    return cached.config.text[key];
  }
  
  return DEFAULT_TEXT[key] || key;
}

/**
 * Get all UI text
 */
export function getAllUIText(): Record<string, string> {
  const cached = getCachedConfig();
  
  if (cached?.config?.text) {
    return { ...DEFAULT_TEXT, ...cached.config.text };
  }
  
  return DEFAULT_TEXT;
}

/**
 * Initialize config (fetch in background)
 */
export async function initializeConfig() {
  // Check cache first
  const cached = getCachedConfig();
  
  // If cache is fresh, no need to fetch
  if (cached?.fetchedAt && Date.now() - cached.fetchedAt < CACHE_DURATION) {
    return cached;
  }
  
  // Fetch in background
  return fetchMobileConfig(DEFAULT_ACCOUNT);
}
