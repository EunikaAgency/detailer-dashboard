#!/usr/bin/env node

const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");

const getArgValue = (name, fallback = "") => {
  const index = args.findIndex((arg) => arg === name);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const envPath = getArgValue("--env", ".env.development");
dotenv.config({ path: path.resolve(process.cwd(), envPath), quiet: true });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("Missing MONGO_URI or MONGODB_URI.");
  process.exit(1);
}

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    brandName: String,
    media: [
      new mongoose.Schema(
        {
          type: String,
          title: String,
          groupTitle: String,
          sourceName: String,
        },
        { _id: false }
      ),
    ],
  },
  { collection: "products" }
);

const UserSchema = new mongoose.Schema(
  {
    name: String,
    username: String,
    repId: String,
    role: String,
    accessType: String,
  },
  { collection: "users" }
);

const SlideRetentionSchema = new mongoose.Schema({}, { strict: false, collection: "slideretentions" });

const Product =
  mongoose.models.ReportSeedProduct ||
  mongoose.model("ReportSeedProduct", ProductSchema);
const User =
  mongoose.models.ReportSeedUser ||
  mongoose.model("ReportSeedUser", UserSchema);
const SlideRetention =
  mongoose.models.ReportSeedSlideRetention ||
  mongoose.model("ReportSeedSlideRetention", SlideRetentionSchema);

const normalizeText = (value) => String(value || "").trim();
const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const cleanLabel = (value) =>
  normalizeText(value)
    .replace(/\.(pdf|ppt|pptx|html?|jpg|jpeg|png)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseSlideNumber = (value, fallback) => {
  const normalized = normalizeText(value);
  const match = normalized.match(/slide[-_\s]?0*([0-9]+)/i);
  if (match) return Number.parseInt(match[1], 10);
  return fallback;
};

const toMonthStartUtc = (year, monthIndex) => new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));

const buildAttachmentGroups = (product) => {
  const groups = new Map();

  (Array.isArray(product?.media) ? product.media : []).forEach((media, mediaIndex) => {
    const type = normalizeText(media?.type).toLowerCase();
    if (!["image", "html", "pdf"].includes(type)) return;

    const groupLabel =
      normalizeText(media?.groupTitle) ||
      normalizeText(media?.sourceName) ||
      normalizeText(media?.title) ||
      normalizeText(product?.name) ||
      "Untitled Attachment";

    const groupKey = groupLabel;
    const current = groups.get(groupKey) || {
      label: groupLabel,
      slides: [],
    };

    const fallbackNumber = current.slides.length + 1;
    const slideNumber = parseSlideNumber(media?.title || media?.sourceName, fallbackNumber);
    const slideTitle =
      cleanLabel(media?.title) ||
      cleanLabel(media?.sourceName) ||
      `Slide ${slideNumber}`;

    current.slides.push({
      mediaIndex,
      slideNumber,
      slideTitle,
      slideId: `${slugify(groupLabel)}-${String(slideNumber).padStart(3, "0")}`,
      slideType: type || "image",
    });

    groups.set(groupKey, current);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      slides: group.slides
        .sort(
          (left, right) =>
            left.slideNumber - right.slideNumber ||
            left.mediaIndex - right.mediaIndex ||
            left.slideTitle.localeCompare(right.slideTitle)
        )
        .map(({ mediaIndex, ...slide }) => slide),
    }))
    .filter((group) => group.slides.length > 0)
    .sort(
      (left, right) =>
        right.slides.length - left.slides.length ||
        left.label.localeCompare(right.label)
    );
};

const pickUsers = (users, limit) => {
  const normalizedUsers = [...users].sort((left, right) => {
    const leftLabel = normalizeText(left?.name) || normalizeText(left?.username) || normalizeText(left?.repId);
    const rightLabel = normalizeText(right?.name) || normalizeText(right?.username) || normalizeText(right?.repId);
    return leftLabel.localeCompare(rightLabel);
  });

  const representatives = normalizedUsers.filter((user) => {
    const accessType = normalizeText(user?.accessType).toLowerCase();
    const role = normalizeText(user?.role).toLowerCase();
    return accessType === "representative" || role.includes("representative");
  });

  return (representatives.length ? representatives : normalizedUsers).slice(0, limit);
};

const distributeSessionDate = (monthStart, totalSessions, sessionIndex) => {
  const dayOffset = totalSessions > 0 ? sessionIndex % Math.min(24, totalSessions) : 0;
  const hour = 9 + (sessionIndex % 8);
  const minute = (sessionIndex * 11) % 60;
  return new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth(),
      1 + dayOffset,
      hour,
      minute,
      0,
      0
    )
  );
};

async function main() {
  const latestRetention = await (async () => {
    await mongoose.connect(mongoUri);
    const latest = await SlideRetention.findOne({}).sort({ endedAt: -1 }).select("endedAt").lean();
    await mongoose.connection.close();
    return latest;
  })();

  await mongoose.connect(mongoUri);

  const latestEndedAt = latestRetention?.endedAt ? new Date(latestRetention.endedAt) : new Date();
  const defaultYear = latestEndedAt.getUTCFullYear();
  const defaultMonth = latestEndedAt.getUTCMonth() + 1;
  const targetYear = parsePositiveInt(getArgValue("--year"), defaultYear);
  const targetMonth = Math.min(12, parsePositiveInt(getArgValue("--month"), defaultMonth));
  const targetMonthIndex = targetMonth - 1;
  const monthStart = toMonthStartUtc(targetYear, targetMonthIndex);
  const monthEnd = toMonthStartUtc(targetMonth === 12 ? targetYear + 1 : targetYear, targetMonth === 12 ? 0 : targetMonthIndex + 1);
  const monthKey = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

  const userLimit = parsePositiveInt(getArgValue("--users"), 6);
  const attachmentsPerProduct = parsePositiveInt(getArgValue("--attachments"), Number.MAX_SAFE_INTEGER);
  const slidesPerAttachment = parsePositiveInt(getArgValue("--slides"), Number.MAX_SAFE_INTEGER);

  const seedMatch = {
    "details.seeded": true,
    "details.seedSource": "seed-slide-retention-chart.js",
    "details.seedScope": "dashboard-slide-retention",
    endedAt: { $gte: monthStart, $lt: monthEnd },
  };

  const [users, products, currentMonthRows, existingSeedRowsInMonth] = await Promise.all([
    User.find({}).select("name username repId role accessType").lean(),
    Product.find({}).select("name brandName media.type media.title media.groupTitle media.sourceName").lean(),
    SlideRetention.find({
      endedAt: { $gte: monthStart, $lt: monthEnd },
    })
      .select("presentationId durationMinutes details.seeded")
      .lean(),
    SlideRetention.countDocuments(seedMatch),
  ]);

  const selectedUsers = pickUsers(users, userLimit);
  if (!selectedUsers.length) {
    throw new Error("No users found to seed slide retention data.");
  }

  const currentMinutesByProductId = new Map();
  currentMonthRows.forEach((row) => {
    if (row?.details?.seeded) return;
    const key = normalizeText(row?.presentationId);
    if (!key) return;
    currentMinutesByProductId.set(
      key,
      Number((currentMinutesByProductId.get(key) || 0) + Number(row?.durationMinutes || 0))
    );
  });

  const preparedProducts = products
    .map((product) => ({
      product,
      brandName: normalizeText(product?.brandName) || normalizeText(product?.name) || "Unknown Brand",
      attachmentGroups: buildAttachmentGroups(product).slice(0, attachmentsPerProduct),
      currentMinutes: Number(currentMinutesByProductId.get(String(product?._id || "")) || 0),
    }))
    .filter((entry) => entry.attachmentGroups.length > 0)
    .sort(
      (left, right) =>
        right.currentMinutes - left.currentMinutes ||
        right.attachmentGroups.length - left.attachmentGroups.length ||
        left.brandName.localeCompare(right.brandName)
    );

  if (!preparedProducts.length) {
    throw new Error("No products with usable media were found.");
  }

  let generatedCount = 0;
  const operations = [];
  const summaryRows = [];

  preparedProducts.forEach((entry, productIndex) => {
    const productId = String(entry.product._id);
    const productName = normalizeText(entry.product?.name) || entry.brandName;
    const productSlug = slugify(productName);
    const baselineSessions =
      entry.currentMinutes > 0
        ? Math.min(4, Math.max(2, Math.round(entry.currentMinutes / 8)))
        : productIndex < 2
          ? 3
          : 2;

    let productSeedMinutes = 0;

    entry.attachmentGroups.forEach((group, attachmentIndex) => {
      const selectedSlides = group.slides.slice(0, Math.min(slidesPerAttachment, group.slides.length));
      const sessionCount = Math.max(1, baselineSessions - attachmentIndex);

      for (let sessionIndex = 0; sessionIndex < sessionCount; sessionIndex += 1) {
        const user = selectedUsers[(productIndex + attachmentIndex + sessionIndex) % selectedUsers.length];
        const sessionDate = distributeSessionDate(monthStart, preparedProducts.length * 4, generatedCount + sessionIndex);
        const sessionId = `seed-session-${monthKey}-${productSlug}-${slugify(group.label)}-${String(sessionIndex + 1).padStart(2, "0")}`;

        selectedSlides.forEach((slide, slideIndex) => {
          const durationSeconds =
            36 +
            Math.max(0, selectedSlides.length - slideIndex) * 10 +
            productIndex * 3 +
            attachmentIndex * 5 +
            sessionIndex * 4;
          const durationMs = durationSeconds * 1000;
          const startedAt = new Date(sessionDate.getTime() + slideIndex * 90000 + sessionIndex * 20000);
          const endedAt = new Date(startedAt.getTime() + durationMs);
          const retentionId = [
            "seed",
            monthKey,
            productSlug,
            slugify(group.label),
            String(sessionIndex + 1).padStart(2, "0"),
            String(slide.slideNumber).padStart(3, "0"),
            String(user._id),
          ].join("-");

          generatedCount += 1;
          productSeedMinutes += durationMs / 60000;

          operations.push({
            updateOne: {
              filter: {
                userId: user._id,
                retentionId,
              },
              update: {
                $setOnInsert: {
                  userId: user._id,
                  retentionId,
                  sessionId,
                  method: "password",
                  source: "online",
                  presentationId: productId,
                  caseId: `${productId}-${slugify(group.label)}`,
                  deckId: `${productId}-${slugify(group.label)}`,
                  presentationTitle: productName,
                  deckTitle: group.label,
                  slideId: slide.slideId,
                  slideIndex: Math.max(0, slide.slideNumber - 1),
                  slideNumber: slide.slideNumber,
                  slideTitle: slide.slideTitle,
                  slideType: slide.slideType,
                  startedAt,
                  endedAt,
                  durationMs,
                  durationSeconds: Number((durationMs / 1000).toFixed(2)),
                  durationMinutes: Number((durationMs / 60000).toFixed(4)),
                  browser: "Chrome",
                  browserName: "Chrome",
                  browserVersion: "146.0.0.0",
                  platform: "Win32",
                  os: "Windows",
                  device: "Desktop",
                  userAgent:
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
                  details: {
                    seeded: true,
                    seedSource: "seed-slide-retention-chart.js",
                    seedScope: "dashboard-slide-retention",
                    seedMonth: monthKey,
                    productId,
                    productName,
                    brandName: entry.brandName,
                    deckTitle: group.label,
                    flushReason: "seeded_for_reports",
                  },
                },
              },
              upsert: true,
            },
          });
        });
      }

      summaryRows.push({
        brand: entry.brandName,
        product: productName,
        attachment: group.label,
        slidesSeeded: selectedSlides.length,
        sessionsSeeded: sessionCount,
      });
    });

    entry.seedMinutes = Number(productSeedMinutes.toFixed(2));
  });

  const preview = {
    mode: shouldApply ? "apply" : "dry-run",
    envPath,
    targetMonth: monthKey,
    representativeUsersPicked: selectedUsers.length,
    productsSeeded: preparedProducts.length,
    recordsPlanned: operations.length,
    existingSlideRetentionRowsInMonth: currentMonthRows.length,
    existingSeedRowsInMonth,
    brands: preparedProducts.map((entry) => ({
      brand: entry.brandName,
      product: normalizeText(entry.product?.name) || entry.brandName,
      currentMinutes: Number(entry.currentMinutes.toFixed(2)),
      seedMinutes: entry.seedMinutes,
      attachments: entry.attachmentGroups.map((group) => group.label),
    })),
    attachments: summaryRows,
  };

  console.log(JSON.stringify(preview, null, 2));

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to upsert the seed records.");
    await mongoose.connection.close();
    return;
  }

  if (existingSeedRowsInMonth > 0) {
    await SlideRetention.deleteMany(seedMatch);
  }

  const result = await SlideRetention.bulkWrite(operations, { ordered: false });

  console.log(
    JSON.stringify(
      {
        matchedCount: Number(result?.matchedCount || 0),
        modifiedCount: Number(result?.modifiedCount || 0),
        upsertedCount: Number(result?.upsertedCount || 0),
        insertedCount: Number(result?.insertedCount || 0),
      },
      null,
      2
    )
  );

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
