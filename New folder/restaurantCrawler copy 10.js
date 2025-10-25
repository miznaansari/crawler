import { CheerioCrawler, sleep } from "crawlee";
import db from "../db/db.js";
import { dbQueue } from "../controllers/dbRequestQueue.js";

let counter = 0;
let currentLimit = 100; // first pause threshold
export let isRunning = false;
let crawlerInstance = null;
let lastUrl = "";
let consecutiveErrors = 0;

// 🕒 Format timestamp (IST)
const getTimestamp = () =>
  new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

// 🕓 Countdown timer (seconds)
async function countdown(io, totalSeconds, message) {
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
    io.emit("crawler-countdown", {
      message: msg,
      counter,
      nextThreshold: currentLimit,
      time: getTimestamp(),
    });

    await sleep(1000);
  }

  console.log("\n⏰ Countdown finished — resuming crawl...");
  io.emit("crawler-log", {
    type: "resume",
    message: "🚀 Resuming crawl...",
    counter,
    nextThreshold: currentLimit,
    time: getTimestamp(),
  });
}

// 🧠 Pause handler
async function pauseCrawler(io, message, seconds) {
  console.log(`\n⏸️ ${message}`);
  io.emit("crawler-log", {
    type: "pause",
    message: `😴 ${message}`,
    counter,
    nextThreshold: currentLimit,
    time: getTimestamp(),
  });

  await countdown(io, seconds, message);
}

// ================== Main Crawler ==================
export const runCrawler = async (io, startUrl) => {
  if (!startUrl) {
    console.error("❌ No start URL provided");
    return;
  }

  // Stop old crawler if running
  if (crawlerInstance) {
    io.emit("crawler-log", {
      type: "stopping",
      message: "🛑 Stopping previous crawler...",
      time: getTimestamp(),
    });
    await stopCrawler(io);
  }

  // Reset counters if new URL
  if (startUrl !== lastUrl) {
    counter = 0;
    currentLimit = 100;
    consecutiveErrors = 0;
    lastUrl = startUrl;
  }

  isRunning = true;
  io.emit("crawler-status", true);
  io.emit("crawler-log", {
    type: "start",
    message: `🚀 Crawler started for ${startUrl}`,
    counter,
    nextThreshold: currentLimit,
    time: getTimestamp(),
  });

  const crawler = new CheerioCrawler({
    useSessionPool: true,
    persistCookiesPerSession: true,
    requestHandlerTimeoutSecs: 60, // per request timeout

    async requestHandler({ request, $ }) {
      if (!isRunning) return;

      const url = request.loadedUrl;
      const title = $("title").text()?.trim() || "No Title";

      try {
        // Insert restaurant if not exists
        const exists = await db("restaurants").where({ url }).first();
        if (!exists) {
          await db("restaurants").insert({ title, url });
          counter++;

          console.log(`✅ Inserted ${counter} | Next pause at ${currentLimit} | URL: ${url}`);
          io.emit("crawler-log", {
            type: "insert",
            message: `✅ Inserted ${counter}: ${url}`,
            counter,
            nextThreshold: currentLimit,
            time: getTimestamp(),
          });
        } else {
          io.emit("crawler-log", {
            type: "exists",
            message: `⚠️ Already exists: ${url}`,
            counter,
            nextThreshold: currentLimit,
            time: getTimestamp(),
          });
        }

        consecutiveErrors = 0;

        // Enqueue links to DB queue
        $("a[href]").each(async (_, el) => {
          const link = $(el).attr("href");
          if (link && link.startsWith("http")) {
            await dbQueue.addRequest({ url: link, uniqueKey: link, method: "GET" });
          }
        });

        // 💤 Pause every currentLimit inserts
        if (counter >= currentLimit) {
          await pauseCrawler(io, `Reached ${counter} inserts — pausing for 2 minutes`, 2 * 60);
          currentLimit = counter + 100;
        }
      } catch (err) {
        consecutiveErrors++;
        io.emit("crawler-log", {
          type: "error",
          message: `❌ Error processing ${url}: ${err.message}`,
          counter,
          nextThreshold: currentLimit,
          time: getTimestamp(),
        });

        try {
          await db("error_logs").insert({ url, error_message: err.message, created_at: new Date() });
        } catch (dbErr) {
          console.error("❌ Failed to log error in DB:", dbErr.message);
        }

        if (consecutiveErrors >= 10) {
          await pauseCrawler(io, "⚠️ 10 consecutive errors — pausing for 20 minutes", 20 * 60);
          consecutiveErrors = 0;
        }
      }
    },

    failedRequestHandler: async ({ request, error }) => {
      io.emit("crawler-log", {
        type: "failed",
        message: `❌ Final failure for ${request.url}: ${error.message}`,
        counter,
        nextThreshold: currentLimit,
        time: getTimestamp(),
      });

      try {
        await db("error_logs").insert({
          url: request.url,
          error_message: `Final failure: ${error.message}`,
          created_at: new Date(),
        });
      } catch (dbErr) {
        console.error("❌ DB logging failed:", dbErr.message);
      }

      consecutiveErrors++;
      if (consecutiveErrors >= 10) {
        await pauseCrawler(io, "⚠️ 10 consecutive errors — pausing for 20 minutes", 20 * 60);
        consecutiveErrors = 0;
      }
    },
  });

  crawlerInstance = crawler;

  // ================== DB Queue Loop ==================
  await dbQueue.addRequest({ url: startUrl, method: "GET" }); // seed start URL

  while (isRunning) {
    const next = await dbQueue.getNextRequest();
    if (!next) break;

    await crawler.run([{ url: next.url, userData: { id: next.id }, uniqueKey: next.unique_key }]);
    await dbQueue.markHandled(next.id);
  }

  isRunning = false;
  crawlerInstance = null;
  io.emit("crawler-status", false);
  io.emit("crawler-log", {
    type: "done",
    message: "✅ Crawl complete or stopped",
    counter,
    nextThreshold: currentLimit,
    time: getTimestamp(),
  });
};

// ================== Stop Function ==================
export const stopCrawler = async (io) => {
  if (!crawlerInstance) return;

  await crawlerInstance.autoscaledPool?.abort();
  isRunning = false;
  crawlerInstance = null;

  io.emit("crawler-status", false);
  io.emit("crawler-log", {
    type: "stopped",
    message: "🛑 Crawler stopped by user",
    counter,
    nextThreshold: currentLimit,
    time: getTimestamp(),
  });

  console.log("Crawler aborted by user");
};
