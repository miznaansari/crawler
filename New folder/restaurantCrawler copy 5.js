import { CheerioCrawler } from "crawlee";
import db from "../db/db.js";

let counter = 0;
export let isRunning = false;
let crawlerInstance = null;
let lastUrl = "";

const getTimestamp = () =>
  new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

export const runCrawler = async (io, startUrl) => {
  if (!startUrl) {
    console.error("❌ No start URL provided");
    return;
  }

  if (crawlerInstance) {
    io.emit("crawler-log", {
      type: "stopping",
      message: "🛑 Stopping previous crawler...",
      time: getTimestamp(),
    });
    await stopCrawler(io);
  }

  if (startUrl !== lastUrl) {
    counter = 0;
    lastUrl = startUrl;
  }

  isRunning = true;
  io.emit("crawler-status", true);
  io.emit("crawler-log", {
    type: "start",
    message: `🚀 Crawler started for ${startUrl}...`,
    time: getTimestamp(),
  });

  const crawler = new CheerioCrawler({
    async requestHandler({ request, $, enqueueLinks }) {
      const url = request.loadedUrl;
      const title = $("title").text()?.trim() || "No Title"; // ✅ Using Cheerio

      try {
        const exists = await db("restaurants").where({ url }).first();

        if (!exists) {
          await db("restaurants").insert({ title, url });
          counter++;
          io.emit("crawler-log", {
            type: "insert",
            message: `✅ Inserted ${counter}: ${url}`,
            time: getTimestamp(),
          });
        } else {
          io.emit("crawler-log", {
            type: "exists",
            message: `⚠️ Already exists: ${url}`,
            time: getTimestamp(),
          });
        }

        await enqueueLinks(); // ✅ Automatically adds found links to queue
      } catch (err) {
        io.emit("crawler-log", {
          type: "error",
          message: `❌ Error processing ${url}: ${err.message}`,
          time: getTimestamp(),
        });

        try {
          await db("error_logs").insert({
            url,
            error_message: err.message,
          });
        } catch (dbErr) {
          console.error("❌ Failed to log error in DB:", dbErr.message);
        }
      }

    },
    maxRequestsPerCrawl: undefined,
  });

  crawlerInstance = crawler;

  try {
    await crawler.run([startUrl]);
  } catch {
    io.emit("crawler-log", {
      type: "stopped",
      message: "🛑 Crawl stopped by user",
      time: getTimestamp(),
    });
  } finally {
    isRunning = false;
    crawlerInstance = null;
    io.emit("crawler-status", false);
    io.emit("crawler-log", {
      type: "done",
      message: "✅ Crawl complete or stopped",
      time: getTimestamp(),
    });
  }
};

export const stopCrawler = async (io) => {
  if (!crawlerInstance) return;

  crawlerInstance.autoscaledPool?.abort();
  isRunning = false;
  crawlerInstance = null;

  io.emit("crawler-status", false);
  io.emit("crawler-log", {
    type: "stopped",
    message: "🛑 Crawler stopped by user",
    time: getTimestamp(),
  });

  console.log("Crawler aborted by user");
};
