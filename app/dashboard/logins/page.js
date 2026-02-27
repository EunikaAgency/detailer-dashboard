"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

const LOGS_PER_PAGE = 10;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getDurationSeconds = (startValue, endValue) => {
  const startMs = new Date(startValue || 0).getTime();
  const endMs = new Date(endValue || 0).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.round((endMs - startMs) / 1000);
};

const formatDurationMinutes = (startValue, endValue) => {
  const totalSeconds = getDurationSeconds(startValue, endValue);
  if (totalSeconds === null) return "-";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteLabel = minutes === 1 ? "minute" : "minutes";
  const secondLabel = seconds === 1 ? "second" : "seconds";
  return `${minutes} ${minuteLabel} and ${seconds} ${secondLabel}`;
};

const toActivityTitle = (action) =>
  String(action || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveDeckTitle = (event) =>
  String(event?.deckTitle || event?.details?.deckTitle || event?.details?.presentationTitle || "").trim();

const groupEventsToLogs = (events) => {
  if (!Array.isArray(events)) return [];
  const grouped = new Map();
  events.forEach((event) => {
    const key = String(event?.sessionId || event?.eventId || "").trim();
    if (!key) return;
    const current = grouped.get(key) || {
      id: key,
      sessionId: key,
      method: event?.method || "password",
      source: event?.source || "online",
      startedAt: event?.occurredAt,
      endedAt: event?.occurredAt,
      lastOccurredAt: event?.occurredAt,
      eventCount: 0,
      user: event?.user || null,
      events: [],
      payload: null,
    };
    current.events.push({
      eventId: event?.eventId,
      eventType: event?.eventType || "activity",
      action: event?.action || "unknown_action",
      deckTitle: event?.deckTitle || event?.details?.deckTitle || null,
      screen: event?.screen || null,
      timestampMs: event?.timestampMs || null,
      details: event?.details || null,
      occurredAt: event?.occurredAt || null,
    });
    current.eventCount = current.events.length;
    const occurredAtTime = new Date(event?.occurredAt || 0).getTime();
    const startedTime = new Date(current.startedAt || 0).getTime();
    const endedTime = new Date(current.endedAt || 0).getTime();
    if (!Number.isNaN(occurredAtTime) && (Number.isNaN(startedTime) || occurredAtTime < startedTime)) {
      current.startedAt = event?.occurredAt || current.startedAt;
    }
    if (!Number.isNaN(occurredAtTime) && (Number.isNaN(endedTime) || occurredAtTime > endedTime)) {
      current.endedAt = event?.occurredAt || current.endedAt;
      current.lastOccurredAt = current.endedAt;
    }
    grouped.set(key, current);
  });
  const logs = Array.from(grouped.values())
    .map((log) => ({
      ...log,
      events: log.events.sort(
        (left, right) => new Date(left?.occurredAt || 0).getTime() - new Date(right?.occurredAt || 0).getTime()
      ),
    }))
    .sort((left, right) => new Date(right?.lastOccurredAt || 0).getTime() - new Date(left?.lastOccurredAt || 0).getTime());
  return logs.map((log) => ({
    ...log,
    payload: {
      sessionId: log.sessionId,
      method: log.method,
      source: log.source,
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      eventCount: log.eventCount,
      events: log.events,
    },
  }));
};

export default function LoginEventsPage() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [openLogId, setOpenLogId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    const loadLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/login-events?limit=200");
        if (!response.ok) {
          throw new Error("Failed to load login events.");
        }
        const data = await response.json();
        const list = Array.isArray(data?.logs)
          ? data.logs
          : groupEventsToLogs(Array.isArray(data?.events) ? data.events : []);
        if (mounted) setLogs(list);
      } catch (err) {
        if (mounted) {
          setError(err?.message || "Failed to load login events.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadLogs();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const email = log?.user?.email?.toLowerCase() || "";
      const username = log?.user?.username?.toLowerCase() || "";
      const repId = log?.user?.repId?.toLowerCase() || "";
      const name = log?.user?.name?.toLowerCase() || "";
      const method = String(log?.method || "").toLowerCase();
      const source = String(log?.source || "").toLowerCase();
      const sessionId = String(log?.sessionId || "").toLowerCase();
      const payloadText = JSON.stringify(log?.payload || log?.events || {}).toLowerCase();
      return (
        email.includes(term) ||
        username.includes(term) ||
        repId.includes(term) ||
        name.includes(term) ||
        method.includes(term) ||
        source.includes(term) ||
        sessionId.includes(term) ||
        payloadText.includes(term)
      );
    });
  }, [logs, query]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [query]);

  useEffect(() => {
    setCurrentPage((previous) => {
      if (previous > totalPages) return totalPages;
      if (previous < 1) return 1;
      return previous;
    });
  }, [totalPages]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + LOGS_PER_PAGE);
  }, [currentPage, filteredLogs]);

  useEffect(() => {
    if (!openLogId) return;
    const isVisible = paginatedLogs.some((log) => String(log.id || log.sessionId) === openLogId);
    if (!isVisible) {
      setOpenLogId(null);
    }
  }, [openLogId, paginatedLogs]);

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [];
    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((left, right) => left - right);
  }, [currentPage, totalPages]);

  const pageStart = filteredLogs.length === 0 ? 0 : (currentPage - 1) * LOGS_PER_PAGE + 1;
  const pageEnd = filteredLogs.length === 0 ? 0 : Math.min(currentPage * LOGS_PER_PAGE, filteredLogs.length);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Activity Logs</h2>
          <p className="text-sm text-gray-600">
            One row per session. Open Activity to view the full timeline.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by user, session, action..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      <div className="mb-4 text-xs text-gray-500">
        Showing <span className="font-semibold text-gray-700">{pageStart}</span>-
        <span className="font-semibold text-gray-700">{pageEnd}</span> of{" "}
        <span className="font-semibold text-gray-700">{filteredLogs.length}</span> session
        {filteredLogs.length === 1 ? "" : "s"} (Page {currentPage} of {totalPages})
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500">Loading activity logs...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-sm text-gray-500">No activity logs available.</div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm text-gray-700 table-fixed">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Start Time</th>
                  <th className="px-4 py-3 text-left font-semibold">End Time</th>
                  <th className="px-4 py-3 text-left font-semibold">User</th>
                  <th className="px-4 py-3 text-left font-semibold">Identifier</th>
                  <th className="px-4 py-3 text-left font-semibold">Method</th>
                  <th className="px-4 py-3 text-left font-semibold">Source</th>
                  <th className="px-4 py-3 text-left font-semibold">Count</th>
                  <th className="px-4 py-3 text-left font-semibold">Activity</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => {
                  const logId = String(log.id || log.sessionId);
                  const isOpen = openLogId === logId;
                  const totalEvents = Number(log?.eventCount || log?.events?.length || 0);
                  return (
                    <Fragment key={logId}>
                      <tr key={logId} className="border-t border-gray-100 align-top">
                        <td className="px-4 py-3">{formatDate(log.startedAt)}</td>
                        <td className="px-4 py-3">{formatDate(log.endedAt || log.lastOccurredAt)}</td>
                        <td className="px-4 py-3">{log?.user?.name || "-"}</td>
                        <td className="px-4 py-3 truncate">{log?.user?.username || log?.user?.repId || log?.user?.email || "-"}</td>
                        <td className="px-4 py-3 capitalize">{log?.method || "-"}</td>
                        <td className="px-4 py-3 capitalize">{log?.source || "-"}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{totalEvents}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setOpenLogId((current) => (current === logId ? null : logId))}
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            {isOpen ? "Hide Activity" : "View Activity"}
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr key={`${logId}-details`} className="border-t border-gray-100">
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                              <div className="rounded-lg border border-gray-200 bg-white">
                                <div className="border-b border-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Activity Timeline
                                </div>
                                <div className="max-h-72 overflow-auto px-3 py-2">
                                  <div className="space-y-2">
                                    {(log?.events || [])
                                      .slice()
                                      .map((event) => {
                                        const deckTitle = resolveDeckTitle(event);
                                        return (
                                          <div
                                            key={event?.eventId || `${log.sessionId}-${event?.occurredAt || "event"}`}
                                            className="rounded border border-gray-100 bg-gray-50 px-3 py-2"
                                          >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                              <div className="text-sm font-medium text-gray-800">
                                                {toActivityTitle(event?.action)}
                                              </div>
                                              <div className="text-xs text-gray-500">{formatDate(event?.occurredAt)}</div>
                                            </div>
                                            {deckTitle ? (
                                              <div className="mt-1 text-xs text-blue-700">Deck: {deckTitle}</div>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Session Summary
                                </div>
                                <div className="space-y-2 text-gray-700">
                                  <div>
                                    <span className="font-semibold text-gray-900">Start:</span> {formatDate(log.startedAt)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">End:</span>{" "}
                                    {formatDate(log.endedAt || log.lastOccurredAt)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">Duration:</span>{" "}
                                    {formatDurationMinutes(log.startedAt, log.endedAt || log.lastOccurredAt)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">Method:</span>{" "}
                                    <span className="capitalize">{log?.method || "-"}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">Source:</span>{" "}
                                    <span className="capitalize">{log?.source || "-"}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-900">Event Count:</span> {totalEvents}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-500">
                Page <span className="font-semibold text-gray-700">{currentPage}</span> of{" "}
                <span className="font-semibold text-gray-700">{totalPages}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                  disabled={currentPage <= 1}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                {paginationItems.map((page, index) => {
                  const previousPage = paginationItems[index - 1];
                  const showGap = Number.isFinite(previousPage) && page - previousPage > 1;
                  return (
                    <Fragment key={`page-${page}`}>
                      {showGap ? <span className="px-1 text-xs text-gray-400">...</span> : null}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                          page === currentPage
                            ? "border-blue-300 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    </Fragment>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                  disabled={currentPage >= totalPages}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
