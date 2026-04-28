/**
 * Sync user Team and Division from the Salesforce CSV.
 *
 * In this app, the dashboard "Team" column is backed by `users.role`.
 * CSV `EmpID` is matched against `repId` first, then `username` as a fallback.
 *
 * Usage:
 *   node scripts/sync-user-team-division-from-csv.js staging --dry-run
 *   node scripts/sync-user-team-division-from-csv.js live
 *   node scripts/sync-user-team-division-from-csv.js live --csv "/abs/path/file.csv"
 */

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const XLSX = require("xlsx");

const VALID_TARGETS = new Set(["staging", "live"]);
const DEFAULT_CSV_NAME = "SalesForceInformationData V3.xlsx - PostReport.csv";

const OFFICE_DIVISION_LABEL = "Office";
const LEGACY_REPORT_DIVISION_ALIASES = {
  "Carry-All Prov": "Carry-All Province",
  CNS: "CNS Division",
};

const REPORT_DIVISION_VALUES = [
  OFFICE_DIVISION_LABEL,
  "CNS Division",
  "Key Accounts",
  "Carry-All GMA",
  "Carry-All Province",
  "House Accounts GMA",
  "Clinical Nutrition",
  "Oncology",
  "Trade Accounts",
  "Sales",
  "Marketing",
  "Training",
];

const args = process.argv.slice(2);
const target = String(args[0] || "").trim().toLowerCase();
const isDryRun = args.includes("--dry-run");
const csvFlagIndex = args.indexOf("--csv");
const csvArg = csvFlagIndex >= 0 ? args[csvFlagIndex + 1] : "";
const csvPath = csvArg
  ? path.resolve(process.cwd(), csvArg)
  : path.join(__dirname, "..", DEFAULT_CSV_NAME);

if (!VALID_TARGETS.has(target)) {
  console.error(
    "Usage: node scripts/sync-user-team-division-from-csv.js <staging|live> [--dry-run] [--csv /path/to/file.csv]"
  );
  process.exit(1);
}

if (csvFlagIndex >= 0 && !csvArg) {
  console.error("Error: --csv requires a file path.");
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`Error: CSV file not found at ${csvPath}`);
  process.exit(1);
}

const envFile = target === "live" ? ".env.production" : ".env.development";
const envPath = path.join(__dirname, "..", envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Error: ${envFile} not found at ${envPath}`);
  process.exit(1);
}

const env = dotenv.parse(fs.readFileSync(envPath));
const mongoUri = String(env.MONGO_URI || env.MONGODB_URI || "").trim().replace(/^'|'$/g, "");

if (!mongoUri) {
  console.error(`Error: MONGO_URI is missing in ${envFile}`);
  process.exit(1);
}

const normalizeText = (value) => String(value || "").trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const normalizeDivision = (value) => {
  const raw = normalizeText(value);
  const canonical = LEGACY_REPORT_DIVISION_ALIASES[raw] || raw;
  return REPORT_DIVISION_VALUES.includes(canonical) ? canonical : "";
};

const readCsvRows = (filePath) => {
  const workbook = XLSX.readFile(filePath, { raw: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(`No worksheet found in ${filePath}`);
  }

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
};

const pushSample = (list, value, limit = 20) => {
  if (list.length < limit) {
    list.push(value);
  }
};

const addUniqueLookup = (map, duplicates, key, user) => {
  if (!key) return;

  if (duplicates.has(key)) {
    duplicates.get(key).push(user);
    return;
  }

  if (map.has(key)) {
    duplicates.set(key, [map.get(key), user]);
    map.delete(key);
    return;
  }

  map.set(key, user);
};

const buildCsvIndex = (rows) => {
  const uniqueRows = new Map();
  const duplicateOverrides = new Map();
  const invalidRows = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const empId = normalizeText(rawRow.EmpID);
    const team = normalizeText(rawRow.TeamID);
    const divisionRaw = normalizeText(rawRow.Division);
    const division = normalizeDivision(divisionRaw);

    if (!empId) {
      pushSample(invalidRows, { rowNumber, reason: "Missing EmpID", row: rawRow });
      return;
    }

    if (!team) {
      pushSample(invalidRows, { rowNumber, empId, reason: "Missing TeamID", row: rawRow });
      return;
    }

    if (!division) {
      pushSample(invalidRows, { rowNumber, empId, reason: `Invalid Division: ${divisionRaw}`, row: rawRow });
      return;
    }

    const key = normalizeKey(empId);
    const candidate = {
      empId,
      team,
      division,
      rowNumbers: [rowNumber],
    };

    const existing = uniqueRows.get(key);
    if (!existing) {
      uniqueRows.set(key, candidate);
      return;
    }

    if (!duplicateOverrides.has(key)) {
      duplicateOverrides.set(key, [existing]);
    }
    duplicateOverrides.get(key).push(candidate);
    uniqueRows.set(key, candidate);
  });

  return {
    uniqueRows,
    duplicateOverrides,
    invalidRows,
  };
};

async function run() {
  let connection;

  try {
    const csvRows = readCsvRows(csvPath);
    const { uniqueRows, duplicateOverrides, invalidRows } = buildCsvIndex(csvRows);

    connection = await mongoose.createConnection(mongoUri).asPromise();
    const users = await connection.collection("users").find(
      {},
      {
        projection: {
          name: 1,
          username: 1,
          repId: 1,
          role: 1,
          division: 1,
        },
      }
    ).toArray();

    const repIdLookup = new Map();
    const repIdDuplicates = new Map();
    const usernameLookup = new Map();
    const usernameDuplicates = new Map();

    users.forEach((user) => {
      addUniqueLookup(repIdLookup, repIdDuplicates, normalizeKey(user.repId), user);
      addUniqueLookup(usernameLookup, usernameDuplicates, normalizeKey(user.username), user);
    });

    const now = new Date();
    const updates = [];
    const changedSamples = [];
    const dbMisses = [];
    const ambiguousDbMatches = [];
    const matchedUserIds = new Set();

    let matchedCount = 0;
    let updatedRoleCount = 0;
    let updatedDivisionCount = 0;

    for (const [empKey, csvRow] of uniqueRows.entries()) {
      if (repIdDuplicates.has(empKey) || usernameDuplicates.has(empKey)) {
        pushSample(ambiguousDbMatches, {
          empId: csvRow.empId,
          reason: repIdDuplicates.has(empKey) ? "Duplicate repId in DB" : "Duplicate username in DB",
        });
        continue;
      }

      const user = repIdLookup.get(empKey) || usernameLookup.get(empKey);
      if (!user) {
        pushSample(dbMisses, {
          empId: csvRow.empId,
          team: csvRow.team,
          division: csvRow.division,
        });
        continue;
      }

      matchedCount += 1;
      matchedUserIds.add(String(user._id));

      const currentRole = normalizeText(user.role);
      const currentDivision = normalizeText(user.division);
      const nextRole = csvRow.team;
      const nextDivision = csvRow.division;
      const roleChanged = currentRole !== nextRole;
      const divisionChanged = currentDivision !== nextDivision;

      if (!roleChanged && !divisionChanged) {
        continue;
      }

      if (roleChanged) updatedRoleCount += 1;
      if (divisionChanged) updatedDivisionCount += 1;

      pushSample(changedSamples, {
        empId: csvRow.empId,
        name: user.name || "",
        username: user.username || "",
        repId: user.repId || "",
        currentRole,
        nextRole,
        currentDivision,
        nextDivision,
      });

      updates.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              role: nextRole,
              division: nextDivision,
              updatedAt: now,
            },
          },
        },
      });
    }

    const unmatchedUsers = users
      .filter((user) => !matchedUserIds.has(String(user._id)))
      .slice(0, 20)
      .map((user) => ({
        name: user.name || "",
        username: user.username || "",
        repId: user.repId || "",
        role: user.role || "",
        division: user.division || "",
      }));

    console.log(`Target: ${target}`);
    console.log(`Mode: ${isDryRun ? "dry-run" : "apply"}`);
    console.log(`DB: ${mongoUri.split("/").pop()}`);
    console.log(`CSV: ${csvPath}`);
    console.log(`CSV rows: ${csvRows.length}`);
    console.log(`Unique EmpIDs in CSV: ${uniqueRows.size}`);
    console.log(`Repeated EmpIDs in CSV (last row wins): ${duplicateOverrides.size}`);
    console.log(`Invalid CSV rows: ${invalidRows.length}`);
    console.log(`Total users in DB: ${users.length}`);
    console.log(`Matched users: ${matchedCount}`);
    console.log(`Users to update: ${updates.length}`);
    console.log(`Team updates (role field): ${updatedRoleCount}`);
    console.log(`Division updates: ${updatedDivisionCount}`);
    console.log(`CSV EmpIDs with no DB user: ${dbMisses.length}`);
    console.log(`Ambiguous DB matches skipped: ${ambiguousDbMatches.length}`);
    console.log(`DB users without CSV match: ${users.length - matchedUserIds.size}`);
    console.log("");
    console.log("Changed sample:");
    console.log(JSON.stringify(changedSamples, null, 2));
    console.log("");
    console.log("CSV duplicate overrides:");
    console.log(
      JSON.stringify(
        Array.from(duplicateOverrides.values())
          .slice(0, 20)
          .map((entries) => ({
            empId: entries[0]?.empId || "",
            selectedRow: entries[entries.length - 1]?.rowNumbers || [],
            variants: entries.map((entry) => ({
              team: entry.team,
              division: entry.division,
              rowNumbers: entry.rowNumbers,
            })),
          })),
        null,
        2
      )
    );
    console.log("");
    console.log("CSV rows missing a DB user:");
    console.log(JSON.stringify(dbMisses, null, 2));
    console.log("");
    console.log("Ambiguous DB matches:");
    console.log(JSON.stringify(ambiguousDbMatches, null, 2));
    console.log("");
    console.log("DB users without CSV match sample:");
    console.log(JSON.stringify(unmatchedUsers, null, 2));
    console.log("");
    console.log("Invalid CSV row sample:");
    console.log(JSON.stringify(invalidRows.slice(0, 20), null, 2));

    if (isDryRun || updates.length === 0) {
      await connection.close();
      process.exit(0);
    }

    const result = await connection.collection("users").bulkWrite(updates, { ordered: false });
    console.log("");
    console.log(`Matched updates: ${result.matchedCount}`);
    console.log(`Modified updates: ${result.modifiedCount}`);

    await connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    if (connection) {
      await connection.close().catch(() => {});
    }
    process.exit(1);
  }
}

run();
