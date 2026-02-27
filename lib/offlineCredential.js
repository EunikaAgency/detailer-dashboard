import crypto from "crypto";
import jwt from "jsonwebtoken";

export const OFFLINE_CREDENTIAL_VERSION = "od-offline-v4-short";

const ENCRYPTED_PREFIX = "ode1.";
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

const SHORT_TS_LENGTH = 6;
const SHORT_MAC_LENGTH = 8;
const SHORT_KEY_PATTERN = new RegExp(`^[a-z0-9]{${SHORT_TS_LENGTH + SHORT_MAC_LENGTH}}$`);

const normalize = (value) => String(value || "").trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toUtf8Bytes = (value) => Buffer.from(String(value || ""), "utf8");

const fromBase64Url = (value) => {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
};

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const timingSafeEquals = (left, right) => {
  const a = Buffer.from(left || []);
  const b = Buffer.from(right || []);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const deriveKey = (secret, label) =>
  crypto.createHmac("sha256", toUtf8Bytes(secret)).update(toUtf8Bytes(label)).digest();

const hmacSha256 = (keyBytes, messageBytes) =>
  crypto
    .createHmac("sha256", Buffer.from(keyBytes))
    .update(Buffer.from(messageBytes))
    .digest();

const buildCounterBytes = (value) => {
  const counter = value >>> 0;
  return Buffer.from([
    (counter >>> 24) & 0xff,
    (counter >>> 16) & 0xff,
    (counter >>> 8) & 0xff,
    counter & 0xff,
  ]);
};

const buildKeystream = (encKey, nonce, length) => {
  const chunks = [];
  let produced = 0;
  let counter = 1;

  while (produced < length) {
    const block = hmacSha256(encKey, Buffer.concat([nonce, buildCounterBytes(counter)]));
    chunks.push(block);
    produced += block.length;
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
};

const xorBytes = (left, right) => {
  const out = Buffer.alloc(left.length);
  for (let i = 0; i < left.length; i += 1) {
    out[i] = left[i] ^ right[i];
  }
  return out;
};

const encryptPayload = (payload, secret) => {
  const plaintext = toUtf8Bytes(JSON.stringify(payload));
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  const encKey = deriveKey(secret, "od:enc:v1");
  const macKey = deriveKey(secret, "od:mac:v1");

  const keystream = buildKeystream(encKey, nonce, plaintext.length);
  const ciphertext = xorBytes(plaintext, keystream);
  const tag = hmacSha256(
    macKey,
    Buffer.concat([toUtf8Bytes("od3"), nonce, ciphertext])
  ).subarray(0, TAG_LENGTH);

  const encoded = toBase64Url(Buffer.concat([nonce, ciphertext, tag]));
  return `${ENCRYPTED_PREFIX}${encoded}`;
};

const decryptPayload = (token, secret) => {
  if (!token.startsWith(ENCRYPTED_PREFIX)) return null;

  const encoded = token.slice(ENCRYPTED_PREFIX.length);
  const packed = fromBase64Url(encoded);

  if (!packed || packed.length <= NONCE_LENGTH + TAG_LENGTH) return null;

  const nonce = packed.subarray(0, NONCE_LENGTH);
  const tag = packed.subarray(packed.length - TAG_LENGTH);
  const ciphertext = packed.subarray(NONCE_LENGTH, packed.length - TAG_LENGTH);

  const encKey = deriveKey(secret, "od:enc:v1");
  const macKey = deriveKey(secret, "od:mac:v1");

  const expectedTag = hmacSha256(
    macKey,
    Buffer.concat([toUtf8Bytes("od3"), nonce, ciphertext])
  ).subarray(0, TAG_LENGTH);

  if (!timingSafeEquals(tag, expectedTag)) {
    return null;
  }

  const keystream = buildKeystream(encKey, nonce, ciphertext.length);
  const plaintext = xorBytes(ciphertext, keystream);

  try {
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
};

const mapEncryptedPayload = (decoded) => ({
  typ: decoded?.typ || "offline-credential",
  ver: decoded?.ver || OFFLINE_CREDENTIAL_VERSION,
  username: decoded?.username || decoded?.u || "",
  name: decoded?.name || decoded?.n || "",
  repId: decoded?.repId || decoded?.r || "",
  role: decoded?.role || decoded?.rl || "",
  email: decoded?.email || decoded?.e || "",
  userId: decoded?.userId || decoded?.i || "",
  createdAt: decoded?.createdAt || decoded?.c || "",
});

const toTimestampPart = (date) => {
  const minutes = Math.floor(date.getTime() / 60000);
  return minutes.toString(36).padStart(SHORT_TS_LENGTH, "0").slice(-SHORT_TS_LENGTH);
};

const fromTimestampPart = (value) => {
  const minutes = parseInt(String(value || ""), 36);
  if (!Number.isFinite(minutes) || Number.isNaN(minutes) || minutes <= 0) return null;
  const parsed = new Date(minutes * 60000);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const shortMac = (secret, username, tsPart) =>
  crypto
    .createHmac("sha256", secret)
    .update(`${username}|${tsPart}`)
    .digest("hex")
    .slice(0, SHORT_MAC_LENGTH)
    .toLowerCase();

const verifyLegacyJwtCredential = (credential, secret) => {
  try {
    const decoded = jwt.verify(String(credential || "").trim(), secret);
    if (!decoded || typeof decoded !== "object") return null;
    const looksLegacyCredential =
      decoded.typ === "offline-credential" ||
      Boolean(decoded.username || decoded.userId || decoded.email);
    if (!looksLegacyCredential) return null;

    const normalized = normalizeIdentity(decoded);
    const createdAt = new Date(decoded.createdAt || decoded.iat * 1000 || Date.now());
    if (!normalized.username) return null;
    if (Number.isNaN(createdAt.getTime())) return null;

    return {
      ...decoded,
      username: normalized.username,
      name: normalized.name,
      repId: normalized.repId,
      role: normalized.role,
      email: normalized.email,
      userId: normalized.userId,
      createdAt: createdAt.toISOString(),
      ver: String(decoded.ver || "od-offline-v1"),
      format: "jwt",
    };
  } catch {
    return null;
  }
};

const verifyLegacyShortCredential = (token, options, secret) => {
  if (!SHORT_KEY_PATTERN.test(token)) {
    return null;
  }

  const username = normalizeIdentifier(
    options.username || options.identifier || options.name || options.email || options.repId
  );
  if (!username) return null;

  const tsPart = token.slice(0, SHORT_TS_LENGTH);
  const providedMac = token.slice(SHORT_TS_LENGTH);
  const expectedMac = shortMac(secret, username, tsPart);

  if (!timingSafeEquals(toUtf8Bytes(providedMac), toUtf8Bytes(expectedMac))) {
    return null;
  }

  const createdAt = fromTimestampPart(tsPart);
  if (!createdAt) return null;

  return {
    typ: "offline-credential",
    ver: OFFLINE_CREDENTIAL_VERSION,
    username,
    name: normalize(options.name || username),
    repId: normalize(options.repId),
    role: normalize(options.role),
    email: normalize(options.email).toLowerCase(),
    userId: normalize(options.userId),
    createdAt: createdAt.toISOString(),
    format: "short",
  };
};

export const getOfflineCredentialSecret = () => {
  const preferred = process.env.OFFLINE_CREDENTIAL_SECRET;
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }

  const fallback = process.env.JWT_SECRET;
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : null;
};

export const normalizeIdentifier = (value) =>
  normalize(value)
    .replace(/\s+/g, " ")
    .toLowerCase();

export const normalizeIdentity = (identity = {}) => {
  const username = normalize(identity.username || identity.name || identity.email || identity.repId);
  const name = normalize(identity.name || username);
  const repId = normalize(identity.repId);
  const role = normalize(identity.role);
  const email = normalize(identity.email).toLowerCase();
  const userId = normalize(identity.userId);

  return {
    username,
    name,
    repId,
    role,
    email,
    userId,
  };
};

export const buildIdentifierQuery = (identifier) => {
  const normalized = normalize(identifier);
  if (!normalized) return null;
  const safe = escapeRegex(normalized);
  const exactInsensitive = new RegExp(`^${safe}$`, "i");
  return {
    $or: [{ email: exactInsensitive }, { username: exactInsensitive }, { repId: exactInsensitive }],
  };
};

export const issueOfflineCredential = (identity, options = {}) => {
  const secret = getOfflineCredentialSecret();
  if (!secret) return null;

  const clean = normalizeIdentity(identity);
  if (!clean.username) return null;

  const issuedAt = options.issuedAt ? new Date(options.issuedAt) : new Date();
  const createdAt = Number.isNaN(issuedAt.getTime()) ? new Date() : issuedAt;
  const tsPart = toTimestampPart(createdAt);
  const mac = shortMac(secret, normalizeIdentifier(clean.username), tsPart);
  return `${tsPart}${mac}`;
};

export const verifyOfflineCredential = (credential, options = {}) => {
  const secret = options.secret || getOfflineCredentialSecret();
  if (!secret) return null;

  const token = String(credential || "").trim();
  if (!token) return null;

  if (token.startsWith(ENCRYPTED_PREFIX)) {
    const decoded = decryptPayload(token, secret);
    if (!decoded || typeof decoded !== "object") return null;
    const mapped = mapEncryptedPayload(decoded);
    if (mapped.typ !== "offline-credential") return null;

    const normalized = normalizeIdentity(mapped);
    const createdAt = new Date(mapped.createdAt);

    if (!normalized.username) return null;
    if (Number.isNaN(createdAt.getTime())) return null;

    return {
      ...mapped,
      username: normalized.username,
      name: normalized.name,
      repId: normalized.repId,
      role: normalized.role,
      email: normalized.email,
      userId: normalized.userId,
      createdAt: createdAt.toISOString(),
      ver: mapped.ver || OFFLINE_CREDENTIAL_VERSION,
      format: "enc",
    };
  }

  if (token.includes(".")) {
    return verifyLegacyJwtCredential(token, secret);
  }

  return verifyLegacyShortCredential(token.toLowerCase(), options, secret);
};

export const credentialMatchesUsername = (credentialPayload, inputUsername) => {
  const tokenUsername = normalizeIdentifier(credentialPayload?.username);
  const entered = normalizeIdentifier(inputUsername);
  if (!tokenUsername || !entered) return false;
  return tokenUsername === entered;
};
