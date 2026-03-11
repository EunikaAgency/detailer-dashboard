/**
 * Authentication utilities for One Detailer
 * Handles login, offline auth, token management, and credential storage
 */

import { apiClient, LoginRequest, LoginResponse } from './api';
import { clearMediaCache, clearPresentationCache } from './media-cache';
import { verifyOfflineCredential, type OfflineCredentialPayload } from './offline-credentials';

export interface AccountProfile {
  representativeName?: string;
  username: string;
  issuedLoginUsername?: string;
  userId: string;
  repId?: string;
  role?: string;
}

export interface SavedCredentials {
  identifier: string;
  password: string;
  createdAt: string;
}

export interface OfflineAuth {
  method: string;
  username: string;
  passwordHash: string;
  keygenHash: string | null;
  repId?: string;
  role?: string;
  credentialCreatedAt: string;
  grantedAt: number;
  validUntil: number;
}

export type AuthMode = 'bearer' | 'session-cookie' | 'offline';

/**
 * Get current auth mode based on stored token
 */
export function getAuthMode(): AuthMode | null {
  const token = localStorage.getItem('authToken');
  if (!token) return null;
  
  if (token === 'session-cookie-only') return 'session-cookie';
  if (token === 'offline-granted') return 'offline';
  return 'bearer';
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('authToken');
  return !!token;
}

/**
 * Get stored account profile
 */
export function getAccountProfile(): AccountProfile | null {
  const profile = localStorage.getItem('accountProfile');
  return profile ? JSON.parse(profile) : null;
}

/**
 * Get saved credentials if remember was checked
 */
export function getSavedCredentials(): SavedCredentials | null {
  const saved = localStorage.getItem('savedCredentials');
  return saved ? JSON.parse(saved) : null;
}

export function syncStoredPassword(newPassword: string) {
  const trimmedPassword = String(newPassword || "").trim();
  if (!trimmedPassword) {
    return;
  }

  const profile = getAccountProfile();
  const identifier = String(profile?.issuedLoginUsername || profile?.username || "").trim();
  if (!identifier) {
    return;
  }

  const timestamp = new Date().toISOString();

  const savedCredentials = getSavedCredentials();
  if (savedCredentials) {
    localStorage.setItem(
      'savedCredentials',
      JSON.stringify({
        ...savedCredentials,
        identifier,
        password: trimmedPassword,
        createdAt: timestamp,
      } satisfies SavedCredentials)
    );
  }

  localStorage.setItem(
    'offlineSyncCredentials',
    JSON.stringify({
      identifier,
      password: trimmedPassword,
      createdAt: timestamp,
    })
  );

  const existingOfflineAuth = localStorage.getItem('offlineAuth');
  const baseOfflineAuth: OfflineAuth = existingOfflineAuth
    ? JSON.parse(existingOfflineAuth)
    : {
        method: 'password',
        username: identifier.trim().toLowerCase(),
        passwordHash: '',
        keygenHash: null,
        repId: profile?.repId,
        role: profile?.role,
        credentialCreatedAt: timestamp,
        grantedAt: Date.now(),
        validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000),
      };

  localStorage.setItem(
    'offlineAuth',
    JSON.stringify({
      ...baseOfflineAuth,
      username: identifier.trim().toLowerCase(),
      passwordHash: simpleHash(trimmedPassword),
      keygenHash: null,
      repId: profile?.repId || baseOfflineAuth.repId,
      role: profile?.role || baseOfflineAuth.role,
      credentialCreatedAt: timestamp,
      grantedAt: Date.now(),
      validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000),
    } satisfies OfflineAuth)
  );
}

/**
 * Simple hash function for offline password validation
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Validate offline credentials
 */
function validateOfflineCredentials(username: string, password: string): boolean {
  const offlineAuth = localStorage.getItem('offlineAuth');
  if (!offlineAuth) return false;

  try {
    const auth: OfflineAuth = JSON.parse(offlineAuth);
    
    // Check if offline auth is still valid
    if (Date.now() > auth.validUntil) {
      localStorage.removeItem('offlineAuth');
      return false;
    }

    // Check username and password hash
    const passwordHash = simpleHash(password);
    return auth.username === username.trim().toLowerCase() && auth.passwordHash === passwordHash;
  } catch {
    return false;
  }
}

/**
 * Build account profile from login response
 */
function buildAccountProfile(loginResponse: LoginResponse, identifier: string): AccountProfile {
  const user = loginResponse.user || {};
  
  // A. Representative Name - fallback chain
  const representativeName = 
    user.representativeName || 
    user.repName || 
    user.fullName || 
    user.name || 
    '';
  
  // B. Username - fallback chain
  const username = 
    user.username || 
    user.email || 
    identifier;
  
  // C. Issued login username - normalized identifier
  const issuedLoginUsername = identifier;
  
  // D. User ID - fallback chain
  const userId = 
    user.userId || 
    user._id || 
    user.id || 
    '';
  
  // E. Rep ID - fallback chain
  const repId = 
    user.repId || 
    user.repID || 
    user.representativeId || 
    '';
  
  // F. Role
  const role = user.role || '';
  
  return {
    representativeName,
    username,
    issuedLoginUsername,
    userId,
    repId,
    role,
  };
}

/**
 * Store auth data after successful login
 */
function storeAuthData(
  loginResponse: LoginResponse,
  identifier: string,
  password: string,
  rememberCredentials: boolean
) {
  const user = loginResponse.user || {};

  // Extract token
  const token = loginResponse.token || loginResponse.accessToken || loginResponse.access_token;
  
  if (token) {
    localStorage.setItem('authToken', token);
  } else if (loginResponse.success) {
    localStorage.setItem('authToken', 'session-cookie-only');
  }

  // Build and store account profile
  const accountProfile = buildAccountProfile(loginResponse, identifier);
  localStorage.setItem('accountProfile', JSON.stringify(accountProfile));

  // Store offline auth for future offline access
  const offlineAuth: OfflineAuth = {
    method: loginResponse.method || 'password',
    username: identifier.trim().toLowerCase(),
    passwordHash: simpleHash(password),
    keygenHash: null,
    repId: user.repId,
    role: user.role,
    credentialCreatedAt: new Date().toISOString(),
    grantedAt: Date.now(),
    validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
  };
  localStorage.setItem('offlineAuth', JSON.stringify(offlineAuth));

  // Store credentials for sync/retry if remember is checked
  if (rememberCredentials) {
    const savedCredentials: SavedCredentials = {
      identifier,
      password,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('savedCredentials', JSON.stringify(savedCredentials));
  } else {
    localStorage.removeItem('savedCredentials');
  }

  // Store sync credentials for token refresh
  const syncCredentials = {
    identifier,
    password,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem('offlineSyncCredentials', JSON.stringify(syncCredentials));
}

/**
 * Store offline-only auth (when offline login succeeds)
 */
function storeOfflineAuth(identifier: string, password: string) {
  const offlineAuth = localStorage.getItem('offlineAuth');
  if (!offlineAuth) return;

  const auth: OfflineAuth = JSON.parse(offlineAuth);
  
  localStorage.setItem('authToken', 'offline-granted');
  
  // Build minimal account profile from offline auth
  const accountProfile: AccountProfile = {
    username: auth.username,
    issuedLoginUsername: auth.username,
    userId: 'offline-' + auth.username,
    repId: auth.repId,
    role: auth.role,
  };
  localStorage.setItem('accountProfile', JSON.stringify(accountProfile));
}

/**
 * Build account profile from offline credential payload
 */
function buildAccountProfileFromOfflineCredential(
  payload: OfflineCredentialPayload
): AccountProfile {
  return {
    representativeName: payload.name,
    username: payload.username,
    issuedLoginUsername: payload.username,
    userId: payload.userId || 'offline-' + payload.username,
    repId: payload.repId,
    role: payload.role,
  };
}

/**
 * Store offline-only auth (when offline credential login succeeds)
 */
function storeOfflineCredentialAuth(payload: OfflineCredentialPayload) {
  localStorage.setItem('authToken', 'offline-granted');
  
  // Build account profile from credential payload
  const accountProfile = buildAccountProfileFromOfflineCredential(payload);
  localStorage.setItem('accountProfile', JSON.stringify(accountProfile));
  
  // Store offline auth record for future reference
  const offlineAuth: OfflineAuth = {
    method: 'password',
    username: payload.username,
    passwordHash: '', // Not needed for credential tokens
    keygenHash: null,
    repId: payload.repId,
    role: payload.role,
    credentialCreatedAt: payload.createdAt,
    grantedAt: Date.now(),
    validUntil: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
  };
  localStorage.setItem('offlineAuth', JSON.stringify(offlineAuth));
}

/**
 * Login with username and password
 * Supports online and offline authentication via credential tokens
 */
export async function login(
  identifier: string,
  password: string,
  rememberCredentials: boolean
): Promise<{ success: true; mode: AuthMode } | { success: false; error: string }> {
  // Validation
  if (!identifier || !password) {
    return { success: false, error: 'Please enter both OPPI and password' };
  }

  try {
    // Try online login first
    const loginRequest: LoginRequest = {
      email: identifier,
      username: identifier,
      password,
    };

    const response = await apiClient.login(loginRequest);
    
    // Store auth data
    storeAuthData(response, identifier, password, rememberCredentials);
    
    const mode = getAuthMode() || 'bearer';
    return { success: true, mode };
    
  } catch (error) {
    // Online login failed, try offline credential verification
    const offlinePayload = await verifyOfflineCredential(identifier, password);
    
    if (offlinePayload) {
      // Offline credential token verified successfully
      storeOfflineCredentialAuth(offlinePayload);
      
      // Store credentials for future sync if remember is checked
      if (rememberCredentials) {
        const savedCredentials: SavedCredentials = {
          identifier,
          password,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem('savedCredentials', JSON.stringify(savedCredentials));
      }
      
      return { success: true, mode: 'offline' };
    }

    // Try stored offline auth validation (legacy fallback)
    if (validateOfflineCredentials(identifier, password)) {
      storeOfflineAuth(identifier, password);
      return { success: true, mode: 'offline' };
    }

    // Both online and offline failed
    const message = error instanceof Error ? error.message : 'Login failed';
    return { success: false, error: message };
  }
}

/**
 * Logout and clear all auth data
 */
export function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('accountProfile');
  localStorage.removeItem('offlineSyncCredentials');
  // Keep offlineAuth for future offline access
}

/**
 * Clear all cached data including offline auth
 */
export function clearAllData() {
  localStorage.clear();
  void clearMediaCache();
  void clearPresentationCache();
}

/**
 * Attempt silent token refresh using saved credentials
 */
export async function refreshToken(): Promise<boolean> {
  const syncCredentials = localStorage.getItem('offlineSyncCredentials');
  if (!syncCredentials) return false;

  try {
    const { identifier, password } = JSON.parse(syncCredentials);
    const loginRequest: LoginRequest = {
      email: identifier,
      username: identifier,
      password,
    };

    const response = await apiClient.login(loginRequest);
    
    // Update only the token, keep other data
    const token = response.token || response.accessToken || response.access_token;
    if (token) {
      localStorage.setItem('authToken', token);
      return true;
    } else if (response.success) {
      localStorage.setItem('authToken', 'session-cookie-only');
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}
