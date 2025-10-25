import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://gp-crawler.a2deatsdev.in/");

export default function CrawlerLog() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    Skipped: true,
    insert: true,
    exists: true,
    error: true,
    warning: true,
  });
  const logEndRef = useRef(null);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Socket listener
  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("crawler-log", (data) => {
      console.log("Received log:", data);
      setLogs((prev) => [...prev, data]);
    });

    return () => {
      socket.off("crawler-log");
    };
  }, []);

  // Handle filter toggling
  const toggleFilter = (type) => {
    setFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Detect log color
  const getLogColor = (message, type) => {
    if (type === "error" || /error/i.test(message)) return "text-red-400";
    if (type === "insert" || /success|done|completed/i.test(message))
      return "text-green-800";
    if (type === "Skipped") return "text-blue-400";
    if (type === "exists" || /already exists/i.test(message))
      return "text-yellow-400";
    if (type === "warning" || /warn/i.test(message)) return "text-amber-400";
    return "text-base-content/80";
  };

  // Filtered logs based on selected checkboxes
  const filteredLogs = logs.filter((log) => {
    const type = (log.type || "").toLowerCase();
    if (type === "skipped" && !filters.Skipped) return false;
    if (type === "insert" && !filters.insert) return false;
    if (type === "exists" && !filters.exists) return false;
    if (type === "error" && !filters.error) return false;
    if (type === "warning" && !filters.warning) return false;
    return true;
  });
  const h =window.innerHeight -200;
  console.log(h)

  return (
    <div
    className="p-2 bg-base-200  text-content rounded-xl shadow-lg border border-base-300 font-mono"
    style={{ height: h }} // <-- apply dynamic height here
  >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <h2 className="text-base font-semibold text-base-content/80 ml-2">
            Crawler Live Terminal
          </h2>
        </div>

        {/* Filter checkboxes */}
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            { key: "Skipped", color: "text-blue-400" },
            { key: "insert", color: "text-green-400" },
            { key: "exists", color: "text-yellow-400" },
            { key: "error", color: "text-red-400" },
            { key: "warning", color: "text-amber-400" },
          ].map(({ key, color }) => (
            <label
              key={key}
              className={`flex items-center gap-1 cursor-pointer ${color}`}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={filters[key]}
                onChange={() => toggleFilter(key)}
              />
              {key}
            </label>
          ))}
        </div>
      </div>

      {/* Logs */}
      <div className="bg-base-300 rounded-lg p-3  overflow-y-auto space-y-1"
       style={{ height: h-100 }} // <->
       >
        {filteredLogs.length === 0 ? (
          <p className="text-base-content/60 italic">
            {logs.length === 0
              ? "Waiting for crawler logs..."
              : "No logs match the selected filters..."}
          </p>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              className={`flex flex-col sm:flex-row gap-1 sm:gap-2 animate-fadeIn ${getLogColor(
                log.message,
                log.type
              )}`}
            >
              {/* Timestamp */}
              <span className="text-xs sm:text-base text-base-content/60 shrink-0">
                [{log.time || new Date().toLocaleTimeString()}]
              </span>
              {/* Message */}
              <span className="text-xs sm:text-base whitespace-pre-wrap break-words flex-1">
                $ {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}


