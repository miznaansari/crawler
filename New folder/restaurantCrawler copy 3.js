// backend/crawler/restaurantCrawler.js
import { PlaywrightCrawler } from "crawlee";
import db from "../db/db.js";

let counter = 0;
export let isRunning = false;
// 🕒 helper function for current timestamp
const getTimestamp = () => {
    return new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
    });
};

// Accept startUrl as parameter
export const runCrawler = async (io, startUrl) => {
    if (isRunning) {
        console.log("Crawler already running...");
        io.emit("crawler-status", true);
        return;
    }

    if (!startUrl) {
        console.error("❌ No start URL provided");
        return;
    }
    isRunning = true;
    io.emit("crawler-status", true);
    io.emit("crawler-log", {
        type: "start",
        message: `🚀 Crawler started for ${startUrl}...`,
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
        maxRequestsPerCrawl: undefined,
    });

    await crawler.run([startUrl]);
    isRunning = false;
    io.emit("crawler-status", false);

    io.emit("crawler-log", {
        type: "done",
        message: "✅ Crawl complete & saved to database!",
        time: getTimestamp(),
    });
};
