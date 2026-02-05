const url = process.env.CONVERSION_CRON_URL || "http://localhost:8041/api/conversion/worker";
const secret = process.env.CONVERSION_CRON_SECRET || "";

const run = async () => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: secret ? { "X-Cron-Secret": secret } : {},
    });
    const text = await res.text();
    const status = res.status;
    console.log(`[conversion-cron] ${status} ${text}`);
  } catch (error) {
    console.error("[conversion-cron] failed", error);
    // Keep exit code 0 so PM2 cron doesn't mark the process as errored.
    process.exitCode = 0;
  }
};

const intervalMs = Number(process.env.CONVERSION_CRON_INTERVAL_MS || "60000");

run();
const timer = setInterval(run, intervalMs);

const shutdown = () => {
  clearInterval(timer);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
