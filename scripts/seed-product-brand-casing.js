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
    category: String,
  },
  { collection: "products" }
);

const Product =
  mongoose.models.ProductBrandSeed ||
  mongoose.model("ProductBrandSeed", ProductSchema);

const EXPLICIT_BRAND_NAMES = new Map([
  ["ABILIFY MAINTENA", "Abilify Maintena®"],
  ["REXULTI", "Rexulti"],
]);

function toTargetBrandName(product) {
  const nameKey = String(product.name || "").trim().toUpperCase();
  const currentBrand = String(product.brandName || "").trim();

  if (EXPLICIT_BRAND_NAMES.has(nameKey)) {
    return EXPLICIT_BRAND_NAMES.get(nameKey);
  }

  return currentBrand.toUpperCase();
}

async function main() {
  await mongoose.connect(mongoUri);

  const products = await Product.find({}, { name: 1, brandName: 1, category: 1 }).lean();

  const candidates = products
    .map((product) => {
      const currentBrand = String(product.brandName || "").trim();
      const currentCategory = String(product.category || "").trim();
      const nextBrand = toTargetBrandName(product);
      if (!currentBrand || !nextBrand) return null;

      const update = {};
      if (currentBrand !== nextBrand) {
        update.brandName = nextBrand;
      }
      if (currentCategory === currentBrand && currentCategory !== nextBrand) {
        update.category = nextBrand;
      }

      if (!Object.keys(update).length) return null;

      return {
        id: String(product._id),
        name: String(product.name || "").trim(),
        currentBrand,
        nextBrand,
        currentCategory,
        nextCategory: update.category || currentCategory,
      };
    })
    .filter(Boolean);

  if (!candidates.length) {
    console.log("No product brand casing updates needed.");
    await mongoose.connection.close();
    return;
  }

  console.log(`Found ${candidates.length} product(s) requiring brand/category casing updates.`);
  console.log(JSON.stringify(candidates, null, 2));

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to update records.");
    await mongoose.connection.close();
    return;
  }

  const bulkOps = candidates.map((product) => {
    const update = { brandName: product.nextBrand };
    if (product.currentCategory === product.currentBrand) {
      update.category = product.nextCategory;
    }
    return {
      updateOne: {
        filter: { _id: product.id },
        update: { $set: update },
      },
    };
  });

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
