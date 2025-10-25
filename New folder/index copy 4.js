import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runCrawler } from './crawler/restaurantCrawler.js';
import restaurantRoutes from './routes/restaurantRoutes.js';
import { Server } from "socket.io";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', restaurantRoutes);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // replace with your frontend URL in production
    methods: ["GET", "POST"]
  }
});
app.get('/', (req, res) => res.send('✅ API Running'));
// ✅ Socket.io connection event
io.on("connection", (socket) => {
  console.log("🟢 A user connected:", socket.id);
  socket.emit("message", "Connected to crawler socket!");
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server running at http://localhost:${process.env.PORT}`);
});

// Run crawler automatically (optional)
// runCrawler();
