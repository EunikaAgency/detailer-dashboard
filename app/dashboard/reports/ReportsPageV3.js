"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ReportsPage from "./ReportsPageLegacy";
import ReportsPageV2 from "./v2/page";
import { REPORT_DIVISION_FILTER_OPTIONS } from "@/lib/reportDivision";
import { areReportFiltersEqual, useReportSection } from "./reportClient";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), {
  ssr: false,
  loading: () => <ChartLoading />,
});

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
  legacyOverview: {
    monthly: {
      product: [],
      person: [],
      team: [],
    },
  },
  meta: {
    monthlyTotalInteractions: 0,
    yearlyTotalInteractions: 0,
    monthlyTotalSlideViews: 0,
    monthlyTotalSlideMinutes: 0,
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
    labels: items.map((item, index) => `#${index + 1}`),
    datasets: [
      {
        label: "Interactions",
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: rgba(color, 0.92),
        borderRadius: 8,
        maxBarThickness: 24,
        fullLabels: items.map((item) => item.label),
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
          title(context) {
            const firstItem = context?.[0];
            return firstItem?.dataset?.fullLabels?.[firstItem.dataIndex] || firstItem?.label || "";
          },
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
    <div className="flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div>
      {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f4c5c]">{eyebrow}</div> : null}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

function ReportCard({ title, subtitle, children }) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChartItemLegend({ items, color }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700"
        >
          <span className="shrink-0 text-[11px] font-semibold text-slate-500">#{index + 1}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rgba(color, 0.92) }} />
          <span className="min-w-0 flex-1 break-words font-medium leading-snug" title={item.label}>
            {item.label}
          </span>
          <span className="shrink-0 font-semibold text-slate-900">{Number(item.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function MetricChartCard({ title, subtitle, items, color, isLoading }) {
  const hasData = Array.isArray(items) && items.length > 0;

  return (
    <ReportCard title={title} subtitle={subtitle}>
      {isLoading ? (
        <ChartLoading />
      ) : !hasData ? (
        <ChartEmpty />
      ) : (
        <>
          <div className="h-[420px]">
            <Bar data={buildHorizontalBarData(items, color)} options={buildHorizontalBarOptions()} />
          </div>
          <ChartItemLegend items={items} color={color} />
        </>
      )}
    </ReportCard>
  );
}

export default function ReportsPageV3() {
  const [filters, setFilters] = useState(EMPTY_REPORT.filters.selected);
  const filtersResult = useReportSection({
    endpoint: "/api/reports/dashboard-v3",
    filters,
    section: "filters",
    fallbackData: { filters: EMPTY_REPORT.filters },
  });
  const summaryResult = useReportSection({
    endpoint: "/api/reports/dashboard-v3",
    filters,
    section: "summary",
    fallbackData: { filters: EMPTY_REPORT.filters, legacyOverview: EMPTY_REPORT.legacyOverview, meta: EMPTY_REPORT.meta },
  });

  useEffect(() => {
    if (filtersResult.isLoading || filtersResult.error) return;

    const nextSelected = filtersResult.data?.filters?.selected;
    if (!nextSelected) return;

    setFilters((current) => (areReportFiltersEqual(current, nextSelected) ? current : nextSelected));
  }, [filtersResult.data, filtersResult.error, filtersResult.isLoading]);

  const monthlyProduct = summaryResult.data?.legacyOverview?.monthly?.product || [];
  const monthlyPerson = summaryResult.data?.legacyOverview?.monthly?.person || [];
  const monthlyTeam = summaryResult.data?.legacyOverview?.monthly?.team || [];

  return (
    <div className="space-y-6 pb-6">
      <ReportsPage filters={filters} onFiltersChange={setFilters} />

      <div className="relative py-4">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#0f4c5c]/25 to-transparent" />
        <div className="relative mx-auto w-fit rounded-full border border-[#0f4c5c]/15 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c] shadow-sm">
          Monthly Interaction Summary
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader
          eyebrow="Monthly Interactions"
          title="Monthly Interaction Summary"
          subtitle="Top products, PSRs, and teams by interaction count for the selected month."
        />

        {summaryResult.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {summaryResult.error}
          </div>
        ) : null}

        <div className="grid gap-4">
          <MetricChartCard
            title="Top Products by Monthly Interactions"
            subtitle="Top 20 products by interaction count."
            items={monthlyProduct}
            color={SERIES_COLORS[0]}
            isLoading={summaryResult.isLoading}
          />
          <MetricChartCard
            title="Top PSRs by Monthly Interactions"
            subtitle="Top 20 PSRs by interaction count."
            items={monthlyPerson}
            color={SERIES_COLORS[1]}
            isLoading={summaryResult.isLoading}
          />
          <MetricChartCard
            title="Top Teams by Monthly Interactions"
            subtitle="Top 20 teams by interaction count."
            items={monthlyTeam}
            color={SERIES_COLORS[2]}
            isLoading={summaryResult.isLoading}
          />
        </div>
      </div>

      <div className="relative py-4">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#0f4c5c]/25 to-transparent" />
        <div className="relative mx-auto w-fit rounded-full border border-[#0f4c5c]/15 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c] shadow-sm">
          Utilization Charts
        </div>
      </div>

      <ReportsPageV2 filters={filters} onFiltersChange={setFilters} hideHeader hideFilters />
    </div>
  );
}
