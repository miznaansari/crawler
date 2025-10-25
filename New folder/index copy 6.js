// backend/index.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { runCrawler ,isRunning } from "./crawler/restaurantCrawler.js";
import Restaurant from "./models/restaurantModel.js";
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 👈 allow all origins for testing
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("🟢 A user connected:", socket.id);
    socket.emit("crawler-status", isRunning);
    socket.emit("crawler-log", { message: "Connected to crawler socket!" });
});

// API endpoint to trigger the crawler
// backend/index.js

app.post("/start-crawl", async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    // Basic URL format validation
    let checkedUrl;
    try {
        checkedUrl = new URL(url);
        if (!["http:", "https:"].includes(checkedUrl.protocol)) {
            return res.status(400).json({ error: "Invalid protocol" });
        }
    } catch (e) {
        return res.status(400).json({ error: "Invalid URL format" });
    }



    // If all checks are good
    res.json({ message: "Crawl started" });

    runCrawler(io, url);
});

// Pagination API
app.get("/crawled-data", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Get all data (or you can optimize with db('restaurants').limit().offset())
        const allData = await Restaurant.getAll();
        const total = allData.length;
        const totalPages = Math.ceil(total / limit);

        // Paginate
        const items = allData.slice((page - 1) * limit, page * limit);

        res.json({ items, totalPages });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});


server.listen(4000, () => {
    console.log("🚀 Server running on port 4000");
});
