import { PlaywrightCrawler } from "crawlee";
import db from "../db/db.js";

let counter = 0;
export let isRunning = false;
let crawlerInstance = null; 
let lastUrl = "";

const getTimestamp = () => new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true });

export const runCrawler = async (io, startUrl) => {
    if (!startUrl) {
        console.error("❌ No start URL provided");
        return;
    }

    // If previous crawler exists, stop it first
    if (crawlerInstance) {
        io.emit("crawler-log", {
            type: "stopping",
            message: "🛑 Stopping previous crawler before starting new one...",
            time: getTimestamp(),
        });
        await stopCrawler(io); // make sure previous crawler is fully stopped
    }

    // Reset counter if URL is different
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

    // Create a fresh crawler instance
    const crawler = new PlaywrightCrawler({
        async requestHandler({ request, page, enqueueLinks, log }) {
            const title = await page.title();
            const url = request.loadedUrl;

            try {
                const exists = await db("restaurants").where({ url }).first();
                if (!exists) {
                    await db("restaurants").insert({ title, url });
                    counter++;
                    io.emit("crawler-log", { type: "insert", message: `Inserted ${counter}: ${url}`, time: getTimestamp() });
                } else {
                    io.emit("crawler-log", { type: "exists", message: `Already exists: ${url}`, time: getTimestamp() });
                }

                await enqueueLinks();
            } catch (err) {
                io.emit("crawler-log", { type: "error", message: `❌ Error processing ${url}: ${err.message}`, time: getTimestamp() });
            }
        },
        maxRequestsPerCrawl: undefined,
    });

    crawlerInstance = crawler; // store the new instance

    try {
        await crawler.run([startUrl]); // run fresh crawl
    } catch (err) {
        io.emit("crawler-log", { type: "stopped", message: "🛑 Crawl stopped by user", time: getTimestamp() });
    } finally {
        isRunning = false;
        crawlerInstance = null;
        io.emit("crawler-status", false);
        io.emit("crawler-log", { type: "done", message: "✅ Crawl complete or stopped", time: getTimestamp() });
    }
};

export const stopCrawler = async (io) => {
    if (!crawlerInstance) return; // nothing to stop

    // Abort the crawler immediately
    crawlerInstance.autoscaledPool?.abort();

    isRunning = false;
    crawlerInstance = null;

    io.emit("crawler-status", false);
    io.emit("crawler-log", { type: "stopped", message: "🛑 Crawler stopped by user", time: getTimestamp() });

    console.log("Crawler aborted by user");
};
