import { PlaywrightCrawler } from 'crawlee';
import db from '../db/db.js';

const startUrl = 'https://restaurant-guru.in/Jaipur#restaurant-list';
const maxRequests = 20;
let counter = 0;

export const runCrawler = async () => {
  const crawler = new PlaywrightCrawler({
    async requestHandler({ request, page, enqueueLinks, log }) {
      const title = await page.title();
      const url = request.loadedUrl;

      // ✅ Save to database
      await db('restaurants').insert({ title, url });

      counter++;
      log.info(`Progress: ${counter}/${maxRequests} → ${url}`);

      await enqueueLinks();
    },
    maxRequestsPerCrawl: maxRequests,
  });

  await crawler.run([startUrl]);
  console.log('✅ Crawl complete & saved to database!');
};
