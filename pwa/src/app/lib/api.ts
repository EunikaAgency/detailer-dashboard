/**
 * API configuration and client for One Detailer.
 * Mirrors the working app-capacitor request contract.
 */

const isLocalDevHost =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (isLocalDevHost ? "/api" : "https://otsukadetailer.site/api")
).replace(/\/$/, "");

export const CONFIG_BASE_URL = (
  import.meta.env.VITE_CONFIG_BASE_URL ||
  API_BASE_URL.replace(/\/api$/i, "")
).replace(/\/$/, "");

export const API_KEY = import.meta.env.VITE_API_KEY || "";

export interface LoginRequest {
  email: string;
  username: string;
  password: string;
  createdAt?: string;
}

export interface LoginResponse {
  token?: string;
  accessToken?: string;
  access_token?: string;
  success?: boolean;
  method?: string;
  user: {
    _id?: string;
    id?: string;
    userId?: string;
    username?: string;
    email?: string;
    issuedLoginUsername?: string;
    representativeName?: string;
    repName?: string;
    fullName?: string;
    name?: string;
    repId?: string;
    repID?: string;
    representativeId?: string;
    role?: string;
  };
}

export interface LoginErrorResponse {
  error: string;
}

export interface MobileConfigResponse {
  account: string;
  config: {
    text: Record<string, string>;
  };
}

export interface Product {
  _id: string;
  name: string;
  category: string;
  thumbnail: string;
  media?: Array<{
    groupId: string;
    title: string;
    items: Array<{
      id: string;
      type: 'image' | 'video' | 'html';
      url: string;
      thumbnailUrl?: string;
      title?: string;
      hotspots?: Array<{
        id: string;
        x: number;
        y: number;
        w: number;
        h: number;
        targetPageId: string;
      }>;
    }>;
  }>;
}

export interface ProductsResponse {
  version: number;
  products: Product[];
}

export interface LoginEvent {
  eventId: string;
  eventType: 'login' | 'activity';
  action: string;
  screen: string;
  method: string;
  source: 'online' | 'offline';
  occurredAt: string;
  timestampMs: number;
  sessionId?: string;
  details?: Record<string, unknown>;
  deckTitle?: string;
}

export interface LoginEventsRequest {
  userId: string;
  login: string;
  username: string;
  issuedLoginUsername: string;
  events: LoginEvent[];
}

export interface LoginEventsResponse {
  success: boolean;
}

/**
 * API Client with auth header support
 */
function runtimeApiKey() {
  try {
    return String(localStorage.getItem("runtimeApiKey") || "").trim();
  } catch {
    return "";
  }
}

export function getApiKey() {
  return API_KEY || runtimeApiKey();
}

function buildRelativeOrAbsoluteUrl(base: string, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!base) return normalizedPath;
  if (/^https?:\/\//i.test(base)) return `${base}${normalizedPath}`;
  return `${base}${normalizedPath}`;
}

function decodeJwtPayload(token?: string | null) {
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) return null;
  try {
    const [, payload] = raw.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function resolveUserId(token?: string | null, identity?: Partial<LoginEventsRequest>) {
  const direct = String(identity?.userId || "").trim();
  if (direct) return direct;
  const payload = decodeJwtPayload(token);
  return String(payload?.userId || payload?._id || payload?.id || "").trim();
}

async function parseError(response: Response): Promise<never> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  throw new Error(String(parsed?.error || parsed?.message || text || `HTTP ${response.status}`));
}

class ApiClient {
  private getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    const apiKey = getApiKey();
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    if (includeAuth) {
      const authToken = localStorage.getItem("authToken");
      if (authToken && authToken !== "session-cookie-only" && authToken !== "offline-granted") {
        headers["Authorization"] = `Bearer ${authToken}`;
      }
    }

    return headers;
  }

  private async requestJson<T>(
    url: string,
    init: RequestInit,
    options: { includeAuth?: boolean; includeJson?: boolean; credentials?: RequestCredentials } = {}
  ): Promise<T> {
    const headers = new Headers(init.headers || {});
    if (options.includeJson !== false && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      cache: "no-store",
      credentials: options.credentials || "include",
      ...init,
      headers,
    });

    if (!response.ok) {
      await parseError(response);
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  async login(data: LoginRequest): Promise<LoginResponse> {
    return this.requestJson<LoginResponse>(buildRelativeOrAbsoluteUrl(API_BASE_URL, "/auth/login"), {
      method: "POST",
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
  }

  async getMobileConfig(account: string): Promise<MobileConfigResponse> {
    const url = new URL(buildRelativeOrAbsoluteUrl(API_BASE_URL, "/mobile-config"), window.location.origin);
    if (account) {
      url.searchParams.set("account", account);
    }
    const apiKey = getApiKey();
    if (apiKey) {
      url.searchParams.set("api_key", apiKey);
    }

    return this.requestJson<MobileConfigResponse>(url.toString(), {
      method: "GET",
      headers: this.getHeaders(false),
    }, { credentials: "omit" });
  }

  async getProducts(): Promise<ProductsResponse> {
    const url = new URL(buildRelativeOrAbsoluteUrl(CONFIG_BASE_URL, "/api/products"), window.location.origin);
    const apiKey = getApiKey();
    if (apiKey) {
      url.searchParams.set("api_key", apiKey);
    }

    return this.requestJson<ProductsResponse>(url.toString(), {
      method: "GET",
      headers: this.getHeaders(false),
    }, { credentials: "omit" });
  }

  async syncLoginEvents(data: LoginEventsRequest): Promise<LoginEventsResponse> {
    const authToken = localStorage.getItem("authToken");
    const payload: LoginEventsRequest = {
      ...data,
      userId: resolveUserId(authToken, data),
      login: data.login || data.issuedLoginUsername || data.username,
      username: data.username || data.login,
      issuedLoginUsername: data.issuedLoginUsername || data.login || data.username,
    };

    return this.requestJson<LoginEventsResponse>(buildRelativeOrAbsoluteUrl(API_BASE_URL, "/login-events"), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ApiClient();
