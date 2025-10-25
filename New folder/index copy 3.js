import { PlaywrightCrawler } from 'crawlee';
import { Parser } from 'json2csv';
import fs from 'fs';

const startUrl = 'https://restaurant-guru.in/Jaipur#restaurant-list';
const results = [];
const maxRequests = 1000;
let counter = 0; // Counter for progress

const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, pushData, log }) {
        const title = await page.title();
        const url = request.loadedUrl;

        results.push({ title, url });
        await pushData({ title, url });

        counter++;
        log.info(`Progress: ${counter}/${maxRequests} → ${url}`);

        await enqueueLinks();
    },

    maxRequestsPerCrawl: maxRequests,
    // headless: false,
});

await crawler.run([startUrl]);

// Export to CSV
const parser = new Parser();
const csv = parser.parse(results);
fs.writeFileSync('./results.csv', csv);

console.log('✅ Crawl complete!');
console.log(`Found ${results.length} pages.`);
console.log('Saved results to results.csv');
