"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

const formatDayLabel = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  return `${weekday} - ${month} ${day}, ${year}`;
};

const formatActivityLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Unknown Action";

const LINE_COLORS = [
  "#2563eb",
  "#0d9488",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#db2777",
  "#4f46e5",
];

const CHART_LOADING_TEXT = "Loading....";

const ChartLoading = () => (
  <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
);

const Line = dynamic(() => import("react-chartjs-2").then((mod) => mod.Line), {
  ssr: false,
  loading: ChartLoading,
});

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: ChartLoading,
});

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

const ExpandCollapseIcon = ({ expanded }) => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
    <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    {expanded ? null : (
      <path d="M8 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    )}
  </svg>
);

export default function ReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activitiesByDay, setActivitiesByDay] = useState([]);
  const [activityActions, setActivityActions] = useState([]);
  const [topUsersByDay, setTopUsersByDay] = useState([]);
  const [topProductsByDay, setTopProductsByDay] = useState([]);
  const [topFilesByDay, setTopFilesByDay] = useState([]);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState(null);
  const [expandedCards, setExpandedCards] = useState({
    sessionLogs: true,
    dailyActivity: false,
    topUsers: false,
    topProducts: false,
    topFiles: false,
  });
  const selectedUserId = String(searchParams.get("userId") || "").trim();

  const toggleCard = (cardKey) => {
    setExpandedCards((previous) => ({
      ...previous,
      [cardKey]: !previous[cardKey],
    }));
  };

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      setIsUsersLoading(true);
      try {
        const response = await fetch("/api/users");
        if (!response.ok) {
          throw new Error("Failed to load users.");
        }
        const data = await response.json();
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (mounted) {
          setUsers([]);
        }
      } finally {
        if (mounted) setIsUsersLoading(false);
      }
    };
    loadUsers();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadReport = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const query = selectedUserId
          ? `?userId=${encodeURIComponent(selectedUserId)}`
          : "";
        const response = await fetch(`/api/reports/sessions-daily${query}`);
        if (!response.ok) {
          throw new Error("Failed to load session report.");
        }
        const data = await response.json();
        if (!mounted) return;

        setRows(Array.isArray(data?.rows) ? data.rows : []);
        setRange(data?.range || null);
        setTotalSessions(Number(data?.totalSessions || 0));
      } catch (err) {
        if (mounted) setError(err?.message || "Failed to load session report.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadReport();
    return () => {
      mounted = false;
    };
  }, [selectedUserId]);

  useEffect(() => {
    let mounted = true;
    const loadInsights = async () => {
      setIsInsightsLoading(true);
      setInsightsError(null);
      try {
        const response = await fetch("/api/reports/engagement-summary");
        if (!response.ok) {
          throw new Error("Failed to load engagement summary.");
        }
        const data = await response.json();
        if (!mounted) return;

        setActivitiesByDay(Array.isArray(data?.activitiesByDay) ? data.activitiesByDay : []);
        setActivityActions(Array.isArray(data?.activityActions) ? data.activityActions : []);
        setTopUsersByDay(Array.isArray(data?.topUsersByDay) ? data.topUsersByDay : []);
        setTopProductsByDay(Array.isArray(data?.topProductsByDay) ? data.topProductsByDay : []);
        setTopFilesByDay(Array.isArray(data?.topFilesByDay) ? data.topFilesByDay : []);
      } catch (err) {
        if (mounted) {
          setInsightsError(err?.message || "Failed to load engagement summary.");
        }
      } finally {
        if (mounted) setIsInsightsLoading(false);
      }
    };

    loadInsights();
    return () => {
      mounted = false;
    };
  }, []);

  const userOptions = useMemo(
    () =>
      users.map((user) => {
        const id = String(user?.id || user?._id || "").trim();
        const username = String(user?.username || "").trim();
        const name = String(user?.name || "").trim();
        const repId = String(user?.repId || "").trim();
        const primary = username || name || id || "Unknown User";
        const secondary = repId ? ` (${repId})` : "";
        return { id, label: `${primary}${secondary}` };
      }).filter((user) => Boolean(user.id)),
    [users]
  );

  const handleUserFilterChange = (nextUserId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextUserId) {
      params.set("userId", nextUserId);
    } else {
      params.delete("userId");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const chartData = useMemo(
    () => ({
      labels: rows.map((row) => formatDayLabel(row.day)),
      datasets: [
        {
          label: "Session logs",
          data: rows.map((row) => Number(row.sessions || 0)),
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: "rgba(37, 99, 235, 0.15)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        },
      ],
    }),
    [rows]
  );

  const maxDailySessions = useMemo(
    () => rows.reduce((max, row) => Math.max(max, Number(row.sessions || 0)), 0),
    [rows]
  );

  const chartOptions = useMemo(
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

  const activityBreakdownLineData = useMemo(() => {
    return {
      labels: activitiesByDay.map((row) => formatDayLabel(row.day)),
      datasets: activityActions.map((action, index) => ({
        label: formatActivityLabel(action),
        data: activitiesByDay.map((row) => Number(row?.counts?.[action] || 0)),
        borderColor: LINE_COLORS[index % LINE_COLORS.length],
        backgroundColor: LINE_COLORS[index % LINE_COLORS.length],
        borderWidth: 2,
        fill: false,
        tension: 0.25,
        pointRadius: 1.5,
        pointHoverRadius: 4,
      })),
    };
  }, [activitiesByDay, activityActions]);

  const activityBreakdownLineOptions = useMemo(
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

  const topUsersChartData = useMemo(
    () => {
      const resolveRankLabel = (rankIndex) => {
        const counts = new Map();
        topUsersByDay.forEach((row) => {
          const label = String(row?.topUsers?.[rankIndex]?.userLabel || "").trim();
          if (!label) return;
          counts.set(label, (counts.get(label) || 0) + 1);
        });
        const [mostFrequent] = Array.from(counts.entries()).sort(
          (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
        );
        return mostFrequent?.[0] || `Top ${rankIndex + 1}`;
      };

      return {
        labels: topUsersByDay.map((row) => formatDayLabel(row.day)),
        datasets: [
          {
            label: resolveRankLabel(0),
            data: topUsersByDay.map((row) => Number(row?.topUsers?.[0]?.sessions || 0)),
            backgroundColor: "rgba(37, 99, 235, 0.75)",
            borderColor: "rgb(37, 99, 235)",
            borderWidth: 1,
          },
          {
            label: resolveRankLabel(1),
            data: topUsersByDay.map((row) => Number(row?.topUsers?.[1]?.sessions || 0)),
            backgroundColor: "rgba(13, 148, 136, 0.75)",
            borderColor: "rgb(13, 148, 136)",
            borderWidth: 1,
          },
          {
            label: resolveRankLabel(2),
            data: topUsersByDay.map((row) => Number(row?.topUsers?.[2]?.sessions || 0)),
            backgroundColor: "rgba(245, 158, 11, 0.75)",
            borderColor: "rgb(245, 158, 11)",
            borderWidth: 1,
          },
        ],
      };
    },
    [topUsersByDay]
  );

  const topUsersChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            afterLabel: (context) => {
              const row = topUsersByDay[context.dataIndex];
              const rankedUser = row?.topUsers?.[context.datasetIndex];
              if (!rankedUser?.userLabel) return "User: -";
              return `User: ${rankedUser.userLabel}`;
            },
          },
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
    [topUsersByDay]
  );
  const topProductsChartData = useMemo(
    () => {
      const resolveRankLabel = (rankIndex) => {
        const counts = new Map();
        topProductsByDay.forEach((row) => {
          const label = String(row?.topProducts?.[rankIndex]?.productLabel || "").trim();
          if (!label) return;
          counts.set(label, (counts.get(label) || 0) + 1);
        });
        const [mostFrequent] = Array.from(counts.entries()).sort(
          (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
        );
        return mostFrequent?.[0] || `Top ${rankIndex + 1}`;
      };

      return {
        labels: topProductsByDay.map((row) => formatDayLabel(row.day)),
        datasets: [
          {
            label: resolveRankLabel(0),
            data: topProductsByDay.map((row) => Number(row?.topProducts?.[0]?.interactions || 0)),
            backgroundColor: "rgba(37, 99, 235, 0.75)",
            borderColor: "rgb(37, 99, 235)",
            borderWidth: 1,
          },
          {
            label: resolveRankLabel(1),
            data: topProductsByDay.map((row) => Number(row?.topProducts?.[1]?.interactions || 0)),
            backgroundColor: "rgba(13, 148, 136, 0.75)",
            borderColor: "rgb(13, 148, 136)",
            borderWidth: 1,
          },
          {
            label: resolveRankLabel(2),
            data: topProductsByDay.map((row) => Number(row?.topProducts?.[2]?.interactions || 0)),
            backgroundColor: "rgba(245, 158, 11, 0.75)",
            borderColor: "rgb(245, 158, 11)",
            borderWidth: 1,
          },
        ],
      };
    },
    [topProductsByDay]
  );
  const topProductsChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            afterLabel: (context) => {
              const row = topProductsByDay[context.dataIndex];
              const rankedProduct = row?.topProducts?.[context.datasetIndex];
              if (!rankedProduct?.productLabel) return "Product: -";
              return `Product: ${rankedProduct.productLabel}`;
            },
          },
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
    [topProductsByDay]
  );
  const topFilesChartData = useMemo(
    () => {
      const resolveRankLabel = (rankIndex) => {
        const counts = new Map();
        topFilesByDay.forEach((row) => {
          const label = String(row?.topFiles?.[rankIndex]?.fileLabel || "").trim();
          if (!label) return;
          counts.set(label, (counts.get(label) || 0) + 1);
        });
        const [mostFrequent] = Array.from(counts.entries()).sort(
          (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
        );
        return mostFrequent?.[0] || `Top ${rankIndex + 1}`;
      };

      return {
        labels: topFilesByDay.map((row) => formatDayLabel(row.day)),
        datasets: [
          {
            label: resolveRankLabel(0),
            data: topFilesByDay.map((row) => Number(row?.topFiles?.[0]?.interactions || 0)),
            backgroundColor: "rgba(37, 99, 235, 0.75)",
            borderColor: "rgb(37, 99, 235)",
            borderWidth: 1,
          },
          {
            label: resolveRankLabel(1),
            data: topFilesByDay.map((row) => Number(row?.topFiles?.[1]?.interactions || 0)),
            backgroundColor: "rgba(13, 148, 136, 0.75)",
            borderColor: "rgb(13, 148, 136)",
            borderWidth: 1,
          },
          {
            label: resolveRankLabel(2),
            data: topFilesByDay.map((row) => Number(row?.topFiles?.[2]?.interactions || 0)),
            backgroundColor: "rgba(245, 158, 11, 0.75)",
            borderColor: "rgb(245, 158, 11)",
            borderWidth: 1,
          },
        ],
      };
    },
    [topFilesByDay]
  );
  const topFilesChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            afterLabel: (context) => {
              const row = topFilesByDay[context.dataIndex];
              const rankedFile = row?.topFiles?.[context.datasetIndex];
              if (!rankedFile) return "File: -";
              const fileLabel = rankedFile.fileLabel || "Unknown File";
              const openCount = Number(rankedFile.openCount || 0);
              const clickCount = Number(rankedFile.clickCount || 0);
              return `File: ${fileLabel} | Open: ${openCount} | Click: ${clickCount}`;
            },
          },
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
    [topFilesByDay]
  );

  const totalActivities = useMemo(
    () => activitiesByDay.reduce((sum, row) => sum + Number(row?.total || 0), 0),
    [activitiesByDay]
  );
  const hasTopUserSessions = useMemo(
    () =>
      topUsersByDay.some((row) =>
        Array.isArray(row?.topUsers)
          ? row.topUsers.some((entry) => Number(entry?.sessions || 0) > 0)
          : false
      ),
    [topUsersByDay]
  );
  const hasTopProductInteractions = useMemo(
    () =>
      topProductsByDay.some((row) =>
        Array.isArray(row?.topProducts)
          ? row.topProducts.some((entry) => Number(entry?.interactions || 0) > 0)
          : false
      ),
    [topProductsByDay]
  );
  const hasActivityBreakdown = useMemo(
    () =>
      activityActions.some((action) =>
        activitiesByDay.some((row) => Number(row?.counts?.[action] || 0) > 0)
      ),
    [activitiesByDay, activityActions]
  );
  const hasTopFileInteractions = useMemo(
    () =>
      topFilesByDay.some((row) =>
        Array.isArray(row?.topFiles)
          ? row.topFiles.some((entry) => Number(entry?.interactions || 0) > 0)
          : false
      ),
    [topFilesByDay]
  );
  const sessionExportRows = useMemo(
    () =>
      rows.map((row) => ({
        Day: row.day || "",
        SessionLogs: Number(row?.sessions || 0),
      })),
    [rows]
  );
  const activitiesExportRows = useMemo(
    () =>
      activitiesByDay.map((row) => {
        const actionColumns = activityActions.reduce((acc, action) => {
          acc[formatActivityLabel(action)] = Number(row?.counts?.[action] || 0);
          return acc;
        }, {});
        return {
          Day: row.day || "",
          ...actionColumns,
          Total: Number(row?.total || 0),
        };
      }),
    [activitiesByDay, activityActions]
  );
  const topUsersExportRows = useMemo(
    () =>
      topUsersByDay.map((row) => ({
        Day: row.day || "",
        Top1User: row?.topUsers?.[0]?.userLabel || "",
        Top1Sessions: Number(row?.topUsers?.[0]?.sessions || 0),
        Top2User: row?.topUsers?.[1]?.userLabel || "",
        Top2Sessions: Number(row?.topUsers?.[1]?.sessions || 0),
        Top3User: row?.topUsers?.[2]?.userLabel || "",
        Top3Sessions: Number(row?.topUsers?.[2]?.sessions || 0),
      })),
    [topUsersByDay]
  );
  const topProductsExportRows = useMemo(
    () =>
      topProductsByDay.map((row) => ({
        Day: row.day || "",
        Top1Product: row?.topProducts?.[0]?.productLabel || "",
        Top1Interactions: Number(row?.topProducts?.[0]?.interactions || 0),
        Top2Product: row?.topProducts?.[1]?.productLabel || "",
        Top2Interactions: Number(row?.topProducts?.[1]?.interactions || 0),
        Top3Product: row?.topProducts?.[2]?.productLabel || "",
        Top3Interactions: Number(row?.topProducts?.[2]?.interactions || 0),
      })),
    [topProductsByDay]
  );
  const topFilesExportRows = useMemo(
    () =>
      topFilesByDay.map((row) => ({
        Day: row.day || "",
        Top1File: row?.topFiles?.[0]?.fileLabel || "",
        Top1Interactions: Number(row?.topFiles?.[0]?.interactions || 0),
        Top1Open: Number(row?.topFiles?.[0]?.openCount || 0),
        Top1Click: Number(row?.topFiles?.[0]?.clickCount || 0),
        Top2File: row?.topFiles?.[1]?.fileLabel || "",
        Top2Interactions: Number(row?.topFiles?.[1]?.interactions || 0),
        Top2Open: Number(row?.topFiles?.[1]?.openCount || 0),
        Top2Click: Number(row?.topFiles?.[1]?.clickCount || 0),
        Top3File: row?.topFiles?.[2]?.fileLabel || "",
        Top3Interactions: Number(row?.topFiles?.[2]?.interactions || 0),
        Top3Open: Number(row?.topFiles?.[2]?.openCount || 0),
        Top3Click: Number(row?.topFiles?.[2]?.clickCount || 0),
      })),
    [topFilesByDay]
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900">Logs and Reports</h2>
        <p className="text-sm text-gray-600 mt-1">
          Daily session log count from day -30 up to today.
          {range?.timezone ? ` Timezone: ${range.timezone}.` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600">Total Sessions in Range</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{isLoading ? "-" : totalSessions}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600">Highest Daily Sessions</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{isLoading ? "-" : maxDailySessions}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div
          className={`flex items-center justify-between gap-3${
            expandedCards.sessionLogs ? " mb-4" : ""
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-900">Session Logs</h3>
          <button
            type="button"
            onClick={() => toggleCard("sessionLogs")}
            aria-expanded={expandedCards.sessionLogs}
            aria-label={expandedCards.sessionLogs ? "Collapse Session Logs" : "Expand Session Logs"}
            aria-controls="session-logs-card-content"
            className="inline-flex h-6 w-6 items-center justify-center text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <ExpandCollapseIcon expanded={expandedCards.sessionLogs} />
          </button>
        </div>

        {expandedCards.sessionLogs ? (
          <div id="session-logs-card-content">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-md">
                <label
                  htmlFor="session-report-user-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filter by User
                </label>
                <select
                  id="session-report-user-filter"
                  value={selectedUserId}
                  onChange={(event) => handleUserFilterChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={isUsersLoading}
                >
                  <option value="">All users</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ))}
                </select>
              </div>
              <ExportButtons
                filenameBase={
                  selectedUserId
                    ? `session-logs-daily-user-${selectedUserId}`
                    : "session-logs-daily-all-users"
                }
                rows={sessionExportRows}
              />
            </div>

            {isLoading ? (
              <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-gray-500">No session logs found for the selected range.</div>
            ) : (
              <div className="h-[360px]">
                <Line data={chartData} options={chartOptions} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div
          className={`flex items-center justify-between gap-3${
            expandedCards.dailyActivity ? " mb-4" : ""
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-900">Daily Activity Count (All Users)</h3>
          <button
            type="button"
            onClick={() => toggleCard("dailyActivity")}
            aria-expanded={expandedCards.dailyActivity}
            aria-label={
              expandedCards.dailyActivity
                ? "Collapse Daily Activity Count"
                : "Expand Daily Activity Count"
            }
            aria-controls="daily-activity-card-content"
            className="inline-flex h-6 w-6 items-center justify-center text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <ExpandCollapseIcon expanded={expandedCards.dailyActivity} />
          </button>
        </div>

        {expandedCards.dailyActivity ? (
          <div id="daily-activity-card-content">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm text-gray-600">
                Each line represents one activity action, with daily counts from day -30 to today.
              </p>
              <ExportButtons filenameBase="activities-daily-all-users" rows={activitiesExportRows} />
            </div>
            <div className="mb-4 text-sm text-gray-700">
              Total activities:{" "}
              <span className="font-semibold">{isInsightsLoading ? "-" : totalActivities}</span>
            </div>
            {isInsightsLoading ? (
              <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
            ) : insightsError ? (
              <div className="text-sm text-red-600">{insightsError}</div>
            ) : !hasActivityBreakdown ? (
              <div className="text-sm text-gray-500">No activities found for the selected range.</div>
            ) : (
              <div className="h-[380px]">
                <Line data={activityBreakdownLineData} options={activityBreakdownLineOptions} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div
          className={`flex items-center justify-between gap-3${expandedCards.topUsers ? " mb-4" : ""}`}
        >
          <h3 className="text-lg font-semibold text-gray-900">Top 3 Active Users Per Day (All Users)</h3>
          <button
            type="button"
            onClick={() => toggleCard("topUsers")}
            aria-expanded={expandedCards.topUsers}
            aria-label={
              expandedCards.topUsers
                ? "Collapse Top 3 Active Users"
                : "Expand Top 3 Active Users"
            }
            aria-controls="top-users-card-content"
            className="inline-flex h-6 w-6 items-center justify-center text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <ExpandCollapseIcon expanded={expandedCards.topUsers} />
          </button>
        </div>

        {expandedCards.topUsers ? (
          <div id="top-users-card-content">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm text-gray-600">
                Per day, the top 3 users with the highest session counts from day -30 to today.
              </p>
              <ExportButtons filenameBase="top-users-daily-all-users" rows={topUsersExportRows} />
            </div>
            {isInsightsLoading ? (
              <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
            ) : insightsError ? (
              <div className="text-sm text-red-600">{insightsError}</div>
            ) : !hasTopUserSessions ? (
              <div className="text-sm text-gray-500">No session data found for the selected range.</div>
            ) : (
              <div className="h-[380px]">
                <Bar data={topUsersChartData} options={topUsersChartOptions} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div
          className={`flex items-center justify-between gap-3${
            expandedCards.topProducts ? " mb-4" : ""
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-900">
            Top 3 Products Most Visited/Clicked Per Day (All Users)
          </h3>
          <button
            type="button"
            onClick={() => toggleCard("topProducts")}
            aria-expanded={expandedCards.topProducts}
            aria-label={
              expandedCards.topProducts
                ? "Collapse Top 3 Products"
                : "Expand Top 3 Products"
            }
            aria-controls="top-products-card-content"
            className="inline-flex h-6 w-6 items-center justify-center text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <ExpandCollapseIcon expanded={expandedCards.topProducts} />
          </button>
        </div>

        {expandedCards.topProducts ? (
          <div id="top-products-card-content">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm text-gray-600">
                Per day, the top 3 products with the highest visit/click interactions from day -30 to
                today.
              </p>
              <ExportButtons filenameBase="top-products-daily-all-users" rows={topProductsExportRows} />
            </div>
            {isInsightsLoading ? (
              <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
            ) : insightsError ? (
              <div className="text-sm text-red-600">{insightsError}</div>
            ) : !hasTopProductInteractions ? (
              <div className="text-sm text-gray-500">
                No product interactions found for the selected range.
              </div>
            ) : (
              <div className="h-[380px]">
                <Bar data={topProductsChartData} options={topProductsChartOptions} />
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div
          className={`flex items-center justify-between gap-3${expandedCards.topFiles ? " mb-4" : ""}`}
        >
          <h3 className="text-lg font-semibold text-gray-900">
            Top 3 Most Visited/Open Files Per Day (Presentation Viewer)
          </h3>
          <button
            type="button"
            onClick={() => toggleCard("topFiles")}
            aria-expanded={expandedCards.topFiles}
            aria-label={
              expandedCards.topFiles
                ? "Collapse Top 3 Most Visited Open Files"
                : "Expand Top 3 Most Visited Open Files"
            }
            aria-controls="top-files-card-content"
            className="inline-flex h-6 w-6 items-center justify-center text-gray-500 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <ExpandCollapseIcon expanded={expandedCards.topFiles} />
          </button>
        </div>

        {expandedCards.topFiles ? (
          <div id="top-files-card-content">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-sm text-gray-600">
                Based on `activitylogs` where screen is `presentation-viewer`, counting open/view and
                click/tap actions per day.
              </p>
              <ExportButtons filenameBase="top-files-daily-presentation-viewer" rows={topFilesExportRows} />
            </div>
            {isInsightsLoading ? (
              <div className="text-sm text-gray-500">{CHART_LOADING_TEXT}</div>
            ) : insightsError ? (
              <div className="text-sm text-red-600">{insightsError}</div>
            ) : !hasTopFileInteractions ? (
              <div className="text-sm text-gray-500">No file interactions found for the selected range.</div>
            ) : (
              <div className="h-[380px]">
                <Bar data={topFilesChartData} options={topFilesChartOptions} />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
