import { CheerioCrawler, sleep } from "crawlee";
import db from "../db/db.js";
import { dbQueue,getNextRequests } from "../controllers/dbRequestQueue.js";

let counter = 0;
let currentLimit = 1000; // pause every 1000 URLs
export let isRunning = false;
let crawlerInstance = null;
let consecutiveErrors = 0;
let lastUrl = "";

// Timestamp in IST
const getTimestamp = () =>
  new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

// Countdown pause
async function pause(io, message, seconds) {
  io.emit("crawler-log", { type: "pause", message, time: getTimestamp() });
  console.log(`\n⏸️ ${message}`);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r⏳ ${i}s left `);
    await sleep(1000);
  }
  console.log("\n🚀 Resuming...");
  io.emit("crawler-log", { type: "resume", message: "Resuming crawl", time: getTimestamp() });
}

// Main crawler
export const runCrawler = async (io, startUrl) => {
  if (!startUrl) return console.error("❌ No start URL provided");

  // Stop previous crawler
  if (crawlerInstance) await stopCrawler(io);

  if (startUrl !== lastUrl) {
    counter = 0;
    consecutiveErrors = 0;
    lastUrl = startUrl;
  }

  isRunning = true;
  io.emit("crawler-status", true);

  const crawler = new CheerioCrawler({
    useSessionPool: true,
    persistCookiesPerSession: true,
    requestHandlerTimeoutSecs: 60,

    async requestHandler({ $, request }) {
      if (!isRunning) return;

      try {
        const url = request.loadedUrl;
        const title = $("title").text()?.trim() || "No Title";

        // Add URL to queue
        await dbQueue.addRequest({ url, uniqueKey: url });
        counter++;

        io.emit("crawler-log", {
          type: "insert",
          message: `✅ Collected ${counter}: ${url}`,
          counter,
          time: getTimestamp(),
        });

        consecutiveErrors = 0;

        // Extract links and add to queue
        $("a[href]").each(async (_, el) => {
          const link = $(el).attr("href");
          if (link?.startsWith("http")) {
            await dbQueue.addRequest({ url: link, uniqueKey: link });
          }
        });

        // Pause every currentLimit URLs
        if (counter >= currentLimit) {
          await pause(io, `Reached ${counter} URLs — pausing 2 min`, 2 * 60);
          currentLimit += 1000;
        }
      } catch (err) {
        consecutiveErrors++;
        console.error(`❌ Error: ${err.message}`);

        if (consecutiveErrors >= 10) {
          await pause(io, "⚠️ 10 consecutive errors — pausing 2 min", 2 * 60);
          consecutiveErrors = 0;
        }
      }
    },
  });

  crawlerInstance = crawler;

  // Seed start URL
  await dbQueue.addRequest({ url: startUrl, uniqueKey: startUrl });

  // Process DB queue continuously
  const BATCH_SIZE = 100;
  while (isRunning) {
    const batch = await getNextRequests(BATCH_SIZE);
    if (!batch?.length) break;

    const requests = batch.map(r => ({ url: r.url, uniqueKey: r.unique_key }));
    await crawler.run(requests);

    // Mark handled
    for (const r of batch) await dbQueue.markHandled(r.id);
  }

  isRunning = false;
  crawlerInstance = null;
  io.emit("crawler-status", false);
  io.emit("crawler-log", { type: "done", message: "✅ Crawl complete", counter, time: getTimestamp() });
};

// Stop crawler
export const stopCrawler = async (io) => {
  if (!crawlerInstance) return;
  await crawlerInstance.autoscaledPool?.abort();
  isRunning = false;
  crawlerInstance = null;
  io.emit("crawler-status", false);
  io.emit("crawler-log", { type: "stopped", message: "🛑 Crawler stopped", counter, time: getTimestamp() });
  console.log("Crawler stopped by user");
};
