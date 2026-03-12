#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");

const envArgIndex = args.findIndex((arg) => arg === "--env");
const envPath =
  envArgIndex !== -1 && args[envArgIndex + 1]
    ? args[envArgIndex + 1]
    : ".env.production";

const backupArgIndex = args.findIndex((arg) => arg === "--backup");
const backupPath =
  backupArgIndex !== -1 && args[backupArgIndex + 1]
    ? args[backupArgIndex + 1]
    : "backups/db/live-2026-03-06_02-14-53/otsuka_prod/products.bson.gz";

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
        },
        { _id: true }
      ),
    ],
  },
  { collection: "products" }
);

const Product =
  mongoose.models.ProductHotspotRestore ||
  mongoose.model("ProductHotspotRestore", ProductSchema);

const TARGET_KEYS = new Set([
  "SAMSCA",
  "JINARC",
  "MUCOSTA",
  "MUSCOSTA",
  "PLETAAL",
  "AMINOLEBAN ORAL",
  "MEPTIN",
]);

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

function loadBackupDocuments() {
  const absoluteBackupPath = path.resolve(process.cwd(), backupPath);
  if (!fs.existsSync(absoluteBackupPath)) {
    throw new Error(`Backup file not found: ${absoluteBackupPath}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "otsuka-hotspot-restore-"));
  const tempBsonPath = path.join(tempDir, "products.bson");

  try {
    fs.writeFileSync(tempBsonPath, zlib.gunzipSync(fs.readFileSync(absoluteBackupPath)));
    const jsonl = execFileSync("bsondump", [tempBsonPath], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });

    return jsonl
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildBackupLookup(docs) {
  const lookup = new Map();

  for (const doc of docs) {
    const keys = [normalizeKey(doc.brandName), normalizeKey(doc.name)].filter(Boolean);
    if (!keys.some((key) => TARGET_KEYS.has(key))) continue;

    for (const key of keys) {
      if (TARGET_KEYS.has(key)) {
        lookup.set(key === "MUSCOSTA" ? "MUCOSTA" : key, doc);
      }
    }
  }

  return lookup;
}

function readBsonNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (!value || typeof value !== "object") return 0;

  for (const key of ["$numberDouble", "$numberInt", "$numberLong", "$numberDecimal"]) {
    if (key in value) {
      const parsed = Number(value[key]);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return 0;
}

function restoreHotspots(currentMedia, backupMedia) {
  const backupUrlToIndex = new Map();
  backupMedia.forEach((item, index) => {
    if (item?.url) {
      backupUrlToIndex.set(String(item.url), index);
    }
  });

  return currentMedia.map((item, index) => {
    const backupItem = backupMedia[index];
    if (!backupItem) {
      return { ...item, hotspots: [] };
    }

    const restoredHotspots = (Array.isArray(backupItem.hotspots) ? backupItem.hotspots : [])
      .map((hotspot) => {
        const targetIndex = backupUrlToIndex.get(String(hotspot?.targetPageId || ""));
        if (targetIndex === undefined) return null;

        const targetMedia = currentMedia[targetIndex];
        if (!targetMedia?.url) return null;

        return {
          id: hotspot.id,
          x: readBsonNumber(hotspot.x),
          y: readBsonNumber(hotspot.y),
          w: readBsonNumber(hotspot.w),
          h: readBsonNumber(hotspot.h),
          shape: hotspot.shape || "rectangle",
          targetPageId: targetMedia.url,
        };
      })
      .filter(Boolean);

    return {
      ...item,
      hotspots: restoredHotspots,
    };
  });
}

async function main() {
  const backupDocs = loadBackupDocuments();
  const backupLookup = buildBackupLookup(backupDocs);

  await mongoose.connect(mongoUri);

  const currentProducts = await Product.find(
    { brandName: { $in: ["SAMSCA", "JINARC", "MUCOSTA", "PLETAAL", "AMINOLEBAN ORAL", "MEPTIN"] } },
    { name: 1, brandName: 1, media: 1 }
  ).lean();

  const updates = [];

  for (const product of currentProducts) {
    const key = normalizeKey(product.brandName || product.name);
    const backupDoc = backupLookup.get(key);
    if (!backupDoc) {
      throw new Error(`No backup document found for ${product.brandName || product.name}`);
    }

    const currentMedia = Array.isArray(product.media) ? product.media : [];
    const backupMedia = Array.isArray(backupDoc.media) ? backupDoc.media : [];
    const nextMedia = restoreHotspots(currentMedia, backupMedia);

    const previousHotspotCount = currentMedia.reduce(
      (sum, item) => sum + (Array.isArray(item.hotspots) ? item.hotspots.length : 0),
      0
    );
    const restoredHotspotCount = nextMedia.reduce(
      (sum, item) => sum + (Array.isArray(item.hotspots) ? item.hotspots.length : 0),
      0
    );

    updates.push({
      id: String(product._id),
      name: String(product.name || "").trim(),
      brandName: String(product.brandName || "").trim(),
      currentMediaCount: currentMedia.length,
      backupMediaCount: backupMedia.length,
      previousHotspotCount,
      restoredHotspotCount,
      nextMedia,
    });
  }

  console.log(
    JSON.stringify(
      updates.map((item) => ({
        id: item.id,
        name: item.name,
        brandName: item.brandName,
        currentMediaCount: item.currentMediaCount,
        backupMediaCount: item.backupMediaCount,
        previousHotspotCount: item.previousHotspotCount,
        restoredHotspotCount: item.restoredHotspotCount,
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

  const bulkOps = updates.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { media: item.nextMedia } },
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
