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
  mongoose.models.ProductCategorySeed ||
  mongoose.model("ProductCategorySeed", ProductSchema);

async function main() {
  await mongoose.connect(mongoUri);

  const products = await Product.find({}, { name: 1, brandName: 1, category: 1 }).lean();

  const candidates = products
    .map((product) => {
      const brandName = String(product.brandName || "").trim();
      const category = String(product.category || "").trim();
      if (!brandName || brandName === category) return null;

      return {
        id: String(product._id),
        name: String(product.name || "").trim(),
        brandName,
        category,
      };
    })
    .filter(Boolean);

  if (!candidates.length) {
    console.log("No product categories need updating.");
    await mongoose.connection.close();
    return;
  }

  console.log(`Found ${candidates.length} product(s) with category != brandName.`);
  console.log(JSON.stringify(candidates, null, 2));

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to update records.");
    await mongoose.connection.close();
    return;
  }

  const bulkOps = candidates.map((product) => ({
    updateOne: {
      filter: { _id: product.id },
      update: { $set: { category: product.brandName } },
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
