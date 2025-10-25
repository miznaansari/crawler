import { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import CrawlerLog from "./components/CrawlerLog";
import CrawlerData from "./components/CrawlerData";
import { Terminal, Database } from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const socket = io("https://gp-crawler.a2deatsdev.in");

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("terminal");
  const [isCrawlerRunning, setIsCrawlerRunning] = useState(false);
  const [countdown, setCountdown] = useState(""); // ✅ Countdown display

  useEffect(() => {
    // Listen for crawler status
    socket.on("crawler-status", (status) => {
      setIsCrawlerRunning(status);
      if (!status) setCountdown(""); // hide countdown when stopped
    });

    // Listen for countdown updates
    socket.on("crawler-countdown", ({ message }) => {
      setCountdown(message); // update countdown
    });

    return () => {
      socket.off("crawler-status");
      socket.off("crawler-countdown");
    };
  }, []);

  const handleCrawl = async () => {
    if (isCrawlerRunning) {
      // Stop the crawler if running
      const confirmStop = window.confirm("Do you want to abort this crawler?");
      if (!confirmStop) return;

      try {
        await axios.post("https://gp-crawler.a2deatsdev.in/stop-crawl");
        setIsCrawlerRunning(false);
        toast.success("Crawler stopped successfully!");
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.error || "Failed to stop crawler!");
      }
      return;
    }

    if (!url.trim()) {
      toast.warning("Please enter a URL!");
      return;
    }

    setLoading(true);
    try {
      await axios.post("https://gp-crawler.a2deatsdev.in/start-crawl", { url });
      toast.success("Crawler started successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Crawl failed!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('countdown', countdown)
  }, [countdown])

  return (
    <div className="pb-16">
      {/* Navbar */}
      <nav className="navbar bg-base-200 shadow sticky top-0 px-4 py-3 z-50 flex gap-4 flex-wrap">
        <h1 className="text-xl font-bold">A2D Crawler</h1>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL"
            className="input input-bordered input-sm w-full"
            disabled={isCrawlerRunning}
          />
          <button
            onClick={handleCrawl}
            className={`btn btn-primary btn-sm ${loading ? "loading" : ""}`}
          >
            {isCrawlerRunning ? "Stop" : loading ? "Crawling..." : "Start"}
          </button>
        </div>

        {/* Show countdown only when active */}
        {countdown && (
          <div
            className={`ml-4 font-mono text-center  text-sm ${countdown === "00:01 left" ? "text-green-600" : "text-yellow-600"
              }`}
          >
            {countdown === "00:01 left"
              ? "Running"
              : `⏳ Paused: ${countdown}`}
          </div>
        )}



        {/* Desktop tabs */}
        <div className="tabs tabs-boxed flex-shrink-0 hidden sm:flex">
          <a
            className={`tab tab-sm ${view === "terminal" ? "tab-active" : ""}`}
            onClick={() => setView("terminal")}
          >
            Live
          </a>
          <a
            className={`tab tab-sm ${view === "database" ? "tab-active" : ""}`}
            onClick={() => setView("database")}
          >
            DB
          </a>
        </div>
      </nav>

      {/* Content */}
      <div className="p-4">
        {view === "terminal" && <CrawlerLog />}
        {view === "database" && <CrawlerData />}
      </div>

      {/* Mobile bottom tabs */}
      <div className="tabs tabs-boxed fixed bottom-0 left-0 right-0 bg-base-300 shadow-lg flex justify-center sm:hidden px-4 py-3 z-50">
        <a
          className={`tab tab-sm flex-1 flex items-center gap-1 ${view === "terminal"
            ? "tab-active text-primary font-semibold"
            : "opacity-60"
            }`}
          onClick={() => setView("terminal")}
        >
          <Terminal size={18} />
          <span>Live</span>
        </a>

        <a
          className={`tab tab-sm flex-1 flex items-center gap-1 ${view === "database"
            ? "tab-active text-primary font-semibold"
            : "opacity-60"
            }`}
          onClick={() => setView("database")}
        >
          <Database size={18} />
          <span>DB</span>
        </a>
        {/* {countdown && (
          <div className="ml-4 font-mono text-sm text-yellow-600">
            ⏳ Paused: {countdown}
          </div>
        )} */}
      </div>

      {/* Toast Container */}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}
