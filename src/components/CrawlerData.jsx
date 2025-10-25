import React, { useEffect, useState } from "react";
import axios from "axios";

export default function CrawlerData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10; // items per page

  // Fetch data from API
  const fetchData = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await axios.get(
        `https://gp-crawler.a2deatsdev.in/crawled-data?page=${currentPage}&limit=${pageSize}`
      );
      setData(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setPage(currentPage);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, []);

  return (
    <div className="p-1 space-y-3">
      <h2 className="text-2xl font-bold"> Crawled Data</h2>

      {/* Scrollable + Sticky Header Table */}
      <div className="bg-base-200 rounded-lg shadow border border-base-300 overflow-hidden">
        {/* Enable both X and Y scrolling */}
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="table table-zebra w-full sm:min-w-[600px]">
            {/* sm:min-w ensures wider table only on larger screens */}
            <thead className="bg-base-300 sticky top-0 z-10">
              <tr>
                <th className="whitespace-nowrap">#</th>
                <th className="whitespace-nowrap">Title</th>
                <th className="whitespace-nowrap">URL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="3" className="text-center text-base-content/60">
                    Loading...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center text-base-content/60">
                    No data found
                  </td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr key={item._id || index}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td className="max-w-[200px] truncate" title={item.title}>
                      {item.title}
                    </td>
                    <td className="max-w-[300px] truncate" title={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                      >
                        {item.url}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <button
          className="btn btn-sm btn-outline"
          disabled={page === 1}
          onClick={() => fetchData(page - 1)}
        >
          Previous
        </button>

        <span className="flex items-center gap-2 px-2">
          Page {page} of {totalPages}
        </span>

        <button
          className="btn btn-sm btn-outline"
          disabled={page === totalPages}
          onClick={() => fetchData(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
