"use client";

import { useEffect, useMemo, useState } from "react";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function LoginEventsPage() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/login-events?limit=200");
        if (!response.ok) {
          throw new Error("Failed to load login events.");
        }
        const data = await response.json();
        const list = Array.isArray(data?.events) ? data.events : [];
        if (mounted) setEvents(list);
      } catch (err) {
        if (mounted) {
          setError(err?.message || "Failed to load login events.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadEvents();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) => {
      const email = event?.user?.email?.toLowerCase() || "";
      const name = event?.user?.name?.toLowerCase() || "";
      const method = event?.method || "";
      const source = event?.source || "";
      return (
        email.includes(term) ||
        name.includes(term) ||
        method.includes(term) ||
        source.includes(term)
      );
    });
  }, [events, query]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Login Events</h2>
          <p className="text-sm text-gray-600">Latest login activity from mobile and web.</p>
        </div>
        <div className="w-full sm:w-72">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user, method, source..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading login events...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-sm text-gray-500">No login events available.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Time</th>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Method</th>
                <th className="px-4 py-3 text-left font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id || event.eventId} className="border-t border-gray-100">
                  <td className="px-4 py-3">{formatDate(event.occurredAt)}</td>
                  <td className="px-4 py-3">{event?.user?.name || "-"}</td>
                  <td className="px-4 py-3">{event?.user?.email || "-"}</td>
                  <td className="px-4 py-3 capitalize">{event?.method || "-"}</td>
                  <td className="px-4 py-3 capitalize">{event?.source || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
