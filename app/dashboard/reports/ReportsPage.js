"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ReportsInsightsSection from "./ReportsInsightsSection";
import ReportsUtilizationSection from "./ReportsUtilizationSection";
import { getChartItemColorConfig } from "./reportColors";
import { REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS } from "@/lib/reportDivision";
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
  year: ["All"],
  month: ["All"],
  division: REPORT_DIVISION_DASHBOARD_FILTER_OPTIONS,
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
    yearOptions: FILTER_OPTIONS.year,
    monthOptions: FILTER_OPTIONS.month,
    divisionOptions: FILTER_OPTIONS.division,
    teamOptions: FILTER_OPTIONS.team,
    psrOptions: FILTER_OPTIONS.psr,
    brandOptions: FILTER_OPTIONS.brand,
    selected: {
      year: "All",
      month: "All",
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
  shareOfVoiceBrand: [],
  shareOfVoiceApp: [],
  teamRankings: [],
  repRankings: [],
  generalCountModules: [],
  generalTimeModules: [],
  brandTotalModules: [],
  movingMonthly: {
    monthKeys: [],
    rows: [],
  },
  allPerTeam: {
    labels: [],
    series: [],
  },
  divisionPerTeam: {
    labels: [],
    series: [],
  },
  specialtyCharts: [],
  slideRetentionSlides: [],
  unifiedExportRows: [],
  nationalUtilization: {
    tdShareOfVoice: [],
    cnsShareOfVoice: [],
  },
  teamUtilization: {
    perTeam: [],
    perPsr: [],
    perProduct: [],
    perSlide: [],
    averageTimePerSlide: [],
  },
  meta: {
    monthlyTotalInteractions: 0,
    yearlyTotalInteractions: 0,
    monthlyTotalSlideViews: 0,
    monthlyTotalSlideMinutes: 0,
    totalSessionsInYear: 0,
    totalInteractionsInMonth: 0,
    totalSlideViewsInMonth: 0,
    totalSlideMinutesInMonth: 0,
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

function buildHorizontalBarData(items, color, options = {}) {
  const colorConfigs = items.map((item, index) =>
    options.useItemBrandColors
      ? getChartItemColorConfig(item, index)
      : { color, borderColor: rgba(color, 1) }
  );

  return {
    labels: items.map((item, index) => `#${index + 1}`),
    datasets: [
      {
        label: "Material Open Count",
        data: items.map((item) => Number(item.value || 0)),
        backgroundColor: colorConfigs.map((config) => rgba(config.color, 0.92)),
        borderColor: colorConfigs.map((config) => config.borderColor),
        borderWidth: 1,
        borderRadius: 8,
        maxBarThickness: 28,
        fullLabels: items.map((item) => item.label),
      },
    ],
  };
}

function buildHorizontalBarOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
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
            return `Material Open Count: ${Number(context.parsed.y || 0).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          autoSkip: false,
          color: "#475569",
          font: { size: 11 },
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.18)" },
        border: { display: false },
        ticks: {
          color: "#334155",
          font: { size: 11, weight: "600" },
        },
        title: {
          display: true,
          text: "Material Open Count",
          color: "#64748b",
          font: { size: 12, weight: "600" },
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
    <section className="min-w-0 rounded-3xl border border-slate-300 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(148,163,184,0.14)] sm:p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChartItemLegend({ items, color, useItemBrandColors = false }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map((item, index) => {
        const colorConfig = useItemBrandColors ? getChartItemColorConfig(item, index) : { color };

        return (
        <div
          key={`${item.label}-${index}`}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700"
        >
          <span className="shrink-0 text-[11px] font-semibold text-slate-500">#{index + 1}</span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: rgba(colorConfig.color, 0.92) }} />
          <span className="min-w-0 flex-1 break-words font-medium leading-snug" title={item.label}>
            {item.label}
          </span>
          <span className="shrink-0 font-semibold text-slate-900">{Number(item.value || 0).toLocaleString()}</span>
        </div>
        );
      })}
    </div>
  );
}

function MetricChartCard({ title, subtitle, items, color, isLoading, useItemBrandColors = false }) {
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
            <Bar data={buildHorizontalBarData(items, color, { useItemBrandColors })} options={buildHorizontalBarOptions()} />
          </div>
          <ChartItemLegend items={items} color={color} useItemBrandColors={useItemBrandColors} />
        </>
      )}
    </ReportCard>
  );
}

export default function ReportsPageDashboard() {
  const [filters, setFilters] = useState(EMPTY_REPORT.filters.selected);
  const reportResult = useReportSection({
    endpoint: "/api/reports/dashboard",
    filters,
    section: "full",
    fallbackData: EMPTY_REPORT,
  });

  useEffect(() => {
    if (reportResult.isLoading || reportResult.error) return;

    const nextSelected = reportResult.data?.filters?.selected;
    if (!nextSelected) return;

    setFilters((current) => (areReportFiltersEqual(current, nextSelected) ? current : nextSelected));
  }, [reportResult.data, reportResult.error, reportResult.isLoading]);

  const reportData = reportResult.data || EMPTY_REPORT;
  const monthlyProduct = reportData.legacyOverview?.monthly?.product || [];
  const monthlyPerson = reportData.legacyOverview?.monthly?.person || [];
  const monthlyTeam = reportData.legacyOverview?.monthly?.team || [];

  return (
    <div className="space-y-6 pb-6">
      

      <ReportsInsightsSection
        filters={filters}
        onFiltersChange={setFilters}
        reportData={reportData}
        isLoading={reportResult.isLoading}
        error={reportResult.error}
      />

      <div className="relative py-4">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#0f4c5c]/25 to-transparent" />
        <div className="relative mx-auto w-fit rounded-full border border-[#0f4c5c]/15 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c] shadow-sm">
          Monthly Material Open Count Summary
        </div>
      </div>

      <div className="space-y-4">
        {reportResult.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {reportResult.error}
          </div>
        ) : null}

        <div className="grid gap-4">
          <MetricChartCard
            title="Products With the Highest Material Open Count"
            subtitle="Shows the top 20 products based on Material Open Count for the selected month."
            items={monthlyProduct}
            color={SERIES_COLORS[0]}
            isLoading={reportResult.isLoading}
            useItemBrandColors
          />
          <MetricChartCard
            title="Representatives With the Highest Material Open Count"
            subtitle="Shows the top 20 representatives based on Material Open Count for the selected month."
            items={monthlyPerson}
            color={SERIES_COLORS[1]}
            isLoading={reportResult.isLoading}
          />
          <MetricChartCard
            title="Teams With the Highest Material Open Count"
            subtitle="Shows the top 20 teams based on Material Open Count for the selected month."
            items={monthlyTeam}
            color={SERIES_COLORS[2]}
            isLoading={reportResult.isLoading}
          />
        </div>
      </div>

      <div className="relative py-4">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[#0f4c5c]/25 to-transparent" />
        <div className="relative mx-auto w-fit rounded-full border border-[#0f4c5c]/15 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#0f4c5c] shadow-sm">
          Material Open Count and Slide Viewing
        </div>
      </div>

      <ReportsUtilizationSection
        filters={filters}
        onFiltersChange={setFilters}
        reportData={reportData}
        isLoading={reportResult.isLoading}
        error={reportResult.error}
        hideHeader
        hideFilters
      />
    </div>
  );
}
