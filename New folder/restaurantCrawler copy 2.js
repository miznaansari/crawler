// backend/crawler/restaurantCrawler.js
import { PlaywrightCrawler } from "crawlee";
import db from "../db/db.js";

const startUrl = "https://restaurant-guru.in/Jaipur#restaurant-list";
const maxRequests = 30;
let counter = 0;

// 🕒 helper function for current timestamp
const getTimestamp = () => {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
  });
};

export const runCrawler = async (io) => {
  io.emit("crawler-log", {
    type: "start",
    message: "🚀 Crawler started...",
    time: getTimestamp(),
  });

  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
      const title = await page.title();
      const url = request.loadedUrl;

      try {
        const exists = await db("restaurants").where({ url }).first();
        if (!exists) {
          await db("restaurants").insert({ title, url });
          counter++;
          const message = `Inserted ${counter}: ${url}`;
          log.info(message);
          io.emit("crawler-log", { type: "insert", message, time: getTimestamp() });
        } else {
          const message = `Already exists: ${url}`;
          log.info(message);
          io.emit("crawler-log", { type: "exists", message, time: getTimestamp() });
        }

        await enqueueLinks();
      } catch (err) {
        const errorMsg = `❌ Error processing ${url}: ${err.message}`;
        log.error(errorMsg);
        io.emit("crawler-log", { type: "error", message: errorMsg, time: getTimestamp() });
      }
    },
    maxRequestsPerCrawl: maxRequests,
  });

  await crawler.run([startUrl]);
  io.emit("crawler-log", {
    type: "done",
    message: "✅ Crawl complete & saved to database!",
    time: getTimestamp(),
  });
};
