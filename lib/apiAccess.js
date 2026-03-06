import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import AppSetting from "@/models/AppSetting";

const SETTINGS_NAME = "global";
const CACHE_TTL_MS = 5000;
let cachedApiLoginRequired = null;
let cachedAtMs = 0;

const toApiLoginRequired = (doc) => doc?.apiLoginRequired !== false;

export const getApiLoginRequired = async ({ forceRefresh = false } = {}) => {
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedApiLoginRequired !== null &&
    now - cachedAtMs < CACHE_TTL_MS
  ) {
    return cachedApiLoginRequired;
  }

  await connectDB();
  const doc = await AppSetting.findOne({ name: SETTINGS_NAME })
    .select("apiLoginRequired")
    .lean();
  const value = toApiLoginRequired(doc);
  cachedApiLoginRequired = value;
  cachedAtMs = now;
  return value;
};

export const setApiLoginRequired = async (apiLoginRequired) => {
  await connectDB();
  const doc = await AppSetting.findOneAndUpdate(
    { name: SETTINGS_NAME },
    {
      $set: {
        name: SETTINGS_NAME,
        apiLoginRequired: Boolean(apiLoginRequired),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const value = toApiLoginRequired(doc);
  cachedApiLoginRequired = value;
  cachedAtMs = Date.now();
  return value;
};

export const requireApiAuthIfEnabled = async (request) => {
  const apiLoginRequired = await getApiLoginRequired();
  if (!apiLoginRequired) {
    return { apiLoginRequired, user: null };
  }

  const auth = await requireAuth(request);
  return {
    apiLoginRequired,
    ...auth,
  };
};
