const DEFAULT_API_BASE_URL = "https://otsukadetailer.site/api";
const DEFAULT_CONFIG_BASE_URL = "https://otsukadetailer.site";

export function getConfigBaseUrl() {
  return (
    import.meta.env.VITE_CONFIG_BASE_URL ||
    import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/i, "") ||
    DEFAULT_CONFIG_BASE_URL ||
    DEFAULT_API_BASE_URL.replace(/\/api\/?$/i, "")
  ).replace(/\/$/, "");
}

function getAppOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "https://localhost";
}

function getAppBaseUrl() {
  if (typeof window !== "undefined") {
    return new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString();
  }
  return `${getAppOrigin().replace(/\/$/, "")}/`;
}

export function isLocalBundledAssetPath(url: string) {
  const trimmed = String(url || "").trim();
  return /^\.?\/?src\//i.test(trimmed);
}

function shouldPreserveHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    const appParsed = new URL(getAppOrigin());
    return (
      parsed.protocol === "http:" &&
      (parsed.origin === appParsed.origin || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export function resolveMediaUrl(url: string) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";

  if (/^https?:\/\/[^/]+\/_capacitor_file_\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, `${getAppOrigin()}/`).toString();
    } catch {
      return trimmed.replace(/^https?:\/\/[^/]+/i, getAppOrigin());
    }
  }

  if (/^\/_capacitor_file_\//i.test(trimmed)) {
    return new URL(trimmed, `${getAppOrigin()}/`).toString();
  }

  if (/^http:\/\//i.test(trimmed)) {
    return shouldPreserveHttpUrl(trimmed) ? trimmed : trimmed.replace(/^http:\/\//i, "https://");
  }

  if (/^(data:|https?:\/\/|content:\/\/|file:\/\/|capacitor:\/\/|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (isLocalBundledAssetPath(trimmed)) {
    const normalized = trimmed.replace(/^\.\//, "").replace(/^\//, "");
    return new URL(normalized, getAppBaseUrl()).toString();
  }

  const configBase = getConfigBaseUrl();
  if (/^\/?uploads\//i.test(trimmed)) {
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return new URL(normalized, `${configBase}/`).toString();
  }

  if (trimmed.startsWith("/")) {
    return new URL(trimmed, `${configBase}/`).toString();
  }

  return new URL(trimmed, `${configBase}/`).toString();
}
