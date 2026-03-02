"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

const LOGS_PER_PAGE = 10;
const CHART_LOADING_TEXT = "Loading activity graph...";

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

const resolveEventItem = (event) => {
  const productLabel = String(
    event?.details?.productName ||
      event?.details?.productLabel ||
      event?.details?.productTitle ||
      event?.details?.brandName ||
      ""
  ).trim();
  const productId = String(event?.details?.productId || "").trim();
  if (productLabel || productId) {
    return {
      itemType: "Product",
      itemLabel: productLabel || `Product ${productId}`,
    };
  }

  const fileLabel = String(
    event?.deckTitle ||
      event?.details?.deckTitle ||
      event?.details?.presentationTitle ||
      event?.details?.fileLabel ||
      event?.details?.fileName ||
      event?.details?.filename ||
      event?.details?.deckId ||
      ""
  ).trim();
  if (fileLabel) {
    return {
      itemType: "File",
      itemLabel: fileLabel,
    };
  }

  return {
    itemType: "Other",
    itemLabel: "Unknown Item",
  };
};

const resolveLogIdentifier = (log) =>
  String(log?.user?.username || log?.user?.repId || log?.user?.email || "-").trim() || "-";

const resolveUserKey = (log) =>
  String(log?.user?.id || log?.user?.username || log?.user?.repId || log?.user?.email || "").trim();

const resolveUserLabel = (log) => {
  const name = String(log?.user?.name || "").trim();
  const identifier = resolveLogIdentifier(log);
  if (name && identifier && name.toLowerCase() !== identifier.toLowerCase()) {
    return `${name} (${identifier})`;
  }
  return name || identifier || "Unknown User";
};

const formatDayLabel = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const toDayKey = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeActionText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

const isOpenViewAction = (value) => /\b(open|opened|view|viewed)\b/.test(normalizeActionText(value));

const isClickTapAction = (value) => /\b(click|clicked|tap|tapped)\b/.test(normalizeActionText(value));

const ITEM_SERIES_COLORS = [
  "rgb(37, 99, 235)",
  "rgb(13, 148, 136)",
  "rgb(245, 158, 11)",
  "rgb(220, 38, 38)",
  "rgb(124, 58, 237)",
];

const escapeCsvCell = (value) => {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return "No data\n";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );
  const headerLine = headers.map(escapeCsvCell).join(",");
  const valueLines = rows.map((row) =>
    headers.map((header) => escapeCsvCell(row?.[header] ?? "")).join(",")
  );
  return [headerLine, ...valueLines].join("\n");
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toExcelHtml = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [
      "<!doctype html>",
      "<html><head><meta charset='UTF-8'></head><body>",
      "<table border='1'><thead><tr><th>No Data</th></tr></thead><tbody><tr><td>-</td></tr></tbody></table>",
      "</body></html>",
    ].join("");
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const headHtml = `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`;
  const bodyHtml = `<tbody>${rows
    .map(
      (row) =>
        `<tr>${headers.map((header) => `<td>${escapeHtml(row?.[header] ?? "")}</td>`).join("")}</tr>`
    )
    .join("")}</tbody>`;

  return [
    "<!doctype html>",
    "<html><head><meta charset='UTF-8'></head><body>",
    `<table border='1'>${headHtml}${bodyHtml}</table>`,
    "</body></html>",
  ].join("");
};

const downloadFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const toFileSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "all-users";

const ExportButtons = ({ filenameBase, rows }) => {
  const disabled = !Array.isArray(rows) || rows.length === 0;

  const handleExportCsv = () => {
    const csvContent = toCsv(rows);
    downloadFile(`${filenameBase}.csv`, csvContent, "text/csv;charset=utf-8;");
  };

  const handleExportExcel = () => {
    const excelHtml = toExcelHtml(rows);
    downloadFile(`${filenameBase}.xls`, excelHtml, "application/vnd.ms-excel;charset=utf-8;");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={disabled}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={handleExportExcel}
        disabled={disabled}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export Excel
      </button>
    </div>
  );
};

const ChartLoading = () => <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>;

const Line = dynamic(() => import("react-chartjs-2").then((mod) => mod.Line), {
  ssr: false,
  loading: ChartLoading,
});

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: ChartLoading,
});

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
  const [selectedUserKey, setSelectedUserKey] = useState("");
  const [error, setError] = useState(null);
  const [openLogId, setOpenLogId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let mounted = true;
    const loadLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/login-events?limit=500");
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

  const userOptions = useMemo(() => {
    const options = new Map();
    logs.forEach((log) => {
      const key = resolveUserKey(log);
      if (!key) return;
      if (!options.has(key)) {
        options.set(key, resolveUserLabel(log));
      }
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [logs]);

  const queryFilteredLogs = useMemo(() => {
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

  const tableLogs = useMemo(() => queryFilteredLogs, [queryFilteredLogs]);

  const graphLogs = useMemo(() => {
    if (!selectedUserKey) return logs;
    return logs.filter((log) => resolveUserKey(log) === selectedUserKey);
  }, [logs, selectedUserKey]);

  useEffect(() => {
    if (selectedUserKey && !userOptions.some((option) => option.value === selectedUserKey)) {
      setSelectedUserKey("");
    }
  }, [selectedUserKey, userOptions]);

  const totalPages = Math.max(1, Math.ceil(tableLogs.length / LOGS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
    setOpenLogId(null);
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
    return tableLogs.slice(startIndex, startIndex + LOGS_PER_PAGE);
  }, [currentPage, tableLogs]);

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

  const pageStart = tableLogs.length === 0 ? 0 : (currentPage - 1) * LOGS_PER_PAGE + 1;
  const pageEnd = tableLogs.length === 0 ? 0 : Math.min(currentPage * LOGS_PER_PAGE, tableLogs.length);
  const graphDayKeys = useMemo(() => {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const keys = [];
    for (let offset = 15; offset >= 0; offset -= 1) {
      const day = new Date(todayUtc);
      day.setUTCDate(todayUtc.getUTCDate() - offset);
      keys.push(day.toISOString().slice(0, 10));
    }
    return keys;
  }, []);

  const graphDayKeySet = useMemo(() => new Set(graphDayKeys), [graphDayKeys]);

  const activityChartRows = useMemo(() => {
    const rowsByDay = new Map(
      graphDayKeys.map((dayKey) => [
        dayKey,
        { sessions: 0, events: 0, openViewEvents: 0, clickTapEvents: 0 },
      ])
    );

    graphLogs.forEach((log) => {
      const sessionDayKey = toDayKey(log?.startedAt || log?.endedAt || log?.lastOccurredAt);
      if (sessionDayKey && rowsByDay.has(sessionDayKey)) {
        const sessionRow = rowsByDay.get(sessionDayKey);
        sessionRow.sessions += 1;
        rowsByDay.set(sessionDayKey, sessionRow);
      }

      (Array.isArray(log?.events) ? log.events : []).forEach((event) => {
        const eventDayKey = toDayKey(event?.occurredAt || log?.lastOccurredAt);
        if (!eventDayKey || !rowsByDay.has(eventDayKey)) return;
        const row = rowsByDay.get(eventDayKey);
        row.events += 1;
        if (isOpenViewAction(event?.action)) row.openViewEvents += 1;
        if (isClickTapAction(event?.action)) row.clickTapEvents += 1;
        rowsByDay.set(eventDayKey, row);
      });
    });

    return graphDayKeys.map((day) => ({
      day,
      ...(rowsByDay.get(day) || { sessions: 0, events: 0, openViewEvents: 0, clickTapEvents: 0 }),
    }));
  }, [graphDayKeys, graphLogs]);

  const itemBreakdownByDay = useMemo(() => {
    const openTotals = new Map();
    const clickTotals = new Map();
    const openDayCounts = new Map();
    const clickDayCounts = new Map();

    graphLogs.forEach((log) => {
      (Array.isArray(log?.events) ? log.events : []).forEach((event) => {
        const dayKey = toDayKey(event?.occurredAt || log?.lastOccurredAt);
        if (!dayKey || !graphDayKeySet.has(dayKey)) return;

        const { itemType, itemLabel } = resolveEventItem(event);
        const itemKey = `${itemType}: ${itemLabel}`;

        if (isOpenViewAction(event?.action)) {
          openTotals.set(itemKey, (openTotals.get(itemKey) || 0) + 1);
          const dayMap = openDayCounts.get(itemKey) || new Map();
          dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
          openDayCounts.set(itemKey, dayMap);
        }

        if (isClickTapAction(event?.action)) {
          clickTotals.set(itemKey, (clickTotals.get(itemKey) || 0) + 1);
          const dayMap = clickDayCounts.get(itemKey) || new Map();
          dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
          clickDayCounts.set(itemKey, dayMap);
        }
      });
    });

    const toTopItems = (totalsMap) =>
      Array.from(totalsMap.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5)
        .map(([itemKey]) => itemKey);

    return {
      topOpenItems: toTopItems(openTotals),
      topClickItems: toTopItems(clickTotals),
      openDayCounts,
      clickDayCounts,
    };
  }, [graphDayKeySet, graphLogs]);

  const otherActionsByDay = useMemo(() => {
    const totals = new Map();
    const dayCounts = new Map();

    graphLogs.forEach((log) => {
      (Array.isArray(log?.events) ? log.events : []).forEach((event) => {
        const dayKey = toDayKey(event?.occurredAt || log?.lastOccurredAt);
        if (!dayKey || !graphDayKeySet.has(dayKey)) return;
        if (isOpenViewAction(event?.action) || isClickTapAction(event?.action)) return;

        const actionKey = normalizeActionText(event?.action) || "unknown action";
        totals.set(actionKey, (totals.get(actionKey) || 0) + 1);

        const actionDayMap = dayCounts.get(actionKey) || new Map();
        actionDayMap.set(dayKey, (actionDayMap.get(dayKey) || 0) + 1);
        dayCounts.set(actionKey, actionDayMap);
      });
    });

    const topActions = Array.from(totals.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6)
      .map(([actionKey]) => actionKey);

    return {
      topActions,
      dayCounts,
    };
  }, [graphDayKeySet, graphLogs]);

  const otherActionsChartData = useMemo(
    () => ({
      labels: graphDayKeys.map((day) => formatDayLabel(day)),
      datasets: otherActionsByDay.topActions.map((actionKey, index) => {
        const dayMap = otherActionsByDay.dayCounts.get(actionKey) || new Map();
        const color = ITEM_SERIES_COLORS[index % ITEM_SERIES_COLORS.length];
        return {
          label: toActivityTitle(actionKey),
          data: graphDayKeys.map((day) => Number(dayMap.get(day) || 0)),
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1,
          stack: "other-actions",
        };
      }),
    }),
    [graphDayKeys, otherActionsByDay]
  );

  const topOpenedItemsChartData = useMemo(
    () => ({
      labels: graphDayKeys.map((day) => formatDayLabel(day)),
      datasets: itemBreakdownByDay.topOpenItems.map((itemKey, index) => {
        const dayMap = itemBreakdownByDay.openDayCounts.get(itemKey) || new Map();
        return {
          label: itemKey,
          data: graphDayKeys.map((day) => Number(dayMap.get(day) || 0)),
          backgroundColor: ITEM_SERIES_COLORS[index % ITEM_SERIES_COLORS.length],
          borderColor: ITEM_SERIES_COLORS[index % ITEM_SERIES_COLORS.length],
          borderWidth: 1,
          stack: "open-items",
        };
      }),
    }),
    [graphDayKeys, itemBreakdownByDay]
  );

  const topClickedItemsChartData = useMemo(
    () => ({
      labels: graphDayKeys.map((day) => formatDayLabel(day)),
      datasets: itemBreakdownByDay.topClickItems.map((itemKey, index) => {
        const dayMap = itemBreakdownByDay.clickDayCounts.get(itemKey) || new Map();
        return {
          label: itemKey,
          data: graphDayKeys.map((day) => Number(dayMap.get(day) || 0)),
          backgroundColor: ITEM_SERIES_COLORS[index % ITEM_SERIES_COLORS.length],
          borderColor: ITEM_SERIES_COLORS[index % ITEM_SERIES_COLORS.length],
          borderWidth: 1,
          stack: "click-items",
        };
      }),
    }),
    [graphDayKeys, itemBreakdownByDay]
  );

  const activityChartData = useMemo(
    () => ({
      labels: activityChartRows.map((row) => formatDayLabel(row.day)),
      datasets: [
        {
          label: "Open / View",
          data: activityChartRows.map((row) => Number(row.openViewEvents || 0)),
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: "rgba(37, 99, 235, 0.12)",
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: "Click / Tap",
          data: activityChartRows.map((row) => Number(row.clickTapEvents || 0)),
          borderColor: "rgb(245, 158, 11)",
          backgroundColor: "rgba(245, 158, 11, 0.12)",
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: "Total Activity",
          data: activityChartRows.map((row) => Number(row.events || 0)),
          borderColor: "rgb(13, 148, 136)",
          backgroundColor: "rgba(13, 148, 136, 0.12)",
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
        {
          label: "Sessions",
          data: activityChartRows.map((row) => Number(row.sessions || 0)),
          borderColor: "rgb(107, 114, 128)",
          backgroundColor: "rgba(107, 114, 128, 0.06)",
          borderDash: [6, 4],
          borderWidth: 2,
          fill: false,
          tension: 0.25,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    }),
    [activityChartRows]
  );

  const activityChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    }),
    []
  );

  const itemBreakdownChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    }),
    []
  );

  const selectedUserLabel = useMemo(() => {
    if (!selectedUserKey) return "All Users";
    return userOptions.find((option) => option.value === selectedUserKey)?.label || "Selected User";
  }, [selectedUserKey, userOptions]);

  const graphExportRows = useMemo(() => {
    const rows = [];

    activityChartRows.forEach((row) => {
      rows.push({
        Section: "Daily Activity Totals",
        User: selectedUserLabel,
        Day: row.day,
        OpenView: Number(row.openViewEvents || 0),
        ClickTap: Number(row.clickTapEvents || 0),
        TotalActivity: Number(row.events || 0),
        Sessions: Number(row.sessions || 0),
      });
    });

    otherActionsByDay.topActions.forEach((actionKey) => {
      const dayMap = otherActionsByDay.dayCounts.get(actionKey) || new Map();
      graphDayKeys.forEach((day) => {
        rows.push({
          Section: "Other Actions By Day",
          User: selectedUserLabel,
          Day: day,
          Action: toActivityTitle(actionKey),
          Count: Number(dayMap.get(day) || 0),
        });
      });
    });

    itemBreakdownByDay.topOpenItems.forEach((itemKey) => {
      const dayMap = itemBreakdownByDay.openDayCounts.get(itemKey) || new Map();
      graphDayKeys.forEach((day) => {
        rows.push({
          Section: "Top Opened Items By Day",
          User: selectedUserLabel,
          Day: day,
          Item: itemKey,
          Count: Number(dayMap.get(day) || 0),
        });
      });
    });

    itemBreakdownByDay.topClickItems.forEach((itemKey) => {
      const dayMap = itemBreakdownByDay.clickDayCounts.get(itemKey) || new Map();
      graphDayKeys.forEach((day) => {
        rows.push({
          Section: "Top Clicked Items By Day",
          User: selectedUserLabel,
          Day: day,
          Item: itemKey,
          Count: Number(dayMap.get(day) || 0),
        });
      });
    });

    return rows;
  }, [
    activityChartRows,
    graphDayKeys,
    itemBreakdownByDay.clickDayCounts,
    itemBreakdownByDay.openDayCounts,
    itemBreakdownByDay.topClickItems,
    itemBreakdownByDay.topOpenItems,
    otherActionsByDay.dayCounts,
    otherActionsByDay.topActions,
    selectedUserLabel,
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Activity Logs</h2>
            <p className="text-sm text-gray-600">
              One row per session. Open Activity to view the full timeline.
            </p>
          </div>
          <div className="w-full sm:w-80">
            <label htmlFor="activity-search" className="mb-1 block text-xs font-medium text-gray-600">
              Search
            </label>
            <input
              id="activity-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by user, session, action..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <div className="mb-4 text-xs text-gray-500">
          Showing <span className="font-semibold text-gray-700">{pageStart}</span>-
          <span className="font-semibold text-gray-700">{pageEnd}</span> of{" "}
          <span className="font-semibold text-gray-700">{tableLogs.length}</span> session
          {tableLogs.length === 1 ? "" : "s"} (Page {currentPage} of {totalPages})
        </div>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading activity logs...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : tableLogs.length === 0 ? (
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
                          <td className="px-4 py-3 truncate">{resolveLogIdentifier(log)}</td>
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

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:w-80">
            <label htmlFor="user-graph-filter" className="mb-1 block text-xs font-medium text-gray-600">
              User (Graph)
            </label>
            <select
              id="user-graph-filter"
              value={selectedUserKey}
              onChange={(event) => setSelectedUserKey(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="" className="text-gray-900">
                All users
              </option>
              {userOptions.map((option) => (
                <option key={option.value} value={option.value} className="text-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="self-start sm:self-auto">
            <ExportButtons
              filenameBase={`activity-logs-graph-${toFileSlug(selectedUserLabel)}`}
              rows={graphExportRows}
            />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900">Activity Logs Graph</h3>
          <p className="text-sm text-gray-600">
            Activity per day from day -15 to today, including opens/views and clicks/taps.
          </p>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Showing data for{" "}
          {selectedUserKey
            ? userOptions.find((option) => option.value === selectedUserKey)?.label || "selected user"
            : "all users"}
          .
        </p>

        {isLoading ? (
          <div className="mt-4 text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
        ) : error ? (
          <div className="mt-4 text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="mt-4">
              {activityChartRows.length === 0 ? (
                <div className="text-sm text-gray-500">No chart data available.</div>
              ) : (
                <div className="h-[340px]">
                  <Line data={activityChartData} options={activityChartOptions} />
                </div>
              )}
            </div>

            <div className="mt-6 rounded-lg border border-gray-200 p-3">
              <h4 className="text-sm font-semibold text-gray-900">
                Other Activity Actions Per Day (Excluding Open/Click)
              </h4>
              <p className="text-xs text-gray-600">
                Top non-open/click actions from day -15 to today.
              </p>
              {otherActionsByDay.topActions.length === 0 ? (
                <div className="mt-2 text-sm text-gray-500">
                  No other activity actions found for the selected user/range.
                </div>
              ) : (
                <div className="mt-2 h-[280px]">
                  <Bar data={otherActionsChartData} options={itemBreakdownChartOptions} />
                </div>
              )}
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-900">Opened/Clicked Items Per Day</h4>
              <p className="text-xs text-gray-600">
                Chart view of file/product details from activity events in the same day -15 to today range.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Top Opened / Viewed Items
                  </h5>
                  {itemBreakdownByDay.topOpenItems.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-500">No open/view item data found.</div>
                  ) : (
                    <div className="mt-2 h-[320px] 2xl:h-[360px]">
                      <Bar data={topOpenedItemsChartData} options={itemBreakdownChartOptions} />
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Top Clicked / Tapped Items
                  </h5>
                  {itemBreakdownByDay.topClickItems.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-500">No click/tap item data found.</div>
                  ) : (
                    <div className="mt-2 h-[320px] 2xl:h-[360px]">
                      <Bar data={topClickedItemsChartData} options={itemBreakdownChartOptions} />
                    </div>
                  )}
                </div>
              </div>
              {itemBreakdownByDay.topOpenItems.length === 0 && itemBreakdownByDay.topClickItems.length === 0 ? (
                <div className="mt-2 text-sm text-gray-500">No open/click item details found.</div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
