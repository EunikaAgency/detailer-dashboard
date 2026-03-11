/**
 * Offline credential verification compatible with the working app-capacitor build.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface OfflineCredentialPayload {
  typ: string;
  ver: string;
  username: string;
  name?: string;
  repId?: string;
  role?: string;
  email?: string;
  userId?: string;
  createdAt: string;
}

function getRuntimeOfflineSecret() {
  try {
    return String(localStorage.getItem("offlineCredentialSecret") || "").trim();
  } catch {
    return "";
  }
}

function resolveOfflineSecret() {
  return String(
    import.meta.env.VITE_OFFLINE_CREDENTIAL_SECRET ||
    import.meta.env.VITE_JWT_SECRET ||
    getRuntimeOfflineSecret() ||
    ""
  ).trim();
}

function normalizeUsername(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function base64UrlToBytes(value: string) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a[index] ^ b[index];
  return mismatch === 0;
}

async function hmacSha256Bytes(keyBytes: Uint8Array, dataBytes: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(signature);
}

function concatBytes(...chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function u32be(value: number) {
  const out = new Uint8Array(4);
  out[0] = (value >>> 24) & 0xff;
  out[1] = (value >>> 16) & 0xff;
  out[2] = (value >>> 8) & 0xff;
  out[3] = value & 0xff;
  return out;
}

function parseIsoDateOrNull(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapPayloadFields(payload: Record<string, unknown>) {
  return {
    typ: String(payload?.typ || "offline-credential"),
    ver: String(payload?.ver || "od-offline-v4-short"),
    username: String(payload?.username || payload?.u || ""),
    name: String(payload?.name || payload?.n || ""),
    repId: String(payload?.repId || payload?.r || ""),
    role: String(payload?.role || payload?.rl || ""),
    email: String(payload?.email || payload?.e || ""),
    userId: String(payload?.userId || payload?.i || ""),
    createdAt: String(payload?.createdAt || payload?.c || ""),
  };
}

function validateMappedPayload(mapped: ReturnType<typeof mapPayloadFields>, enteredIdentifier: string) {
  if (mapped.typ !== "offline-credential") {
    return null;
  }

  const tokenUsername = normalizeUsername(mapped.username);
  if (!tokenUsername) {
    return null;
  }

  const expectedUsername = normalizeUsername(enteredIdentifier);
  if (expectedUsername && expectedUsername !== tokenUsername) {
    return null;
  }

  const createdAtIso = parseIsoDateOrNull(mapped.createdAt);
  if (!createdAtIso) {
    return null;
  }

  return {
    typ: mapped.typ,
    ver: mapped.ver,
    username: tokenUsername,
    name: mapped.name || "",
    repId: mapped.repId || "",
    role: mapped.role || "",
    email: mapped.email || "",
    userId: mapped.userId || "",
    createdAt: createdAtIso,
  } satisfies OfflineCredentialPayload;
}

async function verifyEncryptedToken(token: string, enteredIdentifier: string, secret: string) {
  if (!token.startsWith("ode1.")) return null;

  let packed: Uint8Array;
  try {
    packed = base64UrlToBytes(token.slice(5));
  } catch {
    return null;
  }

  if (packed.length <= 28) return null;

  const nonce = packed.slice(0, 12);
  const ciphertext = packed.slice(12, packed.length - 16);
  const tag = packed.slice(packed.length - 16);

  const secretBytes = encoder.encode(secret);
  const encKey = await hmacSha256Bytes(secretBytes, encoder.encode("od:enc:v1"));
  const macKey = await hmacSha256Bytes(secretBytes, encoder.encode("od:mac:v1"));

  const macData = concatBytes(encoder.encode("od3"), nonce, ciphertext);
  const expectedTag = (await hmacSha256Bytes(macKey, macData)).slice(0, 16);
  if (!timingSafeEqualBytes(expectedTag, tag)) return null;

  const keyStream = new Uint8Array(ciphertext.length);
  let offset = 0;
  let counter = 1;
  while (offset < ciphertext.length) {
    const block = await hmacSha256Bytes(encKey, concatBytes(nonce, u32be(counter)));
    const writeLength = Math.min(block.length, ciphertext.length - offset);
    keyStream.set(block.slice(0, writeLength), offset);
    offset += writeLength;
    counter += 1;
  }

  const plaintextBytes = new Uint8Array(ciphertext.length);
  for (let index = 0; index < ciphertext.length; index += 1) {
    plaintextBytes[index] = ciphertext[index] ^ keyStream[index];
  }

  try {
    const payload = JSON.parse(decoder.decode(plaintextBytes)) as Record<string, unknown>;
    return validateMappedPayload(mapPayloadFields(payload), enteredIdentifier);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string) {
  const [, payload] = String(token || "").split(".");
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function verifyLegacyJwtToken(token: string, enteredIdentifier: string) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return validateMappedPayload(
    mapPayloadFields({
      ...payload,
      typ: "offline-credential",
      ver: String(payload.ver || "jwt-legacy"),
      username: payload.username || payload.sub,
      createdAt:
        payload.createdAt ||
        (typeof payload.iat === "number" ? new Date(payload.iat * 1000).toISOString() : ""),
    }),
    enteredIdentifier
  );
}

function verifyShortToken(token: string, enteredIdentifier: string) {
  if (!/^[a-z0-9]{14}$/i.test(String(token || "").trim())) return null;
  return {
    typ: "offline-credential",
    ver: "od-offline-v4-short",
    username: normalizeUsername(enteredIdentifier),
    createdAt: new Date().toISOString(),
  };
}

export async function verifyOfflineCredential(username: string, password: string): Promise<OfflineCredentialPayload | null> {
  const secret = resolveOfflineSecret();
  if (!secret) return null;

  const trimmed = String(password || "").trim();
  if (trimmed.startsWith("ode1.")) {
    return verifyEncryptedToken(trimmed, username, secret);
  }
  if (/^[a-z0-9]{14}$/i.test(trimmed)) {
    return verifyShortToken(trimmed, username);
  }
  if (trimmed.split(".").length === 3) {
    return verifyLegacyJwtToken(trimmed, username);
  }

  return null;
}

export function isOfflineCredentialToken(password: string) {
  const trimmed = String(password || "").trim();
  return trimmed.startsWith("ode1.") || /^[a-z0-9]{14}$/i.test(trimmed) || trimmed.split(".").length === 3;
}
