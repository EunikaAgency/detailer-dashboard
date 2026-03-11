const OFFLINE_EMAIL_DOMAIN = "@offline.otsuka.local";

const ADMIN_ROLE_KEYS = new Set([
  "admin",
  "administrator",
  "superadmin",
  "super admin",
  "systemadmin",
  "system admin",
  "systemadministrator",
  "system administrator",
  "owner",
]);

const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
export const normalizeAccessType = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "admin" || normalized === "representative" ? normalized : "";
};

export const normalizeRoleKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const getConfiguredValues = (...names) => {
  for (const name of names) {
    const raw = String(process.env[name] || "").trim();
    if (!raw) continue;
    return new Set(
      raw
        .split(",")
        .map((item) => normalizeText(item).toLowerCase())
        .filter(Boolean)
    );
  }
  return new Set();
};

export const getUserAccessType = (user) => {
  if (!user || typeof user !== "object") return "representative";

  const explicitAccessType = normalizeAccessType(user.accessType);
  if (explicitAccessType) {
    return explicitAccessType;
  }

  const roleKey = normalizeRoleKey(user.role);
  if (ADMIN_ROLE_KEYS.has(roleKey)) {
    return "admin";
  }

  const email = normalizeEmail(user.email);
  const username = normalizeText(user.username).toLowerCase();
  const repId = normalizeText(user.repId);

  const configuredAdminEmails = getConfiguredValues("ADMIN_EMAILS", "ADMIN_EMAIL");
  if (email && configuredAdminEmails.has(email)) {
    return "admin";
  }

  const configuredAdminUsernames = getConfiguredValues("ADMIN_USERNAMES", "ADMIN_USERNAME");
  if (username && configuredAdminUsernames.has(username)) {
    return "admin";
  }

  const hasRepresentativeSignals =
    Boolean(repId) ||
    (Boolean(roleKey) && !ADMIN_ROLE_KEYS.has(roleKey)) ||
    email.endsWith(OFFLINE_EMAIL_DOMAIN);

  if (hasRepresentativeSignals) {
    return "representative";
  }

  return "representative";
};

export const isAdminUser = (user) => getUserAccessType(user) === "admin";
