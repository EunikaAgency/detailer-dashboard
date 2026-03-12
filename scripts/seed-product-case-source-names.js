#!/usr/bin/env node

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
          sourceName: String,
          groupId: String,
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
  mongoose.models.ProductCaseSourceSeed ||
  mongoose.model("ProductCaseSourceSeed", ProductSchema);

const EXCLUDED_PRODUCTS = new Set(["ABILIFY MAINTENA", "REXULTI"]);

const normalizeKey = (value) => String(value || "").trim().toUpperCase();

function getTargetSourceName(product) {
  const productKey = normalizeKey(product.name || product.brandName);
  if (!productKey || EXCLUDED_PRODUCTS.has(productKey)) {
    return "";
  }

  const baseName = normalizeKey(product.brandName || product.name);
  if (!baseName) return "";

  return `${baseName} ONE DETAILER`;
}

async function main() {
  await mongoose.connect(mongoUri);

  const products = await Product.find({}, { name: 1, brandName: 1, media: 1 }).lean();

  const candidates = products
    .map((product) => {
      const targetSourceName = getTargetSourceName(product);
      if (!targetSourceName || !Array.isArray(product.media) || product.media.length === 0) {
        return null;
      }

      let changedCount = 0;
      const nextMedia = product.media.map((item) => {
        const currentSourceName = String(item?.sourceName || "").trim();
        if (currentSourceName === targetSourceName) {
          return item;
        }

        changedCount += 1;
        return {
          ...item,
          sourceName: targetSourceName,
        };
      });

      if (!changedCount) return null;

      return {
        id: String(product._id),
        name: String(product.name || "").trim(),
        brandName: String(product.brandName || "").trim(),
        targetSourceName,
        changedCount,
        nextMedia,
      };
    })
    .filter(Boolean);

  if (!candidates.length) {
    console.log("No product case source name updates needed.");
    await mongoose.connection.close();
    return;
  }

  console.log(`Found ${candidates.length} product(s) requiring case source name updates.`);
  console.log(
    JSON.stringify(
      candidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        brandName: candidate.brandName,
        targetSourceName: candidate.targetSourceName,
        changedCount: candidate.changedCount,
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

  const bulkOps = candidates.map((candidate) => ({
    updateOne: {
      filter: { _id: candidate.id },
      update: { $set: { media: candidate.nextMedia } },
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
