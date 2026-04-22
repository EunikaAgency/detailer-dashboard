"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { REPORT_DIVISION_FILTER_OPTIONS } from "@/lib/reportDivision";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: () => <ChartLoading />,
});

const FILTERS = [
  { key: "year", label: "Year", hint: "" },
  { key: "month", label: "Month", hint: "" },
  { key: "division", label: "Division", hint: "" },
  { key: "team", label: "Team", hint: "" },
  { key: "psr", label: "Person", hint: "" },
  { key: "brand", label: "Brand", hint: "" },
];

const FILTER_OPTIONS = {
  year: [],
  month: [],
  division: REPORT_DIVISION_FILTER_OPTIONS,
  team: ["All"],
  psr: ["All"],
  brand: ["All"],
};

const SERIES_COLORS = [
  "16, 94, 118",
  "2, 132, 199",
  "217, 119, 6",
  "21, 128, 61",
  "190, 24, 93",
  "79, 70, 229",
];

const LOADING_PLACEHOLDER_TEXT = "Loading...";
const EMPTY_CHART_MESSAGE = "No data available for the selected filters.";

const EMPTY_REPORT = {
  filters: {
    yearOptions: [],
    monthOptions: [],
    divisionOptions: FILTER_OPTIONS.division,
    teamOptions: FILTER_OPTIONS.team,
    psrOptions: FILTER_OPTIONS.psr,
    brandOptions: FILTER_OPTIONS.brand,
    selected: {
      year: "",
      month: "",
      division: "All",
      team: "All",
      psr: "All",
      brand: "All",
    },
  },
  monthly: {
    product: [],
    person: [],
    team: [],
  },
  yearly: {
    product: [],
    person: [],
    team: [],
  },
  meta: {
    monthlyTotalInteractions: 0,
    yearlyTotalInteractions: 0,
  },
};

function rgba(color, alpha) {
  return `rgba(${color}, ${alpha})`;
}

function toMultilineLabel(value, maxLineLength = 24) {
  const words = String(value || "").split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const nextValue = current ? `${current} ${word}` : word;
    if (nextValue.length <= maxLineLength || !current) {
      current = nextValue;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length > 1 ? lines : String(value || "");
}

function buildHorizontalBarData(items, color) {
  return {
    labels: items.map((item) => toMultilineLabel(item.label)),
    datasets: [
      {
        label: "Interactions",
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(color, 0.92),
        borderRadius: 8,
        maxBarThickness: 26,
      },
    ],
  };
}

function buildHorizontalBarOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            return `Interactions: ${Number(context.parsed.x || 0).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.18)" },
        border: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 11 },
        },
        title: {
          display: true,
          text: "Total Interactions",
          color: "#64748b",
          font: { size: 12, weight: "600" },
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: "#334155",
          font: { size: 11, weight: "600" },
        },
      },
    },
  };
}

function ChartLoading() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center text-sm text-slate-500">
      {LOADING_PLACEHOLDER_TEXT}
    </div>
  );
}

function ChartEmpty({ message = EMPTY_CHART_MESSAGE }) {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

function FilterTile({ filterKey, label, value, options, onChange }) {
  return (
    <label className="flex min-h-[74px] flex-col justify-between rounded-2xl border border-sky-900/20 bg-sky-800 px-3 py-2.5 text-white md:min-h-[82px] md:px-4 md:py-3">
      <div className="text-[1.2rem] font-semibold leading-none md:text-[1.35rem]">{label}</div>
      <select
        value={value}
        onChange={(event) => onChange(filterKey, event.target.value)}
        className="mt-3 w-full rounded-md border border-white/30 bg-white/95 px-3 py-2 text-sm font-medium text-slate-800 outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function ReportCard({ title, subtitle, children }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChartCard({ title, subtitle, items, color, isLoading }) {
  const hasData = Array.isArray(items) && items.length > 0;

  return (
    <ReportCard title={title} subtitle={subtitle}>
      {isLoading ? (
        <ChartLoading />
      ) : !hasData ? (
        <ChartEmpty />
      ) : (
        <div className="h-[320px]">
          <Bar data={buildHorizontalBarData(items, color)} options={buildHorizontalBarOptions()} />
        </div>
      )}
    </ReportCard>
  );
}

export default function ReportsPageV2() {
  const [filters, setFilters] = useState(EMPTY_REPORT.filters.selected);
  const [reportData, setReportData] = useState(EMPTY_REPORT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadReport = async () => {
      setIsLoading(true);
      setError("");

      try {
        const searchParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) searchParams.set(key, value);
        });

        const response = await fetch(`/api/reports/dashboard-v2?${searchParams.toString()}`, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load dashboard v2 reports.");
        }

        setReportData({ ...EMPTY_REPORT, ...payload });

        const nextSelected = payload?.filters?.selected || EMPTY_REPORT.filters.selected;
        setFilters((current) => {
          const isSame =
            current.year === nextSelected.year &&
            current.month === nextSelected.month &&
            current.division === nextSelected.division &&
            current.team === nextSelected.team &&
            current.psr === nextSelected.psr &&
            current.brand === nextSelected.brand;

          return isSame ? current : nextSelected;
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error("Failed to load dashboard v2 reports:", loadError);
        setReportData(EMPTY_REPORT);
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard v2 reports.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadReport();
    return () => controller.abort();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const filterOptions = {
    year: reportData?.filters?.yearOptions?.length ? reportData.filters.yearOptions : FILTER_OPTIONS.year,
    month: reportData?.filters?.monthOptions?.length ? reportData.filters.monthOptions : FILTER_OPTIONS.month,
    division: reportData?.filters?.divisionOptions?.length ? reportData.filters.divisionOptions : FILTER_OPTIONS.division,
    team: reportData?.filters?.teamOptions?.length ? reportData.filters.teamOptions : FILTER_OPTIONS.team,
    psr: reportData?.filters?.psrOptions?.length ? reportData.filters.psrOptions : FILTER_OPTIONS.psr,
    brand: reportData?.filters?.brandOptions?.length ? reportData.filters.brandOptions : FILTER_OPTIONS.brand,
  };

  const monthlyProduct = reportData?.monthly?.product || [];
  const monthlyPerson = reportData?.monthly?.person || [];
  const monthlyTeam = reportData?.monthly?.team || [];
  const yearlyProduct = reportData?.yearly?.product || [];
  const yearlyPerson = reportData?.yearly?.person || [];
  const yearlyTeam = reportData?.yearly?.team || [];

  const scopeDetail = useMemo(() => {
    const detailParts = [];
    if (filters.division && filters.division !== "All") detailParts.push(filters.division);
    if (filters.team && filters.team !== "All") detailParts.push(filters.team);
    if (filters.psr && filters.psr !== "All") detailParts.push(filters.psr);
    if (filters.brand && filters.brand !== "All") detailParts.push(filters.brand);
    return detailParts.length > 0 ? detailParts.join(" / ") : "All divisions, teams, people, and brands";
  }, [filters.brand, filters.division, filters.psr, filters.team]);

  const monthlyScopeLabel = useMemo(() => {
    const monthLabel = filters.month === "All" ? "all months in scope" : `${filters.month} ${filters.year || ""}`.trim();
    return `Totals by selected month scope: ${monthLabel}. Filters: ${scopeDetail}.`;
  }, [filters.month, filters.year, scopeDetail]);

  const yearlyScopeLabel = useMemo(() => {
    const yearLabel = filters.year === "All" ? "all available years" : filters.year || "selected year";
    return `Totals across ${yearLabel}. Filters: ${scopeDetail}.`;
  }, [filters.year, scopeDetail]);

  return (
    <div className="space-y-6 pb-6">
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-950 via-sky-900 to-cyan-800 px-4 py-5 text-white shadow-sm sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Dashboard Reports</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Reports V2</h1>
            <p className="mt-2 max-w-3xl text-sm text-sky-100 sm:text-base">
              Focused on the six summary graphics requested: monthly and yearly totals per product, person, and team.
            </p>
          </div>
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            Open current reports
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FILTERS.map((filter) => (
          <FilterTile
            key={filter.key}
            filterKey={filter.key}
            label={filter.label}
            value={filters[filter.key]}
            options={filterOptions[filter.key] || []}
            onChange={handleFilterChange}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <StatCard label="Monthly Total Interactions" value={reportData?.meta?.monthlyTotalInteractions || 0} tone="sky" />
        <StatCard label="Yearly Total Interactions" value={reportData?.meta?.yearlyTotalInteractions || 0} />
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          {isLoading ? (
            <span>{LOADING_PLACEHOLDER_TEXT}</span>
          ) : error ? (
            <span className="text-red-600">{error}</span>
          ) : (
            <span>Totals are based on tracked dashboard interactions within the selected filters.</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Monthly Total</h2>
          <p className="mt-1 text-sm text-slate-600">{monthlyScopeLabel}</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard
            title="Monthly Total per Product"
            subtitle="Top 10 products by interaction count."
            items={monthlyProduct}
            color={SERIES_COLORS[0]}
            isLoading={isLoading}
          />
          <ChartCard
            title="Monthly Total per Person"
            subtitle="Top 10 people by interaction count."
            items={monthlyPerson}
            color={SERIES_COLORS[1]}
            isLoading={isLoading}
          />
          <ChartCard
            title="Monthly Total per Team"
            subtitle="Top 10 teams by interaction count."
            items={monthlyTeam}
            color={SERIES_COLORS[2]}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Yearly Total</h2>
          <p className="mt-1 text-sm text-slate-600">{yearlyScopeLabel}</p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <ChartCard
            title="Yearly Total per Product"
            subtitle="Top 10 products by interaction count."
            items={yearlyProduct}
            color={SERIES_COLORS[3]}
            isLoading={isLoading}
          />
          <ChartCard
            title="Yearly Total per Person"
            subtitle="Top 10 people by interaction count."
            items={yearlyPerson}
            color={SERIES_COLORS[4]}
            isLoading={isLoading}
          />
          <ChartCard
            title="Yearly Total per Team"
            subtitle="Top 10 teams by interaction count."
            items={yearlyTeam}
            color={SERIES_COLORS[5]}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
