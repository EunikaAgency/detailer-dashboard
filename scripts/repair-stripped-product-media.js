#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");

const envArgIndex = args.findIndex((arg) => arg === "--env");
const envPath =
  envArgIndex !== -1 && args[envArgIndex + 1]
    ? args[envArgIndex + 1]
    : ".env.production";

dotenv.config({ path: path.resolve(process.cwd(), envPath), quiet: true });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("Missing MONGO_URI or MONGODB_URI.");
  process.exit(1);
}

const MEDIA_ITEM_FIELDS = {
  type: String,
  url: String,
  title: String,
  size: Number,
  status: String,
  groupId: String,
  sourceName: String,
  thumbnailUrl: String,
  hotspots: [
    new mongoose.Schema(
      {
        id: String,
        x: Number,
        y: Number,
        w: Number,
        h: Number,
        shape: String,
        targetPageId: String,
      },
      { _id: false }
    ),
  ],
};

const ProductSchema = new mongoose.Schema(
  {
    name: String,
    brandName: String,
    media: [new mongoose.Schema(MEDIA_ITEM_FIELDS, { _id: true })],
  },
  { collection: "products" }
);

const Product =
  mongoose.models.ProductMediaRepair ||
  mongoose.model("ProductMediaRepair", ProductSchema);

const REPAIR_TARGETS = {
  "SAMSCA": "public/uploads/product-library/tolvaptan/samsca-case-based-detailer-2026-f",
  "JINARC": "public/uploads/product-library/tolvaptan/jinarc-case-based-detailer-2026",
  "MUCOSTA": "public/uploads/product-library/muscosta/mucosta-daily-detailer-2026",
  "PLETAAL": "public/uploads/product-library/pletaal/pletaal-slides",
  "AMINOLEBAN ORAL": "public/uploads/product-library/aminoleban-oral/aminoleban-one-detailer",
  "MEPTIN": "public/uploads/product-library/meptin/meptin-one-detailer",
};

function toUploadUrl(filePath) {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  return `/${relativePath.replace(/^public\//, "")}`;
}

function getImageFiles(dirPath) {
  const grouped = new Map();

  for (const entry of fs.readdirSync(dirPath)) {
    if (!/\.(png|jpe?g|webp)$/i.test(entry)) continue;

    const match = entry.match(/slide-(\d+)(-thumbnail)?\.[a-z0-9]+$/i);
    if (!match) continue;

    const slideNumber = Number(match[1]);
    const isThumbnailVariant = Boolean(match[2]);
    const existing = grouped.get(slideNumber) || {};

    if (isThumbnailVariant) {
      existing.thumbnail = entry;
    } else {
      existing.primary = entry;
    }

    grouped.set(slideNumber, existing);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, entry]) => entry.primary || entry.thumbnail)
    .filter(Boolean)
    .map((entry) => path.join(dirPath, entry));
}

function buildMediaItems(files, currentMedia, fallbackName) {
  const firstMedia = Array.isArray(currentMedia) ? currentMedia[0] : null;
  const groupId =
    String(firstMedia?.groupId || "").trim() ||
    `repair-${Date.now()}-${fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const sourceName = String(firstMedia?.sourceName || "").trim() || fallbackName;

  return files.map((filePath) => {
    const stats = fs.statSync(filePath);
    const url = toUploadUrl(filePath);

    return {
      type: "image",
      url,
      title: path.basename(filePath),
      size: stats.size,
      status: "ready",
      groupId,
      sourceName,
      thumbnailUrl: url,
      hotspots: [],
    };
  });
}

async function main() {
  await mongoose.connect(mongoUri);

  const products = await Product.find(
    { name: { $in: Object.keys(REPAIR_TARGETS) } },
    { name: 1, brandName: 1, media: 1 }
  ).lean();

  const repairs = [];

  for (const product of products) {
    const key = String(product.name || "").trim().toUpperCase();
    const assetDir = REPAIR_TARGETS[key];
    if (!assetDir) continue;

    const absoluteDir = path.resolve(process.cwd(), assetDir);
    if (!fs.existsSync(absoluteDir)) {
      throw new Error(`Missing asset directory for ${product.name}: ${absoluteDir}`);
    }

    const files = getImageFiles(absoluteDir);
    if (!files.length) {
      throw new Error(`No slide images found for ${product.name}: ${absoluteDir}`);
    }

    const nextMedia = buildMediaItems(files, product.media, product.brandName || product.name || key);
    const missingUrlCount = Array.isArray(product.media)
      ? product.media.filter((item) => !item?.url).length
      : 0;

    repairs.push({
      id: String(product._id),
      name: String(product.name || "").trim(),
      brandName: String(product.brandName || "").trim(),
      fileCount: files.length,
      previousMediaCount: Array.isArray(product.media) ? product.media.length : 0,
      missingUrlCount,
      sourceName: nextMedia[0]?.sourceName || null,
      groupId: nextMedia[0]?.groupId || null,
      nextMedia,
    });
  }

  console.log(
    JSON.stringify(
      repairs.map((repair) => ({
        id: repair.id,
        name: repair.name,
        brandName: repair.brandName,
        previousMediaCount: repair.previousMediaCount,
        missingUrlCount: repair.missingUrlCount,
        fileCount: repair.fileCount,
        sourceName: repair.sourceName,
        groupId: repair.groupId,
      })),
      null,
      2
    )
  );

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to update records.");
    await mongoose.connection.close();
    return;
  }

  const bulkOps = repairs.map((repair) => ({
    updateOne: {
      filter: { _id: repair.id },
      update: { $set: { media: repair.nextMedia } },
    },
  }));

  const result = await Product.bulkWrite(bulkOps);
  console.log(
    JSON.stringify(
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
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
