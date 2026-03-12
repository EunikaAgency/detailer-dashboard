#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_URL = "http://127.0.0.1:7001/api/products";
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), "backups/api-products");

const sourceUrl = String(process.env.PRODUCTS_API_BACKUP_URL || DEFAULT_URL).trim();
const intervalMs = Math.max(
  60 * 1000,
  Number.parseInt(process.env.PRODUCTS_API_BACKUP_INTERVAL_MS || "", 10) || DEFAULT_INTERVAL_MS
);
const outputDir = path.resolve(process.env.PRODUCTS_API_BACKUP_DIR || DEFAULT_OUTPUT_DIR);
const runOnce = process.argv.includes("--once");

let lastSuccessfulDate = "";

function getDateParts(now = new Date()) {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    year,
    month,
    day,
    stamp: `${year}-${month}-${day}`,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function fetchProductsResponse() {
  const response = await fetch(sourceUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "detailer-products-api-backup/1.0",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Products API request failed (${response.status}): ${text.slice(0, 400)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Products API returned invalid JSON: ${error.message}`);
  }

  return { text, parsed };
}

function writeSnapshot({ stamp, year, parsed, rawText }) {
  const yearDir = path.join(outputDir, year);
  ensureDir(yearDir);

  const snapshot = {
    backupDate: stamp,
    backedUpAt: new Date().toISOString(),
    sourceUrl,
    sha256: sha256(rawText),
    productCount: Array.isArray(parsed?.products) ? parsed.products.length : 0,
    response: parsed,
  };

  const datedPath = path.join(yearDir, `${stamp}.json`);
  const latestPath = path.join(outputDir, "latest.json");
  const latestPointerPath = path.join(outputDir, "latest.txt");
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;

  fs.writeFileSync(datedPath, json, "utf8");
  fs.writeFileSync(latestPath, json, "utf8");
  fs.writeFileSync(latestPointerPath, `${path.relative(outputDir, datedPath)}\n`, "utf8");

  return {
    datedPath,
    latestPath,
    latestPointerPath,
    productCount: snapshot.productCount,
    checksum: snapshot.sha256,
  };
}

async function backupIfDue(force = false) {
  const { year, stamp } = getDateParts();

  if (!force && lastSuccessfulDate === stamp) {
    return { skipped: true, reason: "already-backed-up-today", stamp };
  }

  const existingPath = path.join(outputDir, year, `${stamp}.json`);
  if (!force && fs.existsSync(existingPath)) {
    lastSuccessfulDate = stamp;
    return { skipped: true, reason: "snapshot-file-exists", stamp, existingPath };
  }

  const { text, parsed } = await fetchProductsResponse();
  const result = writeSnapshot({ stamp, year, parsed, rawText: text });
  lastSuccessfulDate = stamp;
  return {
    skipped: false,
    stamp,
    ...result,
  };
}

async function runCycle(force = false) {
  try {
    const result = await backupIfDue(force);
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          message: error?.message || String(error),
          at: new Date().toISOString(),
        },
        null,
        2
      )
    );
  }
}

async function main() {
  ensureDir(outputDir);
  await runCycle(true);

  if (runOnce) {
    return;
  }

  setInterval(() => {
    void runCycle(false);
  }, intervalMs);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
