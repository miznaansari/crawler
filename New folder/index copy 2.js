import { PlaywrightCrawler } from 'crawlee';
import { Parser } from 'json2csv';
import fs from 'fs';

const startUrl = 'https://restaurant-guru.in/Jaipur#restaurant-list'; // 👈 Change this to your target URL
const results = [];

const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, pushData, log }) {
        const title = await page.title();
        const url = request.loadedUrl;

        log.info(`Title of ${url} → '${title}'`);
        results.push({ title, url });

        // Save to Crawlee dataset too (optional)
        await pushData({ title, url });

        // Extract and enqueue internal links
        await enqueueLinks();
    },

    maxRequestsPerCrawl: 1000,
    // headless: false, // Uncomment if you want to see the browser
});

await crawler.run([startUrl]);

// Export to CSV
const parser = new Parser();
const csv = parser.parse(results);
fs.writeFileSync('./results.csv', csv);

console.log('✅ Crawl complete!');
console.log(`Found ${results.length} pages.`);
console.log('Saved results to results.csv');
