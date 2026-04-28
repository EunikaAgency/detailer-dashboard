/**
 * Backfill blank or unassigned user divisions to "Office".
 *
 * Usage:
 *   node scripts/migrate-office-division.js staging
 *   node scripts/migrate-office-division.js live
 *   node scripts/migrate-office-division.js staging --dry-run
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const OFFICE_DIVISION_LABEL = "Office";
const VALID_TARGETS = new Set(["staging", "live"]);
const target = String(process.argv[2] || "").trim().toLowerCase();
const isDryRun = process.argv.includes("--dry-run");

if (!VALID_TARGETS.has(target)) {
  console.error('Usage: node scripts/migrate-office-division.js <staging|live> [--dry-run]');
  process.exit(1);
}

const envFile = target === "live" ? ".env.production" : ".env.development";
const envPath = path.join(__dirname, "..", envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Error: ${envFile} not found at ${envPath}`);
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(envPath));
const mongoUri = env.MONGO_URI || "";

if (!mongoUri) {
  console.error(`Error: MONGO_URI is missing in ${envFile}`);
  process.exit(1);
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    username: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "" },
    division: { type: String, default: "" },
  },
  {
    collection: "users",
    strict: false,
    timestamps: true,
  }
);

const User = mongoose.models.OfficeDivisionMigrationUser || mongoose.model("OfficeDivisionMigrationUser", userSchema);

const query = {
  $or: [
    { division: { $exists: false } },
    { division: null },
    { division: "" },
    { division: /^\s+$/ },
    { division: "Unassigned" },
    { division: "Unassigned Division" },
  ],
};

async function run() {
  try {
    await mongoose.connect(mongoUri);

    const affectedCount = await User.countDocuments(query);
    const sample = await User.find(query)
      .select("name username email role division")
      .sort({ createdAt: -1, _id: -1 })
      .limit(10)
      .lean();

    console.log(`Target: ${target}`);
    console.log(`Mode: ${isDryRun ? "dry-run" : "apply"}`);
    console.log(`Affected users: ${affectedCount}`);
    console.log("Sample:");
    console.log(JSON.stringify(sample, null, 2));

    if (isDryRun || affectedCount === 0) {
      await mongoose.connection.close();
      process.exit(0);
    }

    const result = await User.updateMany(query, {
      $set: { division: OFFICE_DIVISION_LABEL },
    });

    const remainingCount = await User.countDocuments(query);
    const officeCount = await User.countDocuments({ division: OFFICE_DIVISION_LABEL });

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    console.log(`Remaining unassigned users: ${remainingCount}`);
    console.log(`Total Office users: ${officeCount}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

run();
