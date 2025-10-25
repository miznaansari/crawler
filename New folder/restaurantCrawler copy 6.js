import { CheerioCrawler, sleep } from "crawlee";
import db from "../db/db.js";

let counter = 0;
export let isRunning = false;
let crawlerInstance = null;
let lastUrl = "";
let consecutiveErrors = 0;
let isCountdownRunning = false; // ✅ Prevent multiple timers

const getTimestamp = () =>
  new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

async function countdown(io, totalSeconds, message) {
  if (isCountdownRunning) return; // ✅ Don't start if already running
  isCountdownRunning = true;

  io.emit("crawler-log", {
    type: "pause",
    message: `😴 ${message} — Waiting ${Math.floor(totalSeconds / 60)} minutes...`,
    time: getTimestamp(),
  });

  console.log(`\n=== ${message} ===`);

  for (let remaining = totalSeconds; remaining > 0; remaining--) {
    const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
    const secs = (remaining % 60).toString().padStart(2, "0");
    const msg = `${mins}:${secs} left`;

    process.stdout.write(`\r${msg} `);
    io.emit("crawler-countdown", { message: msg, time: getTimestamp() });

    await sleep(1000);
  }

  console.log("\n⏰ Countdown finished — resuming crawl...");
  io.emit("crawler-log", {
    type: "resume",
    message: "🚀 Resuming crawl...",
    time: getTimestamp(),
  });

  isCountdownRunning = false; // ✅ Reset flag when done
}

// ================== Main Crawler ==================
export const runCrawler = async (io, startUrl) => {
  if (!startUrl) return console.error("❌ No start URL provided");

  if (crawlerInstance) {
    io.emit("crawler-log", { type: "stopping", message: "🛑 Stopping previous crawler...", time: getTimestamp() });
    await stopCrawler(io);
  }

  if (startUrl !== lastUrl) {
    counter = 0;
    consecutiveErrors = 0;
    lastUrl = startUrl;
  }

  isRunning = true;
  io.emit("crawler-status", true);
  io.emit("crawler-log", { type: "start", message: `🚀 Crawler started for ${startUrl}...`, time: getTimestamp() });

  const crawler = new CheerioCrawler({
    useSessionPool: true,
    persistCookiesPerSession: true,

    async requestHandler({ request, $, enqueueLinks }) {
      const url = request.loadedUrl;
      const title = $("title").text()?.trim() || "No Title";

      try {
        const exists = await db("restaurants").where({ url }).first();
        if (!exists) {
          await db("restaurants").insert({ title, url });
          counter++;
          io.emit("crawler-log", { type: "insert", message: `✅ Inserted ${counter}: ${url}`, time: getTimestamp() });
        } else {
          io.emit("crawler-log", { type: "exists", message: `⚠️ Already exists: ${url}`, time: getTimestamp() });
        }

        consecutiveErrors = 0;
        await enqueueLinks();

        // Pause every 25 inserts (change to 250 if needed)
        if (counter > 0 && counter % 25 === 0) {
          console.log("\n⏸️ 25 URLs reached — pausing crawler for 2 minutes");
          await crawler.autoscaledPool.pause();
          await countdown(io, 2 * 60, "Pause after 25 URLs"); // 2 min pause
          await crawler.autoscaledPool.resume();
          console.log("▶️ Crawler resumed after 2-minute pause");
        }

      } catch (err) {
        consecutiveErrors++;
        io.emit("crawler-log", { type: "error", message: `❌ Error processing ${url}: ${err.message}`, time: getTimestamp() });
        try { await db("error_logs").insert({ url, error_message: err.message, created_at: new Date() }); } catch {}

        if (consecutiveErrors >= 10) {
          console.log("\n⚠️ 10 consecutive errors — pausing crawler for 2 minutes");
          await crawler.autoscaledPool.pause();
          await countdown(io, 2 * 60, "Pausing due to 10 consecutive errors");
          await crawler.autoscaledPool.resume();
          console.log("✅ Crawler resumed after 2-minute error pause");
          consecutiveErrors = 0;
        }
      }
    },

    failedRequestHandler: async ({ request, error }) => {
      io.emit("crawler-log", { type: "failed", message: `❌ Final failure for ${request.url}: ${error.message}`, time: getTimestamp() });
      try { await db("error_logs").insert({ url: request.url, error_message: `Final failure: ${error.message}`, created_at: new Date() }); } catch {}

      consecutiveErrors++;
      if (consecutiveErrors >= 10) {
        console.log("\n⚠️ 10 consecutive errors — pausing crawler for 2 minutes");
        await crawler.autoscaledPool.pause();
        await countdown(io, 2 * 60, "Pausing due to 10 consecutive errors");
        await crawler.autoscaledPool.resume();
        console.log("✅ Crawler resumed after 2-minute error pause");
        consecutiveErrors = 0;
      }
    },
  });

  crawlerInstance = crawler;

  try {
    await crawler.run([startUrl]);
  } catch (err) {
    io.emit("crawler-log", { type: "stopped", message: `🛑 Crawl stopped: ${err.message}`, time: getTimestamp() });
  } finally {
    isRunning = false;
    crawlerInstance = null;
    io.emit("crawler-status", false);
    io.emit("crawler-log", { type: "done", message: "✅ Crawl complete or stopped", time: getTimestamp() });
  }
};

// ================== Stop Function ==================
export const stopCrawler = async (io) => {
  if (!crawlerInstance) return;
  crawlerInstance.autoscaledPool?.abort();
  isRunning = false;
  crawlerInstance = null;
  io.emit("crawler-status", false);
  io.emit("crawler-log", { type: "stopped", message: "🛑 Crawler stopped by user", time: getTimestamp() });
  console.log("Crawler aborted by user");
};
