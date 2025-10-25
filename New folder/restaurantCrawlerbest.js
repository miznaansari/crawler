// backend/crawler/restaurantCrawler.js
import { PlaywrightCrawler } from "crawlee";
import db from "../db/db.js";

const startUrl = "https://restaurant-guru.in/Jaipur#restaurant-list";
const maxRequests = 30;
let counter = 0;

export const runCrawler = async (io) => {
  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
      const title = await page.title();
      const url = request.loadedUrl;

      try {
        // Check if URL already exists
        const exists = await db("restaurants").where({ url }).first();
        if (!exists) {
          await db("restaurants").insert({ title, url });
          counter++;
          const message = `Inserted ${counter}: ${url}`;
          log.info(message);
          io.emit("crawler-log", { type: "insert", message });
        } else {
          const message = `Already exists: ${url}`;
          log.info(message);
          io.emit("crawler-log", { type: "exists", message });
        }

        await enqueueLinks();
      } catch (err) {
        const errorMsg = `❌ Error processing ${url}: ${err.message}`;
        io.emit("crawler-log", { type: "error", message: errorMsg });
      }
    },
    maxRequestsPerCrawl: maxRequests,
  });

  await crawler.run([startUrl]);
  io.emit("crawler-log", { type: "done", message: "✅ Crawl complete & saved to database!" });
};
